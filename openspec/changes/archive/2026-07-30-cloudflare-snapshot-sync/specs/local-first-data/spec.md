# local-first-data 增量规范

## MODIFIED Requirements

### Requirement: IndexedDB 是正式旅行数据主存储

系统 SHALL 将 `LocalAppEnvelope<TripPayload>` 保存到 IndexedDB；LocalStorage SHALL 只作为旧正式快照迁移源、设备偏好和 BYOK 持久化存储。

#### Scenario: 旧 Atlas 快照迁移

- **WHEN** IndexedDB 为空且旧 LocalStorage 正式键存在
- **THEN** Repository 先保存原始备份，再校验并写入 IndexedDB；成功后删除旧正式键，失败时保留原数据

### Requirement: 异步持久化与版本

Repository 读写 SHALL 可等待并顺序执行。业务修改 SHALL 递增 dataVersion、更新 updatedAt、设置 dirty 和 pending，并清空上一提交 ID。

#### Scenario: 连续修改

- **WHEN** 页面在前一次写入结束前发起下一次业务修改
- **THEN** Repository 按顺序保存，两次修改均保留且 dataVersion 分别递增

### Requirement: IndexedDB 容量反馈

系统 SHALL 计算正式快照 UTF-8 字节数；达到 10 MB 提醒导出，超过 18 MB 严重提醒。

#### Scenario: 超过容量阈值

- **WHEN** 正式记录达到 10 MB 或超过 18 MB
- **THEN** 设置页分别显示 warning 或 critical 提示，并保留导出入口
