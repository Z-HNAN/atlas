# pwa-support

## 规范目标
- 门户支持 PWA（manifest + service worker）。
- 门户资源可离线启动，并能提示用户刷新以升级到新版本。

## 功能与行为

### 要求：提供 manifest
- **当** 浏览器请求 `/manifest.webmanifest`
- **则** 返回合法 manifest，包含 name/short_name、icons、start_url、display、theme/background color

### 要求：注册 service worker
- **当** 门户在支持 service worker 的浏览器中首次加载
- **则** 尝试注册 service worker

### 要求：离线可启动
- **当** 用户离线打开已安装应用或访问门户
- **则** 门户 Shell 可使用预缓存资源渲染基础界面

### 要求：可提示更新
- **当** 检测到新版本 service worker 已就绪
- **则** 门户向用户展示“可刷新更新”的提示，并提供刷新操作

### 约束：默认不做运行时缓存
- 门户默认只做构建产物的预缓存，不应对运行时请求做额外缓存策略（除非明确配置）。
