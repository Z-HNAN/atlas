# Personal Web Seed 本地优先基础提案

## 问题定义

Gipsy 已具备 React、TypeScript、路由和 PWA 能力，但业务数据仍由组件附近的代码直接读写 LocalStorage，缺少数据校验、版本、迁移、导入导出、容量提示和失败反馈；工程也缺少测试、静态检查、统一格式化、持续集成和完整开发文档。这使它尚不能作为长期复用的个人 Web 项目种子。

## 目标与非目标

### 目标

- 在不改变 Gipsy“应用配置与跳转门户”定位的前提下，建立 Local-first 的数据基础设施。
- 使用统一 Envelope 保存业务快照，并通过 Zod 校验所有持久化与导入数据。
- 支持旧 `gipsy-apps` 数据迁移、JSON 导入导出、清空恢复、容量检查和明确错误反馈。
- 补齐 Tailwind CSS、Vitest、ESLint、Prettier、CI、Vercel 和 PWA 工程约束。
- 通过目录边界、OpenSpec、`AGENTS.md` 和 README 固化后续 Codex 辅助开发流程。
- 为可选 Supabase 快照同步和 BYOK Provider 保留稳定接口边界。

### 非目标

- 本阶段不接入 Supabase Auth，不执行云端读写，也不提供可用的云同步页面。
- 本阶段不实现多设备冲突处理、实时协作、CRDT 或业务字段级同步。
- Gipsy 当前没有第三方 API，本阶段不添加虚构的 API Provider 或 Key 输入页面。
- 不引入服务端、SSR、Next.js、复杂状态管理或 IndexedDB。

## 方案对比

### 方案一：继续直接使用 LocalStorage

- 优点：改动少，当前功能可以继续运行。
- 缺点：无法可靠校验、迁移和恢复数据；写入失败可能静默丢失；业务组件与存储实现耦合，无法复用。

### 方案二：引入 IndexedDB 和完整同步框架

- 优点：容量和查询能力更强，可提前覆盖复杂场景。
- 缺点：明显超出当前小型文本数据规模，引入额外异步复杂度，也违背种子架构按需升级原则。

### 方案三：统一 Envelope + Repository，云同步延后

- 优点：保持纯前端和 Local-first；当前阶段即可获得校验、版本、备份与测试能力；未来可替换存储实现并接入 SyncProvider。
- 缺点：LocalStorage 仍有容量上限，全量 JSON 写入不适合大数据。

## 推荐方案

采用方案三。以 `app:gipsy:data` 为正式存储键，使用包含 `schemaVersion`、`dataVersion`、`deviceId` 和同步元数据的 Envelope 包装 `GipsyPayload`。UI 只通过业务 Hook 调用 Repository，不直接访问 LocalStorage。

第一阶段交付可独立运行、测试和部署的本地版本；Supabase SQL 和运行时同步在后续独立变更中实现，避免云能力成为应用启动前提。

## 影响范围

- 工程配置：`package.json`、TypeScript、Vite、Tailwind、Vitest、ESLint、Prettier。
- 应用结构：入口、路由、页面、应用业务 Feature 和通用 `lib` 基础设施。
- 数据格式：从 `gipsy-apps` 数组迁移为版本化 Envelope。
- 用户界面：设置页增加数据版本、容量、导入、导出和清空能力；增加离线与存储错误反馈。
- 交付流程：新增 GitHub Actions、Vercel SPA 配置、Node 版本约束和验证命令。
- 协作流程：新增标准大小写的 `AGENTS.md`，更新 OpenSpec 项目上下文和 README。

## 兼容性与迁移计划

- 首次加载若不存在新存储键但存在 `gipsy-apps`，校验旧数组后生成 Envelope。
- 为旧应用配置生成稳定 ID；应用名称和 URL 保持不变。
- 迁移成功后将旧 JSON 保存到专用备份键，再移除旧键，防止清空新数据后被重复迁移。
- 迁移、解析或写入失败时保留原数据并显示明确错误，不静默回退覆盖。
- 首页卡片、应用新增、删除和 `appName`/`returnUrl` 跳转协议继续兼容。
