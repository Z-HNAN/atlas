# cloud-sync 增量规范

## MODIFIED Requirements

### Requirement: 单 Head 手动同步 API

共享 Worker SHALL 在 `/api/v1` 提供 `/me?appId=atlas`、head、提交和 latest 接口；每个 `appId + 用户` SHALL 只保留一个最新 Head。客户端 SHALL 只在用户主动检查登录、刷新云端信息、同步、恢复或处理冲突时访问共享 Worker，SHALL NOT 在应用初始化或普通路由加载时自动请求身份或同步数据，也 SHALL NOT 提供云端历史入口。

#### Scenario: 主动检查身份与 Head

- **WHEN** 用户点击“检查登录状态”且 `/me?appId=atlas` 验证成功
- **THEN** 客户端继续请求 `/api/v1/apps/atlas/sync/head`，展示响应中的真实云端 version 和 createdAt

#### Scenario: 主动刷新云端信息

- **WHEN** 已登录用户点击“刷新云端信息”
- **THEN** 客户端重新查询 Head，且不比较本地 dataVersion 与云端 version，也不据此自动上传、下载或覆盖数据

#### Scenario: 尚无云端快照

- **WHEN** Head API 返回 `{ "head": null }`
- **THEN** 设置页显示“尚无云端备份”和“尚未同步”，不得回退显示本地缓存的 lastCloudVersion 或 lastSyncAt

## ADDED Requirements

### Requirement: 真实云端元数据展示

客户端 SHALL 通过 Zod 严格校验 Head 响应，只展示当前账号 Head 的真实 `version` 与服务端 `createdAt`。客户端 SHALL NOT 为展示云端信息下载快照正文、读取其它 App 数据、比较本地与云端谁更新，或以本地同步元数据代替查询结果。

#### Scenario: 有效 Head

- **WHEN** Head API 返回当前 Atlas 账号的有效元数据
- **THEN** 设置页按浏览器本地时区显示云端版本和云端最后同步时间

#### Scenario: Head 查询失败或响应无效

- **WHEN** 当前离线、请求失败、响应结构无效或 appId 不是 `atlas`
- **THEN** 客户端显示错误且不覆盖 IndexedDB，不泄露认证信息、快照正文或其它 App 元数据

## Compatibility

- 本次不修改 Worker 路由、Access 权限、同步提交协议、IndexedDB Envelope、TripPayload Schema、版本基线或冲突策略。
- 应用初始化和普通路由继续不请求 Worker；云端信息只由用户检查登录、主动刷新或明确同步操作触发。
