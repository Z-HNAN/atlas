# Supabase 可选云同步

Gipsy 的核心功能不依赖 Supabase。云同步默认关闭；只有设置 `VITE_ENABLE_CLOUD_SYNC=true` 且公开配置完整时，前端才动态加载 Supabase 客户端并读写同步表。

## 初始化

1. 创建 Supabase 项目并安装 Supabase CLI。
2. 将项目链接到本地目录。
3. 执行 `supabase db push` 应用 `migrations/0001_app_sync_snapshots.sql`。
4. 在 Supabase 控制台确认表已启用 RLS，并使用两个不同用户验证数据隔离。
5. 在本地或 Vercel 配置公开的 URL 和 publishable key，并把访问域名加入 Auth Redirect URLs。
6. 使用邮箱 Magic Link 登录，在设置页完成首次同步和双设备冲突验证。

完整命令、Auth URL、环境变量和上线检查见根目录 `START.md` 第 4 节。

## 安全约束

- 浏览器只能使用 publishable key 或旧项目 anon key。
- 禁止向 `VITE_` 变量写入 secret key、service role、数据库密码或 JWT secret。
- `user_id` 必须来自当前 Auth Session；URL、表单和 LocalStorage 中的用户 ID 均不可信。
- 前端隐藏按钮不构成权限控制，RLS 是最终权限边界。
- 上传更新必须同时匹配预期 `data_version`；匹配行数为零时进入冲突处理，禁止无条件 upsert 覆盖。

## 表模型

所有个人项目共用 `app_sync_snapshots`。每个用户、每个 appId 只有一行完整 JSON 快照，主键为 `(user_id, app_id)`。本架构不提供字段级合并、CRDT 或实时协作。

前端更新会过滤 `user_id`、`app_id` 和预期 `data_version`。若另一台设备抢先更新导致返回零行，Provider 会重新拉取，UI 进入人工冲突处理。
