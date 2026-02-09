## Why

当前项目的应用名称仍为“Garfish Parent Container”，与预期的新品牌名称不一致，导致 UI 展示、PWA 安装信息及包名表达混乱。需要统一为“gipsy”，以便对外一致呈现。

## What Changes

- 将应用对外展示名称（标题、PWA manifest、页面标题）统一为“gipsy”。
- 更新前端页面中的应用标题文案为“gipsy”。
- 更新包名为“gipsy”。

## Capabilities

### New Capabilities
- `branding-gipsy`: 统一应用对外品牌名称与显示文案为 gipsy。

### Modified Capabilities
- 

## Impact

- 前端静态入口与 PWA manifest（index.html、manifest.webmanifest、Vite PWA 配置）。
- 应用首页文案展示。
- 包管理元信息（package.json）。
