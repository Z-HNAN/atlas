# portal-shell

## Purpose

定义 Todo Seed 的路由、品牌、设置入口和 PWA 应用壳行为，确保纯本地模式、离线恢复和静态部署路径具有一致且可验证的用户体验。

## Requirements

### Requirement: 基础路由

应用 SHALL 提供 Todo 首页、设置页和未找到页面，并 SHALL 支持静态部署下的直接访问。

#### Scenario: 访问首页

- **WHEN** 用户访问 `/`
- **THEN** 系统渲染 Todo 新增表单、统计、过滤列表和设置入口

#### Scenario: 访问设置页

- **WHEN** 用户访问 `/settings`
- **THEN** 系统渲染 DeepSeek BYOK、可选云同步和本地数据管理区域

#### Scenario: 访问未知路径

- **WHEN** 用户访问其它前端路径
- **THEN** 系统显示未找到页面并提供返回待办首页入口

### Requirement: Todo Seed 品牌

浏览器标题和首页主标题 SHALL 使用 Todo Seed 品牌，派生项目 SHALL 替换自己的品牌配置。

#### Scenario: 打开应用

- **WHEN** 页面加载
- **THEN** 浏览器标签和首页显示 Todo Seed 品牌

### Requirement: PWA 应用壳

生产构建 SHALL 生成合法 Manifest 和 Service Worker，并 SHALL 只预缓存应用壳、图标及必要静态资源。

#### Scenario: 请求 Manifest

- **WHEN** 浏览器请求 `/manifest.webmanifest`
- **THEN** 返回 name 和 short_name 为 Todo Seed、语言为 zh-CN 的 Manifest

#### Scenario: 注册 Service Worker

- **WHEN** 应用在支持 Service Worker 的浏览器中加载生产版本
- **THEN** 系统注册生成的 Service Worker，使已访问应用可离线启动

#### Scenario: 发现新版本

- **WHEN** 新 Service Worker 已安装并等待激活
- **THEN** 系统提示用户点击刷新，不在用户操作期间静默替换页面

#### Scenario: 缓存安全边界

- **WHEN** Workbox 生成预缓存规则
- **THEN** 不缓存 API Key、自定义 Auth Token 副本、外部私密响应或无明确策略的跨域请求

### Requirement: 网络与错误反馈

应用 SHALL 为离线、存储失败和 PWA 更新提供可操作反馈，增强能力失败 SHALL NOT 隐藏或阻断本地核心页面。

#### Scenario: 网络断开

- **WHEN** 浏览器触发 offline 事件
- **THEN** 顶部显示离线提示，Todo 仍可新增、完成、过滤和删除

#### Scenario: 本地数据错误

- **WHEN** Repository 无法加载、校验或保存数据
- **THEN** 系统显示统一错误、重试和恢复入口，不静默丢弃数据

## Compatibility

- Vercel rewrite 必须允许 `/settings` 等前端路由直接打开，同时不破坏真实 PWA 静态文件。
- 云同步默认关闭；应用壳和本地 Todo 不以 Supabase 或 DeepSeek 可用为前提。
