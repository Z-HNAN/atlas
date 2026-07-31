# 任务

- [x] P0 / Codex：建立 L 级提案、设计和增量规范；依赖：请求链路审计；验收：根因、方案对比、错误阶段、风险和回滚完整。
- [x] P0 / Codex：实现 Ky 驱动的 `BrowserHttpClient`；依赖：规范；验收：正确 Fetch 接收者、超时、取消、网络错误和非 2xx 透传测试通过。
- [x] P0 / Codex：迁移 DeepSeek、Nominatim 与 Worker Provider；依赖：HTTP 客户端；验收：业务状态码、安全、串行限速和同步协议不回归。
- [x] P1 / Codex：补充按钮禁用原因和可见错误；依赖：Provider；验收：请求未发送时用户能区分缺 Key、无效输入、进行中或无待查询项。
- [x] P1 / Codex：同步 Gipsy 同一实现、文档和主规范；依赖：Atlas 方案；验收：两仓请求基础设施与错误分类一致。
- [x] P0 / Codex：执行两仓完整门禁、OpenSpec strict 与浏览器回归并归档；依赖：全部任务；验收：所有自动化和真实请求证据通过。
