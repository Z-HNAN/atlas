# Atlas 本地开发、同步服务与 Codex 指南

Atlas 默认是由 Dexie 驱动 IndexedDB 的本地优先应用。Vercel 只承载前端；可选同步服务由 Cloudflare Access、Worker、D1 和私有 R2 组成。本文只准备本地可交付版本，不执行线上发布。

## 1. 前端启动

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

修改环境变量后重启 Vite。

## 2. 本地数据与旧版迁移

- 正式数据：Dexie 适配的 IndexedDB `atlas-travel-local` / `records`。
- 正式记录键：`app:atlas-travel:data`。
- LocalStorage：只保留 API Key 持久化选择、同步偏好和旧版迁移源。
- 旧 LocalStorage 正式记录：校验后迁入 IndexedDB，并保存 `:localstorage-backup`。
- Schema 迁移、导入、清空和云端覆盖前都先备份；失败不删除原数据。

设置页可以导出标准 JSON、下载最近本地备份、导入同一 appId 的可迁移文件和确认后重置。导出不包含 deviceId、同步状态、认证或 Key。

## 3. DeepSeek BYOK 与地点查询

1. 在“设置与数据”输入自己的 DeepSeek API Key。
2. Key 默认保存到 sessionStorage；只有主动勾选才保存到 LocalStorage。
3. 在“创建计划”描述旅行想法，或直接手工创建草稿。
4. DeepSeek 只生成名称、理由、顺序和搜索词，不生成最终坐标。
5. 在旅行详情点击“查询全部未确认地点”，逐项检查 Nominatim 结果。
6. 全部坐标确认后才确认旅行或导出 PLN。

DeepSeek、Nominatim 和同步 Worker 统一通过 `BrowserHttpClient` 请求，底层由 Ky 管理超时并正确调用浏览器原生 `fetch`。若点击后 Network 完全没有请求，先查看按钮旁的禁用原因，再检查表单校验和控制台；这表示代码在发包前停止，不是已发送请求后的 CORS 结论。若提示“未收到 HTTP 响应”，可能来自 DNS、TLS、代理、扩展、网络策略、错误 API 地址或真实 CORS，仅凭浏览器 `TypeError` 无法区分。

DeepSeek Key 不进入 Payload、云快照、导出、URL 或日志。Nominatim 批量查询严格串行，相邻请求至少约 1.1 秒，公共实例仅用于个人低频场景。

## 4. 本地准备 Cloudflare 同步服务

### 4.1 Wrangler 配置

```bash
cp worker/wrangler.toml.example worker/wrangler.toml
```

`worker/wrangler.toml` 不提交。填写：

- `ACCESS_ISSUER`：例如 `https://your-team.cloudflareaccess.com`。
- `ACCESS_AUD`：Access Application 的 AUD。
- `ALLOWED_ORIGINS`：逗号分隔的本地与 Vercel Origin，不允许 `*`。
- D1 `database_id` 和私有 R2 bucket 名称。

不得把 Access Secret、R2 Token 或 D1 凭证写入任何 `VITE_` 变量。

### 4.2 本地 D1 迁移和成员

```bash
npx wrangler d1 migrations apply DB \
  --local \
  --config worker/wrangler.toml
```

固定团队首版不开放注册。应在 D1 预配置 `users`、`apps` 和 `app_memberships`：

```sql
INSERT INTO users (id, access_sub, email, status, created_at, updated_at)
VALUES (
  '替换为内部用户 UUID',
  NULL,
  'you@example.com',
  'active',
  '2026-07-30T00:00:00.000Z',
  '2026-07-30T00:00:00.000Z'
);

INSERT INTO apps (
  id, name, current_payload_schema_version, created_at, updated_at
)
VALUES (
  'atlas-travel',
  'Atlas',
  1,
  '2026-07-30T00:00:00.000Z',
  '2026-07-30T00:00:00.000Z'
);

INSERT INTO app_memberships (app_id, user_id, role, created_at)
VALUES (
  'atlas-travel',
  '替换为内部用户 UUID',
  'admin',
  '2026-07-30T00:00:00.000Z'
);
```

首次有效 Access 请求先按 `access_sub` 匹配；找不到时按规范化邮箱匹配 active 用户并更新 sub，不会创建公开用户。

