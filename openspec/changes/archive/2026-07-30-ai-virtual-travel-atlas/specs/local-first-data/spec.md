# local-first-data

## MODIFIED Requirements

### Requirement: 版本化 Atlas 初始化与持久化

系统 SHALL 使用 `LocalAppEnvelope<TripPayload>` 作为离线权威业务快照；appId SHALL 为 `atlas-travel`，默认存储键 SHALL 为 `app:atlas-travel:data`。UI SHALL NOT 直接读写 LocalStorage。

#### Scenario: 首次初始化与业务修改

- **WHEN** Atlas 首次启动或用户修改旅行、地点、记录或缓存
- **THEN** Repository 创建或更新经过 Zod 校验的 Envelope，并在修改时递增 dataVersion、更新时间和设置 dirty

### Requirement: Todo 数据兼容隔离

Atlas SHALL 使用新的 appId 和存储键，不得解释、覆盖或删除旧 Todo Seed 的 `app:gipsy:data`。

#### Scenario: 同一浏览器存在旧 Todo

- **WHEN** Atlas 首次启动且旧 Todo 数据存在
- **THEN** Atlas 仍创建独立旅行 Envelope，旧数据保持原样

### Requirement: JSON 导入、导出与恢复

系统 SHALL 提供不依赖 Supabase 的旅行导出、导入、重置和最近备份下载，且 SHALL 在覆盖前自动备份。

#### Scenario: 导出旅行

- **WHEN** 用户导出 Atlas 数据
- **THEN** 文件包含版本化 TripPayload，不包含 deviceId、同步状态、API Key 或认证信息
