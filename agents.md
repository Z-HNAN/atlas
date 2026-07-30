# Atlas 虚拟旅行收藏地图 Codex 协作指南

本项目采用 OpenSpec 驱动并由 Codex 辅助开发。所有规范、设计、提案、任务、代码注释和面向用户的文案必须使用中文表达。

当前业务是 Local-first 的 AI 虚拟旅行收藏地图；DeepSeek BYOK 用于生成结构化旅行计划，Nominatim 用于地理编码，Leaflet 用于路线与收藏地图，PLN 模块用于导出 Sky4Sim 已验证的自定义航点路线。

## 架构不变量

- 核心功能必须 Local-first：无网络、未登录、未配置 Supabase 时仍可完整使用本地功能。
- UI 不得直接操作 LocalStorage、sessionStorage、Supabase 表或具体第三方 API URL。
- 持久化数据和外部响应必须通过 Zod 校验；TypeScript 保持 strict，禁止使用显式 `any` 绕过检查。
- 正式业务数据只能保存在 `LocalAppEnvelope.payload`；API Key、认证 Token 和设备偏好不得进入 Payload、云快照或导出文件。
- 每次业务数据修改必须递增 dataVersion、更新 updatedAt 并设置 `sync.dirty = true`。
- schemaVersion 变化必须提供顺序迁移；迁移和导入覆盖前必须备份，失败时不得静默丢弃数据。
- Supabase 是可选增强，默认关闭；浏览器中禁止使用 secret、service role、数据库密码或其它私密凭证。
- 云端更新必须带 expectedRemoteVersion，禁止用无条件 upsert 静默覆盖；冲突时禁止自动合并或自动上传。
- 第三方能力必须通过 ExternalApiProvider；Key 默认只进 sessionStorage，用户主动选择后才可持久化，错误和日志不得包含 Key。
- 不提前引入 Serverless、IndexedDB、复杂状态管理或 CRDT；达到 README 中的升级条件后单独立项。

## 目录边界

- `src/app`：应用装配、Router 和全局 Provider。
- `src/features/<name>`：业务功能，包含组件、Hook、Schema、Repository 配置和类型。
- `src/features/trips`：旅行 Schema、Repository、Hook、DeepSeek/Nominatim Provider 和 PLN。
- `src/lib/local-data`：Envelope、Repository、迁移、导入导出和容量计算。
- `src/lib/api-keys`：BYOK Key Store。
- `src/lib/sync`：与云厂商无关的同步协议；Supabase 实现只能依赖该协议。
- `src/lib/supabase`：按需加载的 Supabase 客户端；云同步关闭时不得建立连接。
- `src/lib/providers`：第三方 API Provider 协议。
- `src/lib/errors`：统一错误模型，错误信息不得泄露 Key 或完整私密数据。
- `tests/unit` 与 `tests/integration`：基础设施和业务生命周期验证。
- `supabase/migrations`：可审计的数据库变更与 RLS。

## OpenSpec 流程

1. 确认主题，使用 `YYYY-MM-DD-<topic>` 命名。
2. 在 `openspec/changes/archive/<topic>/` 创建或更新：
   - `proposal.md`：问题、目标与非目标、方案对比、推荐方案、影响和迁移。
   - `design.md`：背景、现状、架构、关键细节、风险权衡和验收标准。
   - `tasks.md`：可执行任务、优先级、依赖和验收条件。
   - `specs/<capability>/spec.md`：本次能力规范。
3. 同步更新 `openspec/specs/<capability>/spec.md` 主规范。
4. 规范确认后再实现；实现变化时同步修正规范，禁止文档与代码长期不一致。
5. 完成后核对全部任务、兼容策略和验收条件。

## Codex 实施原则

- 开始前阅读相关 OpenSpec、README、现有测试和当前工作区差异。
- 先沿现有 Feature 边界扩展；只有种子规范明确要求或出现第二个真实使用方时才抽取通用层。
- React 组件只负责渲染和交互编排，校验、存储、同步和 Provider 逻辑放到对应基础设施。
- 所有破坏性操作必须有用户确认；导入、迁移、清空和云端覆盖必须有恢复路径。
- 不输出或记录 API Key；不得将 `.env`、用户导出数据或真实凭证提交到仓库。
- Codex 在交付前必须执行并报告：

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run format:check
npm run build
```

本地启动、云配置、OpenSpec 命令、Codex 请求模板和派生步骤统一记录在 `START.md`；影响这些流程的变更必须同步更新指南。

## 规范文档质量清单

- [ ] 全部文档为中文表达。
- [ ] 设计包含风险与权衡。
- [ ] 提案包含方案对比与迁移策略。
- [ ] 任务具备负责人、优先级和验收条件。
- [ ] 规范可直接指导实现和测试。
- [ ] 数据、安全、离线和兼容边界没有互相矛盾。
