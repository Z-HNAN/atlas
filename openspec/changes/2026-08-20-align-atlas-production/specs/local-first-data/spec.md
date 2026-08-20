# local-first-data 增量规范

## MODIFIED Requirements

### Requirement: IndexedDB 正式旅行数据

系统 SHALL 通过封装在 `src/lib/local-data` 的 Dexie 适配器，将 `LocalAppEnvelope<TripPayload>` 保存到 IndexedDB 数据库 `atlas-local` 的 `records` Object Store；appId SHALL 为 `atlas`，正式记录键 SHALL 为 `app:atlas:data`。Feature 和 UI SHALL NOT 直接依赖 Dexie。

#### Scenario: 首次初始化

- **WHEN** `atlas` IndexedDB 正式记录不存在
- **THEN** 系统创建 schemaVersion 1、dataVersion 1、dirty false 的有效 Envelope，并包含可删除的富士山示例路线

#### Scenario: 存储记录类型无效

- **WHEN** Dexie 适配器读取到非字符串记录
- **THEN** 系统返回 `DATA_VALIDATION_FAILED`，不得把无效值交给 Repository 解析

#### Scenario: 业务修改

- **WHEN** 用户修改旅行、地点、到访、评分、缓存或导入数据
- **THEN** Repository 先校验 Payload，再递增 dataVersion、更新 updatedAt、设置 dirty true 和 syncStatus pending，并清空上一提交 ID

## Compatibility

- `atlas-travel` 调试 IndexedDB 和记录键不迁移、不读取也不删除；回滚旧调试版本时仍可访问旧库。
- TripPayload Schema 和顺序迁移链保持不变。
