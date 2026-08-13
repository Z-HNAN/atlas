# 接入 Gipsy 共享单 Head 云备份提案

## 背景

Atlas 从 Gipsy Seed 派生后，仍保留早期的独立 Cloudflare Access + Worker + D1 元数据 + 私有 R2 不可变历史快照实现，并支持自动同步、云端历史版本和旧 LocalStorage 正式数据迁移。当前 Gipsy 已将通用基座收敛为共享 `gipsy-sync` Worker 与私有 R2 单 Head：每个 `appId + Access 用户` 只保留最新快照，派生 App 不部署服务端资源、不做服务端注册，且只允许用户手动触发备份与恢复。

Atlas 需要重新对齐当前 Seed，同时保留旅行 Payload、DeepSeek、Nominatim、Leaflet、PLN、IndexedDB 主存储和覆盖前备份等业务能力。

## 目标

- Atlas 复用 `https://sync.api.10242020.xyz`，不再维护或部署独立 Worker、D1、R2、Cron 或 Access Application。
- 正式域名固定为 `https://atlas-travel.app.10242020.xyz`，浏览器请求继续使用 `appId=atlas-travel`。
- 云端每个 Atlas Access 用户只保留一个最新 Head；保留 `baseVersion`、唯一 `commitId`、SHA-256、人工冲突和本地恢复备份。
- 删除自动同步、同步偏好、强制提交新历史版本和云端历史语义，只保留用户主动触发的“立即同步”与“从云端恢复”。
- 将同步 React Hook 从旅行 Feature 移入通用 `src/lib/sync`，由 Atlas 装配层注入 Repository 与空 Payload 判定。
- 修复浏览器 gzip 转换可能因流背压互等而挂起的问题。
- 移除已完成使命的旧 LocalStorage 正式业务迁移；已有 IndexedDB、导入文件和云快照的顺序 Schema 迁移继续保留。

## 非目标

- 不修改 `TripPayload`、`schemaVersion`、IndexedDB 数据库名、正式记录键或 PLN 格式。
- 不把共享 Worker 源码复制到 Atlas，也不修改、发布或清理 Gipsy 的线上 Cloudflare 资源。
- 不迁移 Atlas 旧测试 Worker 中的 D1 元数据或 R2 历史快照；需要保留的数据应先通过现有版本导出 JSON。
- 不实现自动后台同步、云端历史、字段合并、CRDT、实时协作、多人共享同一 Payload 或服务端业务查询。
- 不改变 DeepSeek BYOK 与 Nominatim 的 Provider 契约。

## 方案对比

### 方案一：保留 Atlas 独立 D1/R2 Worker

- 优点：继续提供历史版本、成员角色和既有 Worker 测试。
- 缺点：与当前 Seed 的一次部署边界冲突；Atlas 需要持续承担数据库迁移、双写补偿、Cron、凭证和发布维护。
- 结论：不采用。

### 方案二：复制 Gipsy 的共享 Worker 到 Atlas

- 优点：代码与新协议一致，仓库内可以运行 Worker 单元测试。
- 缺点：形成第二个基础设施维护源，派生 App 仍可能误建或误发 Worker，与 `START.md` 的共享服务契约相悖。
- 结论：不采用。

### 方案三：Atlas 只保留共享 Worker 客户端

- 优点：严格符合 Gipsy Seed；删除 D1、R2、Access 服务端凭证与发布责任；本地功能和客户端冲突保护不受影响。
- 缺点：旧云端历史不迁移，Atlas 仓库不能独立验证共享 Worker 内部实现，真实 Access/CORS/R2 仍依赖 Gipsy 基础设施验收。
- 结论：采用。

## 影响范围

- `src/lib/sync`、设置页同步 UI、App 装配和登录页类型引用。
- `src/lib/local-data` 的首次初始化与旧 LocalStorage 兼容分支。
- 删除 `worker/`、自动同步代码、同步偏好代码及对应测试和依赖。
- README、START、AGENTS、DELIVERY、环境变量说明、CI 和 OpenSpec 主规范。

## 兼容与迁移

1. 当前 IndexedDB Envelope、标准 JSON 导入文件和远程快照格式保持不变，不提升 `schemaVersion`。
2. 新客户端继续读取现有 `lastCloudVersion`，但首次连接共享 Worker 时若远端不存在，将把本地快照作为版本 1 上传；共享 Worker 上的版本序号独立重新开始。
3. 旧 Atlas Worker、D1 元数据、R2 历史对象和自动同步偏好不迁移；升级代码不会操作线上资源，也不会删除浏览器中可能残留的旧 LocalStorage 键。
4. 如果某个环境仍只有旧 LocalStorage 正式数据，升级前应使用旧版本导出 JSON，再由新版本导入；新版本不会自动读取或删除旧键。
5. 回滚到本变更前代码可恢复独立 Worker 客户端与旧迁移逻辑，但共享 Worker 中已覆盖的旧 Head 无法从服务端找回；重要节点依赖本地备份和手工 JSON 导出。
