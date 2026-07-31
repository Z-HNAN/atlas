# cloud-sync

## Purpose

在不影响 Local-first 核心能力的前提下，通过 Cloudflare Access、Worker、D1 元数据和私有 R2 不可变快照，为 Atlas 提供可选团队身份、跨设备备份、历史版本和人工冲突处理。

## Requirements

### Requirement: 云能力可选

系统 SHALL 默认关闭云同步；只有 `VITE_ENABLE_CLOUD_SYNC=true` 且配置公开的 `VITE_SYNC_API_BASE_URL` 时才调用 Worker API。

#### Scenario: 未配置云同步

- **WHEN** 开关关闭或 Worker 地址缺失
- **THEN** 本地功能完整可用，设置页显示关闭或配置缺失，应用不发起同步请求

### Requirement: Cloudflare Access 身份与成员授权

Worker SHALL 从 `Cf-Access-Jwt-Assertion` 验证 Access JWT 的签名、issuer、audience、exp、nbf 和类型，并 SHALL 只允许预配置 active 用户和 App 成员访问。

#### Scenario: 首次绑定内部用户

- **WHEN** 有效 Access 身份无法按 sub 命中、但规范化邮箱命中 active 预配置用户
- **THEN** Worker 绑定该 sub；系统不得自动注册公开用户

#### Scenario: 非成员或只读成员提交

- **WHEN** 用户不是 App 成员，或 readonly 成员上传快照
- **THEN** Worker 分别拒绝访问或拒绝写入，前端按钮隐藏不作为权限边界

### Requirement: 通用版本化快照 API

Worker SHALL 在 `/api/v1` 提供 `/me`、head、提交、latest、版本列表和指定版本接口；前端 SHALL 只通过统一 `BrowserHttpClient` 访问 Worker 云数据并携带 credentials。

#### Scenario: 获取最新快照

- **WHEN** 合法成员请求 latest
- **THEN** Worker 从 D1 读取当前元数据，从私有 R2 读取字节并返回版本、Hash 和 Payload Schema Header

#### Scenario: Worker 请求失败

- **WHEN** Worker 请求超时、离线或未收到 HTTP 响应
- **THEN** 系统显示对应错误，本地数据继续可用且 dirty 状态保留

### Requirement: 云版本与 Payload 版本分离

`version` SHALL 是 app/user 单调递增的云提交序号；`payloadSchemaVersion` SHALL 只描述 TripPayload；两者 SHALL NOT 与本地 `dataVersion` 混用。

#### Scenario: 本地业务多次修改

- **WHEN** 本地 dataVersion 增长但尚未创建新的云提交
- **THEN** lastCloudVersion 保持不变，下一次上传以当前云 version 作为 baseVersion

### Requirement: 幂等提交与竞争控制

每次上传 SHALL 携带 `baseVersion`、唯一 `commitId`、deviceId、Payload Schema 版本和最终字节 SHA-256。Worker SHALL 先条件写 R2，再用 D1 条件 INSERT 提交元数据。

#### Scenario: 正常提交

- **WHEN** baseVersion 等于当前 head 且对象和 Hash 合法
- **THEN** Worker 创建下一个 version，在 D1 记录元数据并返回新 head

#### Scenario: Payload Schema 不匹配

- **WHEN** 上传的 payloadSchemaVersion 与 D1 中 App 当前版本不一致
- **THEN** Worker 在写入 R2 前返回 422，客户端提示升级或迁移且保留本地 dirty

#### Scenario: 并发竞争

- **WHEN** D1 条件提交发现 baseVersion 已过期
- **THEN** Worker 删除本次新写 R2 对象并返回 409；若竞争赢家是同 commitId 和同 Hash，则返回原提交

#### Scenario: 不确定网络重试

- **WHEN** 客户端未收到上传响应后以同 commitId 和同 Hash 重试
- **THEN** Worker 返回原提交，不创建重复版本；相同 commitId 配不同 Hash 返回 409

### Requirement: 私有 R2 对象

R2 SHALL 保持私有，客户端不得直连；对象键 SHALL 由服务端生成且不得包含邮箱、JWT、PII 或客户端路径。

#### Scenario: 生成对象键

- **WHEN** Worker 创建版本
- **THEN** 使用 `v1/apps/{app_id}/users/{user_id}/snapshots/{10位补零version}-{commit_id}.bin`

### Requirement: 客户端同步与人工冲突

客户端 SHALL 把标准快照 Envelope 序列化为 UTF-8 JSON、gzip，并对最终字节计算 SHA-256。双端变化 SHALL 进入人工冲突，不自动合并或静默覆盖。

#### Scenario: 首次上传或恢复

- **WHEN** 远端不存在，或本地是初始空数据且远端存在
- **THEN** 系统分别提交本地，或先备份本地再应用远端

#### Scenario: 双侧修改

- **WHEN** 本地 dirty 且远端 version 高于 lastCloudVersion
- **THEN** 系统提供保留本地并提交新版本、使用云端、分别导出和取消四类操作

#### Scenario: 自动同步

- **WHEN** 自动同步开启且本地 dirty、在线、Access 已认证、无冲突并稳定 3 秒
- **THEN** 系统尝试同步；失败保留 dirty、commitId 和手动重试入口

#### Scenario: 上传期间继续编辑

- **WHEN** 快照上传尚未返回时用户产生新的本地 dataVersion
- **THEN** 旧上传成功只更新 lastCloudVersion，新修改继续保持 dirty 和 pending，等待下一次提交

### Requirement: 版本保留与孤儿清理

系统 SHALL 默认保留每位用户每个 App 最近 50 个有效版本，最新版本不得删除；定时任务 SHALL 先删除 R2 对象，再软删除 D1 元数据，并清理 24 小时前的孤儿对象。

#### Scenario: 执行保留任务

- **WHEN** 有超过保留上限的旧版本
- **THEN** Worker 排除 latest，成功删除对应 R2 后将 D1 记录标记为删除；R2 删除失败时保留元数据供下次重试

## Compatibility

- 云同步关闭、Worker 不可用、Access 过期或上传失败时，本地读取和保存不得受影响。
- 远端 Payload 必须通过同一本地迁移链和 Zod Schema；未来 Payload Schema 不得静默覆盖。
- 旧 Supabase 云数据不自动迁移；需要保留时使用旧版本导出标准 JSON，再由当前版本导入并提交新快照。
