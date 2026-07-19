# local-first-data

## Purpose

为 Todo Seed 提供可验证、可迁移、可恢复的本地优先数据基础设施，保证未联网、未登录、未配置云服务时核心功能仍完整可用，并为可选快照同步保留版本边界。

## Requirements

### Requirement: 版本化本地初始化与持久化

系统 SHALL 使用 `LocalAppEnvelope<TodoPayload>` 作为唯一正式业务快照；`appId` 固定为 `gipsy`，默认存储键为 `app:gipsy:data`。UI SHALL NOT 直接读写 LocalStorage。

#### Scenario: 首次初始化

- **WHEN** 正式存储键和旧数据均不存在
- **THEN** 系统创建 schemaVersion 2、dataVersion 1、dirty 为 false 的有效默认 Envelope

#### Scenario: 业务数据修改

- **WHEN** 用户新增、完成、恢复、删除、批量加入、导入或清空 Todo 数据
- **THEN** 系统使用 Zod 校验新 Payload，递增 dataVersion、更新 updatedAt、设置 dirty 为 true，再写入 LocalStorage

#### Scenario: 刷新恢复

- **WHEN** 页面刷新或浏览器重新打开
- **THEN** 系统从 Repository 恢复最后一次成功写入且通过 Zod 校验的 Envelope

### Requirement: 旧数据与 Schema 迁移

系统 SHALL 支持旧 `gipsy-apps` 数组和低版本 Envelope 的安全迁移；迁移失败 SHALL NOT 删除或覆盖原数据。

#### Scenario: 迁移旧应用数组

- **WHEN** 新存储键不存在且合法的 `gipsy-apps` 存在
- **THEN** 系统保留名称和 HTTP/HTTPS URL，将记录转换为 Todo，保存 legacy backup 后删除旧键

#### Scenario: 迁移低版本 Envelope

- **WHEN** 已保存 schemaVersion 1 的应用导航 Envelope
- **THEN** 系统先备份原始数据，将名称与 URL 转换为未完成 Todo，校验结果，递增 dataVersion 并标记 dirty

#### Scenario: 迁移失败或未来版本

- **WHEN** 旧数据无效、迁移链缺失或已保存 schemaVersion 高于当前版本
- **THEN** 系统拒绝覆盖原数据并提示升级应用或从备份恢复

### Requirement: JSON 导出、导入与恢复

系统 SHALL 提供不依赖 Supabase 的数据导出、导入和清空能力。

#### Scenario: 导出本地数据

- **WHEN** 用户选择导出
- **THEN** 系统下载包含格式、appId、schemaVersion、dataVersion、exportedAt 和 TodoPayload 的 JSON，且不包含 deviceId、同步状态、API Key 或认证信息

#### Scenario: 导入合法备份

- **WHEN** 用户确认导入格式和 appId 正确、可迁移且 Payload 合法的 JSON
- **THEN** Repository 先备份当前正式数据，再以高于当前和导入版本的 dataVersion 保存 Payload，并标记 dirty

#### Scenario: 下载最近本地备份

- **WHEN** 用户在覆盖操作后选择下载最近本地备份
- **THEN** Repository 将内部备份转换为可重新导入的标准导出 JSON，且不包含私密或设备信息

#### Scenario: 清空本地数据

- **WHEN** 用户二次确认清空
- **THEN** Repository 先保存最近备份，再以递增版本写入空 TodoPayload，并保持 dirty

### Requirement: 本地容量与失败反馈

系统 SHALL 计算正式快照的 UTF-8 字节数，并 SHALL 将 JSON、校验、迁移、访问和配额失败归一化为不泄露私密数据的 AppError。

#### Scenario: 容量分级

- **WHEN** 数据小于 2 MB、介于 2～4 MB、或大于 4 MB
- **THEN** 设置页分别显示正常、提醒、严重提醒，并在严重状态建议导出或升级 IndexedDB

#### Scenario: 正式数据损坏或容量不足

- **WHEN** Envelope 无法校验或浏览器抛出 QuotaExceededError
- **THEN** 系统不静默覆盖，显示明确错误、重试和恢复入口

### Requirement: BYOK 本地存储边界

ApiKeyStore SHALL 默认将用户 API Key 保存到 sessionStorage；只有用户明确选择持久化时才写入 LocalStorage。Key SHALL NOT 进入 TodoPayload、导出、云快照或日志。

#### Scenario: 临时保存或清除 Key

- **WHEN** 用户保存、持久化或清除 DeepSeek Key
- **THEN** ApiKeyStore 只操作自己前缀下且经过 Zod 校验的 Provider Key，不影响 Todo 数据

## Compatibility

- appId 发布后不得修改；从种子派生项目时必须定义新的全局唯一 appId 和对应 storageKey。
- Payload 结构变化必须递增 schemaVersion 并提供顺序迁移；schemaVersion 与 dataVersion 不得混用。
- 旧 `gipsy-apps` 只迁移一次，成功后保留 `app:gipsy:data:legacy-backup`。
