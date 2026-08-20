# atlas-map 增量规范

## ADDED Requirements

### Requirement: 地图瓦片加载反馈

地图 SHALL 在 OpenStreetMap 瓦片加载期间显示加载反馈，并 SHALL 在瓦片请求失败时显示非阻断错误；路线、Marker、已保存坐标和本地编辑不得依赖瓦片成功。

#### Scenario: 首次打开地图

- **WHEN** Leaflet 开始请求当前视图瓦片且尚未完成
- **THEN** 地图框显示“正在加载地图”并在加载完成后隐藏

#### Scenario: 瓦片加载失败

- **WHEN** 任一当前视图瓦片请求失败
- **THEN** 地图显示底图加载失败提示，用户仍可查看已有路线图层并继续编辑坐标

## Compatibility

- 本变更不修改 Marker 的 HTML、名称或无障碍语义。
