# Todo Seed 启动与 Codex 开发指南

本指南面向直接运行 Todo Seed 的人，以及从本仓库派生个人 Web 项目并持续使用 Codex + OpenSpec 开发的人。

Todo Seed 默认是纯前端、Local-first 应用。没有账号、网络、Supabase 或 DeepSeek Key 时，Todo、本地备份和 PWA 仍可完整使用；云同步与 AI 拆解都是可选增强。

## 1. 五分钟启动

要求 Node.js 22、npm，以及支持 LocalStorage、sessionStorage 和 Service Worker 的现代浏览器。

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:5173`。第一次使用可以直接新增 Todo，不需要配置任何外部服务。

提交或交付前执行：

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run format:check
npm run build
```

CI 在 Node 22 下执行相同的类型、Lint、测试和生产构建检查。

## 2. 环境变量

复制 `.env.example` 为 `.env.local`；该文件不得提交。

| 变量                            | 默认值              | 用途                                   |
| ------------------------------- | ------------------- | -------------------------------------- |
| `VITE_APP_ID`                   | `gipsy`             | 本地数据、云快照和偏好的稳定标识       |
| `VITE_ENABLE_CLOUD_SYNC`        | `false`             | 是否启用可选云同步                     |
| `VITE_SUPABASE_URL`             | 空                  | Supabase 公开 Project URL              |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 空                  | Publishable Key；旧项目可使用 anon key |
| `VITE_DEEPSEEK_MODEL`           | `deepseek-v4-flash` | DeepSeek 任务拆解模型                  |

纯本地模式：

```env
VITE_APP_ID=gipsy
VITE_ENABLE_CLOUD_SYNC=false
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_DEEPSEEK_MODEL=deepseek-v4-flash
```

开启云同步：

```env
VITE_APP_ID=gipsy
VITE_ENABLE_CLOUD_SYNC=true
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
VITE_DEEPSEEK_MODEL=deepseek-v4-flash
```

所有 `VITE_` 变量都会编译进浏览器资源。禁止填写 Supabase secret/service role、数据库密码、DeepSeek Key 或其它服务端秘密。DeepSeek Key 只能由用户在运行时设置。

修改变量后需要重启开发服务器或重新部署。

## 3. 使用 Todo

首页支持：

1. 填写标题和可选备注，点击“加入待办”。
2. 用 checkbox 标记完成或恢复。
3. 在“全部 / 进行中 / 已完成”之间筛选。
4. 确认后删除单条，或清理全部已完成。
5. 配置 DeepSeek Key 后，将当前标题和备注拆解为子任务；预览后再一次加入。

筛选只影响展示，不修改数据顺序或 Payload。Todo 的所有业务修改都通过 Repository，自动递增 dataVersion、更新时间并设置 `sync.dirty=true`。

### 本地数据与备份

正式数据存储在 `app:gipsy:data`，结构是 `LocalAppEnvelope<TodoPayload>`。设置页可以：

- 查看 schemaVersion、dataVersion、dirty、容量和 PWA 状态；
- 导出不含设备、同步、认证和 Key 信息的标准 JSON；
- 下载最近一次覆盖前的本地备份；
- 导入同一 appId 且可迁移的 JSON，覆盖前自动备份；
- 确认后清空 Todo，清空前自动备份。

建议重要修改前主动导出。Supabase 是第二恢复通道，不能替代本地导出。

### 从旧导航版本升级

本次升级保留 `appId=gipsy` 和原 storageKey，将 schemaVersion 从 1 提升到 2：

- 旧 `{ apps }` 中每条应用转换成未完成 Todo；
- 标题为 `迁移的应用：<名称>`；
- 备注保留旧名称和 URL；
- 旧 ID 继续使用；
- 迁移前原 Envelope 写入 `app:gipsy:data:backup:latest`；
- 更早的 `gipsy-apps` 裸数组迁移后写入 `app:gipsy:data:legacy-backup`。

无效旧数据、缺失迁移链或未来 schemaVersion 会被拒绝，不会静默覆盖原数据。

