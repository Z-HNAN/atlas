# seed-workflow

## Purpose

定义开发者和 Codex 从本地安装、共享增强配置、OpenSpec 变更到测试与 Vercel 部署的可重复 Atlas 工作流。

## Requirements

### Requirement: START 操作指南

仓库 SHALL 提供中文 `START.md` 作为首要操作指南，说明 Node 22、环境变量、IndexedDB 初始化与恢复、Atlas 旅行流程、DeepSeek/Nominatim、Gipsy 共享云备份、Vercel 正式域名、安全禁区和质量门禁。

#### Scenario: 新开发者启动

- **WHEN** 开发者首次克隆仓库
- **THEN** START 说明安装、环境变量、开发命令和纯本地模式；首次启动直接创建当前 IndexedDB Envelope

#### Scenario: 配置外部增强

- **WHEN** 开发者需要 DeepSeek 旅行规划、Nominatim 查询或共享云备份
- **THEN** START 说明 BYOK 保存、Provider 请求、共享 API 公开变量、Access/Cookie 排障和 Local-first 失败边界

### Requirement: 派生 App 不维护同步服务端

Atlas SHALL 作为 Gipsy 的派生 App，只复用 `https://sync.api.10242020.xyz`。START、README 和 npm scripts SHALL NOT 指示 Atlas 开发者复制 Wrangler 配置、注册 App、执行 D1 migration、创建 R2/Access 或发布 Worker。

#### Scenario: 启用 Atlas 正式云备份

- **WHEN** 维护者部署 `https://atlas.app.10242020.xyz`
- **THEN** 只配置 `atlas`、同步开关和共享 API URL，不创建或修改 Cloudflare 服务端资源

### Requirement: OpenSpec 与 Codex 开发流程

Codex SHALL 读取根目录 `AGENTS.md`、START、相关主规范、现有测试和工作区差异，先说明 S/M/L 分级，再按风险维护中文 OpenSpec。实现、测试、主规范和指南 SHALL 同步。

#### Scenario: 创建行为或架构变更

- **WHEN** 开发者提出 M/L 级调整
- **THEN** Codex 在开发中目录建立对应增量规范；L 级同时包含 proposal、design、tasks 和能力规范

#### Scenario: 完成交付

- **WHEN** tasks 全部完成
- **THEN** OpenSpec strict 校验、typecheck、lint、test、format:check 和 build 成功，变更才移动到 archive

### Requirement: 当前 Atlas 产品边界

Atlas SHALL 保留 `atlas` appId、TripPayload、旅行 Feature、DeepSeek BYOK、Nominatim、Leaflet、PLN、IndexedDB、导入导出、PWA 和手动共享云备份；Seed 的 Todo Demo、独立 Worker、自动同步和旧 LocalStorage 初始化兼容 SHALL NOT 进入当前产品。

#### Scenario: 回顾 Gipsy Seed 升级

- **WHEN** Gipsy 的通用基础设施产生新版本
- **THEN** Atlas 只迁移仍符合自身业务与架构不变量的通用改进，并通过 OpenSpec 记录兼容、删除和恢复边界

## Compatibility

- 指南命令必须与 package scripts 和 CI 一致。
- 历史归档记录当时决策，当前行为以主规范、代码、测试和 START 为准。
- 移除旧兼容或基础设施前必须确认其不再被当前代码、数据恢复或部署流程依赖。
