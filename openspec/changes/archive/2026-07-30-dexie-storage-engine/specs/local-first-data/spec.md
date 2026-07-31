# local-first-data 增量规范

## MODIFIED Requirements

### Requirement: IndexedDB 正式旅行数据

系统 SHALL 通过封装在 `src/lib/local-data` 的 Dexie 适配器，将 `LocalAppEnvelope<TripPayload>` 保存到 IndexedDB 数据库 `atlas-travel-local` 的 `records` Object Store；appId SHALL 为 `atlas-travel`，正式记录键 SHALL 为 `app:atlas-travel:data`。Feature 和 UI SHALL NOT 直接依赖 Dexie。

#### Scenario: 新项目首次初始化

- **WHEN** IndexedDB 正式记录不存在且没有可迁移旧数据
- **THEN** Dexie 创建键值 Object Store，Repository 写入通过 Zod 校验的默认 Envelope

#### Scenario: 存储记录类型无效

- **WHEN** 适配器读取到非字符串记录
- **THEN** 系统返回 `DATA_VALIDATION_FAILED`，不得把无效值交给 Repository 解析
