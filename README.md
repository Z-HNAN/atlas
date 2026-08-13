# Atlas · AI 虚拟旅行收藏地图

Atlas 是面向 Microsoft Flight Simulator 2024 的本地优先虚拟旅行规划与收藏工具。它把旅行想法变成可人工确认的地点路线，导出 Sky4Sim 可读取的 `.pln`，并记录到访、评分和旅行总结。

它不是航空导航软件，也不是 MSFS 插件。MSFS 是探索方式，Sky4Sim 是飞行过程中的地图工具，Atlas 负责规划、收藏与记录。

## 当前能力

- DeepSeek BYOK 生成结构化旅行计划，响应经 Zod 校验并支持一次修复重试。
- Nominatim 串行地理编码、匹配评分、IndexedDB 本地缓存和歧义人工确认。
- Ky 驱动的统一浏览器 HTTP 适配层，区分取消、超时、网络失败和 HTTP 状态。
- 草稿、已计划、旅行中、已完成的旅行生命周期，以及地点到访和备注。
- Leaflet + OpenStreetMap 编号 Marker、路线、Popup 与 FitBounds。
- 严格 Custom/User 航点模板的 Sky4Sim `.pln` 本地导出。
- Dexie 驱动的 IndexedDB 主存储、JSON 导入导出、覆盖前备份、容量提示与 PWA。
- 可选 Cloudflare Access + Gipsy 共享 Worker + 私有 R2 单 Head 云备份。
- Vercel 静态前端部署；Atlas 不维护或部署同步服务端资源。

没有网络、账号、同步服务或 DeepSeek Key 时，手工旅行、地图、记录、导入导出和 PLN 核心流程仍可使用。

## 本地运行

要求 Node.js 22：

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

访问 `http://localhost:5173`。不创建 `.env.local` 也能使用纯本地模式；首次启动包含一条可删除的富士山到东京湾示例路线。

交付前执行：

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run format:check
npm run build
```

## 数据架构

正式业务数据由 `DexieKeyValueStore` 适配器写入 IndexedDB 数据库 `atlas-travel-local` 的 `records` Object Store，记录键为 `app:atlas-travel:data`。UI 和 Feature 不直接依赖 Dexie 或读写具体存储。

```text
LocalAppEnvelope<TripPayload>
├── appId / schemaVersion / dataVersion
├── updatedAt / deviceId
├── payload
│   ├── trips[]
│   └── geocodeCache[]
└── sync
    ├── dirty
    ├── lastCloudVersion
    ├── lastSyncAt / lastSyncCommitId
    └── syncStatus
```

`dataVersion` 是本地业务修订号；`lastCloudVersion` 是共享 Worker 的云端提交序号；`schemaVersion` 是旅行 Payload 结构版本，三者不得混用。API Key、Access JWT 和设备偏好不进入 Payload、云快照或标准导出。

全新安装在 IndexedDB 为空时直接创建当前版本的默认 Envelope，不读取或删除旧 LocalStorage 业务键。Payload 结构变化仍必须递增 `schemaVersion` 并提供顺序迁移；读取旧 IndexedDB、导入文件、云端恢复、清空和覆盖前继续备份。

## 可选云备份

```text
浏览器 IndexedDB
  └── 用户点击“立即同步”或“从云端恢复”
       → Cloudflare Access
       → Gipsy 共享 gipsy-sync Worker
       → 私有 R2：每个 appId + 用户一个最新 Head
```

Atlas 正式域名为 `https://atlas-travel.app.10242020.xyz`，复用 `https://sync.api.10242020.xyz`。Atlas 不创建 Worker、D1、R2、Cron、Access Application，也不执行服务端注册。

共享服务只保留当前 Access 用户的最新 Atlas Head，不提供云端历史或自动后台同步。每次提交仍携带 `baseVersion`、唯一 `commitId` 和 SHA-256；双端变化进入人工冲突，不自动合并或静默覆盖。重要节点应手动导出 JSON。

## 环境变量

```env
VITE_APP_ID=atlas-travel
VITE_ENABLE_CLOUD_SYNC=false
VITE_SYNC_API_BASE_URL=
VITE_DEEPSEEK_BASE_URL=https://api.deepseek.com
VITE_DEEPSEEK_MODEL=deepseek-v4-pro
VITE_NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
```

正式环境启用云备份时只设置公开变量：

```env
VITE_ENABLE_CLOUD_SYNC=true
VITE_SYNC_API_BASE_URL=https://sync.api.10242020.xyz
```

所有 `VITE_` 变量都会进入浏览器构建产物，不得填写 Access 私钥、R2 凭证、DeepSeek Key 或其它 Secret。

## 旅行流程

```text
描述旅行想法
→ DeepSeek 生成地点与顺序
→ Nominatim 查询真实坐标
→ 在地图上人工确认
→ 确认旅行计划
→ 导出 MSFS / Sky4Sim PLN
→ 在 MSFS 中探索
→ 标记到访并总结
```

没有 DeepSeek Key 时，可以从“创建旅行 → 手工创建”建立空白草稿，再逐个添加地点。PLN 仅在至少两个地点且全部坐标已确认时可导出；Atlas 不上传 PLN，也不会自动操作用户电脑。

## 目录

```text
src/features/trips      旅行 Schema、Repository、Hook、Provider 与 PLN
src/lib/http            Ky 浏览器请求适配层与请求阶段错误
src/lib/local-data      Dexie/IndexedDB、Envelope、迁移、备份和导入导出
src/lib/sync            手动同步、快照编解码和共享 Worker API Provider
tests                   单元与集成测试
openspec                中文主规范和归档变更
```

本地启动、共享云备份、Vercel 配置、故障排查和 Codex/OpenSpec 工作流见 [START.md](./START.md)。协作与风险分级规则见 [AGENTS.md](./AGENTS.md)。
