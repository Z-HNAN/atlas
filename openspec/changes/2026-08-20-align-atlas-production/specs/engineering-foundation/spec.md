# engineering-foundation 增量规范

## ADDED Requirements

### Requirement: Vercel 静态安全响应头

Vercel SHALL 为应用路由和静态响应设置 CSP、HSTS、Referrer-Policy、X-Content-Type-Options、X-Frame-Options 和 Permissions-Policy。CSP SHALL 默认限制为同源，并只放行 Atlas 当前需要的 OpenStreetMap 瓦片、DeepSeek、Nominatim 和共享 Worker 端点。

#### Scenario: 请求正式页面

- **WHEN** 浏览器加载 Atlas 正式页面
- **THEN** 响应禁止被嵌入 frame、禁止 object、限制来源泄露和不需要的设备能力，并允许现有 PWA 与明确外部能力运行

#### Scenario: 外部资源不在白名单

- **WHEN** 页面代码尝试加载未声明的脚本、图片或连接端点
- **THEN** 浏览器 CSP 阻止该资源且应用不得通过通配来源绕过限制

## MODIFIED Requirements

### Requirement: Vercel 静态部署

项目 SHALL 使用 `npm run build` 生成 `dist`，为 React Router 配置 SPA 回退，并为全部响应提供明确安全头。

#### Scenario: 前端路由直达

- **WHEN** Vercel 收到 `/settings` 等非静态文件路径请求
- **THEN** 请求回退到 `/index.html` 并由 React Router 处理，同时保留安全响应头

#### Scenario: PWA 静态文件

- **WHEN** 请求 `/sw.js`、`/manifest.webmanifest` 或 `/assets/*`
- **THEN** 部署平台返回真实构建文件，而不是错误页面
