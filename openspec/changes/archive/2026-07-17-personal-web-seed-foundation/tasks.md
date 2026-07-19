# Personal Web Seed Phase 1 任务拆解

## 总体里程碑

- M1：规范和工程基础可用。
- M2：本地数据基础设施完成并经过测试。
- M3：Gipsy 业务完成迁移，数据管理界面可用。
- M4：文档、部署和持续集成完整，全部质量门禁通过。

## 阶段一：规范与工具链

- [x] **P0 / Codex**：编写提案、设计、任务和规范。
  - 验收：文档全部为中文，方案、风险、兼容迁移和验收条件一致。
- [x] **P0 / Codex**：引入 Tailwind、Zod、Vitest、ESLint 和 Prettier。
  - 验收：对应脚本可执行，TypeScript 保持 strict。
- [x] **P0 / Codex**：固定 Node 22，增加 GitHub Actions 和 Vercel SPA 配置。
  - 验收：CI 顺序执行安装、类型、Lint、测试和构建。

## 阶段二：本地数据基础设施

- [x] **P0 / Codex**：实现 Envelope Schema、统一错误和 LocalDataRepository。
  - 验收：读取、写入和更新均经 Zod 校验；更新递增 dataVersion 并设置 dirty。
- [x] **P0 / Codex**：实现 schemaVersion 迁移与 `gipsy-apps` 旧数据迁移。
  - 验收：成功迁移名称和 URL；失败时旧数据仍存在且用户收到错误。
- [x] **P0 / Codex**：实现 JSON 导入导出、自动备份和容量分级。
  - 验收：错误格式或 appId 被拒绝，导入前保存当前数据，容量阈值符合设计。
- [x] **P1 / Codex**：实现 ApiKeyStore。
  - 验收：默认 sessionStorage；只有显式持久化时写入 LocalStorage；支持删除和全部清除。
- [x] **P0 / Codex**：补齐基础设施单元测试。
  - 验收：覆盖 Envelope、版本、dirty、导入导出、迁移、配额错误和 Key Store。

## 阶段三：业务和界面改造

- [x] **P0 / Codex**：将应用管理迁移到 `features/apps` 和 Repository。
  - 验收：组件不直接访问 LocalStorage，新增和删除刷新后保持。
- [x] **P0 / Codex**：增加应用稳定 ID 和名称唯一性校验。
  - 验收：删除只影响选中应用，重复名称得到明确提示。
- [x] **P0 / Codex**：扩展设置页的数据管理能力。
  - 验收：显示 schemaVersion、dataVersion、容量和 dirty；支持导出、导入和清空。
- [x] **P1 / Codex**：增加离线、PWA 和错误状态反馈。
  - 验收：网络状态变化可见，存储错误不被静默忽略。
- [x] **P0 / Codex**：回归应用启动协议。
  - 验收：`appName` 精确查找，目标 URL 收到 `appName` 和 `returnUrl`。

## 阶段四：文档和交付

- [x] **P0 / Codex**：编写完整 README 和 Supabase 后续初始化说明。
  - 验收：覆盖本地运行、PWA、数据、环境变量、RLS、同步边界、Vercel 和派生项目流程。
- [x] **P0 / Codex**：建立标准 `AGENTS.md` 和 OpenSpec 项目上下文。
  - 验收：后续 Codex 可以从仓库内识别架构边界、变更流程和质量门禁。
- [x] **P0 / Codex**：执行最终验证和需求审计。
  - 验收：typecheck、lint、test、build 全部通过，工作区无意外产物。

## 依赖与风险

- npm 依赖安装需要可用的软件源。
- 浏览器既有 `gipsy-apps` 数据只能通过自动迁移和测试数据验证，无法读取用户真实浏览器环境。
- Supabase 运行时属于后续 Phase 2，本阶段只记录数据库与安全边界，不将其作为验收阻塞项。
