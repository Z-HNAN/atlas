# pln-export

## ADDED Requirements

### Requirement: DMS 坐标

系统 SHALL 将合法经纬度转换为带半球、度符号、分和两位小数秒的 DMS，并 SHALL 正确处理秒和分进位。

#### Scenario: 四个半球

- **WHEN** 输入正负经纬度和零
- **THEN** 输出分别使用 N/S/E/W，零使用 N/E，越界值被拒绝

### Requirement: 严格 Sky4Sim PLN

系统 SHALL 在浏览器本地为每个确认地点按顺序生成一个 Custom/User 航点，第一点和最后一点写入 DepartureLLA 与 DestinationLLA。

#### Scenario: 导出确认路线

- **WHEN** 至少两个地点全部 resolved
- **THEN** 下载 UTF-8 `.pln`，所有 `id` 为 Custom、类型为 User、SpeedMaxFP 为 -1，且不包含机场、航路、巡航高度或 FPType
