# Atlas · AI 虚拟旅行收藏地图

Atlas 是一个面向 Microsoft Flight Simulator 2024 的个人虚拟旅行规划与收藏工具。它把一句旅行想法变成可确认的地点路线，导出 Sky4Sim 能读取的 `.pln`，并记录到访、评分和旅行总结。

它不是航空导航软件，也不是 MSFS 插件。MSFS 是探索方式，Sky4Sim 是飞行过程中的地图工具，Atlas 负责规划、收藏与记录。

## 首版能力

- AI 旅行计划：DeepSeek BYOK、结构化 JSON、Zod 校验、一次修复重试
- 地点坐标：Nominatim 串行查询、1.1 秒间隔、匹配评分、本地缓存、歧义人工确认
- 旅行管理：草稿、已计划、旅行中、已完成；地点到访与备注；1～10 分和总结
- 地图：Leaflet + OpenStreetMap、编号 Marker、路线、Popup、FitBounds
- 世界收藏：按到访、旅行、年份、主题筛选
- PLN：严格 Custom/User 航点模板、DMS、UTF-8、ASCII 文件名、浏览器本地下载
- Local-first：无网络、无登录、无 Supabase、无 DeepSeek Key 时手工核心功能完整可用
- 可选云同步：Supabase Magic Link、乐观并发快照、冲突不自动覆盖
- PWA、JSON 导入导出、覆盖前自动备份、容量提示

## 快速启动

要求 Node.js 22。

```bash
npm ci
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:5173`。不创建 `.env.local` 也能使用纯本地模式；首次启动包含一条富士山到东京湾的可删除示例路线。

可选登录入口为 `/login`；未登录仍可完整使用本地功能。

完整的 Supabase、Auth、RLS、Vercel、BYOK、Sky4Sim 和 OpenSpec 操作见 [START.md](./START.md)。

## 核心使用流程

```text
描述旅行想法
→ DeepSeek 生成地点与顺序
→ Nominatim 查询真实坐标
→ 在地图上人工确认
→ 确认旅行计划
→ 导出 MSFS / Sky4Sim PLN
→ 在 MSFS 中探索
→ 手工标记到访
→ 评分与总结
→ Atlas 点亮世界地图
```

没有 DeepSeek Key 时，可以从“创建旅行 → 手工创建”建立空白草稿，再逐个添加地点。

## 数据与安全

正式本地数据位于 `app:atlas-travel:data`，结构是 `LocalAppEnvelope<TripPayload>`：

```text
LocalAppEnvelope
├── appId / schemaVersion / dataVersion
├── updatedAt / deviceId
├── payload
│   ├── trips[]
│   └── geocodeCache[]
└── sync.dirty / lastRemoteVersion / lastSyncedAt
```

- 页面不直接操作 LocalStorage、sessionStorage 或 Supabase 表。
- 所有持久化和外部响应先通过 Zod。
- 每次业务修改递增 dataVersion、更新时间并标记 dirty。
- API Key 默认只进入 sessionStorage；主动选择后才写入 LocalStorage。
- API Key、认证 Token 和设备偏好不进入 Payload、导出或云快照。
- Supabase 默认关闭；浏览器只能使用 Project URL 与 Publishable Key。
- 禁止在浏览器配置 secret、service role、数据库密码或项目共享 DeepSeek Key。

旧 Todo Seed 数据位于 `app:gipsy:data`。Atlas 使用全新 appId，不读取、不覆盖也不删除旧数据。

## 环境变量

```env
VITE_APP_ID=atlas-travel
VITE_ENABLE_CLOUD_SYNC=false
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_OWNER_USER_ID=
VITE_DEEPSEEK_BASE_URL=https://api.deepseek.com
VITE_DEEPSEEK_MODEL=deepseek-v4-pro
VITE_NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
```

`VITE_OWNER_USER_ID` 只用于部署文档和前端提示预留，RLS 不信任它；真正写权限来自数据库 `atlas_owners` 与 `auth.uid()`。

## Supabase

迁移文件：

- `0001_app_sync_snapshots.sql`：Local-first 跨设备快照与乐观并发
- `0002_atlas_travel.sql`：`trips`、`trip_points`、`geocode_cache`、公开读取和 owner 写入 RLS

执行迁移后，管理员必须在 Supabase SQL Editor 注册 owner：

```sql
insert into public.atlas_owners (user_id)
values ('你的 Supabase Auth 用户 UUID');
```

首版应用的跨设备恢复仍使用版本化快照，避免本地、快照、规范化表三向静默双写。规范化表为公开只读与后续显式发布流程提供安全基础；该取舍记录在 OpenSpec。

## PLN 与 Sky4Sim

只有至少两个地点且全部坐标已确认时才能导出。Atlas 在浏览器生成 `.pln`，不会上传或自动操作用户电脑。

1. 在旅行详情点击“导出 MSFS / Sky4Sim PLN”。
2. 将下载文件移动到 Sky4Sim 可读取的目录。
3. 在 Sky4Sim 的 Flight Plan 页面加载文件。
4. 检查编号、顺序和路线后在 MSFS 中目视探索。

模板只生成 `Custom` / `User` 航点和 `SpeedMaxFP=-1`，不会添加机场、航空航路、巡航高度或 `FPType`。

## 测试与交付

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run format:check
npm run build
```

自动测试覆盖旅行 Schema、DeepSeek 修复、Nominatim 匹配与缓存、Local-first 生命周期、DMS 四半球/边界/进位，以及严格 PLN 模板。

真实服务仍需人工验收：

- 使用真实 DeepSeek Key 验证浏览器直连与账号模型权限；
- 使用两个 Supabase 账号验证 RLS 和冲突；
- 用“富士山 → 河口湖 → 箱根 → 东京湾”在 Sky4Sim 加载 PLN。

## 目录

```text
src/app                     应用装配与路由
src/components/map          Leaflet 地图
src/components/trips        旅行展示组件
src/features/trips          Schema、Repository、Hook、Provider、PLN
src/lib/local-data          Envelope、迁移、备份、导入导出
src/lib/api-keys            BYOK Key Store
src/lib/sync                云厂商无关的同步协议
src/lib/supabase            按需 Supabase 客户端与 Auth
tests                       单元与集成测试
openspec                    中文主规范与归档变更
supabase/migrations         数据库与 RLS
```

## 首版范围外

不包含 MSFS 插件、SimConnect、实时定位、自动到访、航空导航、Sky4Sim API、图片视频、社区分享、多用户协作、三维地图、语音、付费 GIS、自建后端或强制 AI 代理。
