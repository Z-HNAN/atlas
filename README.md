# Atlas · AI 虚拟旅行收藏地图

Atlas 是面向 Microsoft Flight Simulator 2024 的本地优先虚拟旅行规划与收藏工具。它把旅行想法变成可人工确认的地点路线，导出 Sky4Sim 能读取的 `.pln`，并记录到访、评分和旅行总结。

它不是航空导航软件，也不是 MSFS 插件。MSFS 是探索方式，Sky4Sim 是飞行过程中的地图工具，Atlas 负责规划、收藏与记录。

## 当前能力

- DeepSeek BYOK 生成结构化旅行计划，响应经 Zod 校验并支持一次修复重试。
- Nominatim 串行地理编码、匹配评分、IndexedDB 本地缓存和歧义人工确认。
- Ky 驱动的统一浏览器 HTTP 适配层，明确区分取消、超时、网络失败和 HTTP 状态。
- 草稿、已计划、旅行中、已完成的旅行生命周期，以及地点到访和备注。
- Leaflet + OpenStreetMap 编号 Marker、路线、Popup 与 FitBounds。
- 严格 Custom/User 航点模板的 Sky4Sim `.pln` 本地导出。
- Dexie 驱动的 IndexedDB 主存储、JSON 导入导出、覆盖前备份、容量提示与 PWA。
- 可选 Cloudflare Access + Worker + D1 元数据 + 私有 R2 不可变快照同步。
- Vercel 前端部署配置；同步 Worker 独立部署到 Cloudflare。

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

正式业务数据由 `DexieKeyValueStore` 适配器写入 IndexedDB 数据库 `atlas-travel-local` 的 `records` Object Store，记录键为 `app:atlas-travel:data`。UI 和 Feature 不直接依赖 Dexie 或读写存储。

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

`dataVersion` 是本地业务修订号；`lastCloudVersion` 是云端不可变提交序号，两者不得混用。API Key、Access JWT 和设备偏好不进入 Payload、云快照或标准导出。

升级时，如果 IndexedDB 为空，Repository 会校验旧 LocalStorage 正式数据，先在 IndexedDB 留存迁移备份，再写入正式记录并删除旧正式键；失败时原数据保持不变。

## 可选云同步

```text
Vercel 前端
  → Cloudflare Access
  → Cloudflare Worker API
     ├── D1：用户、App、成员关系、提交元数据
     └── 私有 R2：gzip 不可变快照字节
```

前端只配置公开的 `VITE_SYNC_API_BASE_URL`。D1 不保存业务 Payload，客户端不直连 R2。每次提交携带 `baseVersion` 和可重试的 `commitId`；双端变化进入人工冲突，不自动合并或静默覆盖。

Worker 工程在 `worker/`，D1 迁移位于 `worker/migrations/0001_sync_metadata.sql`。本任务不执行线上发布，完整本地准备和后续手动发布步骤见 [START.md](./START.md)。

## 环境变量

```env
VITE_APP_ID=atlas-travel
VITE_ENABLE_CLOUD_SYNC=false
VITE_SYNC_API_BASE_URL=
VITE_DEEPSEEK_BASE_URL=https://api.deepseek.com
VITE_DEEPSEEK_MODEL=deepseek-v4-pro
VITE_NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
```

所有 `VITE_` 变量都会进入浏览器构建产物，不得填写 Access 私钥、R2 密钥、D1 凭证或 DeepSeek Key。

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

没有 DeepSeek Key 时，可以从“创建旅行 → 手工创建”建立空白草稿，再逐个添加地点。

PLN 仅在至少两个地点且全部坐标已确认时可导出。Atlas 不上传 PLN，也不会自动操作用户电脑。

## 目录

```text
src/features/trips      旅行 Schema、Repository、Hook、Provider 与 PLN
src/lib/http            Ky 浏览器请求适配层与请求阶段错误
src/lib/local-data      Dexie/IndexedDB、Envelope、迁移、备份和导入导出
src/lib/sync            SyncManager、快照编解码和 Worker API Provider
worker/src              Access JWT、权限、D1/R2 同步 API 与清理任务
worker/migrations       D1 元数据迁移
tests                   单元与集成测试
openspec                中文主规范和归档变更
```

## Codex 与 OpenSpec

`agents.md` 定义风险分级：S 级小改动直接实现和回归测试；M 级行为改动至少包含 tasks 与规格增量；L 级存储、同步、认证、部署或破坏性变更必须包含 proposal、design、tasks 和能力规范。

项目不要求所有通用能力都原生实现：复杂生命周期和兼容细节优先评估成熟库，简单稳定的浏览器 API 与核心业务协议保留项目实现。引入依赖必须评估维护、安全、体积、兼容、测试与退出成本，并封装在可替换适配层。

MVP 验收后应删除不再解释当前行为的 Seed 历史、旧厂商配置和失效代码，但保留当前主规范、有效迁移、恢复说明和回归测试。
