# Atlas 启动、配置与交付指南

本指南用于本地运行、配置可选服务、部署首版，以及继续通过 Codex + OpenSpec 开发。

## 1. 五分钟启动

要求 Node.js 22、npm 和支持 LocalStorage、sessionStorage、Service Worker 的现代浏览器。

```bash
npm ci
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:5173`。纯本地模式不需要账号、Supabase 或 DeepSeek Key。

交付前运行：

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run format:check
npm run build
```

## 2. 环境变量

| 变量                            | 默认值                                | 用途                                 |
| ------------------------------- | ------------------------------------- | ------------------------------------ |
| `VITE_APP_ID`                   | `atlas-travel`                        | 本地与云快照稳定标识，发布后不要修改 |
| `VITE_ENABLE_CLOUD_SYNC`        | `false`                               | 是否启用可选 Supabase 快照同步       |
| `VITE_SUPABASE_URL`             | 空                                    | Supabase 公开 Project URL            |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 空                                    | 浏览器公开 Publishable Key           |
| `VITE_OWNER_USER_ID`            | 空                                    | 部署提示预留；RLS 不信任该值         |
| `VITE_DEEPSEEK_BASE_URL`        | `https://api.deepseek.com`            | 公开 API 基址                        |
| `VITE_DEEPSEEK_MODEL`           | `deepseek-chat`                       | 当前账号可用模型名                   |
| `VITE_NOMINATIM_BASE_URL`       | `https://nominatim.openstreetmap.org` | 地理编码服务                         |

所有 `VITE_` 值都会编译到浏览器资源。禁止填写 Supabase secret/service role、数据库密码、DeepSeek Key 或其它私密凭证。

纯本地配置：

```env
VITE_APP_ID=atlas-travel
VITE_ENABLE_CLOUD_SYNC=false
```

开启云同步：

```env
VITE_APP_ID=atlas-travel
VITE_ENABLE_CLOUD_SYNC=true
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

修改环境变量后重启开发服务或重新部署。

## 3. 使用 Atlas

### 3.1 AI 创建

1. 在“设置”输入自己的 DeepSeek API Key。
2. 默认只保存到 sessionStorage；需要长期使用时主动勾选“记住 Key”。
3. 打开“创建计划”，用自然语言描述地区、主题、时长和偏好。
4. DeepSeek 只生成名称、理由、顺序和地理编码搜索词，不生成最终坐标。
5. 计划保存为草稿后，在详情页点击“查询全部未确认地点”。
6. 检查地图，对 ambiguous/failed 项修改搜索词或手工填写坐标。
7. 所有地点 resolved 后确认旅行。

Provider 对外层 Chat Completion 和内层计划分别做 Zod 校验。模型返回 Markdown JSON 代码块时可以解析；首次输出无效会修复重试一次，第二次仍失败则不保存。

浏览器直连可能被供应商 CORS、企业网络或扩展阻止。出现提示时手工功能仍完整可用；不要把项目方共享 Key 写进环境变量。需要代理时另立 OpenSpec。

### 3.2 手工创建

没有 Key 时选择“手工创建”，保存标题后在详情页添加地点。每个地点可编辑中文名、当地名、国家、地区、搜索词、理由、经纬度、到访和备注。

调整地点、搜索词、坐标或顺序会把旅行退回草稿，避免已确认路线在不知情时改变。

### 3.3 Nominatim

批量查询严格串行，相邻请求至少间隔约 1.1 秒。系统会综合国家、地区、搜索词和 importance 评分，不无条件取第一项。

- `resolved`：可直接确认；
- `ambiguous`：地图中检查后点击“确认坐标”；
- `failed`：修改搜索词或手工输入；
- `pending`：尚未查询。

结果缓存在 Payload，命中缓存时不重复请求。应用必须显示 OpenStreetMap attribution。公共 Nominatim 只适合个人低频使用，不要改成并发批量抓取。

### 3.4 旅行记录与 Atlas

状态顺序：

```text
草稿 → 已计划 → 旅行中 → 已完成
```

用户手工勾选到访、填写地点备注、整条旅行 1～10 分和总结。Atlas 支持全部/已到访/计划中，以及旅行、年份、主题筛选。

## 4. PLN 与 Sky4Sim

导出要求：至少两个地点，且每个地点的 `geocodeStatus=resolved`、经纬度完整有效。

Atlas 将十进制度转换为：

```text
N35° 21' 38.16",E138° 43' 38.64"
```

并严格生成 Custom/User 航点。文件名只包含安全 ASCII；标题无法转写时使用 `virtual-trip-YYYY-MM-DD.pln`。

操作：

1. 详情页点击“导出 MSFS / Sky4Sim PLN”。
2. 把下载文件手工移动到 Sky4Sim 可读取目录。
3. 在 Sky4Sim Flight Plan 页面加载。
4. 确认路线后开始 MSFS 目视探索。

Atlas 不自动操作电脑、MSFS 或 Sky4Sim。

## 5. 本地数据、备份与迁移

正式键为 `app:atlas-travel:data`。UI 不直接读写；`BrowserLocalDataRepository` 负责校验、版本、dirty、备份、导入导出和容量。

- JSON 导出不含 deviceId、同步元数据、Key 或 Token。
- 导入、重置、云恢复和冲突覆盖前自动备份。
- 2MB 以上提醒导出，4MB 以上严重提醒并评估 IndexedDB。
- schemaVersion 变化必须提供逐版本 Migration。
- 损坏、未来版本或无迁移链时拒绝覆盖。

Todo Seed 的 `app:gipsy:data` 保留，Atlas 不迁移或删除。

## 6. Supabase

### 6.1 创建项目

1. 创建 Supabase 项目。
2. 复制 Project URL 和 Publishable Key。
3. 配置 `.env.local` 并启用 `VITE_ENABLE_CLOUD_SYNC=true`。
4. 不要使用 secret、service role 或数据库密码。

### 6.2 应用迁移

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

也可以按顺序在 SQL Editor 执行：

1. `supabase/migrations/0001_app_sync_snapshots.sql`
2. `supabase/migrations/0002_atlas_travel.sql`

### 6.3 注册 owner

先通过 Supabase Auth 创建自己的用户，再在 SQL Editor 执行：

```sql
insert into public.atlas_owners (user_id)
values ('YOUR_AUTH_USER_UUID');
```

客户端不能读写 `atlas_owners`。`is_atlas_owner()` 使用 `auth.uid()` 检查；`VITE_OWNER_USER_ID` 不是权限边界。

RLS 设计：

- `trips`、`trip_points`、`geocode_cache`：anon/authenticated 可读；
- 仅 owner 可写；
- 旅行 `created_by` 必须等于当前 `auth.uid()`；
- 地点写入必须属于当前 owner 的父旅行。

### 6.4 Magic Link

在 Authentication 中启用 Email：

- Site URL：`http://localhost:5173`
- Redirect URLs：`http://localhost:5173/**`
- 部署后加入正式域名和 `/**`

