# 任务：修复 DeepSeek 原生 fetch 调用绑定

- [x] P0｜执行方：Codex｜依赖：真实 Chromium 复现｜在 Provider 捕获默认 fetch 时绑定正确的全局接收者；验收：点击生成后浏览器实际发出请求，不在 Network 前抛出 TypeError。
- [x] P0｜执行方：Codex｜依赖：Provider 修复｜新增原生接收者回归测试；验收：默认 fetch 以 globalThis 为接收者，注入 Mock 的现有测试保持通过。
- [x] P0｜执行方：Codex｜依赖：实现｜使用真实浏览器和无效测试 Key 验证请求抵达 DeepSeek 并返回 401 提示；验收：页面显示 Key 无效而不是未收到 HTTP 响应。
- [x] P0｜执行方：Codex｜依赖：全部修改｜执行项目五项质量门禁和 OpenSpec strict；验收：全部通过后归档本变更。
