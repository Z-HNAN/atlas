# 设计：Atlas 对齐 Gipsy 共享单 Head同步

## 架构边界

Atlas 仍以 `LocalAppEnvelope<TripPayload>` 和 IndexedDB 为正式数据源。云端只是由用户主动触发的最新快照备份：

```text
Atlas 浏览器 IndexedDB
  └── 用户点击“立即同步”或“从云端恢复”
       → Cloudflare Access
       → https://sync.api.10242020.xyz
       → Gipsy 维护的私有 R2 单 Head
```

Atlas 前端只掌握公开的 App ID、同步开关与 API 地址，不包含 Access 私钥、R2 凭证或 Worker 配置。共享 Worker 从正式 Origin `https://atlas-travel.app.10242020.xyz` 推导并绑定 `atlas-travel`，Access 用户之间的 Head 相互隔离。

## 客户端同步流程

- `WorkerSyncProvider` 调用 `/me?appId=atlas-travel`、`latest` 和 `PUT sync`，并携带 credentials。
- 上传将快照 Envelope 序列化为 UTF-8 JSON、gzip，对最终字节计算 SHA-256，并携带 `baseVersion`、`commitId`、Payload Schema 版本和设备 ID。
- 下载验证 Hash、Header、appId 和 Payload，再交给 Repository 的 Zod 校验与顺序迁移。
- `SyncManager` 保留首次上传、空本地恢复、单侧更新、双侧冲突、幂等重试和人工选择逻辑。
- 不再暴露自动同步和“提交本地新版本”。用户在无冲突时点击“立即同步”，或在冲突面板明确选择保留本地/使用云端。
- 上传过程中若又发生本地修改，旧上传响应只更新云版本，新修改继续保持 dirty，避免误标为已同步。

## React 依赖方向

`useCloudSync<TPayload>` 移入 `src/lib/sync`，只依赖通用 Repository、Provider、`isPayloadEmpty` 和本地刷新回调。Atlas 的 `src/app/App.tsx` 注入 `TripPayload` 空数据判定，设置组件和登录页只依赖通用 Controller 类型，不再从 `features/trips` 反向提供基础设施类型。

## gzip 背压

浏览器 `CompressionStream`/`DecompressionStream` 的输出必须在写入输入的同时开始消费。实现先创建 `new Response(stream.readable).arrayBuffer()` Promise，再写入和关闭 writable，最后等待输出，避免大于内部高水位的数据因先写后读产生互等。

## 本地初始化与迁移

```text
读取 IndexedDB 正式键
├── 存在：校验 Envelope，必要时备份并按顺序升级 Payload
└── 不存在：直接创建 schemaVersion 1 的 Atlas 默认 Envelope
```

Repository 不再读取、删除或备份 LocalStorage 正式业务键。LocalStorage 只保留用户明确持久化的 DeepSeek Key；同步偏好随自动同步功能一起删除。标准导入、清空、云端覆盖、IndexedDB Schema 迁移和远端快照迁移前的备份继续保留。

## 删除范围

- `worker/` 全部 Atlas 独立服务端源码、D1 migration 与 Wrangler 示例。
- `src/lib/sync/auto-sync.ts`、`sync-preferences.ts` 与对应测试。
- Feature 内的 `useCloudSync.ts`，由通用 Hook 替代。
- 只验证旧 LocalStorage 自动迁移、自动同步或历史强制提交的测试。
- `jose`、Wrangler 和 Cloudflare Worker 类型依赖，以及 Worker npm scripts。

历史归档 OpenSpec 继续作为当时决策记录；主规范和当前指南必须只描述现行架构。

## 失败恢复

- 共享 API 不可用、Access 过期、CORS/Cookie 失败或离线时，只显示错误并保留 IndexedDB 与 dirty 状态。
- 云端恢复和冲突覆盖本地前创建本地备份；保留本地覆盖云端前保存当前远端为本地恢复备份。
- Hash、appId、Schema 或 Zod 校验失败时禁止覆盖本地。
- 共享 Worker 只保留最新 Head，因此云端覆盖后不能回滚；设置页与 START 明确提示重要节点手工导出 JSON。
- 本任务不连接或改写线上 Cloudflare 资源；真实端到端未执行时必须在交付报告中注明。

## 风险与权衡

- **失去云端历史**：换取单存储、无数据库迁移和低维护成本；恢复依赖本地覆盖前备份与手工导出。
- **共享服务依赖**：同步故障会影响云备份，但 Local-first 核心功能不受影响。
- **跨站 Cookie**：隐私模式可能阻止 Access 会话；UI 与 START 提供检查登录状态和 Cookie 排障说明。
- **移除旧 LocalStorage 迁移**：仅有旧键的数据不会自动出现；代码不主动删除旧键，用户可回滚旧版本导出后再导入。
- **服务端测试移出仓库**：Atlas 只验证客户端协议；Worker 的身份、Origin、ETag 和 R2 行为由 Gipsy 仓库负责。

## 验收标准

- Atlas 代码与当前文档不再包含独立 Worker、D1、Cron、历史版本、自动同步或服务端注册流程。
- 启用同步时使用共享 API，`/me` 带 appId，接受匿名化 64 位用户 ID，并保留人工冲突与上传期间编辑保护。
- gzip 背压回归测试、共享 Provider 测试、双设备同步测试和本地生命周期测试通过。
- 首次初始化不读取 LocalStorage 正式业务键，现有 IndexedDB/导入/远端 Schema 迁移与备份继续可用。
- README、START、AGENTS、DELIVERY、主规范与实现一致。
- OpenSpec strict 校验及五项项目质量门禁全部通过。