## 4. 使用 DeepSeek BYOK

DeepSeek 用来把一个待办拆解为 2～6 个子任务，不是 Todo 本地功能的依赖。

### 使用步骤

1. 准备自己的 DeepSeek API Key。
2. 打开“设置与数据”，在 DeepSeek BYOK 中输入 Key。
3. 默认保存到 sessionStorage；关闭浏览器会话后失效。
4. 只有主动勾选“在此浏览器中记住 Key”时才写入 LocalStorage。
5. 返回首页填写任务标题，可补充背景或完成标准。
6. 点击“DeepSeek 拆解”，检查结果后点击“全部加入待办”。

Key 不进入 TodoPayload、Supabase 快照、JSON 导出、URL、console 或仓库。公开变量 `VITE_DEEPSEEK_MODEL` 只配置模型名，不保存 Key。

### Provider 行为

`DeepSeekTaskBreakdownProvider` 调用：

```text
POST https://api.deepseek.com/chat/completions
```

请求使用 Chat Completions messages、`response_format: { "type": "json_object" }`、非流式响应和明确的 JSON 提示。返回内容经过外层 Chat Completion Schema、JSON.parse 和 Todo 子任务 Schema 三层校验；空内容、重复后少于两项或超过长度都会被拒绝。

Provider 还处理：

- 20 秒超时和 AbortSignal；
- 429 与 5xx 一次有限重试；
- 缺失 Key、离线、权限/余额、限流、网络、CORS 和无效响应的统一 AppError；
- 错误和日志不包含 Key 或完整私密响应。

默认模型为当前配置的 `deepseek-v4-flash`。模型可用性发生变化时，更新 `VITE_DEEPSEEK_MODEL`、官方文档说明和 Provider 测试。

### 浏览器直连失败

浏览器、组织网络或供应商 CORS 策略可能阻止直连。此时手工 Todo 完整可用。需要代理时单独创建 OpenSpec，通过 Vercel Function、Supabase Edge Function 等实现 Server Provider；业务页面与 `ExternalApiProvider` 边界保持不变。禁止把项目方共享 Key 编译进前端。

## 5. 配置 Supabase 云同步

### 5.1 创建项目与公开配置

1. 创建 Supabase 项目。
2. 复制 Project URL 和 Publishable Key；旧项目若只显示 anon key，也可以使用。
3. 不要把 secret、service role 或数据库密码放入浏览器变量。

### 5.2 应用数据库迁移

迁移文件是 `supabase/migrations/0001_app_sync_snapshots.sql`。使用 CLI：

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

也可以在 SQL Editor 完整执行迁移。执行后确认：

- `public.app_sync_snapshots` 存在；
- 主键为 `(user_id, app_id)`；
- RLS 已开启；
- authenticated 角色只有 select、insert、update、delete；
- 所有策略均以 `auth.uid() = user_id` 隔离用户。

### 5.3 配置 Magic Link

在 Supabase Authentication 中启用 Email 登录：

- 本地 Site URL：`http://localhost:5173`；
- Redirect URLs：加入 `http://localhost:5173/**`；
- 部署后加入正式域名和允许的回调路径。

用户 ID 只能来自当前 Auth Session，不能信任页面输入、URL 或 LocalStorage 中的用户 ID。

### 5.4 同步行为

开启变量并重启后，设置页可登录、立即同步或开启 3 秒防抖自动同步。

- 远程不存在：上传本地快照。
- 本地刚初始化为空、远程存在：备份本地后拉取远程。
- 本地未修改、远程更高：拉取远程。
- 本地修改、远程仍等于上次同步版本：安全上传。
- 两端都修改：进入冲突，不自动合并或覆盖。

冲突时可以保留本地、使用云端、分别导出或取消。更新必须带 `expectedRemoteVersion`，返回零行时重新拉取并进入冲突。

### 5.5 上线前 RLS 验证

至少用两个邮箱和两个独立浏览器配置验证：

