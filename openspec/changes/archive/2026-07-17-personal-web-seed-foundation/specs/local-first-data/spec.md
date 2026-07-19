# local-first-data

## Purpose

为 Gipsy 提供可验证、可迁移、可恢复的本地优先数据基础设施，保证未联网、未登录、未配置云服务时核心功能仍完整可用，并为后续可选快照同步保留版本边界。

## Requirements

### Requirement: 版本化本地初始化与持久化

系统 SHALL 使用 `LocalAppEnvelope<GipsyPayload>` 作为唯一正式业务快照；`appId` 固定为 `gipsy`，默认存储键为 `app:gipsy:data`。UI SHALL NOT 直接读写 LocalStorage。

#### Scenario: 首次初始化

- **WHEN** 正式存储键和旧数据均不存在
- **THEN** 系统创建 schemaVersion 1、dataVersion 1、dirty 为 false 的有效默认 Envelope

#### Scenario: 业务数据修改

- **WHEN** 用户新增、删除、导入或清空应用数据
- **THEN** 系统使用 Zod 校验新 Payload，递增 dataVersion、更新 updatedAt、设置 dirty 为 true，再写入 LocalStorage

#### Scenario: 刷新恢复

- **WHEN** 页面刷新或浏览器重新打开
- **THEN** 系统从 Repository 恢复最后一次成功写入且通过 Zod 校验的 Envelope

### Requirement: 旧数据与 Schema 迁移

系统 SHALL 支持旧 `gipsy-apps` 数组和低版本 Envelope 的安全迁移；迁移失败 SHALL NOT 删除或覆盖原数据。

#### Scenario: 迁移旧应用数组

- **WHEN** 新存储键不存在且合法的 `gipsy-apps` 存在
- **THEN** 系统保留名称和 HTTP/HTTPS URL，为记录生成稳定 ID，写入新 Envelope，保存 legacy backup 后删除旧键

#### Scenario: 旧数据无效

- **WHEN** `gipsy-apps` 不是有效 JSON、URL 不安全或数据违反唯一性约束
- **THEN** 系统保留旧键、不创建正式数据，并向用户显示明确错误

#### Scenario: 迁移低版本 Envelope

- **WHEN** 已保存 schemaVersion 低于当前版本
- **THEN** 系统先备份原始数据，再按版本顺序执行迁移，校验结果，递增 dataVersion 并标记 dirty

#### Scenario: 不兼容的未来版本

- **WHEN** 已保存 schemaVersion 高于当前版本或迁移链缺失
- **THEN** 系统拒绝覆盖数据并提示用户升级应用或从备份恢复

### Requirement: JSON 导出、导入与恢复

系统 SHALL 提供不依赖 Supabase 的数据导出、导入和清空能力。

#### Scenario: 导出本地数据

- **WHEN** 用户选择导出
- **THEN** 系统下载包含格式、appId、schemaVersion、dataVersion、exportedAt 和 Payload 的 JSON，且不包含 deviceId、同步状态、API Key 或认证信息

#### Scenario: 下载最近本地备份

- **WHEN** 用户在覆盖操作后选择下载最近本地备份
- **THEN** Repository 将内部备份转换为可重新导入的标准导出 JSON，且不包含 deviceId、同步状态、API Key 或认证信息

#### Scenario: 导入合法备份

- **WHEN** 用户确认导入格式和 appId 正确、可迁移且 Payload 合法的 JSON
- **THEN** Repository 先备份当前正式数据，再以高于当前和导入版本的 dataVersion 保存 Payload，并标记 dirty

#### Scenario: 拒绝错误导入

- **WHEN** 导入文件格式错误、appId 不匹配、包含重复名称或 ID、URL 非 HTTP/HTTPS，或 Schema 无法迁移
- **THEN** 系统拒绝写入正式数据并显示明确错误

#### Scenario: 清空本地数据

- **WHEN** 用户二次确认清空
- **THEN** Repository 先保存最近备份，再以递增版本写入空 Payload，并保持 dirty

### Requirement: 本地容量与失败反馈

系统 SHALL 计算正式快照的 UTF-8 字节数，并 SHALL 将 JSON、校验、迁移、访问和配额失败归一化为不泄露私密数据的 AppError。

#### Scenario: 容量分级

- **WHEN** 数据小于 2 MB、介于 2～4 MB、或大于 4 MB
- **THEN** 设置页分别显示正常、提醒、严重提醒，并在严重状态建议导出或升级 IndexedDB

#### Scenario: LocalStorage 配额不足

- **WHEN** 浏览器抛出 QuotaExceededError
- **THEN** 正式数据不被静默覆盖，用户收到导出和清理空间的明确提示

#### Scenario: 正式数据损坏

- **WHEN** Envelope 无法解析或校验
- **THEN** 首页仍可显示错误与恢复入口，用户可以在确认后清空或导入有效备份

### Requirement: 应用配置安全与唯一性

GipsyPayload 中每个应用 SHALL 具有唯一 ID 和唯一名称，URL SHALL 仅使用 HTTP 或 HTTPS。

#### Scenario: 新增重复应用名称

- **WHEN** 用户提交与已有记录同名的应用
- **THEN** 系统拒绝新增并显示名称已存在

#### Scenario: 按稳定 ID 删除

- **WHEN** 用户确认删除某个应用卡片
- **THEN** 系统只删除该 ID 对应的记录

#### Scenario: 不安全 URL

- **WHEN** 用户或导入文件提供 `javascript:`、`data:` 或其它非 HTTP/HTTPS URL
- **THEN** Zod Schema 拒绝数据，浏览器不得执行跳转

### Requirement: BYOK 本地存储边界

ApiKeyStore SHALL 默认将用户 API Key 保存到 sessionStorage；只有用户明确选择持久化时才写入 LocalStorage。Key SHALL NOT 进入业务 Payload、导出、云快照或日志。

#### Scenario: 临时保存 Key

- **WHEN** 用户未选择记住 Key
- **THEN** Key 仅存在于当前会话的 sessionStorage

#### Scenario: 显式持久化或清除 Key

- **WHEN** 用户选择记住、删除或全部清除 Key
- **THEN** ApiKeyStore 只操作自己前缀下且经过 Zod 校验的 Provider Key，不影响其它本地数据

## Compatibility

- appId 发布后不得修改；从种子派生项目时必须定义新的全局唯一 appId 和对应 storageKey。
- Payload 结构变化必须递增 schemaVersion 并提供顺序迁移；schemaVersion 与 dataVersion 不得混用。
- 旧 `gipsy-apps` 只迁移一次，成功后保留 `app:gipsy:data:legacy-backup`。
