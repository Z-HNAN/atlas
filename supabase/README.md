# Atlas Supabase 配置

Atlas 的核心旅行功能不依赖 Supabase。只有设置 `VITE_ENABLE_CLOUD_SYNC=true` 且公开配置完整时，前端才按需加载 Supabase。

## 迁移

按顺序执行：

1. `migrations/0001_app_sync_snapshots.sql`
2. `migrations/0002_atlas_travel.sql`

第一份提供私有、按用户隔离的 Local-first JSON 快照和乐观并发。第二份提供 `trips`、`trip_points`、`geocode_cache` 规范化表，以及公开读取、仅 owner 写入的 RLS。

## 注册 owner

先在 Supabase Auth 创建自己的账号，然后仅在 SQL Editor 执行：

```sql
insert into public.atlas_owners (user_id)
values ('YOUR_AUTH_USER_UUID');
```

`atlas_owners` 不向浏览器开放。RLS 通过 `is_atlas_owner()` 与 `auth.uid()` 判断，不信任前端环境变量或请求参数。

## 安全边界

- 浏览器只能使用 Project URL 与 Publishable Key。
- 禁止使用 secret、service role、数据库密码或 JWT secret。
- `app_sync_snapshots` 仅允许用户操作自己的 `(user_id, app_id)`。
- 快照更新必须匹配预期 `data_version`；零行更新进入冲突。
- `trips`、`trip_points`、`geocode_cache` 可公开读取，仅 owner 可写。
- 前端隐藏按钮不构成权限控制，RLS 才是最终边界。

完整 Auth URL、双账号 RLS、部署和冲突验收见根目录 `START.md`。
