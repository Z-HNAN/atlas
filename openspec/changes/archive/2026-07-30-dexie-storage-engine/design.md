# 设计：Dexie 本地键值适配器

## 架构

UI 和 Feature 继续只依赖 Repository。Repository 继续只依赖 `AsyncKeyValueStore`，默认实现改为 `DexieKeyValueStore`。Dexie 只负责 `atlas-travel-local` 数据库中 `records` Object Store 的打开、声明式 Schema 和单记录事务；字符串 Envelope 的校验、版本、备份、导入导出和同步元数据仍由项目代码负责。

Object Store 使用隐藏且非自增的主键，写入仍为 `put(value, key)`，因此数据库内部保持键值语义，不把 TripPayload 拆成业务表。

## 错误与数据边界

- Dexie 操作统一经过适配器错误转换，配额错误继续映射为 `LOCAL_STORAGE_QUOTA_EXCEEDED`。
- 读取结果必须是字符串；其它类型映射为 `DATA_VALIDATION_FAILED`。
- Dexie 实例不暴露给 UI、Feature 或业务 Repository 调用方。
- `fake-indexeddb` 仅存在于测试依赖，不进入生产包。

## 新项目初始化

Atlas 尚未正式发布，本次不为开发期原生 IndexedDB 数据建立专用兼容路径、双读或迁移版本。首次访问由 Dexie 创建 version 1 和 `records` Object Store。现有 LocalStorage 导入与备份能力不因本次重构改变。

## 风险与权衡

- 新增依赖带来供应链和包体积成本；通过固定锁文件、零审计漏洞、局部适配层和构建检查控制。
- Dexie 的 Schema 版本与业务 `schemaVersion` 含义不同；前者只管理 IndexedDB 结构，后者只管理 TripPayload，文档和代码中不得混用。
- 直接在 Feature 使用 Dexie 会形成库耦合；只允许 `src/lib/local-data` 适配器导入 Dexie。
- 其它原生实现只有在存在明确维护收益时才换库，避免借本次重构扩大范围。

## 验收标准

- 新数据库可初始化并完成字符串记录读写与删除。
- 非字符串记录被明确拒绝，配额错误可由统一错误模型识别。
- Repository、旅行生命周期、离线构建和云同步测试无回归。
- 两项目的 AGENTS 与工程主规范包含一致的依赖选择原则。
