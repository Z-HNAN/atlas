# local-first-data

## Purpose

为 Atlas 提供可验证、可迁移、可恢复的旅行数据基础设施，保证无网络、账号或 Supabase 时核心功能完整可用。

## Requirements

### Requirement: 版本化旅行 Envelope

系统 SHALL 使用 `LocalAppEnvelope<TripPayload>` 作为离线权威快照；appId SHALL 为 `atlas-travel`，正式键 SHALL 为 `app:atlas-travel:data`。

#### Scenario: 首次初始化

- **WHEN** 正式存储键不存在
- **THEN** 系统创建 schemaVersion 1、dataVersion 1、dirty false 的有效 Envelope，并包含可删除的富士山示例路线

#### Scenario: 业务修改

- **WHEN** 用户修改旅行、地点、到访、评分、缓存或导入数据
- **THEN** Repository 先校验 Payload，再递增 dataVersion、更新 updatedAt 并设置 dirty true

### Requirement: 导入、导出与恢复

系统 SHALL 导出不含 Key、认证、设备和同步状态的标准 JSON；导入、重置和云覆盖前 SHALL 自动备份。

#### Scenario: 导入有效 Atlas 数据

- **WHEN** appId、schemaVersion 和 Payload 合法
- **THEN** 系统先备份当前数据，再用更高 dataVersion 保存并标记 dirty

### Requirement: 私密数据边界

API Key、认证 Token 和设备偏好 SHALL NOT 进入 TripPayload、云快照或导出文件。

#### Scenario: 保存 DeepSeek Key

- **WHEN** 用户选择临时或持久保存
- **THEN** ApiKeyStore 只操作自己的 sessionStorage/localStorage 前缀，不修改旅行 Envelope

## Compatibility

- 旧 Todo 数据保留在 `app:gipsy:data`，Atlas 不解释、不覆盖、不删除。
- Payload 变化必须递增 schemaVersion、顺序迁移并在迁移前备份。