设置页通过 `signInWithOtp` 发送 Magic Link。未登录时本地功能不受影响。

### 6.5 快照同步与冲突

首版跨设备同步使用 `app_sync_snapshots`。更新必须带 expectedRemoteVersion；两端都修改时进入冲突，不自动合并。

冲突操作：

- 保留本地并覆盖云端；
- 使用云端并覆盖本地；
- 分别导出；
- 取消并保持冲突。

规范化旅行表首版不与本地快照静默双写。若要把本地旅行发布成公开在线数据，应新增显式发布流程、事务与失败恢复 OpenSpec。

### 6.6 上线前 RLS 验证

使用两个邮箱和两个独立浏览器：

1. owner 能登录并同步快照。
2. 非 owner 对规范化旅行表 INSERT/UPDATE/DELETE 被拒绝。
3. anon 能读取已发布的规范化旅行数据。
4. 用户 A 不能读写用户 B 的私有快照。
5. 同一用户双设备同时修改时出现冲突而非静默覆盖。

## 7. Vercel 部署

1. 将仓库连接到 Vercel。
2. Framework 选择 Vite；Build Command 为 `npm run build`；Output 为 `dist`。
3. 按需要配置公开环境变量。
4. `vercel.json` 已为 React Router 配置 SPA 回退。
5. 在 Supabase Auth 中加入正式域名。

部署后至少验证：

- `/`、`/login`、`/atlas`、`/trips`、`/trips/new`、`/settings` 直达；
- `/manifest.webmanifest`、`/sw.js` 和 `/assets/*` 返回真实文件；
- 地图 attribution、DeepSeek BYOK、Nominatim、Magic Link 和 PLN 下载。

## 8. 真实端到端验收

使用路线：

```text
富士山
河口湖
箱根
东京湾
```

执行：

```text
创建旅行
→ AI 生成或使用内置示例
→ 查询/确认坐标
→ 保存并确认
→ 导出 PLN
→ Sky4Sim 加载
→ 核对顺序与路线
→ 网页标记到访
→ 评分和总结
→ Atlas 查看记录
```

真实 DeepSeek、Supabase 和 Sky4Sim 依赖用户账号与本机软件，自动测试不能替代该验收。

## 9. OpenSpec 与 Codex

非平凡变更使用：

```text
openspec/changes/archive/YYYY-MM-DD-topic/
├── proposal.md
├── design.md
├── tasks.md
└── specs/<capability>/spec.md
```

同步更新 `openspec/specs/<capability>/spec.md`，再实现和测试。交付必须运行五项质量门禁并核对 README、START、OpenSpec、实现和测试一致。

当前首版变更位于：

```text
openspec/changes/archive/2026-07-30-ai-virtual-travel-atlas/
```
