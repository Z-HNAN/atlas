# Atlas 1.0.0 首版交付说明

## 交付结论

当前仓库已经从 Local-first Todo Seed 派生为可独立运行的 Atlas 虚拟旅行收藏地图。纯本地模式具备完整手工闭环；DeepSeek、Nominatim 和 Supabase 是可选网络增强。

## 已交付能力

- Dashboard、旅行列表、AI/手工创建、旅行详情、世界收藏地图、登录和设置页面。
- DeepSeek BYOK：会话存储、主动持久化、清除、JSON Output、Zod 校验和一次修复。
- Nominatim：串行队列、至少 1.1 秒间隔、国家/地区/搜索词评分、缓存、歧义与失败处理。
- 人工确认：名称、搜索词、坐标、增删、顺序、推荐理由和地图 Popup。
- 旅行记录：四种状态、地点到访、地点备注、1～10 分评分和旅行总结。
- Atlas：全部、已到访、计划中、旅行、年份和主题筛选。
- PLN：四半球 DMS、进位、严格 Custom/User XML、ASCII 文件名和浏览器下载。
- Local-first：版本化 Envelope、Zod、dataVersion、dirty、导入导出、覆盖前备份和容量提示。
- Supabase：Magic Link、乐观并发快照、人工冲突、规范化旅行表、owner RLS 和公开读取。
- PWA：Atlas 图标、离线应用壳、更新提示和分享封面。

## 自动验证证据

```text
typecheck       通过
lint            通过（0 warning）
test            16 个测试文件、44 项测试全部通过
format:check    通过
build           通过
OpenSpec        9 项当前主规范 strict 校验通过
```

生产预览已验证以下路径或资源返回 HTTP 200 与正确 Content-Type：

```text
/
/login
/atlas
/trips
/trips/new
/settings
/manifest.webmanifest
/sw.js
/og.png
```

## 仍需交付者使用真实环境验收

以下项目需要用户账号、本机软件或生产项目，仓库内自动测试无法代替：

1. 使用真实 DeepSeek Key 验证当前账号的模型权限和浏览器 CORS。
2. 在 Supabase 生产项目执行两份 migration，并写入 owner 用户 UUID。
3. 使用两个账号验证公开读取、非 owner 禁止写入和私有快照隔离。
4. 使用富士山—河口湖—箱根—东京湾路线导出 PLN，在 Sky4Sim 中核对顺序和坐标。
5. 在生产域名补齐 Supabase Auth Redirect URL。

## 交付入口

- 产品与安全说明：`README.md`
- 启动、Supabase、部署和人工验收：`START.md`
- 方案、风险与迁移：`openspec/changes/archive/2026-07-30-ai-virtual-travel-atlas/`
- 数据库与 RLS：`supabase/migrations/`
