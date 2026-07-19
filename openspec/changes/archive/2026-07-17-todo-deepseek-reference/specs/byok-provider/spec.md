# byok-provider

## Purpose

定义 DeepSeek 用户自带 API Key 的存储边界和任务拆解 Provider，保证 AI 增强失败时 Todo 本地核心功能仍可完整使用。

## Requirements

### Requirement: DeepSeek Key 本地边界

ApiKeyStore SHALL 使用 provider ID `deepseek`，默认保存到 sessionStorage，只有用户明确选择记住时才保存到 LocalStorage。

#### Scenario: 保存或清除 Key

- **WHEN** 用户保存临时/持久 DeepSeek Key 或选择清除
- **THEN** Store 只操作 deepseek 前缀，Key 不进入 TodoPayload、导出、Supabase、URL 或日志

### Requirement: DeepSeek Chat Provider

Provider SHALL 使用浏览器请求 DeepSeek `/chat/completions`，负责认证 Header、模型、JSON Output、超时、取消、有限重试、错误归一化和 Zod 响应校验。

#### Scenario: 成功拆解任务

- **WHEN** 用户在线、Key 存在、任务合法且响应包含有效 JSON subtasks
- **THEN** Provider 返回 2～6 条经过裁剪、去重和长度校验的子任务，不自动写入 Todo

#### Scenario: Key、网络或响应错误

- **WHEN** Key 缺失、离线、401/402/403、429、CORS/网络失败、超时、空内容或响应结构无效
- **THEN** 系统显示对应 AppError；手工 Todo 操作继续可用

### Requirement: Provider 可替换

业务 UI SHALL 只依赖 ExternalApiProvider 和任务拆解 Hook，不得直接拼接 DeepSeek URL 或读取 Key Store 内部键。

#### Scenario: CORS 降级

- **WHEN** 浏览器直连被供应商或网络策略阻止
- **THEN** Provider 报告 API_CORS_BLOCKED；后续可替换 Server Provider 而不改变 Todo 组件

## Compatibility

- 默认模型通过 `VITE_DEEPSEEK_MODEL` 集中配置，不进入 TodoPayload。
- 原 OpenAI Key 不迁移成 DeepSeek Key；用户必须提供自己的 DeepSeek Key。
