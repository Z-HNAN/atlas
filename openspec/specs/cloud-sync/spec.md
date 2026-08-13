# cloud-sync

## Purpose

在不影响 Local-first 核心能力的前提下，通过 Gipsy 统一维护的 Cloudflare Access、共享 Worker 和私有 R2 单 Head，为 Atlas 提供用户主动触发的跨设备最新快照备份、恢复与人工冲突处理。

## Requirements

### Requirement: 云能力可选

系统 SHALL 默认关闭云备份；只有 `VITE_ENABLE_CLOUD_SYNC=true` 且配置公开的 `VITE_SYNC_API_BASE_URL` 时才允许用户访问共享 Worker API。云备份 SHALL NOT 成为应用初始化、本地读取或保存的依赖。

#### Scenario: 未配置云备份

- **WHEN** 开关关闭或共享 API 地址缺失
- **THEN** 本地功能完整可用，设置页显示关闭或配置缺失，应用不发起同步请求

#### Scenario: 共享服务故障

- **WHEN** Worker 超时、离线、Access 失效或没有 HTTP 响应
- **THEN** 客户端显示对应错误，IndexedDB 数据继续可用且 dirty 状态保留

### Requirement: 共享服务与部署边界

Atlas SHALL 复用 Gipsy 基础设施维护者部署的 `https://sync.api.10242020.xyz`、Cloudflare Access 和私有 R2；Atlas 仓库与部署 SHALL NOT 创建、注册、迁移或发布 Worker、D1、R2、Cron 或 Access Application。

#### Scenario: Atlas 启用云备份

- **WHEN** 正式环境开启共享云备份
- **THEN** 只设置 `VITE_APP_ID=atlas-travel`、同步开关和共享 API 公开地址，不运行服务端命令

### Requirement: 正式 Origin 与 App 隔离

Atlas 正式 Origin SHALL 为 `https://atlas-travel.app.10242020.xyz`。客户端 SHALL 只请求 `atlas-travel` 路径，并在 `/me` 请求中携带 `appId=atlas-travel`；共享 Worker SHALL 从正式 Origin 推导 appId 并拒绝 Origin 与路径不一致的请求。

#### Scenario: 同名 Atlas 请求

- **WHEN** 正式 Atlas Origin 请求 `/api/v1/apps/atlas-travel/sync/latest`
- **THEN** Worker 继续执行 Access 身份和用户 Head 隔离校验

#### Scenario: 跨 App 请求

- **WHEN** Atlas Origin 请求其它 appId 的同步路径
- **THEN** Worker 返回拒绝且不得读取其它 App 的 R2 对象

### Requirement: Access 身份与用户隔离

共享 Worker SHALL 验证 Access JWT，并从规范化邮箱派生 64 位小写十六进制匿名用户 ID。每个 Access 用户 SHALL 拥有独立 Atlas Head；R2 键、日志和同步响应 SHALL NOT 包含明文邮箱或 JWT。客户端 SHALL 校验身份响应和 Atlas App 条目。

#### Scenario: 身份检查成功

- **WHEN** `/me?appId=atlas-travel` 返回有效匿名用户 ID、邮箱与 Atlas 条目
- **THEN** 客户端显示已登录账号并允许手动同步

#### Scenario: 不同 Access 用户

- **WHEN** 两个允许登录的邮箱分别访问 Atlas
- **THEN** 两个用户只能读取和覆盖各自的 Head，不能读取彼此数据

### Requirement: 单 Head 手动同步 API

共享 Worker SHALL 在 `/api/v1` 提供 `/me?appId=atlas-travel`、head、提交和 latest 接口；每个 `appId + 用户` SHALL 只保留一个最新 Head。客户端 SHALL 只在用户主动点击同步、恢复或处理冲突时访问同步数据接口，SHALL NOT 自动后台同步或提供云端历史入口。

#### Scenario: 只修改本地

