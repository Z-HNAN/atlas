# 设计：Atlas 统一浏览器 HTTP 客户端

## 分层

```text
页面 / Hook
  → 业务 Provider（状态码、Prompt、Zod、Key 安全）
  → BrowserHttpClient（超时、取消、网络阶段错误、有限重试）
  → Ky
  → globalThis.fetch
```

只有 `src/lib/http` 可以导入 Ky。默认 Fetch 通过箭头函数调用 `globalThis.fetch(...)`，不会把 Provider 实例作为原生方法接收者。测试可以在客户端构造时注入 Fetch，业务 Provider 只注入 `BrowserHttpClient`。

## 客户端协议

- 输入保持 URL、RequestInit、`timeoutMs` 和显式 retry 配置。
- 非 2xx `Response` 原样交给 Provider，以便业务层安全映射状态码；不得直接展示第三方正文。
- 请求前或网络阶段异常统一包装为 `BrowserHttpError`：`aborted`、`timeout`、`network`、`unexpected`。
- 客户端不记录 URL Query、Authorization、Body 或响应正文。

## 各调用方

### DeepSeek

- 30 秒超时，用户取消优先于超时。
- 429/5xx 只有限重试一次；旅行输出校验失败仍只修复一次。
- 401、402、403、400/404、429、5xx 分别映射，网络异常不武断归因于 CORS。

### Nominatim

- 15 秒超时。
- 继续使用串行队列和至少 1.1 秒间隔；429 不自动快速重试。
- 缓存命中时不调用客户端。

### Worker 同步

- 使用 credentials include。
- GET/PUT 的业务幂等仍由 `commitId` 和服务端协议控制；首版不扩大自动重试次数。
- 离线与网络失败保持本地功能可用。

## 交互前置条件

AI 提交按钮在缺少 Key、输入不合法或请求进行中时禁用，并显示对应原因。地点批量查询在没有待查询地点时显示“无需查询”，所有异步事件必须捕获并呈现错误。

## 风险与权衡

- Ky 增加少量包体积；换来统一 Fetch 生命周期与更少重复代码。
- 库不能修复真实 CORS 或网络策略，只能保证调用确实进入网络层或返回明确的前置错误。
- 自动重试可能产生重复副作用，因此默认关闭，只由明确安全或幂等的调用方有限开启。
- Ky 仅支持现代浏览器和 Node 22，符合项目当前运行基线。

## 验收标准

- 两仓默认请求均以正确全局接收者调用 Fetch。
- Gipsy 不再出现 `API_CORS_BLOCKED` 误判。
- DeepSeek、Nominatim 和 Worker 不再直接持有原生 Fetch。
- 超时、取消、网络异常、HTTP 状态与无效 JSON 均有回归测试。
- Atlas 真实浏览器使用无效 Key 能到达 DeepSeek 并显示 401 类提示。
