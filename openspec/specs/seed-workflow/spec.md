# seed-workflow

## Purpose

定义开发者和 Codex 从安装、配置、OpenSpec 变更到测试、部署及派生新项目的可重复启动流程。

## Requirements

### Requirement: START 指南

仓库 SHALL 提供中文 `START.md` 作为首要操作指南。

#### Scenario: 新开发者启动

- **WHEN** 开发者首次克隆仓库
- **THEN** START 说明 Node 22、安装、环境变量、Atlas 使用、开发命令、本地模式和质量门禁

#### Scenario: 配置外部增强

- **WHEN** 开发者需要云同步或 DeepSeek 旅行规划
- **THEN** START 说明 Worker/D1/R2 本地准备、Access、公开变量、DeepSeek Key 保存、Vercel 前端边界与安全禁区

### Requirement: OpenSpec 与 Codex 开发流程

所有非平凡变更 SHALL 先建立中文 OpenSpec，再实现、测试和归档；Codex SHALL 读取 `AGENTS.md` 并报告质量门禁。

#### Scenario: 创建新变更

- **WHEN** 开发者提出功能或架构调整
- **THEN** 使用日期主题目录编写 proposal、design、tasks、capability spec，并同步主规范后实施

#### Scenario: 完成交付

- **WHEN** tasks 全部完成
- **THEN** 新主规范严格校验通过，typecheck、lint、test、format:check、build 成功，README 和 START 与实现一致

### Requirement: 派生个人项目

START SHALL 记录从 Local-first 种子派生 Atlas 时替换和验证的配置，并 SHALL 将 Atlas 作为当前可运行产品。

#### Scenario: 创建派生项目

- **WHEN** 开发者复制种子实现新工具
- **THEN** 替换 appId、IndexedDB 数据库名、storageKey、Payload 类型、Zod Schema、迁移、Feature、PWA 品牌、环境变量和规范，并保持 Local-first

## Compatibility

- 指南中的命令必须与 package scripts 和 CI 一致。
- 未使用云同步或 DeepSeek 的派生项目可以删除相应 UI，但不得破坏本地数据、恢复和质量门禁。
- MVP 验收后必须删除不再解释当前行为的 Seed 历史、旧厂商配置和失效代码，并保留有效迁移、恢复说明和回归测试。
