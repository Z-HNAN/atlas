# local-first-data 增量规范

## MODIFIED Requirements

### Requirement: IndexedDB 正式旅行数据

系统 SHALL 通过封装在 `src/lib/local-data` 的 Dexie 适配器保存 `LocalAppEnvelope<TripPayload>`；生产环境首次初始化 SHALL NOT 从 LocalStorage 读取旧业务快照。

#### Scenario: 全新初始化

- **WHEN** IndexedDB 正式记录不存在
- **THEN** Repository 直接创建 schemaVersion 1、dataVersion 1、dirty false 的有效 Atlas 默认 Envelope

### Requirement: Schema 顺序迁移

系统 SHALL 支持 IndexedDB Envelope、导入文件和云端快照中的低版本 Payload 顺序迁移；迁移前 SHALL 备份，迁移失败 SHALL NOT 覆盖现有正式数据。

#### Scenario: 读取低版本 IndexedDB Envelope

- **WHEN** Envelope 版本低于当前版本且迁移链完整
- **THEN** Repository 先保存当前原始记录，再顺序迁移、校验并保存当前版本

#### Scenario: 导入或云端快照迁移

- **WHEN** 合法的旧版本导入文件或云端快照进入当前客户端
- **THEN** 系统通过同一迁移链校验并在覆盖本地前备份

## REMOVED Requirements

### Requirement: 旧 LocalStorage 一次性迁移

**原因**：Atlas 已完成 IndexedDB 基座升级，继续保留旧正式键读取会扩大 LocalStorage 访问面并让当前派生项目长期背负 Seed 初始化兼容代码。

**过渡**：新版本不读取、不删除残留旧键；若某个环境仍只有旧 LocalStorage 数据，应先用旧版本导出标准 JSON，再导入新版本。
