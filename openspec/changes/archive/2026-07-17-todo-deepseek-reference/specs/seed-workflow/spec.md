# seed-workflow

## Purpose

记录 Todo + DeepSeek 参考业务对启动指南、Codex 工作流和派生项目清单的更新。

## Requirements

### Requirement: Todo + DeepSeek 启动说明

README 和 START SHALL 将 Todo 描述为默认参考业务，将 DeepSeek 描述为可选 BYOK 增强，并保持 Local-first 为默认模式。

#### Scenario: 新开发者启动

- **WHEN** 开发者按指南运行 `npm run dev`
- **THEN** 首屏是可直接新增待办的 Todo Seed，不要求云服务或 API Key

### Requirement: Codex 后续开发

种子及派生项目 SHALL 继续使用 Codex + 中文 OpenSpec 驱动非平凡变更。

#### Scenario: 派生新业务

- **WHEN** 开发者从种子创建个人工具
- **THEN** 指南要求替换 appId、Payload、Schema、迁移、Feature、测试与品牌，并让 Codex 完成规范、门禁和浏览器回归闭环

### Requirement: 文档与实现一致

当前文档 SHALL NOT 把应用导航或其它模型供应商描述为运行时参考业务。

#### Scenario: 完成交付

- **WHEN** 本次 tasks 完成
- **THEN** README、START、AGENTS、主规范、环境变量和运行时代码都指向 Todo + DeepSeek

## Compatibility

- 指南中的命令必须与 package scripts 和 CI 一致。
- 派生项目不使用 Supabase 或 DeepSeek 时可以删除相应增强，但不得破坏本地数据、迁移和恢复边界。
