# browser-http 增量规范

## ADDED Requirements

### Requirement: 统一浏览器 HTTP 适配层

所有浏览器外部请求 SHALL 通过 `src/lib/http` 的 `BrowserHttpClient`；只有该适配层 MAY 直接依赖 Ky 或捕获原生 Fetch。默认 Fetch SHALL 以 `globalThis` 为接收者执行。

#### Scenario: 默认浏览器请求

- **WHEN** Provider 未注入测试客户端并发起请求
- **THEN** 请求进入 Ky 并以正确接收者调用 `globalThis.fetch`，不得在 Network 前因 `Illegal invocation` 中断

#### Scenario: 非 2xx 响应

- **WHEN** 服务端返回可读 HTTP 错误状态
- **THEN** 客户端把 Response 交给业务 Provider 映射，且不直接展示或记录第三方正文

### Requirement: 请求阶段错误

客户端 SHALL 区分取消、超时、网络失败和意外编程错误；调用方 SHALL 将错误转换为可恢复的项目错误，且 SHALL NOT 把所有无响应错误断言为 CORS。

#### Scenario: 请求未得到 HTTP 响应

- **WHEN** DNS、TLS、代理、扩展、网络策略或 CORS 等原因使请求失败
- **THEN** 客户端返回 network 阶段错误，UI 说明可能原因并保留本地核心功能

#### Scenario: 主动取消或超时

- **WHEN** 用户取消请求或达到调用方配置的超时
- **THEN** 客户端分别返回 aborted 或 timeout，调用方显示对应提示

### Requirement: 有限且显式的重试

客户端 SHALL 默认不重试；只有调用方证明请求安全或幂等时 MAY 配置有限重试，且 SHALL NOT 隐藏无限重试。

#### Scenario: 非幂等外部请求

- **WHEN** DeepSeek 或其它外部请求需要重试
- **THEN** 调用方最多执行一次有限重试，并在最终失败后返回明确错误
