# 提案：Atlas 迁移到通用本地优先快照同步架构

## 问题

Atlas 当前把旅行快照保存在 LocalStorage，并通过 Supabase Auth 与单行 JSON 表同步；仓库还包含未被本地优先主流程使用的 Supabase 旅行业务表。该结构与通用同步服务目标不一致：LocalStorage 容量有限，云端可直接查询业务 JSON，云端版本与 Payload 版本混用，也难以复用统一的多 App 权限、幂等和保留策略。

## 目标

- 将浏览器正式旅行数据迁到 IndexedDB，旧 LocalStorage 仅作为一次性迁移源。
- 保持 Atlas 的旅行 Payload、地图、DeepSeek、Nominatim 和 PLN 行为不变。
- 前端继续以 Vercel 为发布目标；云同步服务独立使用 Cloudflare Access、Worker、D1 元数据和私有 R2 不可变快照。
- 使用独立的云端 `version`、`baseVersion` 和 `commitId` 实现乐观并发与幂等。
- 清理 Supabase 代码、迁移和与当前 Atlas 无关的 Garfish/旧品牌 Seed 历史。

## 非目标

- 不实现字段级合并、CRDT、实时协作、增量日志同步、公开注册或旅行业务云查询。
- 不改变 Atlas schemaVersion 1 的旅行 Payload。
- 不执行 Vercel 或 Cloudflare 线上发布。
- 不托管客户端端到端加密密钥；首版只上传 gzip、未加密快照。

## 方案对比

### 方案 A：保留 LocalStorage + Supabase

改动小，但不满足 IndexedDB 主存储、D1/R2 分离、不可变历史和统一多 App 权限要求，不采用。

### 方案 B：IndexedDB + Vercel Serverless

可实现同步，但偏离既定 Cloudflare Access/D1/R2 体系，并增加另一套认证和对象存储边界，不采用。

### 方案 C：IndexedDB + Cloudflare Access/Worker/D1/R2

前后端职责清晰、固定团队权限可审计，D1 不接触旅行 Payload，R2 保存不可变字节，可与 Gipsy 共用服务模型。采用此方案。

## 迁移与回滚

1. 首次启动在 IndexedDB 为空时读取旧 `app:atlas-travel:data`，先保存原始备份，再校验并写入 IndexedDB。
2. 成功后删除旧正式键；失败时不覆盖或删除旧数据。
3. Supabase 云数据不自动迁移。需要保留时先用旧版本导出 JSON，再由新版本导入并提交。
4. 删除 Supabase Auth、快照表和 Atlas 业务表迁移；本地 IndexedDB 始终是主数据源。
5. 回滚时可使用 IndexedDB 内迁移备份或标准 JSON 导出恢复。

## 影响

- Repository 和旅行操作改为异步。
- `dataVersion` 与云端 `version` 分离。
- 环境变量改为 `VITE_SYNC_API_BASE_URL`。
- 新增 `worker/`、D1 元数据迁移、快照编解码和 Worker Provider。
