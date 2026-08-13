# seed-workflow 增量规范

## MODIFIED Requirements

### Requirement: START 指南

仓库 SHALL 提供中文 `START.md`，说明 Node 22、本地 IndexedDB 初始化、Atlas 旅行流程、DeepSeek/Nominatim、共享 Gipsy 云备份、Vercel 正式域名、安全边界和五项质量门禁；SHALL NOT 指示 Atlas 开发者创建、迁移或部署 Worker、D1、R2、Cron 或 Access Application。

#### Scenario: 新开发者启动

- **WHEN** 开发者按 START 配置纯本地环境
- **THEN** Atlas 不访问同步服务，首次启动直接创建当前 IndexedDB Envelope，旅行核心功能完整可用

#### Scenario: 启用共享云备份

- **WHEN** 维护者为正式 Atlas 设置共享 API 公开变量
- **THEN** 只配置 `atlas-travel`、同步开关和 `https://sync.api.10242020.xyz`，不运行任何 Cloudflare 服务端命令

### Requirement: 项目交付流程

Codex SHALL 读取根目录 `AGENTS.md`、START、相关主规范、测试和工作区差异，按 S/M/L 分级实施；CI 与本地交付 SHALL 执行 typecheck、lint、test、format:check 和 build。

#### Scenario: 完成本次基础设施升级

- **WHEN** 共享同步、初始化和文档修改完成
- **THEN** OpenSpec strict 校验及五项门禁全部通过，当前主规范同步后才归档变更