1. 用户 A 创建并同步快照。
2. 用户 B 使用同一 appId 仍看不到 A 的快照。
3. 两个用户只能读写自己的行。
4. 退出后不能访问表。
5. 同一用户两台设备同时修改，第二次同步进入冲突而非静默覆盖。

## 6. 代码结构与边界

```text
src/app                         应用装配、全局 Provider、Router
src/features/todos              Todo 类型、Schema、Repository、Hook、DeepSeek Provider
src/components                  通用反馈与设置 UI
src/lib/local-data              Envelope、迁移、导入导出、备份、容量
src/lib/sync                    SyncManager、协议、偏好、Supabase Provider
src/lib/supabase                Supabase 按需客户端与认证网关
src/lib/api-keys                BYOK Key Store
src/lib/providers               外部 API Provider 接口
src/lib/errors                  统一 AppError
tests/unit                      决策、校验与边界测试
tests/integration               本地生命周期和双设备流程
openspec                        主规范与归档变更
supabase                        SQL 迁移和云端说明
```

必须保持：

- 页面和组件不直接读写 LocalStorage、sessionStorage 或 Supabase 表。
- 页面不直接拼接第三方 API 请求，通过 Feature Hook 和 Provider。
- 持久化、导入、远程快照和外部响应先通过 Zod。
- 每次业务修改递增 dataVersion、更新 updatedAt、标记 dirty。
- schemaVersion 提升必须有逐版本 Migration，覆盖前先备份。
- Supabase 和 DeepSeek 失败不能阻断本地 Todo。

## 7. 使用 OpenSpec 开发

根目录 `AGENTS.md` 是强制约束。所有规范、设计、任务、注释和用户文案使用中文。

非平凡变更目录：

```text
openspec/changes/archive/YYYY-MM-DD-topic/
├── proposal.md
├── design.md
├── tasks.md
└── specs/capability/spec.md

openspec/specs/capability/spec.md
```

流程：

1. proposal 写问题、目标/非目标、至少两个方案、推荐理由、影响和迁移。
2. design 写现状、架构、数据/接口、失败恢复、风险权衡和验收。
3. tasks 标注优先级、执行方、依赖和可验证验收条件。
4. 编写变更 capability spec，并同步主规范。
5. 规范确认后实现；实现变化时同步修正规范。
6. 完成后勾选任务，运行严格规范校验和全部质量门禁。

示例校验：

```bash
openspec list --specs
openspec validate todo-list --type spec --strict --no-interactive
openspec validate local-first-data --type spec --strict --no-interactive
openspec validate byok-provider --type spec --strict --no-interactive
openspec validate seed-workflow --type spec --strict --no-interactive
```

## 8. 使用 Codex 辅助开发

后续种子和派生项目默认使用 Codex。每次任务先让 Codex 阅读 `AGENTS.md`、`START.md`、相关主规范、测试和工作区差异。

推荐节奏：

1. **理解**：解释现有模块、数据边界、迁移风险，不立即改代码。
2. **规范**：先创建中文 OpenSpec 提案、设计、任务和主规范更新。
3. **实现**：沿 Feature 边界分阶段修改，保持 Local-first 和兼容性。
4. **测试**：先补迁移、校验和错误边界，再跑全量门禁。
5. **审计**：检查 Key 泄漏、直接存储访问、无条件 upsert、离线回归和缺失迁移。
6. **交付**：更新 README/START/OpenSpec，做真实浏览器回归，报告未使用真实凭证验证的部分。

参考请求：

```text
请先阅读 AGENTS.md、START.md、相关 openspec/specs、测试和 git diff。
为“给 Todo 增加截止日期”创建中文 OpenSpec 变更并同步主规范，再实现。
要求旧数据自动迁移、离线完整可用、导入导出兼容、补单元和集成测试，最后运行全部质量门禁和浏览器回归。
```

```text
请审计这次变更是否破坏 Local-first、DeepSeek BYOK 或同步乐观锁边界。
只报告证据和文件位置，不修改代码。
```

