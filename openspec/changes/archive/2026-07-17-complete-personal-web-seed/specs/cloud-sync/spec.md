# cloud-sync

## Purpose

在不影响 Local-first 核心能力的前提下，为 Gipsy 提供可选登录、跨设备快照同步、云备份、恢复和人工冲突处理。

## Requirements

### Requirement: 云能力可选且按需加载

系统 SHALL 默认关闭云同步；只有公开环境配置完整且功能启用时才动态加载 Supabase SDK。

#### Scenario: 未配置云同步

- **WHEN** `VITE_ENABLE_CLOUD_SYNC` 不是 true，或 URL/publishable key 缺失
- **THEN** 本地功能完整可用，设置页显示关闭或配置缺失，应用不发起 Supabase 请求

### Requirement: Magic Link 认证

系统 SHALL 使用邮箱 Magic Link/OTP 登录，监听会话变化并支持退出。

#### Scenario: 发送登录链接

- **WHEN** 用户提交合法邮箱
- **THEN** 系统通过 Supabase `signInWithOtp` 发送链接，并使用当前站点地址作为 emailRedirectTo

#### Scenario: 会话建立或退出

- **WHEN** `onAuthStateChange` 返回登录或退出事件
- **THEN** UI 更新用户邮箱和云操作权限；未登录用户不能访问同步表

### Requirement: 同步决策与乐观并发

SyncManager SHALL 比较 local.dataVersion、dirty、lastRemoteVersion 和 remote.dataVersion，并 SHALL NOT 无条件 upsert 覆盖现有远程快照。

#### Scenario: 首次上传或恢复

- **WHEN** 远程不存在，或本地为初始空数据且远程存在
- **THEN** 系统分别上传本地，或先备份本地再应用远程

#### Scenario: 单侧修改

- **WHEN** 只有本地修改且远程等于 lastRemoteVersion，或本地未修改且远程版本更高
- **THEN** 系统分别安全上传，或备份后应用远程

#### Scenario: 双侧修改

- **WHEN** 本地 dirty 且远程版本高于 lastRemoteVersion
- **THEN** 系统进入冲突，不自动覆盖任一侧

#### Scenario: 并发更新失败

- **WHEN** 带 expectedRemoteVersion 的更新返回零行
- **THEN** Provider 抛出 REMOTE_VERSION_MISMATCH，Manager 重新读取远程并进入冲突

### Requirement: 人工冲突处理

系统 SHALL 提供保留本地、使用云端、分别导出和取消四类冲突操作。

#### Scenario: 本地或云端覆盖

- **WHEN** 用户确认保留本地或使用云端
- **THEN** 系统先备份当前云端并使用其版本乐观更新，或先备份本地再校验并应用远程

#### Scenario: 分别导出或取消

- **WHEN** 用户选择分别导出或取消
- **THEN** 系统生成两份不含密钥的标准 JSON，或保持冲突且不修改数据

### Requirement: 云数据管理与自动同步

登录用户 SHALL 能立即同步、从云恢复、用本地覆盖云端、删除云快照，并可独立开启自动上传。

#### Scenario: 自动同步

- **WHEN** 自动同步开启且本地 dirty、在线、已登录、无冲突并稳定 3 秒
- **THEN** 系统尝试同步；失败保留 dirty 和手动重试入口

#### Scenario: 删除云快照

- **WHEN** 用户二次确认删除
- **THEN** Provider 只删除当前 user_id/app_id 行，本地数据保持不变

### Requirement: RLS 安全边界

`app_sync_snapshots` SHALL 启用 RLS，authenticated 用户 SHALL 只能操作 `user_id = auth.uid()` 的行。

#### Scenario: 未登录或跨用户访问

- **WHEN** 请求没有有效会话或 user_id 不属于当前会话
- **THEN** RLS 拒绝查询和写入，前端隐藏按钮不作为权限边界

## Compatibility

- 云同步关闭、Supabase 不可用或上传失败时，本地读取和保存不得受影响。
- 远程 Payload 必须通过同一本地迁移链和 Zod Schema；未来 schemaVersion 不得静默覆盖。
