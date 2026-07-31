# byok-provider 增量规范

## MODIFIED Requirements

### Requirement: DeepSeek 浏览器 BYOK 直连

Provider SHALL 通过统一 `BrowserHttpClient` 使用用户 Key 直连可配置的 DeepSeek Chat Completions；UI SHALL NOT 直接拼接 URL，Provider SHALL NOT 捕获原生 Fetch 或依赖 Ky 类型。

#### Scenario: 请求到达 DeepSeek

- **WHEN** Key、输入和公开配置合法
- **THEN** 浏览器实际发送请求，Key 只存在于 Authorization Header

#### Scenario: 无 HTTP 响应

- **WHEN** 客户端返回 network 阶段错误
- **THEN** Provider 返回 `NETWORK_ERROR`，不得确定性显示为 CORS
