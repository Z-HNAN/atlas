# portal-shell

## MODIFIED Requirements

### Requirement: Atlas 产品路由

应用 SHALL 提供 `/`、`/login`、`/atlas`、`/trips`、`/trips/new`、`/trips/:id`、`/settings` 和未找到页面，并 SHALL 支持静态部署直达。

#### Scenario: 访问核心路由

- **WHEN** 用户直接打开任一核心前端路径
- **THEN** 部署平台返回应用壳，由 React Router 渲染对应旅行、登录、地图或设置页面

### Requirement: Atlas 品牌与 PWA

浏览器标题、分享卡片、PWA Manifest、图标、导航和首页 SHALL 使用 Atlas 虚拟旅行收藏地图的品牌与森林绿、米色、橙色地图视觉。

#### Scenario: 安装或分享

- **WHEN** 浏览器读取 Manifest 或社交爬虫读取 Open Graph 元数据
- **THEN** 返回 Atlas 名称、描述、图标和专用分享图片，不出现 Todo 品牌

### Requirement: 网络与错误反馈

应用 SHALL 为离线、存储失败和 PWA 更新提供可操作反馈，外部增强失败 SHALL NOT 阻断本地旅行页面。

#### Scenario: 网络断开

- **WHEN** 浏览器触发 offline 事件
- **THEN** 顶部显示离线提示，已有旅行编辑、记录和 PLN 导出继续可用
