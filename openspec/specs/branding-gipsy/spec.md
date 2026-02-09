## ADDED Requirements

### Requirement: 应用名称统一为 gipsy
系统 SHALL 在用户可见的应用名称位置统一显示为“gipsy”。

#### Scenario: 页面标题显示
- **WHEN** 用户打开应用首页
- **THEN** 浏览器标签页标题显示为“gipsy”

#### Scenario: 首页标题显示
- **WHEN** 用户进入应用首页
- **THEN** 首页标题文案显示为“gipsy”

### Requirement: PWA 清单名称一致
系统 SHALL 在 PWA manifest 中将 name 与 short_name 设置为“gipsy”。

#### Scenario: Manifest 读取
- **WHEN** 浏览器请求 /manifest.webmanifest
- **THEN** 返回的 manifest 中 name 与 short_name 均为“gipsy”

### Requirement: 构建配置中的名称一致
系统 SHALL 在构建时生成的 PWA manifest 配置中使用“gipsy”。

#### Scenario: 构建时注入
- **WHEN** 执行构建生成 PWA manifest
- **THEN** 生成的 manifest name 与 short_name 为“gipsy”
