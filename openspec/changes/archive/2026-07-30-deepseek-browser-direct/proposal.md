# 提案：修正 DeepSeek 浏览器直连

## 问题

Atlas 使用用户自带 Key 从浏览器直连 DeepSeek。2026-07-30 的核查表明，官方 `/chat/completions` 与 `/v1/chat/completions` 会为 localhost、自定义域名和 Vercel 来源返回匹配的 CORS 预检头，认证失败响应也保留 CORS 头；因此 C 端 BYOK 直连当前可用。

现有实现仍有两个问题：

- 默认模型是已于 2026-07-24 停用的 `deepseek-chat`，与 `.env.example` 和当前官方模型不一致。
- 浏览器 `fetch` 的任何 `TypeError` 都被归因为 CORS，但 DNS、代理、证书、扩展拦截、连接重置和错误 Base URL 也会产生同类异常。

## 目标

- 默认使用当前官方模型 `deepseek-v4-pro`，同时保留环境变量覆盖能力。
- 继续支持 C 端 BYOK 直连，不增加强制服务端代理。
- 按 HTTP 状态和网络阶段提供可操作且不过度归因的错误。
- 保持 Key 不进入业务 Payload、日志、URL、导出或云端。

## 非目标

- 不引入项目共享 DeepSeek Key。
- 不增加 Vercel Function、Serverless 代理、配额中台或 Key 托管。
- 不在应用中自动探测或绕过用户的代理、浏览器扩展和企业网络策略。
- 不把第三方原始错误正文直接展示给用户。

## 方案对比

### 方案 A：继续使用浏览器 BYOK 直连并修正模型与诊断

优点是无需后端、用户 Key 不经过项目方服务器、符合 Local-first 与种子项目的不提前引入 Serverless 原则；官方端点当前明确通过预检。缺点是用户网络、浏览器扩展或供应商未来调整 CORS 时仍可能失败。

### 方案 B：所有请求改走 Vercel Function 代理

优点是浏览器不再直接跨域，便于集中观测。缺点是用户 Key 将经过项目方基础设施，需要额外的日志脱敏、滥用防护、超时、费用、隐私披露和部署依赖；离线种子也会多一个必须维护的服务端组件。

## 推荐方案

采用方案 A。当前故障不能证明 DeepSeek 不支持 CORS，反而已有官方端点的实际响应证明直连可用。先修正过期模型和误导性错误；只有未来官方明确取消浏览器跨域，或产品改为共享额度时，再为薄代理单独立项。

## 影响范围

- `src/config/env.ts`：更新默认模型。
- DeepSeek Provider：调整错误分类和提示。
- BYOK 主规范、README、START 与单元测试：同步当前行为。

## 兼容与迁移

- 不修改 Payload、Envelope、LocalStorage Key 或 schemaVersion，无业务数据迁移。
- 显式配置 `VITE_DEEPSEEK_MODEL` 的部署保持原值；未配置部署自动切换到 `deepseek-v4-pro`。
- 已保存的用户 API Key 不移动、不重写、不上传。
