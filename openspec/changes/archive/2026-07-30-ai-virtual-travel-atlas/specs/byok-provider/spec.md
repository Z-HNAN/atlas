# byok-provider

## MODIFIED Requirements

### Requirement: DeepSeek Key 本地边界

ApiKeyStore SHALL 使用 provider ID `deepseek`，默认保存到 sessionStorage，只有用户明确选择记住时才保存到 LocalStorage；Key SHALL NOT 进入 TripPayload、导出、Supabase、URL、日志或 PWA 缓存。

#### Scenario: 保存、替换或清除 Key

- **WHEN** 用户临时保存、持久保存、替换或清除 DeepSeek Key
- **THEN** Store 只操作自己的 Provider 前缀，不修改旅行 Envelope 或云快照

### Requirement: DeepSeek 结构化旅行计划

Provider SHALL 使用浏览器请求 DeepSeek Chat Completions JSON Output，负责认证、模型、超时、取消、有限重试、错误归一化和 GeneratedTravelPlan Zod 校验。

#### Scenario: 首次输出非法

- **WHEN** 内容不是 JSON、缺少字段、地点为空、顺序重复或不连续
- **THEN** Provider 保留原旅行需求并修复重试一次；第二次失败返回 INVALID_RESPONSE 且不创建草稿

### Requirement: Provider 可替换

业务 UI SHALL 只依赖 ExternalApiProvider 和旅行规划 Hook，不得直接拼接 DeepSeek URL 或读取 Key Store 内部键。

#### Scenario: CORS 降级

- **WHEN** 浏览器直连被供应商或网络策略阻止
- **THEN** Provider 报告 API_CORS_BLOCKED，本地手工旅行继续可用，未来可替换 Server Provider
