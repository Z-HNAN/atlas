# cloud-sync 增量规范

## ADDED Requirements

### Requirement: 复用 Gipsy 共享同步服务

Atlas SHALL 只通过 `https://sync.api.10242020.xyz` 使用 Gipsy 基础设施维护者部署的 Cloudflare Access、Worker 和私有 R2；Atlas 仓库和部署 SHALL NOT 创建、注册、迁移或发布独立 Worker、D1、R2、Cron 或 Access Application。

#### Scenario: Atlas 开启云备份

- **WHEN** `VITE_ENABLE_CLOUD_SYNC=true` 且 `VITE_SYNC_API_BASE_URL=https://sync.api.10242020.xyz`
- **THEN** 前端以 `appId=atlas-travel` 访问共享 API，本地核心功能不依赖服务端可用性

### Requirement: 正式 Origin 与 App 绑定

Atlas 正式 Origin SHALL 为 `https://atlas-travel.app.10242020.xyz`；浏览器访问共享同步 API 时 SHALL 只请求 `atlas-travel` 路径，并 SHALL 在身份检查 URL 中携带 `appId=atlas-travel`。

#### Scenario: 打开 Access 登录

- **WHEN** 用户在 Atlas 设置页点击 Access 登录
- **THEN** 客户端打开共享 API 的 `/api/v1/me?appId=atlas-travel`，完成后由用户返回并检查登录状态

### Requirement: 单 Head 手动云备份

每个 `appId + Access 用户` SHALL 只保留一个最新云端 Head。客户端 SHALL 只在用户点击“立即同步”“从云端恢复”或明确处理冲突时访问同步数据接口，SHALL NOT 自动后台同步或提供云端历史版本入口。

#### Scenario: 用户继续本地编辑

- **WHEN** 用户修改旅行但没有点击同步
- **THEN** IndexedDB 保存修改并保持 dirty，客户端不自动访问 Worker

#### Scenario: 覆盖云端 Head

- **WHEN** 用户基于当前 `baseVersion` 成功提交本地快照
- **THEN** 共享 Worker 覆盖该用户的 Atlas Head，旧云端正文不再提供历史读取

### Requirement: 匿名身份响应

客户端 SHALL 校验共享 Worker 返回的用户 ID 为 64 位小写十六进制匿名标识；认证 Token SHALL NOT 进入 Payload、导出、URL 参数或日志。

#### Scenario: 检查 Access 身份

- **WHEN** 共享 Worker 返回有效匿名用户 ID、邮箱和 Atlas App 条目
- **THEN** 客户端显示已登录账号并允许手动同步

## MODIFIED Requirements

### Requirement: 幂等与乐观并发

每次上传 SHALL 携带 `baseVersion`、唯一 `commitId`、deviceId、Payload Schema 版本和最终 gzip 字节 SHA-256。共享 Worker SHALL 以 R2 Head 的版本与 ETag 条件写控制竞争；客户端遇到 409 SHALL 拉取最新 Head 并进入人工冲突。

#### Scenario: 幂等重试

- **WHEN** 当前 Head 的 commitId 与 Hash 等于重试请求
- **THEN** Worker 返回原提交结果且不增加 version

#### Scenario: 双设备竞争

- **WHEN** `baseVersion` 过期或条件写竞争失败
- **THEN** 客户端保留本地数据并提供保留本地、使用云端、分别导出和取消选项，不得静默覆盖

### Requirement: 私有最新快照

客户端 SHALL 将标准快照 Envelope 序列化为 UTF-8 JSON、gzip 并校验 SHA-256；共享 Worker SHALL 返回最新 Head 的版本、commitId、Payload Schema、设备和创建时间，客户端 SHALL NOT 直连 R2。

#### Scenario: 从云端恢复

- **WHEN** 用户确认使用最新云端快照覆盖本地
- **THEN** Repository 先创建本地备份，再校验 appId、Schema 和 TripPayload 后覆盖 IndexedDB

#### Scenario: 上传期间继续编辑

- **WHEN** 快照上传尚未返回时用户产生新的本地 dataVersion
- **THEN** 旧上传成功只更新 lastCloudVersion，新修改继续保持 dirty 和 pending

## REMOVED Requirements

### Requirement: D1 元数据、成员角色与独立 Worker

**原因**：Atlas 作为派生 App 不再维护服务端资源；身份、Origin 与用户 Head 隔离由 Gipsy 共享 Worker 统一承担。

**过渡**：不迁移旧测试 D1/R2 数据；需要保留的 Atlas 数据通过旧版本导出 JSON，再由新版本导入并提交共享 Head。

### Requirement: 云端历史与清理

**原因**：共享服务只保留最新 Head，不提供版本列表、指定版本读取、Cron 或孤儿历史清理语义。

**过渡**：重要节点使用本地覆盖前备份和手工 JSON 导出。

### Requirement: 自动同步

**原因**：共享服务定位为低频、用户主动触发的备份和恢复，不在本地修改后后台上传。

**过渡**：删除已保存的同步偏好读取路径；残留 LocalStorage 偏好键不会影响运行，也不会被新版本主动删除。