```text
请从该种子派生一个新的个人工具。先列出 APP_ID、Payload、Zod Schema、schemaVersion、迁移、页面、Provider 和测试替换计划；不要复制 gipsy 的存储标识。
```

## 9. 从种子派生新项目

Todo 是参考实现。派生时至少完成：

1. 设置全局唯一且稳定的 `VITE_APP_ID`，不要继续使用 `gipsy`。
2. 修改 `APP_CONFIG.appName`、PWA 名称、描述、主题、图标和页面品牌。
3. 在 `src/features/<new-feature>` 定义 Payload 类型和严格 Zod Schema。
4. 确定 schemaVersion；结构变化提供从每个旧版本到下一版本的 Migration。
5. 替换 `features/todos` 的页面、Hook、Repository 配置、Provider 和测试。
6. 保留通用 Envelope、Repository、SyncManager、Supabase Provider、Key Store、导入导出和错误层。
7. 只为真实需要的第三方能力新增 `ExternalApiProvider`；不用 DeepSeek 时删除相关 UI 和配置。
8. 更新 README、START、AGENTS 上下文和 OpenSpec。
9. 用新 appId 验证本地隔离、云端 `(user_id, app_id)` 隔离和导入 appId 拒绝。
10. 使用 Codex 完成规范、实现、门禁和浏览器回归闭环。

架构升级必须独立立项：

- 数据接近数 MB、需要索引或 Blob：评估 IndexedDB。
- 需要跨记录查询、服务端统计或多人数据：评估业务表。
- 需要隐藏项目方密钥、解决 CORS、支付、Webhook：增加 Serverless。
- 需要 SSR/SEO 或复杂全栈能力：评估全栈框架。
- 需要实时多人编辑：评估业务冲突模型、Realtime 或 CRDT。

## 10. 部署与 PWA 验证

Vercel 配置已在 `vercel.json`：Vite、`npm run build`、输出 `dist`、前端路由回退到 `/index.html`。部署环境使用 Node 22。

部署后验证：

- `/` 可打开 Todo；
- `/settings` 直接访问不返回 404；
- `/manifest.webmanifest`、`/sw.js`、一个 `/assets/*` 文件返回成功；
- 新增 Todo 后刷新仍存在；
- 离线重开已访问过的应用并继续本地操作；
- 若启用 Supabase，完成登录、同步、退出和双用户 RLS 验证。

## 11. 常见问题

### DeepSeek 拆解提示 CORS

手工 Todo 继续可用。网络允许时重试；若持续禁止浏览器直连，按 Provider 接口新增 Server Provider，不要把共享 Key 放进 `VITE_` 变量。

### DeepSeek 返回空内容或格式错误

JSON Output 仍可能返回空内容。Provider 会拒绝写入；重试或手工拆解。若更换模型，同步更新配置、官方说明和测试。

### 云同步显示“等待配置”

确认 `VITE_ENABLE_CLOUD_SYNC=true`，并设置 Supabase URL 和 Publishable Key，然后重启或重新部署。

### 同步一直显示冲突

这是保护行为。先分别导出两份数据，再明确选择本地或云端。取消不会清除冲突，也不会恢复自动上传。

### 导入被拒绝

确认文件为 `personal-web-seed-export`，appId 相同、schemaVersion 有完整迁移链、TodoPayload 通过当前 Zod Schema。

### 修改 Payload 后旧数据打不开

不要在不提升 schemaVersion 的情况下直接修改 Schema。新增逐版本 Migration，并补本地、导入和云快照迁移测试。

### 构建提示 Node 版本不兼容

运行 `nvm use` 并确认 Node 22。项目 CI 和当前 Supabase SDK 均以 Node 22 为基线。

## 12. 官方参考

- [DeepSeek 第一次 API 调用](https://api-docs.deepseek.com/)
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion)
- [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/)
- [Supabase 邮箱 OTP / Magic Link](https://supabase.com/docs/reference/javascript/auth-signinwithotp)
- [Supabase Auth 状态监听](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
