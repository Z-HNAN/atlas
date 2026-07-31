# local-first-data

## Purpose

为 Atlas 提供可验证、可迁移、可恢复的 IndexedDB 旅行数据基础设施，保证无网络、账号或同步服务时核心功能完整可用。

## Requirements

### Requirement: IndexedDB 正式旅行数据

系统 SHALL 通过封装在 `src/lib/local-data` 的 Dexie 适配器，将 `LocalAppEnvelope<TripPayload>` 保存到 IndexedDB 数据库 `atlas-travel-local` 的 `records` Object Store；appId SHALL 为 `atlas-travel`，正式记录键 SHALL 为 `app:atlas-travel:data`。Feature 和 UI SHALL NOT 直接依赖 Dexie。

#### Scenario: 首次初始化

- **WHEN** IndexedDB 正式记录不存在且没有可迁移旧数据
- **THEN** 系统创建 schemaVersion 1、dataVersion 1、dirty false 的有效 Envelope，并包含可删除的富士山示例路线

#### Scenario: 存储记录类型无效

- **WHEN** Dexie 适配器读取到非字符串记录
- **THEN** 系统返回 `DATA_VALIDATION_FAILED`，不得把无效值交给 Repository 解析

#### Scenario: 业务修改

- **WHEN** 用户修改旅行、地点、到访、评分、缓存或导入数据
- **THEN** Repository 先校验 Payload，再递增 dataVersion、更新 updatedAt、设置 dirty true 和 syncStatus pending，并清空上一提交 ID

### Requirement: 旧 LocalStorage 一次性迁移

LocalStorage SHALL NOT 继续作为正式业务数据存储；它只可作为旧正式记录迁移源、设备偏好或 BYOK 持久化存储。

#### Scenario: 迁移旧 Atlas 快照

- **WHEN** IndexedDB 为空且旧 `app:atlas-travel:data` 存在
- **THEN** Repository 在 IndexedDB 保存原始迁移备份，校验和迁移 Payload，写入正式记录后才删除旧键

#### Scenario: 迁移失败

- **WHEN** 旧数据无法读取、校验、迁移或写入
- **THEN** 系统返回明确错误，保留旧正式键且不得创建损坏的新正式记录

### Requirement: 异步持久化与并发顺序

Repository 读写 SHALL 返回可等待的 Promise，并 SHALL 将并发业务修改串行化，IndexedDB 事务完成后才报告成功。

#### Scenario: 连续修改

- **WHEN** 页面在前一次写入完成前发起下一次写入
- **THEN** Repository 按提交顺序应用修改，每次 dataVersion 恰好递增一次且不丢失数据

### Requirement: 导入、导出与恢复

系统 SHALL 导出不含 Key、认证、deviceId 和同步状态的标准 JSON；导入、重置、迁移和云覆盖前 SHALL 自动备份。

#### Scenario: 导入有效 Atlas 数据

- **WHEN** appId、schemaVersion 和 Payload 合法
- **THEN** 系统先备份当前数据，再用更高 dataVersion 保存并标记 dirty

#### Scenario: 导入未来版本或其它 App

- **WHEN** 导入文件来自其它 appId 或 schemaVersion 高于当前版本
- **THEN** 系统拒绝覆盖并保留现有数据

### Requirement: 容量反馈

系统 SHALL 以正式记录的 UTF-8 字节数提供容量反馈。

#### Scenario: 接近或超过建议容量

- **WHEN** 正式记录达到 10 MB 或超过 18 MB
- **THEN** 设置页分别显示 warning 或 critical 提示，并保留导出入口

### Requirement: 私密数据边界

API Key、Access JWT 和设备偏好 SHALL NOT 进入 TripPayload、云快照或标准导出。

#### Scenario: 保存 DeepSeek Key

- **WHEN** 用户选择临时或持久保存
- **THEN** ApiKeyStore 只操作自己的 sessionStorage/LocalStorage 前缀，不修改旅行 Envelope

## Compatibility

- 旧 Todo 数据位于其它 appId，Atlas 不解释、不覆盖、不删除。
- Payload 变化必须递增 schemaVersion、提供顺序迁移并在迁移前备份。
- 旧同步字段 `lastRemoteVersion` 和 `lastSyncedAt` 只在读取兼容层转换为当前字段，不再写回。
