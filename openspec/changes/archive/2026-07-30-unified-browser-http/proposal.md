# 提案：统一 Atlas 浏览器请求基础设施

## 问题

Atlas 曾出现点击 DeepSeek 或地点查询后 Network 面板完全没有请求。根因不是已收到响应后的 CORS，而是请求前 JavaScript 失败：浏览器原生 `fetch` 被保存为类成员后以错误接收者调用，触发 `Illegal invocation`。后续 DeepSeek、Nominatim 和 Worker 又分别维护绑定、超时、取消、重试与错误映射，容易再次分叉。

Gipsy 仍保留修复前的未绑定 `fetch`，并把所有 `TypeError` 误报为 CORS。两个仓库需要同一套不会静默中断的现代浏览器请求边界。

## 目标

- 使用 Ky 作为现代 Fetch 内核，统一正确调用、超时、取消和可选有限重试。
- 在 `src/lib/http` 提供项目自有 `BrowserHttpClient`，Feature、Provider 和同步层不直接捕获原生 `fetch` 或依赖 Ky 类型。
- DeepSeek、Nominatim 和 Worker 同步统一使用该客户端，同时保留各自状态码、Zod、幂等和安全规则。
- 对请求前失败、超时、取消、离线、无 HTTP 响应和 HTTP 错误提供稳定且不误导的错误分类。
- 让禁用按钮显示明确原因，避免用户把“未满足前置条件”误认为网络没有发送。

## 非目标

- 不承诺绕过真实的 DNS、TLS、代理、浏览器扩展、企业网络或供应商 CORS 策略。
- 不增加 Vercel Function、共享 API Key、服务端代理或请求日志平台。
- 不改变 TripPayload、Envelope、同步协议或数据库结构。
- 不对非幂等请求进行无限或不可见重试。

## 方案对比

### 方案 A：继续在每个 Provider 手工绑定 Fetch

改动最小，但绑定、超时和错误分类仍会重复，Gipsy 已证明修复容易漏同步，不采用。

### 方案 B：直接在业务代码使用 Axios

Axios 功能完整，但会让 Feature 直接依赖另一套请求/错误模型，且当前项目已基于 Fetch 的 Request、Response、AbortSignal 与流式字节，不采用。

### 方案 C：Ky + 项目适配层

Ky 面向现代浏览器、零运行时依赖，提供 Fetch 语义、超时、取消、重试和 TypeScript 类型。项目适配层固定正确的全局 Fetch 接收者并隔离 Ky，Provider 继续掌控业务状态码和 Zod。采用此方案。

## 迁移与回滚

项目尚未正式发布，不涉及用户数据迁移。逐个 Provider 把 `fetch`/`fetcher` 注入改为 `BrowserHttpClient`；测试通过客户端协议注入响应。回滚可恢复原 Provider 请求实现并移除 Ky，不影响业务数据。

## 影响

- 新增 `ky` 生产依赖和 `src/lib/http`。
- DeepSeek、Nominatim、Worker 同步 Provider 的依赖注入统一。
- README、START、AGENTS、主规范和回归测试同步更新。
