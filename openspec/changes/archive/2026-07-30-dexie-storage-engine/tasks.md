# 任务

- [x] P0 / Codex：建立 L 级提案、设计与增量规范；依赖：无；验收：方案对比、新项目边界、风险和回滚完整。
- [x] P0 / Codex：以 Dexie 适配器替换手写 IndexedDB；依赖：规范；验收：Repository 协议、数据库名、Object Store 和记录键保持不变。
- [x] P0 / Codex：增加 fake-indexeddb 回归测试；依赖：Dexie 适配器；验收：新库初始化、读写、删除和无效记录场景通过。
- [x] P1 / Codex：更新 AGENTS、README、START 和主规范；依赖：实现；验收：依赖选择规则与实际架构一致。
- [x] P0 / Codex：执行完整质量门禁与浏览器回归并归档；依赖：以上任务；验收：typecheck、lint、test、format:check、build 和 OpenSpec strict 全部通过。
