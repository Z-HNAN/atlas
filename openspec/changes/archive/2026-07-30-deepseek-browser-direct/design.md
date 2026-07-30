# 设计：DeepSeek 浏览器直连与错误诊断

## 背景与证据

DeepSeek 官方文档当前列出的 Chat Completions 模型为 `deepseek-v4-pro` 和 `deepseek-v4-flash`，并说明旧模型名在 2026-07-24 停用。2026-07-30 对官方端点执行不含凭证的 OPTIONS 请求，localhost、自定义域名、Vercel 域名和 `null` Origin 均得到对应 `Access-Control-Allow-Origin`，允许 `POST`、`authorization` 与 `content-type`；使用无效测试 Key 的 401 响应也带正确 CORS 头。

参考：

- <https://api-docs.deepseek.com/guides/function_calling/>
- <https://api-docs.deepseek.com/api/create-chat-completion>
- <https://api-docs.deepseek.com/updates/>

## 架构

UI 继续通过 `useTravelPlanner` 调用 `ExternalApiProvider`。Provider 从 ApiKeyStore 接收当前用户 Key，并直接请求公开 Base URL。Key 不写入 Vite 环境变量，也不进入业务数据。

## 关键细节

### 默认模型

未显式配置时使用 `deepseek-v4-pro`。模型名仍由公开的 `VITE_DEEPSEEK_MODEL` 覆盖，以便官方升级时无需修改 Provider。

旅行规划是短结构化任务，请求显式使用非思考模式，避免默认思考过程增加延迟和 Token 消耗；JSON Output 和 Zod 仍负责输出约束。

### 错误分类

- 浏览器离线：`OFFLINE`。
- 主动取消或超时：`NETWORK_ERROR`，分别提示取消或超时。
- `fetch` 抛出 `TypeError`：`NETWORK_ERROR`，说明请求未到达可读 HTTP 响应，列出网络、DNS、代理、证书、扩展、自定义 Base URL 或 CORS 等可能原因，不武断判定为 CORS。
- HTTP 400/404：提示模型名或请求配置不受支持。
- HTTP 401/402/403：提示 Key、余额或权限。
- HTTP 429：提示限流。
- HTTP 5xx：提示服务暂不可用。

第三方错误正文不得直接呈现或记录，避免意外带出请求信息。

### 失败恢复

任何 AI 请求失败都不创建不完整旅行，不修改已有 TripPayload；用户仍可手工创建旅行。更换模型环境变量需要重新构建，替换 Key 只影响 ApiKeyStore。

## 风险与权衡

- CORS 是供应商的运行时策略，未来可能变化；文档只承诺当前核查结论，Provider 边界允许后续新增代理实现。
- 浏览器无法可靠区分 CORS、DNS、TLS 和扩展拦截，精确声称“CORS 被拦截”会误导；因此采用阶段型错误说明。
- `deepseek-v4-pro` 可能比 Flash 成本或延迟更高，但更适合作为首版质量默认值；部署者可显式改为 `deepseek-v4-flash`。
- BYOK 仍暴露于当前页面运行环境，必须维持 XSS 防护和依赖审计；不能把项目共享 Key 放入浏览器。

## 验收标准

- 未设置模型环境变量时，请求体使用 `deepseek-v4-pro`。
- `fetch TypeError` 不再显示确定性的 CORS 错误。
- 400/404、401/402/403、429 与 5xx 有稳定、脱敏的中文提示。
- Key 不出现在请求体、错误、日志、Payload 或导出。
- BYOK Provider 单元测试、类型检查、Lint、格式、全量测试和生产构建通过。
