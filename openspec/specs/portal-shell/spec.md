# portal-shell

## Purpose

定义 Atlas 的产品品牌、主要路由、全局导航、离线与错误反馈、PWA 安装和版本更新应用壳，保证静态部署直达、无外部配置启动和移动端访问具有一致体验。

## Requirements

### Requirement: 产品路由

应用 SHALL 提供 `/`、`/login`、`/atlas`、`/trips`、`/trips/new`、`/trips/:id`、`/settings` 和未找到页面，并 SHALL 支持静态部署直达。

#### Scenario: 打开 Atlas

- **WHEN** 用户访问 `/atlas`
- **THEN** 系统显示可筛选的世界收藏地图

### Requirement: Atlas 品牌

浏览器标题、PWA Manifest、导航、首页、辅助标题和页脚 SHALL 使用 Atlas 虚拟旅行收藏地图品牌及一致中文表达。

#### Scenario: 安装 PWA

- **WHEN** 浏览器读取 Manifest
- **THEN** name 为 Atlas 虚拟旅行收藏地图、short_name 为 Atlas、语言为 zh-CN

### Requirement: 路由页面标题

应用 SHALL 根据当前路由设置中文浏览器标题，并 SHALL 在旅行详情使用当前旅行名称；未知路由使用页面不存在标题。

#### Scenario: 切换主要页面

- **WHEN** 用户在首页、世界地图、旅行、新建旅行、登录和设置之间导航
- **THEN** `document.title` 更新为对应中文页面名加 ` · Atlas`

#### Scenario: 打开旅行详情

- **WHEN** 当前旅行存在且标题为“富士山环线”
- **THEN** 浏览器标题为“富士山环线 · Atlas”

### Requirement: 中文产品文案与窄屏操作

面向用户的页面辅助标题和页脚 SHALL 使用中文，专有产品名除外；窄屏主要操作 SHALL 保持完整词组而不是逐字换行。

#### Scenario: 窄屏登录页

- **WHEN** 用户以手机宽度打开 `/login`
- **THEN** “暂不登录”保持为完整按钮文字，页头不出现横向溢出

### Requirement: 网络与更新反馈

应用 SHALL 显示离线和新版本提示，增强能力失败 SHALL NOT 阻断本地页面。

#### Scenario: 网络断开

- **WHEN** 浏览器触发 offline
- **THEN** 顶部提示离线，手工编辑、记录和已有 PLN 导出继续可用

## Compatibility

- SPA 回退不得覆盖 `/sw.js`、Manifest 和构建静态文件。
