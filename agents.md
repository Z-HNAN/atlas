# Atlas 虚拟旅行收藏地图 Codex 协作指南

本项目由 Codex 辅助开发，并按变更风险分级使用 OpenSpec。OpenSpec 用于沉淀长期产品契约、架构决策和兼容边界，不作为每个小改动的固定文书流程。所有规范、设计、提案、任务、代码注释和面向用户的文案必须使用中文表达。

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

## 变更分级与 OpenSpec

Codex 开始实现前必须先判断变更属于 S、M 或 L 级，并在工作说明中用一句话说明依据。用户明确指定等级或要求使用 OpenSpec 时优先遵循；证据表明风险更高时必须升级，不得为了减少文档而降级。拿不准时按较高一级处理。

OpenSpec 记录未来仍需遵守的产品与技术契约；局部实现细节优先由类型、测试和提交说明记录。

### S 级：小改动

同时满足以下条件时属于 S 级：

- 不改变架构不变量、业务数据 Schema、存储键、同步协议、认证、权限、安全边界、Provider 契约或 PLN 格式。
- 不需要数据迁移、兼容策略或跨 Feature 设计。
- 影响范围局部，验收条件明确，失败可以通过回滚单个提交恢复。

典型场景包括文案、样式、可访问性、小范围交互、符合现有规范的明确 Bug、测试补强和不改变行为的重构。

S 级 SHALL NOT 创建 OpenSpec change。流程为：检查现状与差异 → 直接实现 → 补回归测试 → 执行对应门禁 → 报告并提交。若修复过程中发现现有规范需要改变，立即升级为 M 级。

### M 级：行为改动

改变用户可感知行为或某项能力契约，但不改变整体架构和数据兼容边界时属于 M 级。典型场景包括筛选规则、表单流程、AI Prompt、错误恢复、地图交互、Provider 请求行为和导出细节。

M 级使用轻量 OpenSpec：

```text
openspec/changes/YYYY-MM-DD-<topic>/
├── tasks.md
└── specs/<capability>/spec.md
```

- `tasks.md` 必须包含优先级、执行方、依赖和可验证验收条件。
- `specs/<capability>/spec.md` 只记录本次新增、修改或删除的能力契约与 Scenario。
- 存在多个可行方案、明显风险或重要取舍时增加 `design.md`。
- 问题边界、目标/非目标或迁移影响需要单独评审时增加 `proposal.md`。
- 能力契约变化时同步更新 `openspec/specs/<capability>/spec.md` 主规范。

需求明确且不存在需要用户选择的重大分歧时，Codex 可以在同一任务中维护轻量规范并完成实现；不得用文档代替测试。

### L 级：架构或高风险改动

出现以下任一情况时属于 L 级：

- 修改业务 Schema、schemaVersion、存储格式、迁移、导入覆盖或备份恢复。
- 修改同步协议、冲突策略、Supabase 表/RLS、认证、权限或敏感数据边界。
- 引入新的外部服务、Serverless、IndexedDB、状态管理、业务数据库或跨 Feature 通用层。
- 修改 PLN 协议兼容、公开 API、核心用户闭环或离线能力。
- 存在不可逆操作、多个方案的重要权衡或发布兼容风险。

L 级必须使用完整 OpenSpec：

```text
openspec/changes/YYYY-MM-DD-<topic>/
├── proposal.md
├── design.md
├── tasks.md
└── specs/<capability>/spec.md
```

- `proposal.md`：问题、目标与非目标、方案对比、推荐方案、影响和迁移。
- `design.md`：背景、现状、架构、关键细节、失败恢复、风险权衡和验收标准。
- `tasks.md`：可执行任务、优先级、执行方、依赖和验收条件。
- `specs/<capability>/spec.md`：本次能力规范。

涉及需要用户决定的产品方向、数据取舍或破坏性策略时，规范确认后再实现。用户已给出明确方案并要求直接完成时，可连续实施，但规范、代码和测试必须在交付时一致。

### 活跃变更与归档

1. 主题使用 `YYYY-MM-DD-<topic>` 命名。
2. 开发中的 M/L 级变更放在 `openspec/changes/<topic>/`，不得预先放入 `archive/`。
3. 实现变化时同步修正规范，禁止文档与代码长期不一致。
4. 完成后核对任务、兼容策略和验收条件，执行 OpenSpec strict 校验及项目质量门禁。
5. 只有全部任务完成并验证通过后，才将变更移动到 `openspec/changes/archive/<topic>/`。

## Codex 实施原则

- 开始前阅读相关 OpenSpec、README、现有测试和当前工作区差异，并先给出 S/M/L 分级；S 级不为满足形式而创建 OpenSpec。
- 先沿现有 Feature 边界扩展；只有种子规范明确要求或出现第二个真实使用方时才抽取通用层。
- React 组件只负责渲染和交互编排，校验、存储、同步和 Provider 逻辑放到对应基础设施。
- Bug 修复必须优先增加能在修复前失败、修复后通过的回归测试；无法自动化时报告人工验证证据。
- 一次请求优先形成一个边界清晰、可回滚的提交，避免混入无关重构。
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

## 交付质量清单

所有等级：

- [ ] 已说明 S/M/L 分级及依据。
- [ ] 全部文档和用户文案为中文表达。
- [ ] 变更边界清晰，没有混入无关修改。
- [ ] 实现、测试和用户指南一致。
- [ ] 数据、安全、离线和兼容边界没有互相矛盾。
- [ ] 已执行并报告要求的质量门禁。

M/L 级追加检查：

- [ ] 任务具备执行方、优先级、依赖和验收条件。
- [ ] 能力规范包含可直接指导实现和测试的 Scenario。
- [ ] 主规范已同步，完成后才归档。

L 级追加检查：

- [ ] 设计包含失败恢复、风险与权衡。
- [ ] 提案包含方案对比与迁移策略。
- [ ] 破坏性或需要产品选择的方案已经用户确认。
