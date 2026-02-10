# branding-gipsy

## 规范目标
- 用户可见名称统一为 “gipsy”。

## 功能与行为

### 要求：页面标题为 gipsy
- **当** 用户打开门户
- **则** 浏览器标签页标题显示为 “gipsy”

### 要求：首页标题为 gipsy
- **当** 用户进入门户首页
- **则** 页面内标题显示为 “gipsy”

### 要求：manifest 名称为 gipsy
- **当** 浏览器请求 `/manifest.webmanifest`
- **则** manifest 的 `name` 与 `short_name` 均为 “gipsy”
