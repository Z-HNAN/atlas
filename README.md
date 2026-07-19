# Todo Seed

Todo Seed 是一套可长期复用的个人 Web 项目种子，也是一个可以直接运行的 Local-first Todo List。它用一项完整但克制的参考业务展示表单、列表、过滤、状态更新、删除、版本迁移、备份恢复、可选云同步和 DeepSeek BYOK，并把 Codex + OpenSpec 固化为后续开发流程。

没有网络、账号、Supabase 或 DeepSeek Key 时，Todo 的新增、完成、筛选、删除、导入导出和 PWA 仍可完整使用。

## 能力概览

- Vite 5、React 18、严格 TypeScript、React Router、Tailwind CSS
- Zod 校验的版本化 `LocalAppEnvelope<TodoPayload>`
- Todo 新增、完成/恢复、三种过滤、单条删除、清理已完成
- schemaVersion 1 应用导航数据到 schemaVersion 2 Todo 的安全迁移
- JSON 导入导出、覆盖前自动备份、本地容量提示
- PWA 离线应用壳与用户确认更新
- 可选 Supabase Magic Link 与乐观并发 JSON 快照同步
- DeepSeek Chat Completions JSON Output 的 BYOK 任务拆解
- Vitest、ESLint、Prettier、CI、中文 OpenSpec 与 Codex 协作约束

完整启动、云配置、Codex 工作流和派生清单见 [START.md](./START.md)。

## 本地运行

要求 Node.js 22：

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

访问 `http://localhost:5173`。不创建 `.env.local` 也能以纯本地模式运行。

交付前执行：

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run format:check
npm run build
```

## Todo 参考业务

首页可以：

- 添加标题和可选备注；
- 标记完成或恢复进行中；
- 查看全部、进行中、已完成；
- 确认后删除单条或清理全部已完成；
- 配置 DeepSeek Key 后，将一条任务拆成 2～6 个子任务，预览确认后一次加入。

Todo 是派生项目的工程参考，不是必须保留的产品功能。创建其它个人工具时，应替换 `src/features/todos` 的 Payload、Schema、Repository 配置、Hook、页面和测试，同时保留通用 Local-first 基础设施。

## Local-first 数据

正式数据位于 LocalStorage 的 `app:gipsy:data`：

```text
LocalAppEnvelope<TodoPayload>
├── appId / schemaVersion / dataVersion
├── updatedAt / deviceId
├── payload.todos[]
└── sync.dirty / lastRemoteVersion / lastSyncedAt
```

UI 不直接读写 LocalStorage。`BrowserLocalDataRepository` 统一负责 Zod 校验、版本递增、dirty 标记、Schema 迁移、JSON 导入导出、覆盖前备份和容量计算。API Key、认证 Token 与设备偏好不进入 Payload、云快照或导出文件。

当前 `appId=gipsy` 和存储键保持不变，以便已有用户升级。schemaVersion 从 1 升到 2：旧应用名称会转换为“迁移的应用”待办，旧名称和 URL 保存在备注中，迁移前的原 Envelope 保存在最近备份。更早的 `gipsy-apps` 裸数组也会保留 legacy backup 后迁移。失败时原数据不会被静默删除。

容量策略：

- 小于 2 MB：正常；
- 2～4 MB：提醒导出；
- 大于 4 MB：建议立即导出，并评估 IndexedDB。

## DeepSeek BYOK

设置页保存用户自己的 DeepSeek API Key；首页通过 `DeepSeekTaskBreakdownProvider` 调用 `POST https://api.deepseek.com/chat/completions`，使用 JSON Output 返回子任务。

- Provider ID 为 `deepseek`；
- Key 默认只进入 sessionStorage，主动选择“记住”后才进入 LocalStorage；
- Key 不进入 TodoPayload、JSON 导出、Supabase、URL、日志或 PWA 缓存；
- 页面只调用 Feature Hook，不能直接拼接供应商 URL；
- 超时、取消、429/5xx 有限重试、CORS 与无效响应统一转换为 `AppError`；
- AI 失败不影响手工 Todo。

