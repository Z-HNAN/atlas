# travel-planning 增量规范

## MODIFIED Requirements

### Requirement: 真实坐标查询与人工确认

系统 SHALL 通过统一 `BrowserHttpClient` 串行调用 Nominatim、至少间隔 1.1 秒、设置有限超时、缓存结果并要求人工处理歧义或失败地点。

#### Scenario: 查询前置条件

- **WHEN** 用户点击批量查询但没有未确认地点
- **THEN** 页面显示无需查询且不发起网络请求

#### Scenario: 地点请求超时或失败

- **WHEN** Nominatim 未在时限内响应或没有可读 HTTP 响应
- **THEN** 页面显示可恢复错误并把对应地点标记为失败，不静默停止后续 UI
