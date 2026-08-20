# 设计：Atlas 正式身份与生产体验闭环

## 正式身份与共享 Worker

Atlas 使用唯一公开身份：

```text
Origin  https://atlas.app.10242020.xyz
  └── appId atlas
       └── https://sync.api.10242020.xyz/api/v1/apps/atlas/*
```

Worker 对浏览器请求解析 `Origin`，只接受 HTTPS、无显式端口、单段合法 App ID 和精确 `app.10242020.xyz` 后缀。通过后回显完整 Origin，并返回 `Access-Control-Allow-Credentials: true` 与 `Vary: Origin`；请求路径或 `/me` 查询中的 App ID 必须与 Origin 推导值一致。`ALLOWED_ORIGINS` 只服务精确 localhost/127.0.0.1 开发 Origin，不承载生产通配规则。

Atlas 不包含 Worker 源码或凭证，也不为 `atlas` 添加服务端注册。执行阶段只运行 Gipsy 的 Origin/CORS 测试并对线上 Worker 发出无业务数据的 OPTIONS 预检。

## 数据边界

`VITE_APP_ID=atlas` 会派生新的 `atlas-local` IndexedDB 和 `app:atlas:data` 记录键。用户已确认当前是调试环境且没有需迁移的线上数据，因此不实现跨 App ID 数据迁移；旧数据库不被读取或删除。

新本地 Envelope、标准导出和新云快照都必须使用 `appId=atlas`。Payload Schema 保持不变。首次连接新云端 Head 时按现有 SyncManager 流程上传版本 1 或恢复远端，不复用 `atlas-travel` 的 `lastCloudVersion`。

## 云会话按需检查

`useCloudSync` 在云能力可用时以 `signed-out` 初始化，但不在 Effect 中调用 `/me`。只有用户点击“检查登录状态”才获取身份；登录、同步、恢复和冲突处理继续由明确交互触发。网络恢复只更新已经认证会话的本地提示，不自动请求或上传。

## 未保存修改保护

旅行详情以持久化 `source` 与本地 `draft` 的内容差异派生 `isDirty`：

- React Router 使用 data router，使 `useBlocker` 可以拦截站内 Link、导航按钮和浏览器历史跳转。
- 阻塞时显示项目内确认面板，用户可留在当前页或放弃修改继续离开。
- `beforeunload` 只在 `isDirty` 时注册浏览器刷新/关闭保护。
- 页面底部显示固定保存条；保存成功且 Repository 状态刷新后自动消失。
- 当 source 在当前草稿未修改时更新，草稿跟随持久化数据；存在本地修改时不得被无关刷新覆盖。
- 删除旅行属于明确破坏性操作，确认后允许导航到列表。

## 地图加载状态

TravelMap 监听 TileLayer 的 `loading`、`load` 和 `tileerror`：

- 开始或视图变化加载瓦片时显示半透明加载提示。
- 首批瓦片完成后隐藏提示。
- 出现瓦片错误时显示非阻断错误层；后续成功加载可以恢复正常状态。
- Marker、Polyline、路线编辑和已保存坐标不依赖瓦片是否成功。

## 页面标题与文案

应用壳根据 pathname 计算中文标题；旅行详情使用当前旅行标题。未知路由使用“页面不存在 · Atlas”。标题更新集中在布局组件，避免每个页面维护重复 Effect。

英文 eyebrow 与页脚替换为中文；登录页窄屏操作按钮禁止逐字换行。产品品牌 `Atlas`、协议名、DeepSeek、Cloudflare Access、MSFS、Sky4Sim 和 OpenStreetMap 等专有名词保留。

## 安全响应头

Vercel 对所有静态响应设置：

- CSP：默认只允许同源；脚本仅同源；样式允许 Leaflet 所需内联样式；图片允许同源、data/blob 和 OpenStreetMap 瓦片；连接只允许同源、DeepSeek、Nominatim 与共享 Worker。
- `frame-ancestors 'none'`、`object-src 'none'`、`base-uri 'self'`、`form-action 'self'`。
- HSTS、nosniff、DENY frame、严格来源 Referrer Policy 和关闭相机/麦克风/定位的 Permissions Policy。

生产构建和浏览器控制台用于验证 CSP 不阻断 PWA、地图、DeepSeek、Nominatim 或云同步入口。

## 风险与恢复

- **调试数据不可见**：App ID 切换后旧库不会出现在新版本中；这是用户确认的范围，旧库仍保留以便回滚。
- **路由装配变化**：BrowserRouter 调整为 data router 以支持阻塞器；所有既有直达路由、SPA 回退和 404 必须回归。
- **草稿源刷新**：错误的 Effect 可能覆盖正在编辑的 draft；以 dirty 状态和当前旅行 ID 保护。
- **地图事件波动**：单个瓦片失败不应永久遮挡地图；错误层可随新一轮成功加载恢复。
- **CSP 过严**：通过生产构建和真实页面网络/控制台检查校准明确白名单，不允许私密凭证进入配置。
- **第三方 Cookie**：正确 CORS 仍无法绕过浏览器的第三方 Cookie 策略；设置页保留可操作说明。

## 验收标准

- 仓库当前配置、文档、测试和构建产物只使用 `atlas` 与新正式域名。
- 普通页面首次加载不请求共享 Worker；用户点击检查后才访问 `/me?appId=atlas`。
- 未保存旅行修改在站内跳转、历史导航和刷新/关闭时受到保护，保存后可正常离开。
- 地图加载和失败均有反馈，失败不阻止路线编辑。
- 路由标题、中文文案、窄屏登录按钮和 Vercel 安全头符合规范。
- Atlas 五项质量门禁、OpenSpec strict、Gipsy Worker 相关测试和生产浏览器回归全部通过。
