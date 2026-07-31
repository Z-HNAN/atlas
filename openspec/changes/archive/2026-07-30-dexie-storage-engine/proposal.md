# 提案：使用 Dexie 收敛 Atlas 本地存储基础设施

## 问题

Atlas 当前手写 IndexedDB 打开、升级、事务和事件错误处理。代码量不大，但这些通用细节容易在浏览器差异、事务时序和后续 Schema 演进中形成维护负担。项目同时缺少明确的第三方库选型规则，容易走向“所有能力都原生实现”或“为现代化盲目堆库”两个极端。

## 目标

- 使用 Dexie 封装 IndexedDB 的 Schema、Promise 和事务完成语义。
- 保持 `AsyncKeyValueStore`、Repository、业务 Envelope、数据库名、Object Store 和记录键不变。
- 建立收益驱动的依赖选择规则，允许成熟库承接通用基础能力。
- 通过真实 IndexedDB 模拟测试覆盖新数据库初始化、读写、删除和无效记录校验。

## 非目标

- 不迁移或兼容尚未正式发布的开发期 IndexedDB 数据。
- 不修改 TripPayload、schemaVersion、云同步协议或用户交互。
- 不引入新的状态管理、HTTP 客户端、表单框架或数据 ORM。
- 不执行线上发布。

## 方案对比

### 方案 A：保留手写原生 IndexedDB

没有新增依赖，但仍需自行维护打开、升级、事务和事件回调，后续索引演进成本较高，不采用。

### 方案 B：使用 Dexie 适配现有键值协议

Dexie 提供声明式 Schema、Promise API 和事务管理；项目继续掌控 Envelope、Zod 校验与错误模型。改动集中、退出成本可控，采用此方案。

### 方案 C：改造成完整业务表 ORM

可直接查询业务字段，但会破坏当前 Envelope 快照与通用同步边界，属于没有真实需求的过度设计，不采用。

## 迁移与回滚

当前项目尚未正式部署，本次按新项目干净初始化处理，不提供开发期 IndexedDB 数据迁移。数据库名、Object Store 和记录键仍保持稳定。回滚只需恢复原适配器和依赖锁文件；标准 JSON 导入导出继续作为正式发布后的用户恢复路径。

## 影响

- 生产依赖新增 Dexie，测试依赖新增 fake-indexeddb。
- `src/lib/local-data` 删除原生 IndexedDB 事件式实现，改为 Dexie 适配器。
- AGENTS、README、START 和工程主规范增加依赖选型边界。
