# atlas-map

## Purpose

定义旅行详情地图与个人世界收藏地图的数据输入、路线绘制、地点状态、自动缩放、交互弹窗、视觉区分、来源标注和组合筛选行为，保证地图始终是可验证的旅行预览而不是航空导航。

## Requirements

### Requirement: 路线预览地图

系统 SHALL 使用 Leaflet、OpenStreetMap 瓦片、顺序 Marker、Polyline、Popup 和 FitBounds 展示旅行路线，并 SHALL 显示 OpenStreetMap attribution。

#### Scenario: 查看旅行详情

- **WHEN** 旅行包含已解析坐标
- **THEN** 地图按顺序连接地点、自动缩放并在 Popup 显示名称、理由、坐标和解析名称

### Requirement: 世界收藏筛选

Atlas SHALL 展示全部旅行路线，并支持全部、已到访、计划中、旅行、年份和主题筛选。

#### Scenario: 只看已到访

- **WHEN** 用户选择只看已到访
- **THEN** 地图仅显示到访点，已完成与计划路线仍使用不同视觉规则

### Requirement: 地图瓦片加载反馈

地图 SHALL 在 OpenStreetMap 瓦片加载期间显示加载反馈，并 SHALL 在瓦片请求失败时显示非阻断错误；路线、Marker、已保存坐标和本地编辑不得依赖瓦片成功。

#### Scenario: 首次打开地图

- **WHEN** Leaflet 开始请求当前视图瓦片且尚未完成
- **THEN** 地图框显示“正在加载地图”并在加载完成后隐藏

#### Scenario: 瓦片加载失败

- **WHEN** 任一当前视图瓦片请求失败
- **THEN** 地图显示底图加载失败提示，用户仍可查看已有路线图层并继续编辑坐标

## Compatibility

- 地图只用于预览和人工确认，不提供导航、实时定位或航空分析。
- 已有坐标和记录离线可读；新瓦片加载依赖网络。
- 地图加载反馈不修改 Marker 的 HTML、名称或无障碍语义。
