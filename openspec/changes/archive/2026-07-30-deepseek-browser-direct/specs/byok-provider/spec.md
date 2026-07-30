# byok-provider

## MODIFIED Requirements

### Requirement: DeepSeek 浏览器 BYOK 直连

Provider SHALL 使用用户在当前浏览器提供的 Key 直连可配置的 DeepSeek 官方 Chat Completions Base URL；默认模型 SHALL 为当前官方模型 `deepseek-v4-pro`，部署者 MAY 通过公开环境变量覆盖模型名。

#### Scenario: 默认配置生成请求

- **WHEN** 部署者未显式配置模型且用户发起 AI 旅行规划
- **THEN** Provider 请求官方 `/chat/completions`，请求体模型为 `deepseek-v4-pro`，Authorization 使用 ApiKeyStore 提供的当前用户 Key

#### Scenario: 网络层拒绝

- **WHEN** `fetch` 在获得可读 HTTP 响应前因 DNS、代理、TLS、扩展、网络策略或 CORS 等原因失败
- **THEN** Provider 返回可恢复的 `NETWORK_ERROR`，不得武断声称故障一定来自 CORS，手工旅行继续可用

#### Scenario: API 返回错误状态

- **WHEN** DeepSeek 返回 400/404、401/402/403、429 或 5xx
- **THEN** Provider SHALL 分别提示配置、凭证或余额、限流、服务不可用，并且 SHALL NOT 直接展示第三方错误正文

### Requirement: DeepSeek Key 本地边界

ApiKeyStore SHALL 默认写入 sessionStorage，只有用户明确选择记住时才写入 LocalStorage；Key SHALL NOT 进入 TripPayload、导出、Supabase、URL、日志、请求体或 PWA 缓存。

#### Scenario: 直连请求

- **WHEN** Provider 为浏览器直连构造请求
- **THEN** Key 只出现在 Authorization Header，不出现在 JSON Body 或可持久化数据
