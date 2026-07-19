# todo-list

## Purpose

提供可离线、可迁移、可同步的 Todo List 参考业务，展示个人 Web 项目常用的表单、列表、过滤、状态更新和删除模式。

## Requirements

### Requirement: Todo 数据结构

系统 SHALL 使用严格 TodoPayload 保存具有唯一 ID、标题、备注、完成状态和时间字段的待办。

#### Scenario: 校验 Todo

- **WHEN** 用户草稿标题为空或超长、用户备注超过 500 字符、ID 重复、时间格式错误或 completed/completedAt 不一致
- **THEN** Zod Schema 拒绝 Payload，Repository 不写入正式数据

### Requirement: Todo 新增与批量建议

用户 SHALL 能手工添加 Todo，并能将确认后的 DeepSeek 子任务建议一次加入列表。

#### Scenario: 手工新增

- **WHEN** 用户提交合法标题和可选备注
- **THEN** 系统生成稳定 ID 和时间，以未完成状态原子写入 Repository

#### Scenario: 加入 AI 建议

- **WHEN** DeepSeek 返回 2～6 条合法子任务且用户选择全部加入
- **THEN** 系统在一次 Repository 更新中创建对应未完成 Todo

### Requirement: Todo 状态与删除

用户 SHALL 能切换单条完成状态、删除单条并清理全部已完成任务。

#### Scenario: 标记完成或恢复

- **WHEN** 用户切换 Todo checkbox
- **THEN** completed、updatedAt 和 completedAt 保持一致并保存

#### Scenario: 删除任务

- **WHEN** 用户确认删除单条或清理全部已完成任务
- **THEN** Repository 只删除目标记录；取消确认时 Payload 不变

### Requirement: 过滤与状态

首页 SHALL 提供全部、进行中和已完成过滤及数量统计。

#### Scenario: 切换过滤

- **WHEN** 用户选择过滤条件
- **THEN** 列表只显示匹配 Todo，数据顺序和 Payload 不被过滤操作修改

#### Scenario: 空状态

- **WHEN** 没有 Todo 或当前过滤无匹配项
- **THEN** 页面显示对应空状态和可执行提示

### Requirement: 旧导航数据迁移

系统 SHALL 将 schemaVersion 1 应用列表和旧 `gipsy-apps` 数组迁移为 schemaVersion 2 TodoPayload，不静默丢失名称或 URL。

#### Scenario: 迁移版本 1 Envelope

- **WHEN** Repository 读取合法 `{ apps }` Payload
- **THEN** 先备份原 Envelope，再将每个应用转换为保留名称和 URL 的未完成 Todo

#### Scenario: 迁移旧裸数组

- **WHEN** 新存储键不存在且合法 `gipsy-apps` 存在
- **THEN** 生成有效 TodoPayload、保存 legacy backup 后删除旧键

## Compatibility

- appId 与 storageKey 保持稳定；schemaVersion 从 1 升到 2。
- 旧版本应用无法理解 TodoPayload 时必须拒绝未来版本，不得覆盖。
