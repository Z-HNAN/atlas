# atlas-map

## ADDED Requirements

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
