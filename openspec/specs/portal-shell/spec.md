# portal-shell

## Purpose

定义 Atlas 的产品品牌、主要路由、全局导航、离线与错误反馈、PWA 安装和版本更新应用壳，保证静态部署直达、无外部配置启动和移动端访问具有一致体验。

## Requirements

### Requirement: 产品路由

应用 SHALL 提供 `/`、`/atlas`、`/trips`、`/trips/new`、`/trips/:id`、`/settings` 和未找到页面，并 SHALL 支持静态部署直达。

#### Scenario: 打开 Atlas

- **WHEN** 用户访问 `/atlas`
- **THEN** 系统显示可筛选的世界收藏地图

### Requirement: Atlas 品牌

浏览器标题、PWA Manifest、导航和首页 SHALL 使用 Atlas 虚拟旅行收藏地图品牌。

#### Scenario: 安装 PWA

- **WHEN** 浏览器读取 Manifest
- **THEN** name 为 Atlas 虚拟旅行收藏地图、short_name 为 Atlas、语言为 zh-CN

### Requirement: 网络与更新反馈

应用 SHALL 显示离线和新版本提示，增强能力失败 SHALL NOT 阻断本地页面。

#### Scenario: 网络断开

- **WHEN** 浏览器触发 offline
- **THEN** 顶部提示离线，手工编辑、记录和已有 PLN 导出继续可用

## Compatibility

- SPA 回退不得覆盖 `/sw.js`、Manifest 和构建静态文件。
