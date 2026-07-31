# engineering-foundation

## Purpose

固定 Atlas 的前端工具链、PWA、部署、持续集成和 Codex 协作约束，使项目在每个阶段都可运行、可测试、可部署。

## Requirements

### Requirement: 固定开发工具链

项目 SHALL 使用 Vite、React、严格 TypeScript、React Router、Tailwind CSS、Zod、Dexie、Ky、Vitest、ESLint 和 Prettier，并 SHALL 固定 Node.js 22。

#### Scenario: 本地质量门禁

- **WHEN** 开发者准备交付变更
- **THEN** `npm run typecheck`、`npm run lint`、`npm run test -- --run`、`npm run format:check` 和 `npm run build` 全部成功

#### Scenario: 未配置环境变量

- **WHEN** `.env.local` 不存在且未配置同步 Worker
- **THEN** 依赖安装、生产构建和纯本地核心功能仍可用

### Requirement: 持续集成

仓库 SHALL 在 push 和 pull request 上使用 Node.js 22 执行可复现的质量门禁。

#### Scenario: CI 验证

- **WHEN** GitHub Actions 运行 CI
- **THEN** 工作流依次执行 `npm ci`、typecheck、lint、test 和 build，任一步失败都会阻止 verify job 成功

### Requirement: PWA 与离线应用壳

生产构建 SHALL 生成 Manifest 和 Service Worker，并 SHALL 仅预缓存应用壳、图标和必要构建资源。

#### Scenario: 离线打开

- **WHEN** 用户曾加载生产 PWA 后断开网络
- **THEN** 应用壳可以打开，本地应用配置仍可查看和编辑，界面显示离线状态

#### Scenario: 敏感资源缓存边界

- **WHEN** Service Worker 生成缓存规则
- **THEN** 规则不得缓存 API Key、额外复制的认证 Token、外部私密响应或无明确策略的跨域请求

#### Scenario: 新版本提示

- **WHEN** 新 Service Worker 等待激活
- **THEN** 应用提示用户点击刷新，而不是在用户操作期间静默替换页面

### Requirement: Vercel 静态部署

项目 SHALL 使用 `npm run build` 生成 `dist`，并 SHALL 为 React Router 配置 SPA 回退。

#### Scenario: 前端路由直达

- **WHEN** Vercel 收到 `/settings` 等非静态文件路径请求
- **THEN** 请求回退到 `/index.html` 并由 React Router 处理

#### Scenario: PWA 静态文件

- **WHEN** 请求 `/sw.js`、`/manifest.webmanifest` 或 `/assets/*`
- **THEN** 部署平台返回真实构建文件，而不是错误页面

### Requirement: 可选云能力安全边界

Cloudflare 快照同步 SHALL 是默认关闭的可选增强，且 SHALL NOT 成为应用初始化或本地保存的依赖。

#### Scenario: 前端环境变量

- **WHEN** 配置任意 `VITE_` 环境变量
- **THEN** 该变量被视为公开信息，不得包含 Access 私钥、R2 密钥、D1 凭证、DeepSeek Key 或其它私密凭证

#### Scenario: Worker 成员隔离

- **WHEN** 用户访问受 Access 保护的同步 API
- **THEN** Worker 验证 JWT 与成员关系，非成员不可读取，readonly 成员不可写入

### Requirement: Codex 与 OpenSpec 协作

功能变更 SHALL 先维护中文 OpenSpec，再修改实现；Codex SHALL 遵循根目录 `AGENTS.md` 的数据、安全、目录和验证约束。

#### Scenario: 创建功能变更

- **WHEN** Codex 开始非平凡功能开发
- **THEN** 对应归档目录包含中文 proposal、design、tasks 和 capability spec，主规范同步更新

#### Scenario: 交付变更

- **WHEN** Codex 声明任务完成
- **THEN** README、OpenSpec、实现和测试互相一致，五项质量门禁已运行且结果被报告

### Requirement: 分层与按需升级

业务代码 SHALL 位于 `features`，跨业务基础设施 SHALL 位于 `lib`；IndexedDB、Worker、D1 和 R2 只服务已确认的本地存储与不可变快照需求，系统 SHALL NOT 在没有明确需求时引入复杂状态管理、CRDT、实时协作或业务查询数据库。

#### Scenario: 新增业务能力

- **WHEN** 派生项目实现新的业务功能
- **THEN** 项目替换 appId、storageKey、Payload 类型、Zod Schema、迁移和业务 Feature，并复用经过验证的通用基础设施

#### Scenario: 架构升级

- **WHEN** 数据接近数 MB、需要 Blob/索引、服务端查询、多人协作、密钥保密、CORS 代理、支付、Webhook 或可信计算
- **THEN** 项目以独立 OpenSpec 评估索引查询、业务数据库、薄代理、增量同步或全栈框架，不污染当前架构边界

### Requirement: 收益驱动的第三方依赖

项目 SHALL 允许维护活跃、类型完整、许可与安全边界清晰的成熟库承接通用基础能力；引入前 SHALL 评估真实需求、包体积、浏览器兼容、PWA 影响、可测试性、迁移和退出成本。第三方库 SHALL 封装在基础设施适配层之后，业务 Schema、Envelope、版本、备份、冲突和安全契约 SHALL 继续由项目掌控。

#### Scenario: 通用基础设施存在成熟实现

- **WHEN** 原生实现需要维护复杂生命周期、事务、兼容或错误处理，且成熟库能以可接受成本降低错误面
- **THEN** 项目优先通过基础设施适配层使用该库，并删除重复实现

#### Scenario: 简单能力没有足够引库收益

- **WHEN** 现代浏览器 API 稳定、实现短小且业务边界清晰
- **THEN** 项目保留原生实现，不为形式上的工程化新增依赖

## Compatibility

- 依赖大版本升级必须独立验证类型、测试、PWA 和生产构建。
- 从种子派生项目必须保留 Local-first 和数据恢复能力，除非新的 OpenSpec 明确改变产品目标并提供迁移方案。
