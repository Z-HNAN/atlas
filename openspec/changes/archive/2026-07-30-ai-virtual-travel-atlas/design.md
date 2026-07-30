# 设计：AI 虚拟旅行收藏地图首版

## 背景与现状

现有仓库是 Vite 5、React 18、严格 TypeScript 的 Local-first PWA。通用层已经提供 Zod Envelope、备份迁移、导入导出、容量提示、BYOK Store、Supabase Magic Link、乐观并发快照和冲突处理。旅行首版继续复用这些基础设施，只替换业务 Feature 和 UI。

## 总体架构

```text
React / Vite PWA
├── trips Feature
│   ├── Schema / 类型 / Repository
│   ├── DeepSeekTravelPlannerProvider
│   ├── NominatimGeocoder + SerialGeocodeQueue
│   └── DMS / PLN
├── LocalAppEnvelope<TripPayload>（离线权威）
├── Leaflet + OpenStreetMap（地图展示）
└── 可选 Supabase
    ├── Auth + 乐观并发快照
    └── 规范化旅行表与公开只读 RLS
```

页面与组件不得直接操作 LocalStorage、sessionStorage 或 Supabase 表。业务修改统一经过 `useTrips` 和 Repository；第三方请求统一经过 Provider。

## 目录结构

```text
src/
├── app/                         应用装配与路由
├── components/
│   ├── layout/                  Atlas 壳与导航
│   ├── map/                     Leaflet 地图
│   ├── trips/                   旅行卡片
│   └── settings/                云同步设置
├── features/trips/
│   ├── hooks/                   旅行、AI、云同步用例
│   ├── pln/                     DMS 与 PLN
│   ├── providers/               DeepSeek 与 Nominatim
│   ├── repository/              Local-first Repository 配置
│   ├── schemas/                 所有持久化与外部响应 Schema
│   └── types/                   从 Schema 推导的类型
├── lib/                         通用本地数据、同步、Supabase、错误
└── pages/                       Dashboard、Trips、Detail、Atlas、Settings
```

## 数据模型

`TripPayload` 只包含 `trips` 和 `geocodeCache`。API Key、认证 Token、设备偏好不进入 Payload。

旅行状态为 `draft → planned → in_progress → completed`。非草稿必须至少有两个地点且所有地点为 `resolved`；完成状态必须有 `completedAt`。地点经纬度必须成对存在，状态为 `resolved` 时必须有合法坐标。

AI 计划与持久化 Trip 分离：AI 只生成名称、理由、顺序和 `searchQuery`；创建草稿时为每个地点生成本地 UUID，坐标保持空值并等待查询。

## DeepSeek BYOK

- Key 默认保存到 sessionStorage，只有用户主动勾选才写入 LocalStorage。
- `DeepSeekTravelPlannerProvider` 使用 JSON Output，外层响应和内层计划分别 Zod 校验。
- 支持去除单层 Markdown JSON 代码块。
- 第一次模型输出校验失败时，将截断后的错误输出作为修复上下文重试一次；第二次失败向用户显示错误。
- 401/402/403、429、5xx、超时、取消、离线、CORS 和非法响应转换为不包含 Key 的 AppError。

## Nominatim 与人工确认

- 查询包含 `searchQuery`、地区和国家。
- 结果按国家命中、地区命中、搜索词命中和 importance 评分，不无条件使用数组第一项。
- 第一、第二候选分数过近时标记 `ambiguous`，必须由用户确认。
- 批量请求进入单一串行队列，相邻开始时间至少 1100ms。
- `queryKey` 归一化后缓存到 `TripPayload.geocodeCache`；命中缓存不发请求。
- 用户可修改名称、搜索词、坐标、删除、添加和调整顺序；任何路线结构修改都退回草稿。

## 地图

地图使用 Leaflet、React Leaflet 和 OpenStreetMap 标准瓦片。Marker 使用顺序数字，已到访为橙色、计划中为灰色。Polyline 根据旅行状态使用实线或虚线。地图自动 FitBounds，并始终显示 OSM attribution。地图只做预览和选择，不提供导航。

## PLN

PLN 在浏览器中生成 UTF-8 XML 和 Blob，不上传服务器。模板只包含需求验证通过的字段；每个航点固定 `id="Custom"`、`ATCWaypointType=User`、`SpeedMaxFP=-1`。第一点和最后一点分别进入 DepartureLLA 与 DestinationLLA。DMS 支持四个半球、两位小数秒和 60 秒/60 分进位。文件名只允许 ASCII，中文标题无法转写时回退 `virtual-trip`。

## Supabase 与 RLS

- `atlas_owners` 由管理员通过 SQL 写入用户 UUID，客户端没有读取或写入权限。
- `is_atlas_owner()` 是安全定义函数，只向 authenticated 开放执行。
- `trips`、`trip_points`、`geocode_cache` 对 anon/authenticated 公开 SELECT。
- INSERT/UPDATE/DELETE 只允许 `is_atlas_owner()`，旅行 `created_by` 必须等于 `auth.uid()`。
- `trip_points` 写入还必须验证父旅行属于当前用户。
- 浏览器只使用 Project URL 与 Publishable Key；secret、service role 和数据库密码不得出现。

## 失败与恢复

- AI、地理编码、地图瓦片或 Supabase 失败不得阻断本地手工旅行和已解析路线。
- 持久化前必须通过 Zod，失败时不覆盖原数据。
- 导入、重置、云恢复和冲突覆盖前自动备份。
- 云更新必须携带 expectedRemoteVersion，零行更新转为冲突。
- 旅行删除必须用户确认；删除本地旅行不自动删除历史备份。

## 风险与权衡

- 保留 Vite 而非迁移 Next.js，换取已验证的 Local-first 能力和更低迁移风险；未来代理需求仍可通过独立 Edge Function 或部署平台函数实现。
- 不做 Local/Snapshot/Normalized 三向双写，避免离线补偿和部分事务；公共发布能力独立立项。
- 使用公共 Nominatim 适合个人低频场景，不适合批量或商业高并发。
- LocalStorage 在数 MB 后不适合继续扩张；首版不含图片，达到 4MB 严重阈值后评估 IndexedDB。

## 验收标准

- 未联网、未登录、未配置 Supabase 时能手工创建、确认、记录、筛选和导出 PLN。
- AI 非法输出不写入，Key 不进入 Payload、导出、URL、日志或 Supabase。
- 批量地理编码串行且缓存，失败和歧义可人工修正。
- Atlas 可按到访、旅行、年份、主题筛选并自动缩放。
- PLN 单元测试覆盖四半球、边界、进位、模板字段、首尾和顺序。
- 全部 typecheck、lint、test、format:check、build 通过。