默认模型由公开变量 `VITE_DEEPSEEK_MODEL` 配置。当前默认值为 `deepseek-v4-flash`；模型变化时只更新配置和 Provider 测试，不修改业务 Payload。浏览器直连被供应商或网络策略阻止时，应另立 OpenSpec 增加 Server Provider，不能把项目方共享 Key 编译进前端。

## PWA 与离线

生产构建生成 Manifest 和 Service Worker，只预缓存应用壳、图标和构建静态资源。离线时 Todo 本地操作继续可用；Supabase 和 DeepSeek 会显示可恢复错误。新 Service Worker 等待激活时，由用户点击刷新。

```bash
npm run build
npm run preview
```

生产预览至少验证 `/`、`/settings`、`/manifest.webmanifest`、`/sw.js` 和一个 `/assets/*` 文件。

## 可选 Supabase 云同步

云同步默认关闭，关闭时不会建立 Supabase 连接。开启后支持邮箱 Magic Link、手动同步、可选 3 秒防抖自动同步、云端恢复、本地覆盖云端、删除云快照和冲突处理。

数据库迁移位于 `supabase/migrations/0001_app_sync_snapshots.sql`。共享表以 `(user_id, app_id)` 为主键，RLS 仅允许 authenticated 用户操作自己的行。更新必须带 `expectedRemoteVersion`；两端同时修改时禁止自动合并或覆盖。

浏览器只能配置公开 URL 与 Publishable Key（旧项目可用 anon key），禁止使用 secret、service role 或数据库密码。

## 环境变量

```env
VITE_APP_ID=gipsy
VITE_ENABLE_CLOUD_SYNC=false
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_DEEPSEEK_MODEL=deepseek-v4-flash
```

所有 `VITE_` 变量都会编译进浏览器资源，不能放任何私密凭证。DeepSeek API Key 必须由用户在运行时输入。

## 目录结构

```text
src/app                 应用装配和路由
src/features/todos      Todo 业务、Schema、Repository 配置、Hook、DeepSeek Provider
src/components          通用反馈与设置 UI
src/lib/local-data      Envelope、Repository、迁移、备份和容量
src/lib/api-keys        BYOK Key Store
src/lib/sync            SyncManager、同步协议、偏好与 Supabase Provider
src/lib/supabase        按需加载的客户端与认证网关
src/lib/providers       第三方 API Provider 协议
src/lib/errors          统一错误模型
tests                   单元与集成测试
openspec                中文主规范和归档变更
supabase                可选云同步 SQL 与说明
```

## Codex 辅助开发

后续种子和派生项目默认采用 Codex + OpenSpec：

1. 让 Codex 先读取 `AGENTS.md`、`START.md`、相关主规范、测试和工作区差异。
2. 非平凡变更先创建中文 proposal、design、tasks 和 capability spec。
3. 同步更新 `openspec/specs` 主规范，再沿现有 Feature 边界实现。
4. 迁移、导入、清空和云端覆盖必须保留恢复路径。
5. 交付前运行全部质量门禁和真实浏览器回归，并报告未使用真实凭证验证的部分。

## 从种子派生

至少替换：

- 全局唯一的 `VITE_APP_ID`、storageKey 和应用品牌；
- Payload TypeScript 类型、严格 Zod Schema、schemaVersion 和迁移链；
- `src/features/todos` 参考业务及其测试；
- PWA 名称、描述、图标；
- README、START、AGENTS 上下文和 OpenSpec。

不要复制 `gipsy` 的 appId 到新项目。数据接近数 MB、需要索引/Blob 时评估 IndexedDB；需要服务端统计、多人协作、密钥保密、CORS 代理、支付或 Webhook 时，分别创建新的 OpenSpec 再升级架构。
