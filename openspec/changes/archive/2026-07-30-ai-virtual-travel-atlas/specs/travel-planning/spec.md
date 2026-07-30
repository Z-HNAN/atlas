# travel-planning

## ADDED Requirements

### Requirement: Local-first 旅行生命周期

系统 SHALL 在未联网、未登录、未配置 Supabase 时提供旅行草稿、地点编辑、状态、到访、评分和总结；UI SHALL NOT 直接操作浏览器存储。

#### Scenario: 离线创建与刷新

- **WHEN** 用户离线创建或修改旅行并刷新页面
- **THEN** Repository 恢复经过 Zod 校验的最后版本，业务修改已递增 dataVersion、更新时间并设置 dirty

### Requirement: AI 旅行计划

系统 SHALL 通过可替换 Provider 和用户自己的 DeepSeek Key 生成不含最终坐标的结构化旅行计划，并 SHALL 在保存前严格校验。

#### Scenario: 有效输出

- **WHEN** DeepSeek 返回标题、简介、连续顺序和至少两个有效地点
- **THEN** 系统创建坐标待确认的本地草稿，不自动确认或导出

#### Scenario: 无效输出

- **WHEN** 首次输出不是合法 JSON 或不符合 Schema
- **THEN** Provider 尝试修复一次；仍失败时显示错误且不写入旅行数据

### Requirement: 地点解析与人工确认

系统 SHALL 串行调用 Nominatim、缓存结果、根据国家/地区/搜索词评分，并 SHALL 对歧义或失败地点要求人工处理。

#### Scenario: 歧义结果

- **WHEN** 两个候选匹配分数接近
- **THEN** 地点标记为 ambiguous，用户确认坐标后才能确认旅行

### Requirement: 状态与记录

系统 SHALL 支持 draft、planned、in_progress、completed，以及地点到访、备注、1～10 分评分和旅行总结。

#### Scenario: 确认旅行

- **WHEN** 地点少于两个或任一地点不是 resolved
- **THEN** 系统禁止从草稿进入 planned 和禁止导出 PLN
