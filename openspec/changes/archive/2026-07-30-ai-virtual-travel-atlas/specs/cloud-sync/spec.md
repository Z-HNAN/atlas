# cloud-sync

## MODIFIED Requirements

### Requirement: 旅行快照同步与乐观并发

SyncManager SHALL 使用 `TripPayload` 比较 local.dataVersion、dirty、lastRemoteVersion 和 remote.dataVersion，并 SHALL NOT 无条件 upsert 覆盖远程旅行快照。

#### Scenario: 双设备修改

- **WHEN** 本地 dirty 且远程版本高于 lastRemoteVersion
- **THEN** 系统进入人工冲突，不自动合并旅行、地点、到访或缓存

## ADDED Requirements

### Requirement: 规范化旅行表与公开读取

Supabase SHALL 提供 `trips`、`trip_points`、`geocode_cache` 和 `atlas_owners`，旅行与地点允许 anon/authenticated 公开读取，写操作 SHALL 只允许数据库注册 owner。

#### Scenario: 未登录读取

- **WHEN** anon 查询已发布旅行、地点或地理编码缓存
- **THEN** RLS 允许 SELECT，但拒绝 INSERT、UPDATE 和 DELETE

#### Scenario: 非 owner 写入

- **WHEN** 已登录但不在 atlas_owners 的用户尝试写入
- **THEN** RLS 通过 `auth.uid()` 与 `is_atlas_owner()` 拒绝操作
