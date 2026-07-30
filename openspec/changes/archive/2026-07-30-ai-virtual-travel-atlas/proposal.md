# 提案：AI 虚拟旅行收藏地图首版

## 问题

现有 Todo Seed 已验证 Local-first、BYOK、可选 Supabase、PWA、迁移和备份能力，但参考业务无法解决 MSFS 虚拟旅行缺少目标、坐标难以定位、飞行后无法沉淀收藏记录的问题。Sky4Sim 已验证能读取只包含自定义坐标点的标准 `.pln`，因此首版无需开发 MSFS 插件、SimConnect 或实时定位。

## 产品目标

- 把种子项目派生为“AI 驱动的个人虚拟旅行收藏地图”。
- 打通“提出想法 → AI 计划 → 坐标查询 → 人工确认 → 保存 → PLN 导出 → 到访记录 → 世界地图”的最小完整闭环。
- 无网络、未登录、未配置 Supabase、未配置 DeepSeek 时，手工规划、编辑、记录、地图查看和 PLN 导出仍可使用。
- 保留 DeepSeek BYOK、可选 Supabase 快照同步、备份恢复和 PWA。
- 提供可审计的 Supabase 旅行表、RLS 与所有者授权方案。

## 非目标

- 不开发航空导航、机场航路、实时飞机位置、MSFS 插件或 Sky4Sim API。
- 不开发社区、分享、多用户协作、图片视频上传、三维地图或复杂 GIS。
- 不引入自建 Node 服务、强制 Serverless AI 代理、IndexedDB、CRDT 或复杂状态管理。

## 方案对比

### 方案 A：按需求改为 Next.js，并让 Supabase 成为核心数据源

优点是与原始技术建议完全一致，公开读取和数据库 CRUD 更直接。缺点是会丢失已完成的 Vite PWA、LocalAppEnvelope、迁移、导入导出、乐观并发同步和大量测试；无 Supabase 时也无法满足仓库强制的 Local-first 不变量。

### 方案 B：保留 Vite 种子基础设施，新增旅行 Feature，Supabase 作为可选增强

优点是保留成熟的离线、备份、冲突和 BYOK 边界，能更快形成可运行完整闭环；地图、AI、地理编码与 PLN 都是浏览器能力，不依赖 Next.js。缺点是首版云同步仍以版本化 JSON 快照为恢复通道，规范化 `trips` 与 `trip_points` 表主要用于生产公开读取和后续增量同步。

### 方案 C：同时维护本地 Payload、Supabase 快照和规范化表的实时双写

优点是兼顾全部目标。缺点是首版会出现三份权威状态、部分失败补偿、顺序更新事务和离线重放问题，明显超过个人首版范围。

## 推荐方案

采用方案 B。旅行 Payload 是离线权威数据，每次修改继续递增 `dataVersion`、更新 `updatedAt` 并标记 dirty；Supabase 关闭时不建立连接。开启后使用已有 `expectedRemoteVersion` 快照协议跨设备备份，不自动合并冲突。同时提供规范化旅行表、公开只读 RLS、所有者表和后续增量同步边界，不在首版引入不可靠双写。

## 影响

- `src/features/todos` 整体替换为 `src/features/trips`。
- 全局 `appId` 改为新的 `atlas-travel`，避免误读 Todo 正式数据。
- 新增 Leaflet/React Leaflet、旅行页面、地理编码、PLN 和测试。
- Supabase 新增 `atlas_owners`、`trips`、`trip_points`、`geocode_cache`。
- README、START、PWA 元数据、环境变量和 OpenSpec 全部切换为 Atlas。

## 迁移策略

- 不原地解释或覆盖 `app:gipsy:data`；Atlas 使用 `app:atlas-travel:data`。
- Todo 数据仍留在原存储键，可由旧版本导出；Atlas 不静默删除。
- Atlas schemaVersion 从 1 开始，后续 Payload 变化必须提供顺序迁移。
- 数据导入、重置、云端恢复和冲突覆盖前继续自动备份。
- Supabase 新迁移为追加文件，不修改既有快照表。

## 风险与待确认

- DeepSeek 浏览器直连可能因 CORS 或企业网络失败；首版显示可恢复错误，达到真实阻断后再立项薄代理。
- Nominatim 公共服务有频率和合理使用限制；首版串行、至少 1.1 秒间隔并缓存，规模扩大后需自建或更换合规服务。
- OpenStreetMap 瓦片和 DeepSeek 都依赖网络；离线时已有坐标、旅行记录和 PLN 仍可用，新瓦片与新查询不可用。
- 首次部署必须由管理员在 SQL Editor 写入所有者 UUID，否则 RLS 会拒绝所有写入。
- 规范化旅行表与 Local-first 快照首版不自动双写；需要公共线上内容时应单独实现带失败恢复的发布动作。
