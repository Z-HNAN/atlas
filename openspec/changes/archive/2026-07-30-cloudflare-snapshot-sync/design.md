# 设计：Atlas Cloudflare 通用快照同步

## 总体架构

Atlas 使用 IndexedDB 保存 `LocalAppEnvelope<TripPayload>`。同步时把标准快照 Envelope 序列化为 UTF-8 JSON、gzip 压缩并计算最终字节 SHA-256，再通过 Worker API 上传。

Cloudflare Access 在 Worker 前完成固定团队登录，Worker 验证 `Cf-Access-Jwt-Assertion` 并映射内部用户。D1 只保存身份、App、成员关系和提交元数据；私有 R2 保存不可变快照字节。

## 本地数据

- 数据库：`atlas-travel-local`
- Object Store：`records`
- 正式键：`app:atlas-travel:data`
- 最近本地备份、旧 LocalStorage 迁移备份和最近远端备份使用同一 Repository 键空间。
- 同步元数据包含 `lastCloudVersion`、`lastSyncAt`、`lastSyncCommitId` 和状态。

旧 LocalStorage 正式快照在迁移前保存到 IndexedDB；成功写入后才删除旧正式键。旅行 Payload 仍使用 schemaVersion 1，不做业务结构迁移。

## 快照与并发协议

快照 Envelope 包含 `formatVersion`、`appId`、`payloadSchemaVersion`、`exportedAt`、`deviceId` 和 `data`。上传携带 baseVersion、UUID commitId、SHA-256、gzip/none 格式和设备 ID。

Worker 流程：

1. 校验 Access JWT、active 用户、App 成员、Header、大小和 SHA。
2. 查询 commitId：相同 Hash 返回原提交，不同 Hash 返回 409。
3. 计算 `proposedVersion = head + 1`。
4. 先条件写 R2。
5. D1 使用条件 `INSERT ... SELECT` 原子校验 baseVersion。
6. 竞争失败时检查幂等赢家；否则删除本次 R2 对象并返回 409。

D1 与 R2 没有分布式事务，因此禁止先写 D1。对象键固定为：

`v1/apps/{app_id}/users/{user_id}/snapshots/{10位补零version}-{commit_id}.bin`

## 权限与隐私

- 验证 JWT 签名、issuer、audience、exp、nbf 和 token type。
- 固定团队用户预配置，不开放注册。
- 优先按 sub 匹配；未匹配时按规范化邮箱匹配 active 用户并更新 sub。
- 所有 App 路由验证成员关系，readonly 不能提交。
- R2 私有，客户端不得直连。
- 日志不记录 JWT、API Key、快照 Body 或完整旅行数据。

## 保留与清理

- 每个用户/App 默认保留最近 50 个版本。
- 定时任务先删 R2 再标记 D1 `deleted_at`，最新版本不删除。
- 清理 24 小时以前且没有有效 D1 元数据的孤儿对象。

## 风险与权衡

- Repository 异步化会影响多个旅行页面回调；通过统一 `TripOperation` Promise 和回归测试控制。
- Access 跨域依赖明确的 Vercel/本地 Origin、credentials 和暴露响应 Header。
- 浏览器需支持 IndexedDB、CompressionStream 和 DecompressionStream；不支持时明确报错。
- Supabase 业务表曾表达公开读取旅行计划的方向，但当前产品以本地数据为主且前端未使用这些表；本次按用户给出的通用快照方案删除，不保留双数据源。

## 验收标准

- 旧 LocalStorage Atlas 快照安全迁入 IndexedDB，刷新和离线旅行生命周期通过。
- 地图、旅行编辑、地理编码、DeepSeek 和 PLN 不因 Repository 异步化回归。
- gzip、SHA、幂等、冲突、人工处理和 Worker D1/R2 编排有测试或可审计实现。
- 前端生产构建仍可由 Vercel 部署，且不包含服务端 Secret。
