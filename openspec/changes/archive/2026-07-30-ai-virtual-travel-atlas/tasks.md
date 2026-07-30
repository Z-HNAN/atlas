# 任务：AI 虚拟旅行收藏地图首版

- [x] P0｜负责人：Codex｜依赖：现有 Local-first 基础设施｜定义 TripPayload、Trip、TravelPoint、AI 输入输出和缓存 Schema；验收：外部与持久化数据均经 Zod，重复 ID/order 被拒绝。
- [x] P0｜负责人：Codex｜依赖：Schema｜建立 `src/features/trips` Repository 与 Hooks；验收：每次修改递增 dataVersion、更新时间并设置 dirty，离线刷新不丢数据。
- [x] P0｜负责人：Codex｜依赖：旅行 Hook｜实现首页、旅行列表、新建、详情、Atlas、设置；验收：手工 CRUD、状态、到访、评分、总结形成闭环。
- [x] P0｜负责人：Codex｜依赖：Leaflet｜实现 Marker、Polyline、Popup、FitBounds、状态样式和 OSM attribution；验收：示例路线在详情与 Atlas 正确展示。
- [x] P0｜负责人：Codex｜依赖：BYOK Store｜实现 BrowserDeepSeek Provider、JSON Schema 校验和一次修复；验收：非法输出不保存，Key 不泄露。
- [x] P0｜负责人：Codex｜依赖：旅行地点 Schema｜实现 Nominatim 评分、串行队列、1.1 秒间隔、缓存、失败与歧义；验收：不是无条件取第一项，人工可确认。
- [x] P0｜负责人：Codex｜依赖：确认地点｜实现 DMS、严格 PLN XML、Blob 与 ASCII 文件名；验收：所有航点顺序和首尾正确，无额外航空字段。
- [x] P0｜负责人：Codex｜依赖：Supabase 基础｜新增旅行表、索引、触发器、owner 函数和 RLS；验收：公开只读、非 owner 写入被拒绝。
- [x] P1｜负责人：Codex｜依赖：全部功能｜添加富士山演示路线和核心单元/集成测试；验收：AI、Nominatim、DMS、PLN、Schema、本地生命周期均有测试。
- [x] P1｜负责人：Codex｜依赖：实现稳定｜更新 README、START、环境变量、PWA 元数据和 OpenSpec；验收：全部中文且可指导本地、Supabase、BYOK、PLN 和部署。
- [x] P1｜负责人：Codex｜依赖：首轮交付审计｜补齐 `/login`、Atlas PWA 图标、分享封面、完整 PLN 快照和 Supabase migration 安全契约测试；验收：生产预览核心路由与静态资源均返回 200，主规范和变更规范与实现一致。
- [ ] P0｜负责人：部署者｜依赖：Supabase 项目与真实账号｜在生产项目执行迁移、写入 owner UUID、配置 Auth 回调和部署变量；验收：真实 Magic Link、RLS 和跨设备同步通过。
- [ ] P0｜负责人：产品所有者｜依赖：MSFS 2024 与 Sky4Sim｜完成富士山—河口湖—箱根—东京湾手工端到端验收；验收：Sky4Sim 加载路线且顺序、坐标、网页记录一致。
