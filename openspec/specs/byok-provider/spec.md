# byok-provider

## Purpose

定义 DeepSeek 用户自带 Key 的安全存储、旅行计划 Provider、结构化响应校验、有限修复和错误归一化，使 AI 增强失败时本地旅行核心功能仍然完整可用，并为未来替换服务端 Provider 保留稳定接口。

## Requirements

### Requirement: DeepSeek Key 本地边界

ApiKeyStore SHALL 默认写入 sessionStorage，只有用户明确选择记住时才写入 LocalStorage。

#### Scenario: 保存或清除

- **WHEN** 用户保存或清除 DeepSeek Key
- **THEN** Key 不进入 TripPayload、导出、Supabase、URL、日志或 PWA 缓存

### Requirement: 结构化旅行计划

Provider SHALL 使用 Chat Completions JSON Output，并 SHALL 校验外层响应和 GeneratedTravelPlan。

#### Scenario: 首次输出非法

- **WHEN** 内容不是 JSON、缺字段、地点为空、顺序重复或不连续
- **THEN** Provider 修复重试一次；第二次失败返回 INVALID_RESPONSE

### Requirement: Provider 可替换

业务 UI SHALL 只依赖 Provider/Hook，不直接拼接 DeepSeek URL。

#### Scenario: 浏览器直连受阻

- **WHEN** CORS 或网络策略阻止请求
- **THEN** 系统显示可恢复错误，手工旅行继续可用；未来可新增 Server Provider

## Compatibility

- Base URL 和模型名是公开环境配置，不得包含 Key。
