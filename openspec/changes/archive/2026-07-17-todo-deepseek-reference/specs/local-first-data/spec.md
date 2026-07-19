# local-first-data

## Purpose

记录本次参考业务从应用导航 Payload 升级到 TodoPayload 时，本地优先基础设施的版本变化与恢复要求。

## Requirements

### Requirement: Todo Envelope v2

系统 SHALL 使用 `LocalAppEnvelope<TodoPayload>` 作为唯一正式业务快照，保持 `appId=gipsy` 和 `app:gipsy:data` 稳定，并将当前 schemaVersion 提升为 2。

#### Scenario: 首次初始化

- **WHEN** 正式键和旧数据都不存在
- **THEN** Repository 创建 schemaVersion 2、dataVersion 1、dirty 为 false 的空 TodoPayload

#### Scenario: Todo 业务修改

- **WHEN** 用户新增、完成、恢复、删除、批量加入、导入或清空 Todo
- **THEN** Repository 校验 Payload、递增 dataVersion、更新 updatedAt 并标记 dirty

### Requirement: 导航数据安全迁移

系统 SHALL 在覆盖前备份 schemaVersion 1 Envelope，并 SHALL 将旧应用名称和 URL 保留到 Todo。

#### Scenario: 迁移版本 1 Envelope

- **WHEN** 读取合法 `{ apps }` Payload
- **THEN** 复用旧 ID，生成未完成 Todo，标题保留可展示名称，备注保留完整旧名称和 URL

#### Scenario: 迁移失败

- **WHEN** 旧数据无效、迁移链缺失或目标 Payload 校验失败
- **THEN** 系统拒绝写入，原正式数据与覆盖前备份保持可恢复

### Requirement: 导出与 Key 隔离

Todo 导入导出 SHALL 继续使用标准种子格式；DeepSeek Key SHALL NOT 进入 Payload、导出或云快照。

#### Scenario: 导出 Todo

- **WHEN** 用户导出当前数据或最近本地备份
- **THEN** JSON 只包含可迁移的业务 Payload 和版本元数据，不包含 Key、Token、deviceId 或同步状态

## Compatibility

- schemaVersion 1 到 2 必须只有一条顺序迁移路径。
- 旧 `gipsy-apps` 成功迁移前必须保留原字符串，成功后保存 legacy backup。
