# 完成 Personal Web Seed Phase 2–4 提案

## 问题定义

Phase 1 已完成 Local-first 数据、工程工具链、PWA 和 Codex 规范，但种子定义中的可选 Supabase 登录与快照同步、冲突处理、真实 BYOK Provider 示例、双设备集成测试和完整启动指南尚未实现。当前仓库还不能证明“本地优先 + 可选云备份 + Provider 可替换 + 新项目可派生”的完整闭环。

## 目标与非目标

### 目标

- 实现按环境变量启用、按需动态加载的 Supabase Magic Link 登录和单表快照同步。
- 实现启动检查、手动同步、可选自动上传、乐观并发、冲突检测与四类人工处理。
- 在设置页提供登录、同步、云恢复、本地覆盖云端、删除云快照和状态反馈。
- 使用 OpenAI Responses API 实现真实 BYOK 示例：根据应用 URL 建议名称。
- 补齐双设备同步和冲突集成测试，确保不会静默覆盖。
- 建立 `START.md`，说明使用、配置、Supabase、OpenAI Key、Vercel、OpenSpec、Codex 和派生开发流程。

### 非目标

- 不实现自动 JSON 合并、CRDT、实时订阅、多用户协作或后台 Service Worker 同步。
- 不在前端保存 Supabase secret/service role，不由项目方托管 OpenAI Key。
- 不把 Supabase 或 OpenAI 变成本地核心功能的前置依赖。
- 不执行真实生产部署，不要求在仓库中保存任何真实凭证。

## 方案对比

### 方案一：组件直接调用 Supabase 与 OpenAI

- 优点：代码量少，功能可以快速展示。
- 缺点：UI 与厂商 SDK、表结构和 API 响应耦合；难以测试冲突；派生项目无法复用。

### 方案二：通用 SyncManager + Provider 边界

- 优点：同步决策可在内存中完整测试；Supabase 只负责远程快照；UI 不理解表结构；第三方 API 可通过统一 Provider 替换。
- 缺点：需要更多状态和接口设计。

### 方案三：使用 Supabase 业务表和自动 upsert

- 优点：查询灵活，实现简单。
- 缺点：偏离单表快照定义；无条件 upsert 会造成静默覆盖；每个派生项目需要重新设计后端。

## 推荐方案

采用方案二。`SyncManager` 只依赖本地 Repository 与 `SyncProvider`，通过 dataVersion/lastRemoteVersion/dirty 决策。`SupabaseSyncProvider` 使用 `(user_id, app_id)` 行和带预期版本过滤的 update 实现乐观并发。OpenAI 示例通过 `ExternalApiProvider` 和 `ApiKeyStore` 接入，不影响业务 Payload。

## 影响范围

- 新增 `@supabase/supabase-js` 运行时依赖和独立异步构建分块。
- 扩展本地 Repository 的远程应用、同步确认和备份能力。
- 新增认证、同步、偏好、Supabase Provider 和冲突状态。
- 设置页新增云同步及 OpenAI Key 区域；添加应用表单新增 AI 名称建议。
- 新增三份主规范、Phase 2–4 变更文档、测试和 `START.md`。

## 兼容性与迁移计划

- `VITE_ENABLE_CLOUD_SYNC` 默认 false；没有 Supabase 配置时现有本地行为不变。
- 现有 schemaVersion 1 Payload 无需变更；同步元数据已存在 Envelope 中。
- 用户登录后首次同步时，远程不存在则上传本地；本地初始为空且远程存在则备份后恢复云端。
- API Key 使用独立存储前缀，不进入现有数据导出。
- 回滚时禁用云同步环境变量即可恢复纯本地运行，云快照不会阻止本地读取。
