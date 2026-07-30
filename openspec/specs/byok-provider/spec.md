# byok-provider

## Purpose

定义 DeepSeek 用户自带 Key 的安全存储、旅行计划 Provider、结构化响应校验、有限修复和错误归一化，使 AI 增强失败时本地旅行核心功能仍然完整可用，并为未来替换服务端 Provider 保留稳定接口。

## Requirements

### Requirement: DeepSeek Key 本地边界

ApiKeyStore SHALL 默认写入 sessionStorage，只有用户明确选择记住时才写入 LocalStorage。

#### Scenario: 保存或清除

- **WHEN** 用户保存或清除 DeepSeek Key
- **THEN** Key 不进入 TripPayload、导出、Supabase、URL、日志、请求体或 PWA 缓存

### Requirement: 结构化旅行计划

Provider SHALL 使用 Chat Completions JSON Output，并 SHALL 校验外层响应和 GeneratedTravelPlan。

#### Scenario: 首次输出非法

- **WHEN** 内容不是 JSON、缺字段、地点为空、顺序重复或不连续
- **THEN** Provider 修复重试一次；第二次失败返回 INVALID_RESPONSE

### Requirement: DeepSeek 浏览器 BYOK 直连

Provider SHALL 使用用户在当前浏览器提供的 Key 直连可配置的 DeepSeek 官方 Chat Completions Base URL；默认模型 SHALL 为当前官方模型 `deepseek-v4-pro`，部署者 MAY 通过公开环境变量覆盖模型名。业务 UI SHALL 只依赖 Provider/Hook，不直接拼接 DeepSeek URL。

#### Scenario: 默认配置生成请求

- **WHEN** 部署者未显式配置模型且用户发起 AI 旅行规划
- **THEN** Provider 请求官方 `/chat/completions`，请求体模型为 `deepseek-v4-pro`，Key 只出现在 Authorization Header

#### Scenario: 网络层拒绝

- **WHEN** `fetch` 在获得可读 HTTP 响应前因 DNS、代理、TLS、扩展、网络策略或 CORS 等原因失败
- **THEN** Provider 返回可恢复的 NETWORK_ERROR，不武断声称故障一定来自 CORS，手工旅行继续可用

#### Scenario: API 错误状态

- **WHEN** API 返回 400/404、401/402/403、429 或 5xx
- **THEN** Provider 分别提示配置、凭证或余额、限流、服务不可用，且不直接展示第三方错误正文

## Compatibility

- Base URL 和模型名是公开环境配置，不得包含 Key。
