# 任务

- [x] **P0 / Codex**：把同步 Hook 移入通用 `src/lib/sync`，接入共享 API 身份响应与 appId 查询；依赖：方案确认；验收：Atlas 业务层只注入 Repository 与空 Payload 判定，登录检查接受 64 位匿名用户 ID。
- [x] **P0 / Codex**：收敛为手动单 Head 同步并修复 gzip 背压；依赖：通用 Hook；验收：无自动同步或历史强制提交入口，双侧冲突不静默覆盖，上传期间编辑保持 dirty，大快照转换不会互等。
- [x] **P0 / Codex**：移除旧 LocalStorage 正式业务迁移；依赖：兼容策略确认；验收：首次初始化直接创建 IndexedDB Envelope，旧键不读取、不删除，通用顺序迁移与覆盖前备份仍通过测试。
- [x] **P0 / Codex**：删除 Atlas 独立 Worker、D1 migration、Wrangler 脚本与不再使用的依赖；依赖：共享服务边界确认；验收：仓库只保留共享 Worker 客户端，`npm run typecheck` 不再编译 Worker。
- [x] **P1 / Codex**：更新设置页、README、START、AGENTS、DELIVERY、CI 与主 OpenSpec；依赖：实现完成；验收：正式域名、共享 API、单 Head、手动同步、恢复限制和安全边界描述一致，CI 包含 format 检查。
- [x] **P0 / Codex**：执行 OpenSpec strict 校验及五项质量门禁，复核差异并归档变更；依赖：以上任务；验收：所有命令通过，任务与主规范一致，变更移动到 archive 后再提交。