### 4.3 启动 Worker

```bash
npm run worker:dev
```

Cloudflare Access 通常需要可访问域名才能完成真实登录；本地 Wrangler 主要用于接口、D1/R2 和 CORS 调试。前端启用同步：

```env
VITE_ENABLE_CLOUD_SYNC=true
VITE_SYNC_API_BASE_URL=https://your-sync-worker.example.com
```

## 5. 同步协议

API 前缀为 `/api/v1`：

- `GET /me`
- `GET /apps/:appId/sync/head`
- `PUT /apps/:appId/sync`
- `GET /apps/:appId/sync/latest`
- `GET /apps/:appId/sync/versions`
- `GET /apps/:appId/sync/versions/:version`

客户端将快照 Envelope JSON 转为 UTF-8 和 gzip，对最终字节计算 SHA-256，并携带 `baseVersion`、UUID `commitId`、Payload Schema 版本和设备 ID 上传。Worker 校验 Access JWT、用户、成员关系、Header、大小与 Hash，先条件写 R2，再用 D1 条件 INSERT 提交元数据。

云端 `version`、Payload `schemaVersion` 和本地 `dataVersion` 是三个独立概念。相同 commitId 与相同 Hash 重试返回原提交；相同 commitId 配不同 Hash 返回 409。

R2 键由服务端生成：

```text
v1/apps/{app_id}/users/{user_id}/snapshots/{10位补零version}-{commit_id}.bin
```

默认保留最近 50 个版本；定时任务先删 R2 再软删除 D1 元数据，并清理 24 小时前的孤儿对象，最新版本不删除。

## 6. Vercel 前端发布准备

仓库 `vercel.json` 已配置 Vite 构建、`dist` 输出和 SPA 路由回退。之后自行发布时：

1. 使用 Node 22。
2. 设置 `VITE_APP_ID=atlas-travel`。
3. 纯本地部署保持 `VITE_ENABLE_CLOUD_SYNC=false`。
4. 启用同步时填写公开的 `VITE_SYNC_API_BASE_URL`。
5. 把正式 Vercel Origin 加入 Worker `ALLOWED_ORIGINS` 和 Cloudflare Access Application。
6. 不在 Vercel 前端变量中放任何服务端 Secret。

发布后验证 `/`、`/settings`、`/trips/new`、深链刷新、离线重开和 IndexedDB 写入。启用同步时再验证 Access、双设备冲突、历史版本和跨用户隔离。

## 7. Cloudflare 手动发布准备

本文不执行发布。上线时由维护者运行：

```bash
npx wrangler d1 migrations apply DB \
  --remote \
  --config worker/wrangler.toml
npx wrangler deploy --config worker/wrangler.toml
```

发布前确认 R2 私有、Access 覆盖 Worker 域名、CORS 仅允许明确 Origin、readonly 成员不能上传、日志不含 JWT/快照 Body/Key，并启用定时保留和孤儿清理。

## 8. Codex + OpenSpec

先让 Codex 阅读 `agents.md`、`START.md`、相关主规范、测试和 `git diff`。

- S 级：文案、样式、局部 Bug，直接修改并补回归测试。
- M 级：新交互、业务规则、Provider 行为，至少建立 `tasks.md` 和能力增量规范。
- L 级：存储、同步、认证、部署、安全或破坏性清理，必须建立 proposal、design、tasks 和能力规范。

通用能力不要求一律原生实现。遇到 IndexedDB、日期、表单等成熟问题时，先评估维护活跃且类型完整的库；只有收益覆盖包体积、兼容、安全和迁移成本时才引入，并通过 `lib` 适配层隔离。稳定浏览器 API、少量明确代码和核心业务协议继续保留项目实现。

开发中变更位于 `openspec/changes/YYYY-MM-DD-topic/`，完成实现、主规范同步和质量门禁后，再移动到 `openspec/changes/archive/`。MVP 验收后删除不再解释当前行为的 Seed 历史、旧厂商配置和失效代码。

## 9. 质量门禁

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run format:check
npm run build
```

`typecheck` 同时校验前端、构建配置和 Worker。未使用真实 Cloudflare 凭证时，交付报告必须明确 Access、远程 D1/R2 和线上 CORS 尚未做端到端验证。
