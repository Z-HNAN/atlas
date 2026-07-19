# Personal Web Seed Phase 2–4 任务

## Phase 2：可选云同步

- [x] **P0 / Codex**：实现 Supabase 动态客户端和 Magic Link Auth；验收：云关闭不加载 SDK，登录与退出有状态反馈。
- [x] **P0 / Codex**：实现 SupabaseSyncProvider 乐观并发；验收：更新过滤 expectedRemoteVersion，零行返回版本冲突。
- [x] **P0 / Codex**：实现 SyncManager 决策矩阵；验收：远程缺失、首次恢复、安全上传、远程更新和冲突均有测试。
- [x] **P0 / Codex**：实现冲突四处理；验收：本地/云端覆盖前备份，双份导出不修改数据，取消保持冲突。
- [x] **P1 / Codex**：实现独立自动同步偏好和 3 秒 debounce；验收：离线、未登录或冲突时不上传。
- [x] **P0 / Codex**：完成云同步设置 UI；验收：登录、同步、恢复、覆盖、删除、自动同步和版本状态可操作。

## Phase 3：BYOK Provider 示例

- [x] **P0 / Codex**：实现 OpenAI Responses Provider；验收：请求和响应经 Zod 校验，支持超时、取消、有限重试与统一错误。
- [x] **P0 / Codex**：实现 API Key 设置；验收：session/persistent 可选，Key 可清除且不进入 Payload、导出或日志。
- [x] **P1 / Codex**：实现 URL 名称建议；验收：有 Key 且在线时可回填名称，失败不影响手工添加。

## Phase 4：派生与交付

- [x] **P0 / Codex**：补齐双设备集成测试；验收：首次上传、拉取、修改、冲突和两种解决均覆盖。
- [x] **P0 / Codex**：创建 START 指南；验收：覆盖本地、环境变量、Supabase/RLS、OpenAI、Vercel、OpenSpec、Codex 和派生流程。
- [x] **P0 / Codex**：更新 README、AGENTS 和三份主规范；验收：文档与实现一致，新规范严格校验通过。
- [x] **P0 / Codex**：执行最终审计；验收：typecheck、lint、test、build、PWA 产物和关键静态路径全部通过。

## 依赖与风险

- 真实 Supabase/Auth/OpenAI 端到端调用需要用户自己的项目、允许的回调 URL 和 API Key；仓库内使用可控网关/Fetch 测试，不保存真实凭证。
- Supabase 与 OpenAI 的公开接口可能变化，版本和配置集中管理，升级必须通过独立 OpenSpec 和测试。
