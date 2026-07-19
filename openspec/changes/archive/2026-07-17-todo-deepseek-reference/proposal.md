# Todo + DeepSeek 参考业务改造提案

## 问题定义

Personal Web Seed 当前以“外部应用导航门户”为参考业务，并用 OpenAI 根据 URL 建议应用名称。导航业务包含跨站跳转协议，不能充分展示普通个人工具最常见的表单、列表、状态更新、过滤、删除和本地迁移；OpenAI 示例也与用户计划采用的 DeepSeek Key 不一致。

## 目标与非目标

### 目标

- 将默认首页完整替换为可离线使用的 Todo List。
- 展示新增、完成切换、筛选、删除、清理已完成等典型本地业务模式。
- 将现有 schemaVersion 1 的应用导航 Payload 安全迁移到 schemaVersion 2 Todo Payload，迁移前保留备份。
- 将 BYOK Provider、Key Store 标识、环境变量和界面全部切换到 DeepSeek。
- 使用 DeepSeek Chat Completions JSON Output 将一条任务拆解为可选择加入的子任务。
- 保留通用 Local-first、PWA、Supabase 快照同步、导入导出和 Codex/OpenSpec 工作流。

### 非目标

- 不保留外部应用启动协议、应用 URL 管理或导航卡片。
- 不实现 Todo 协作分配、提醒推送、重复任务、拖拽排序或服务端业务表。
- 不在仓库或云快照中保存 DeepSeek Key。
- 不为浏览器 CORS 问题提前增加 Serverless。

## 方案对比

### 方案一：保留导航首页，只增加 Todo 示例页

- 优点：兼容旧界面，改动较小。
- 缺点：默认体验仍不是 Todo，参考业务边界重复，Agent 派生新项目时容易继续复制无关导航协议。

### 方案二：完整替换为 Todo，旧应用信息迁移成待办

- 优点：默认业务清晰；真实展示 CRUD、过滤和迁移；旧信息不静默丢失；通用基础设施继续复用。
- 缺点：发布后不再支持原导航用途，迁移生成的待办需要用户自行整理。

### 方案三：清空旧 Payload，直接初始化 Todo

- 优点：实现最简单，数据最干净。
- 缺点：静默丢弃既有应用配置，违反 Local-first 恢复和迁移不变量。

## 推荐方案

采用方案二。Todo 使用独立 `TodoPayload` 和严格 Zod Schema；旧应用名称迁移为待办标题，旧 URL 写入备注。DeepSeek 使用官方 `/chat/completions` 接口与 JSON Output，Provider 负责超时、取消、有限重试和响应校验，页面只消费强类型子任务数组。

## 影响范围

- 删除 `features/apps` 业务与应用跳转服务，新增 `features/todos`。
- `APP_CONFIG.schemaVersion` 从 1 升至 2；存储键与 appId 保持不变。
- 首页改为 Todo List，设置页只保留 DeepSeek、云同步和本地数据管理。
- OpenAI 环境变量和 Provider 改为 DeepSeek。
- PWA 名称、描述、README、START、AGENTS 上下文和主规范同步更新。
- 业务单元测试和集成测试改为 Todo 生命周期与迁移场景。

## 兼容性与迁移计划

- `appId=gipsy` 与 `app:gipsy:data` 保持稳定，已有本地和云端快照仍可定位。
- schemaVersion 1 Payload 经迁移链转换为 schemaVersion 2 Todo Payload。
- 每个旧应用生成一个未完成 Todo：标题保留应用名称，备注保留原 URL。
- 旧 `gipsy-apps` 数组首次迁移时直接生成 schemaVersion 2 Todo Payload，并继续保存 legacy backup。
- 原 OpenAI Key 不自动复制或上传；DeepSeek 使用独立 `deepseek` Provider ID，用户需输入自己的 DeepSeek Key。
- 回滚到旧版本时，新 schemaVersion 会被旧实现拒绝，不会静默覆盖 Todo 数据。
