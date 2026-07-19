# byok-provider

## Purpose

提供可复用的用户自带 API Key 存储和第三方 Provider 边界，并以 OpenAI Responses API 的应用名称建议功能验证真实客户端调用闭环。

## Requirements

### Requirement: API Key 本地边界

ApiKeyStore SHALL 默认使用 sessionStorage，只有用户明确选择记住时才使用 LocalStorage。

#### Scenario: 保存或清除 OpenAI Key

- **WHEN** 用户保存临时/持久 Key 或选择清除
- **THEN** Store 只操作 OpenAI Provider 前缀，Key 不进入 Payload、导出、Supabase、URL 或日志

### Requirement: OpenAI Responses Provider

Provider SHALL 使用浏览器请求 Responses API，负责认证 Header、模型、超时、AbortSignal、有限重试、错误归一化和 Zod 响应校验。

#### Scenario: 成功建议名称

- **WHEN** 用户在线、Key 存在、URL 合法且响应包含有效 output_text
- **THEN** Provider 返回经过裁剪和长度校验的名称，表单只回填不自动保存

#### Scenario: Key、网络或响应错误

- **WHEN** Key 缺失、离线、401/403、429、CORS/网络失败、超时或响应结构无效
- **THEN** 系统显示对应 AppError；本地应用管理仍可手动完成

### Requirement: Provider 可替换

业务 UI SHALL 只依赖 `ExternalApiProvider`，不得直接拼接 OpenAI URL 或读取 Key Store 内部键。

#### Scenario: CORS 降级

- **WHEN** 浏览器直连被供应商 CORS 策略阻止
- **THEN** 当前 Provider 报告 API_CORS_BLOCKED；后续可替换 Server Provider 而不改变业务组件

## Compatibility

- 默认模型集中在公开环境配置中；更新模型不改变业务 Payload。
- Gipsy 不提供项目方共享 Key；需要隐藏统一 Key 时必须独立增加 Serverless。
