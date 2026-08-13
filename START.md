# Atlas 本地开发、共享云备份与 Codex 指南

Atlas 是 Local-first 的 AI 虚拟旅行收藏地图。IndexedDB 是正式业务数据主存储；DeepSeek、Nominatim 和 Gipsy 共享云备份都是可选网络增强。Atlas 静态前端部署到 Vercel，不创建或部署 Cloudflare 服务端资源。

正式地址约定：

- Atlas：`https://atlas-travel.app.10242020.xyz`
- 共享同步 API：`https://sync.api.10242020.xyz`

## 0. 先理解边界

- 离线、未登录、未配置 Key、未开启云备份或共享 Worker 故障时，手工旅行、地图、记录、导入导出和 PLN 仍可完整使用。
- 云备份默认关闭，且只在用户点击“立即同步”“从云端恢复”或处理冲突时访问服务端。
- 每个 `atlas-travel + Access 用户` 只保存一个最新 Head，不提供云端历史、自动后台同步、字段合并或多人共享同一 Payload。
- Atlas 只复用 Gipsy 已部署的 Worker、私有 R2 和 Access Application；本仓库不含 Worker、D1 migration、Wrangler 配置或服务端凭证。
- Atlas 正式 Origin 必须与 appId `atlas-travel` 一致。

## 1. 本地启动

