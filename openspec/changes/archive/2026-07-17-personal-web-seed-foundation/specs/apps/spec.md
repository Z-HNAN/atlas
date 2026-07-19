# apps

## Purpose

定义 Gipsy 外部应用入口的新增、删除、持久化和浏览器级启动协议，保证配置安全、唯一且刷新后可恢复。

## Requirements

### Requirement: 新增应用

系统 SHALL 允许用户在设置页添加具有唯一名称和 HTTP/HTTPS 完整 URL 的外部应用入口。

#### Scenario: 新增合法应用

- **WHEN** 用户在 `/settings` 提交非空名称和合法 HTTP/HTTPS URL
- **THEN** Repository 为应用生成稳定 ID、写入 Payload 并返回首页

#### Scenario: 拒绝无效或重复应用

- **WHEN** 名称为空、名称已存在，或 URL 为空、格式错误、使用非 HTTP/HTTPS 协议
- **THEN** Zod Schema 或业务 Hook 拒绝修改并显示明确错误

### Requirement: 删除应用

系统 SHALL 使用稳定 ID 删除单个应用，并 SHALL 要求用户确认。

#### Scenario: 确认删除

- **WHEN** 用户点击某应用卡片的删除按钮并确认
- **THEN** 系统只删除该 ID 对应记录，递增数据版本，首页不再显示该记录

#### Scenario: 取消删除

- **WHEN** 用户在确认框中取消
- **THEN** 应用列表和本地数据保持不变

### Requirement: 本地持久化与展示

应用列表 SHALL 通过 LocalDataRepository 持久化，首页 SHALL 以响应式卡片网格展示。

#### Scenario: 刷新恢复

- **WHEN** 门户刷新或浏览器重新打开
- **THEN** 系统从有效 Envelope 恢复应用列表，不由组件直接读取 LocalStorage

#### Scenario: 空列表

- **WHEN** Payload 中没有应用
- **THEN** 首页显示空状态和添加入口

### Requirement: 跳转入口协议

首页应用卡片 SHALL 先进入 `/?appName=<name>&returnUrl=<encoded-current-url>` 的门户跳转入口。

#### Scenario: 点击应用卡片

- **WHEN** 用户点击已配置的应用
- **THEN** 门户使用应用名称和 URL 编码后的当前地址构造统一入口

#### Scenario: 精确查找应用

- **WHEN** 门户入口包含非空 appName
- **THEN** 系统按名称精确匹配本地已配置应用；无法匹配时显示错误并允许返回首页

### Requirement: 浏览器级重定向

门户 SHALL 只跳转到本地已校验配置中的目标 URL，SHALL NOT 在页面内嵌外部应用或让 returnUrl 决定目标地址。

#### Scenario: 透传启动参数

- **WHEN** 系统找到目标应用
- **THEN** 在目标 URL 上追加或覆盖 `appName` 和经过校验的 `returnUrl`，然后执行浏览器级跳转

#### Scenario: returnUrl 回退

- **WHEN** returnUrl 缺失、为空或无法解析为合法 HTTP/HTTPS URL
- **THEN** 系统使用门户首页绝对地址作为 returnUrl

## Compatibility

- 旧 `gipsy-apps` 中的合法名称和 URL 迁移后继续遵循同一跳转协议。
- 应用名称作为现有协议的精确匹配键；改变名称可能影响已保存的入口链接。