- **WHEN** 用户编辑旅行但未点击同步
- **THEN** Repository 保存 IndexedDB 并保持 dirty，客户端不自动调用 Worker

#### Scenario: 最新快照覆盖

- **WHEN** 用户基于当前云版本成功提交新快照
- **THEN** Worker 条件覆盖同一 Head，旧云端正文不再提供历史读取

### Requirement: 云版本与 Payload 版本分离

`version` SHALL 是 app/user 单调递增的云提交序号；`payloadSchemaVersion` SHALL 只描述 TripPayload；二者 SHALL NOT 与本地 `dataVersion` 混用。

#### Scenario: 本地多次修改

- **WHEN** 本地 dataVersion 增长但尚未手动提交
- **THEN** lastCloudVersion 保持不变，下一次上传以当前云 version 作为 baseVersion

### Requirement: 幂等与乐观并发

每次上传 SHALL 携带 `baseVersion`、唯一 `commitId`、deviceId、Payload Schema 版本和最终 gzip 字节 SHA-256。共享 Worker SHALL 使用 R2 Head 版本与 ETag 条件写作为提交点。

#### Scenario: 幂等重试

- **WHEN** 当前 Head 的 commitId 与 Hash 等于重试请求
- **THEN** Worker 返回原提交结果且不增加 version

#### Scenario: 版本竞争

- **WHEN** baseVersion 不等于当前 Head，或 ETag 条件写因另一请求获胜而失败
- **THEN** Worker 返回 409，客户端拉取最新 Head 并进入人工冲突，不得静默覆盖

### Requirement: 私有快照与完整性

客户端 SHALL 将标准快照 Envelope 序列化为 UTF-8 JSON、gzip，并对最终字节计算 SHA-256。共享 Worker SHALL 返回最新 Head 的版本、commitId、Payload Schema、Hash、设备和创建时间；客户端 SHALL NOT 直连 R2。

#### Scenario: 下载最新快照

- **WHEN** 合法用户请求 latest
- **THEN** 客户端校验 Hash、appId、Header、Schema 和 TripPayload，任一失败都不得覆盖本地

#### Scenario: gzip 大快照

- **WHEN** 快照字节超过浏览器 TransformStream 的内部高水位
- **THEN** 客户端并发消费 readable 与写入 writable，不得因流背压互等而挂起

### Requirement: 人工冲突与恢复

双端变化 SHALL 进入人工冲突，不自动合并或静默覆盖。客户端 SHALL 提供保留本地、使用云端、分别导出和取消四类操作，并在任何本地覆盖前创建备份。

#### Scenario: 首次上传或空本地恢复

- **WHEN** 远端不存在，或本地是初始空数据且远端存在
- **THEN** 系统分别提交本地，或先备份本地再应用远端

#### Scenario: 保留本地

- **WHEN** 用户确认以本地数据覆盖云端
- **THEN** Repository 先保存当前远端恢复备份，再以远端 version 为 baseVersion 提交本地 Head

#### Scenario: 使用云端

- **WHEN** 用户确认以云端数据覆盖本地
- **THEN** Repository 先创建本地备份，再应用经过迁移和 Zod 校验的远端 Payload

#### Scenario: 上传期间继续编辑

- **WHEN** 快照上传尚未返回时用户产生新的本地 dataVersion
- **THEN** 旧上传成功只更新 lastCloudVersion，新修改继续保持 dirty 和 pending

## Compatibility

- 当前 IndexedDB Envelope、标准导出和云快照格式不变，不提升 TripPayload schemaVersion。
- 首次连接共享 Worker 时，云 version 可从 1 重新开始；不得把旧 Atlas 独立 Worker 的 version 当作共享基线。
- 旧 D1/R2 历史不自动迁移；需要保留时先使用旧版本导出标准 JSON，再由当前版本导入并提交共享 Head。
- 共享服务只保留最新 Head；重要节点依赖本地覆盖前备份和手工 JSON 导出。
