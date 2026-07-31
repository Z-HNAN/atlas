# cloud-sync 增量规范

## MODIFIED Requirements

### Requirement: 云能力可选且前后端分离

前端 SHALL 通过统一 `BrowserHttpClient` 访问公开 Worker API，并携带 credentials；同步失败 SHALL 不影响本地读取和保存。

#### Scenario: Worker 网络失败

- **WHEN** Worker 请求超时、离线或未收到 HTTP 响应
- **THEN** 系统显示对应错误，本地数据继续可用且 dirty 状态保留