要求 Node.js 22，以及支持 IndexedDB、CompressionStream、sessionStorage 和 Service Worker 的现代浏览器。

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:5173`。纯本地配置：

```env
VITE_APP_ID=atlas-travel
VITE_ENABLE_CLOUD_SYNC=false
VITE_SYNC_API_BASE_URL=
VITE_DEEPSEEK_BASE_URL=https://api.deepseek.com
VITE_DEEPSEEK_MODEL=deepseek-v4-pro
VITE_NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
```

修改环境变量后需要重启 Vite。

## 2. 本地数据与恢复

- 正式数据：Dexie 适配的 IndexedDB `atlas-travel-local` / `records`。
- 正式记录键：`app:atlas-travel:data`。
- LocalStorage：只允许保存用户明确选择持久化的 DeepSeek Key。
- 全新安装：IndexedDB 为空时直接创建 schemaVersion 1、dataVersion 1 的默认 Envelope。
- 旧 LocalStorage 业务键：新版本不读取、不删除。若某个开发环境仍只有旧数据，先用旧版本导出 JSON，再在新版本导入。
- Schema 迁移、导入、清空和云端覆盖前都先备份；失败不删除原数据。

设置页可以导出标准 JSON、下载最近本地备份、导入同一 appId 的可迁移文件和确认后重置。标准导出不包含 deviceId、同步状态、认证或 Key。

## 3. DeepSeek BYOK 与地点查询

1. 在“设置与数据”输入自己的 DeepSeek API Key。
2. Key 默认保存到 sessionStorage；只有主动勾选才保存到 LocalStorage。
3. 在“创建计划”描述旅行想法，或直接手工创建草稿。
4. DeepSeek 只生成名称、理由、顺序和搜索词，不生成最终坐标。
5. 在旅行详情点击“查询全部未确认地点”，逐项检查 Nominatim 结果。
6. 全部坐标确认后才确认旅行或导出 PLN。

DeepSeek、Nominatim 和共享 Worker 统一通过 `BrowserHttpClient` 请求。若点击后 Network 完全没有请求，先查看按钮禁用原因、表单校验和控制台；若提示“未收到 HTTP 响应”，可能来自 DNS、TLS、代理、扩展、网络策略、错误 API 地址或真实 CORS，仅凭浏览器 `TypeError` 无法区分。

DeepSeek Key 不进入 Payload、云快照、导出、URL 或日志。Nominatim 批量查询严格串行，相邻请求至少约 1.1 秒，公共实例仅用于个人低频场景。

## 4. 手动云备份如何工作

共享 API 前缀为 `/api/v1`：

- `GET /me?appId=atlas-travel`：检查 Access 身份。
- `GET /apps/atlas-travel/sync/head`：读取最新 Head 元数据。
- `PUT /apps/atlas-travel/sync`：提交新的 Head。
- `GET /apps/atlas-travel/sync/latest`：下载最新快照。

上传流程：

1. 客户端把 Envelope 序列化为 JSON、gzip，并对最终字节计算 SHA-256。
2. 客户端携带 `baseVersion`、唯一 `commitId`、Payload Schema 版本和设备 ID。
3. 共享 Worker 校验 Origin、Access JWT、Header、大小和 Hash。
4. Worker 用 R2 ETag 条件写覆盖该用户的 Atlas Head；版本从 1 开始并单调递增。
5. 相同 commitId 与 Hash 的重试保持幂等；baseVersion 过期或竞争时返回 409。
6. 客户端遇到双侧修改时要求用户选择保留本地、使用云端、分别导出或取消。

云端只保留最新 Head。选择云端覆盖本地前会保存本地备份；选择本地覆盖云端前会保存当前远端备份。云端 Head 被覆盖后无法从服务端找回旧版本，重要节点请手工导出 JSON。

## 5. 启用 Gipsy 共享云备份

Atlas 不需要注册 appId，也不需要运行任何 Cloudflare 命令。正式 Vercel 环境只设置：

```env
VITE_APP_ID=atlas-travel
VITE_ENABLE_CLOUD_SYNC=true
VITE_SYNC_API_BASE_URL=https://sync.api.10242020.xyz
```

前提是用户邮箱已在共享 Cloudflare Access Application 的允许策略内。进入设置页点击“打开 Access 登录”，完成后返回并点击“检查登录状态”。隐私窗口或严格防跟踪可能拦截跨站 Cookie；失败时允许 `sync.api.10242020.xyz` 和 Access 团队域名的 Cookie。

所有 `VITE_` 变量都是公开信息，不得放 Access 私钥、R2 凭证、DeepSeek Key 或其它 Secret。同步失败不会修改或删除 IndexedDB 本地数据。

## 6. Vercel 前端发布

`vercel.json` 已配置 Vite 构建、`dist` 输出和 SPA 回退：

1. 在 Vercel 使用 Node.js 22。
2. 设置 `VITE_APP_ID=atlas-travel` 和按需的共享云备份公开变量。
3. 绑定 `atlas-travel.app.10242020.xyz` 并完成 DNS。
4. 不在前端环境变量中存放 Secret。
5. 发布后验证 `/`、`/settings`、`/trips/new`、`/manifest.webmanifest`、`/sw.js`、深链刷新、离线重开、IndexedDB 写入、导入导出和覆盖前备份。
6. 开启云备份时，再验证 Access 登录、手动上传、另一浏览器恢复和双端冲突。

本仓库不执行共享 Worker 发布。Worker、Access、R2、Origin 策略和线上回滚由 Gipsy 基础设施维护者在 Gipsy 仓库负责。

## 7. 容量与何时升级

共享方案面向 1～2 人、低频手动 JSON 备份。单个压缩快照保护上限由共享 Worker 控制；日常 Payload 最好保持在几 MiB 以内。图片、视频和大量附件不应放进旅行 JSON。

出现以下真实需求时再单独立项：

- 需要找回多个云端历史版本：增加保留策略或版本对象。
- 需要业务查询、成员关系或审计：评估 D1/Postgres 元数据。
- 需要多人编辑同一数据：重新设计身份、冲突与协作模型。
- 需要自动后台同步：设计节流、生命周期、网络和错误恢复。
- 需要图片、音视频或大附件：拆分 Blob/R2 资源。

## 8. Codex + OpenSpec

先让 Codex 阅读 `AGENTS.md`、本文件、相关主规范、测试和 `git diff`，并说明风险等级。

- S 级：文案、样式、局部 Bug，直接修改并补相称回归测试。
- M 级：新交互、业务规则、Provider 行为，至少建立 `tasks.md` 和能力增量规范。
- L 级：存储、同步、认证、安全、部署或破坏性清理，必须建立 proposal、design、tasks 和能力规范。

开发中变更位于 `openspec/changes/YYYY-MM-DD-topic/`；实现、主规范和门禁一致后才移动到 `archive/`。旧归档保留当时决策记录，当前行为以主规范、代码、测试和本指南为准。

## 9. 质量门禁

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run format:check
npm run build
```

`typecheck` 校验前端、测试与构建配置。交付还必须执行 OpenSpec strict 校验。未使用真实 Access 会话时，报告应明确共享 Worker、线上 CORS、R2 上传下载和 Vercel 页面尚未做端到端验证。
