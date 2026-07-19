# portal-shell

## Purpose

记录默认应用壳从外部应用导航门户切换到 Todo Seed 的页面与 PWA 品牌变化。

## Requirements

### Requirement: Todo 首页与设置路由

应用 SHALL 只保留 Todo 首页、设置页和未找到页面，不再处理 appName、returnUrl 或外部应用启动协议。

#### Scenario: 访问首页

- **WHEN** 用户访问 `/`
- **THEN** 系统直接显示 Todo 新增、统计、过滤和列表交互

#### Scenario: 访问设置页

- **WHEN** 用户访问 `/settings`
- **THEN** 系统显示 DeepSeek BYOK、可选云同步和本地数据管理

### Requirement: Todo Seed PWA 品牌

浏览器标题、首页和 Manifest SHALL 使用 Todo Seed 品牌，PWA 图标 SHALL 使用待办勾选语义。

#### Scenario: 生产构建

- **WHEN** 构建 PWA
- **THEN** Manifest name、short_name 和描述指向 Todo Seed，Service Worker 继续只缓存应用壳与静态资源

### Requirement: 离线核心功能

Todo 页面 SHALL 不依赖 Supabase 或 DeepSeek 才能渲染和修改本地数据。

#### Scenario: 网络断开

- **WHEN** 浏览器离线
- **THEN** 顶部提示离线，Todo 新增、完成、过滤和删除继续可用

## Compatibility

- `/settings` 静态部署回退和 PWA 更新提示保持兼容。
- 旧导航查询参数不再触发跳转，只按普通首页地址处理。
