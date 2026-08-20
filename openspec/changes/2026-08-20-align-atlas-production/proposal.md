# 对齐 Atlas 正式域名并修复生产体验提案

## 背景

Atlas 已部署到 `https://atlas.app.10242020.xyz`，Vercel 公开环境变量也已将 App ID 调整为 `atlas`，但仓库默认配置、文档和同步测试仍使用 `atlas-travel`。这会造成正式 Origin、客户端请求路径和共享 Worker 推导出的 App ID 不一致。生产巡检还发现应用启动会主动检查 Access 会话、旅行详情编辑容易在离开页面时丢失、地图首次加载缺少反馈、路由标题固定、部分页面保留英文辅助文案，以及 Vercel 静态响应缺少明确安全头。

Gipsy 公用 Worker 已按照 `https://<appId>.app.10242020.xyz` 校验正式 Origin、推导 App ID、回显具体 Origin，并拒绝跨 App 路径；线上 Atlas 预检也已返回正确 CORS 响应。因此本次不复制、不修改或重新部署 Worker，只修复 Atlas 客户端与生产配置，并执行 Worker 回归验证。

## 目标

- 将 Atlas 的正式 App ID、域名、同步路径和当前文档统一为 `atlas` 与 `https://atlas.app.10242020.xyz`。
- 保持云同步为默认关闭、用户主动触发的增强能力；应用初始化和普通路由不自动请求 Worker。
- 在旅行详情存在未保存修改时保护站内跳转、浏览器前进后退、刷新和关闭，并提供持续可见的保存入口。
- 为 OpenStreetMap 瓦片增加加载与失败反馈，不影响本地路线编辑。
- 为主要路由设置中文页面标题，清理残留英文辅助文案并修复窄屏按钮换行。
- 为 Vercel 静态站点增加与现有外部能力兼容的安全响应头。

## 非目标

- 不迁移 `atlas-travel` IndexedDB、导出文件或云端 Head；当前仍处于调试阶段，线上没有需保留的正式数据。
- 不删除旧 `atlas-travel` 浏览器数据库；回滚旧版本时仍可读取旧调试数据。
- 不修改 TripPayload Schema、PLN 格式、DeepSeek/Nominatim 协议或地图 Marker 的无障碍命名。
- 不新增独立 Worker、D1、R2、Access Application、自动同步、云端历史或多用户协作。
- 不为每个派生 App 增加 Worker 环境变量或服务端注册记录。

## 方案对比

### 方案一：Worker 返回 `Access-Control-Allow-Origin: *.app.10242020.xyz`

- 优点：表面配置简单。
- 缺点：该响应值不是浏览器支持的子域通配形式；带 credentials 的同步请求也不能使用 `*`，并会丢失 Origin 与 App ID 的隔离关系。
- 结论：不采用。

### 方案二：Worker 校验正式域名后回显具体 Origin

- 优点：兼容 Access Cookie；可从域名前缀推导 App ID，并拒绝 Origin 与路径不一致的请求；派生 App 无需服务端注册。
- 缺点：必须严格校验协议、端口、后缀、App ID 格式和跨 App 路径。
- 结论：采用；Gipsy Worker 与线上环境已经实现，本次只做回归验证。

### 方案三：继续保留 `atlas-travel` App ID 并为新域名增加特殊映射

- 优点：不改变旧调试存储键。
- 缺点：域名与 App ID 不再遵循统一规则，Worker 需要永久维护例外，后续派生项目容易重复出现配置漂移。
- 结论：不采用。

## 影响范围

- 环境配置、IndexedDB 数据库名/记录键、同步 Provider 测试与生产文档。
- `src/lib/sync` 的会话检查生命周期和设置页提示。
- React Router 装配、旅行详情草稿保护、地图加载状态和页面标题。
- 全局样式、中文文案、`vercel.json` 安全响应头。
- cloud-sync、portal-shell、travel-planning、atlas-map、engineering-foundation 主规范。

## 兼容、发布与回滚

1. 新版本直接以 `appId=atlas` 使用 `atlas-local` 与 `app:atlas:data`；不读取、不迁移也不删除 `atlas-travel` 调试库。
2. 新 App ID 对应新的云端 Head，首次同步版本从 1 开始；旧调试 Head 不迁移。
3. 先完成 Atlas 单元测试、生产构建和 Worker CORS 回归，再推送 Atlas `master` 触发 Vercel 部署。
4. 若新版本失败，可回滚 Atlas 提交；旧调试库仍存在，Worker 无需回滚。
5. CSP 若阻断现有必要资源，优先修正规则并重新部署，不通过关闭全部 CSP 规避。
