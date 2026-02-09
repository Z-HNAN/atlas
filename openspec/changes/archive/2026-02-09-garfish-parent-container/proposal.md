## Why

需要一个基于 React 的 Garfish 父容器，用于快速集成和管理多个子应用。当前缺少统一的管理入口和简易接入方式，影响多应用的集成效率与体验。

## What Changes

- 新增一个基于 React 的 Garfish 父容器应用作为主框架，直接在仓库根目录创建。
- 父容器主页作为导航页面，以卡片/块形式展示已添加的子应用，类似浏览器首页书签。
- 主页显示【+】块用于添加新子应用，点击后进入添加表单。
- 点击子应用块后进入对应子应用，顶部显示该子应用 Tab 与 Home 按钮。
- Garfish 完整加载并渲染子应用内容。

## Capabilities

### New Capabilities
- `garfish-parent-shell`: 基于 React 的 Garfish 父容器壳应用与布局能力。
- `subapp-management`: 子应用配置的新增与展示能力（设置页）。
- `subapp-navigation`: 子应用入口、Tab 切换与 Home 返回能力。

### Modified Capabilities
- (none)

## Impact

- 新增父容器前端代码与 Garfish 依赖（位于仓库根目录）。
- 新增子应用配置存储（本地或内存）与路由导航逻辑，字段为 name/url。
- 新增 UI 布局：顶部导航区与设置页面。
