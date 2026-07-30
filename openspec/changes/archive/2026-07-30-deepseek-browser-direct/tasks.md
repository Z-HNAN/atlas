# 任务：修正 DeepSeek 浏览器直连

- [x] P0｜负责人：Codex｜依赖：官方模型与 CORS 核查｜更新默认模型和公开配置文档；验收：未配置时使用 `deepseek-v4-pro`，README、START 与 `.env.example` 一致。
- [x] P0｜负责人：Codex｜依赖：Provider 错误边界｜修正 TypeError、400/404、认证、限流和服务端错误提示；验收：不再把所有网络失败断言为 CORS，且不展示第三方原始正文。
- [x] P0｜负责人：Codex｜依赖：上述实现｜补充单元测试；验收：请求 URL、模型、Key 不进入 body、网络异常和 HTTP 状态映射均被覆盖。
- [x] P0｜负责人：Codex｜依赖：实现和文档｜执行 OpenSpec strict、typecheck、lint、test、format:check 和 build；验收：全部通过且工作区无格式错误。
