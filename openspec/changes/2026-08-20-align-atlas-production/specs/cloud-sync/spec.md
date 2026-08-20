# cloud-sync 增量规范

## MODIFIED Requirements

### Requirement: 共享服务与部署边界

Atlas SHALL 复用 Gipsy 基础设施维护者部署的 `https://sync.api.10242020.xyz`、Cloudflare Access 和私有 R2；Atlas 仓库与部署 SHALL NOT 创建、注册、迁移或发布 Worker、D1、R2、Cron 或 Access Application。

#### Scenario: Atlas 启用云备份

- **WHEN** 正式环境开启共享云备份
- **THEN** 只设置 `VITE_APP_ID=atlas`、同步开关和共享 API 公开地址，不运行服务端命令

### Requirement: 正式 Origin 与 App 隔离

Atlas 正式 Origin SHALL 为 `https://atlas.app.10242020.xyz`。客户端 SHALL 只请求 `atlas` 路径，并在 `/me` 请求中携带 `appId=atlas`；共享 Worker SHALL 从正式 Origin 推导 appId、回显经过校验的具体 Origin，并拒绝 Origin 与路径不一致的请求。

#### Scenario: 同名 Atlas 请求

- **WHEN** 正式 Atlas Origin 请求 `/api/v1/apps/atlas/sync/latest`
- **THEN** Worker 返回该具体 Origin 的 credentialed CORS 响应并继续执行 Access 身份和用户 Head 隔离校验

#### Scenario: 跨 App 请求

- **WHEN** Atlas Origin 请求其它 appId 的同步路径
- **THEN** Worker 返回拒绝且不得读取其它 App 的 R2 对象

### Requirement: 单 Head 手动同步 API

共享 Worker SHALL 在 `/api/v1` 提供 `/me?appId=atlas`、head、提交和 latest 接口；每个 `appId + 用户` SHALL 只保留一个最新 Head。客户端 SHALL 只在用户主动检查登录、同步、恢复或处理冲突时访问共享 Worker，SHALL NOT 在应用初始化或普通路由加载时自动请求身份或同步数据，也 SHALL NOT 提供云端历史入口。

#### Scenario: 打开普通页面

- **WHEN** 用户打开首页、地图或旅行页但没有操作云同步
- **THEN** 应用不请求 `/me` 或同步数据接口，本地功能完整可用

#### Scenario: 主动检查身份

- **WHEN** 用户在设置或登录页点击“检查登录状态”
- **THEN** 客户端请求 `/me?appId=atlas` 并更新当前会话状态

#### Scenario: 只修改本地

- **WHEN** 用户编辑旅行但未点击同步
- **THEN** Repository 保存 IndexedDB 并保持 dirty，客户端不自动调用 Worker

#### Scenario: 最新快照覆盖

- **WHEN** 用户基于当前云版本成功提交新快照
- **THEN** Worker 条件覆盖同一 Head，旧云端正文不再提供历史读取

## Compatibility

- `atlas-travel` 调试 IndexedDB、导出和云端 Head 不迁移、不读取也不删除；新版本直接使用 `atlas` 身份和新的本地/云端命名空间。
- TripPayload schemaVersion 与同步协议字段保持不变。
