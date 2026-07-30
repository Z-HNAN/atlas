# byok-provider

## MODIFIED Requirements

### Requirement: DeepSeek 浏览器 BYOK 直连

Provider SHALL 使用用户在当前浏览器提供的 Key 直连可配置的 DeepSeek 官方 Chat Completions Base URL；捕获浏览器原生 fetch 时 SHALL 保留其要求的全局调用接收者，不得因把 fetch 保存为类成员而在网络请求前触发 Illegal invocation；测试 MAY 注入可替换的 Request 实现。

#### Scenario: 使用浏览器原生 fetch

- **WHEN** Provider 未注入测试 Request 且用户发起 AI 旅行规划
- **THEN** 原生 fetch 以 globalThis 为接收者执行，浏览器实际发送 OPTIONS/POST 并读取 HTTP 响应

#### Scenario: 网络请求到达后的认证失败

- **WHEN** DeepSeek 返回 401
- **THEN** Provider 显示 API Key 无效，而不是显示未收到 HTTP 响应
