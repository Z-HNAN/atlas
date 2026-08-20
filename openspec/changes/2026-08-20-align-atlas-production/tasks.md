# Atlas 正式身份与生产体验任务

- [ ] **P0 / Codex**：统一 `appId=atlas`、正式域名、同步路径、环境示例、当前文档和 OpenSpec；验收：当前非归档代码与文档不再把 `atlas-travel` 作为现行配置。
- [ ] **P0 / Codex**：删除应用初始化时的 Access 会话请求；验收：首页、地图和旅行页初次打开不请求 Worker，设置/登录页按钮仍可主动检查身份。
- [ ] **P1 / Codex**：将路由装配调整为支持 Blocker 的 data router，并实现旅行草稿离开保护与底部保存条；依赖：现有 Repository 保存接口；验收：站内跳转、浏览器历史、刷新/关闭均受保护，保存或明确放弃后可离开。
- [ ] **P1 / Codex**：为 Leaflet 瓦片增加加载和非阻断失败反馈；验收：首次加载有提示，错误不影响坐标与路线编辑。
- [ ] **P2 / Codex**：实现按路由变化的中文页面标题，清理英文辅助文案并修复登录页窄屏按钮换行；验收：所有现有路由标题正确且主要界面无残留英文 eyebrow/footer。
- [ ] **P1 / Codex**：为 Vercel 静态响应增加 CSP、HSTS、Referrer、nosniff、frame 和 Permissions Policy；验收：安全头存在且现有 PWA、地图和外部 Provider 白名单完整。
- [ ] **P0 / Codex**：补充 App ID、标题、未保存判断、同步按需和安全配置回归测试；验收：五项质量门禁与 OpenSpec strict 全部通过。
- [ ] **P0 / Codex**：运行 Gipsy Worker Origin/CORS 测试和线上 OPTIONS 预检；验收：Atlas 同名请求回显具体 Origin，跨 App 和相似域名被拒绝。
- [ ] **P0 / Codex**：审核差异、提交并推送 Atlas `master`，等待 Vercel 自动部署后做生产浏览器回归；验收：正式站点路由、编辑保护、地图、同步入口、控制台和安全头无阻断问题。
