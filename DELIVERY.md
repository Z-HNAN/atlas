# Atlas 本地可交付版本说明

## 交付结论

Atlas 已完成本地优先数据架构升级。纯本地模式具备完整手工旅行闭环；DeepSeek、Nominatim 和 Cloudflare 快照同步是可选网络增强。

交付形态为标准 Vite 项目：`npm run dev` 用于本地开发，`npm run build` 生成静态 `dist/`。`vercel.json` 已配置单页应用回退，后续可由维护者自行发布到 Vercel；本次没有执行线上发布。

## 已交付能力

- Dashboard、旅行列表、AI/手工创建、旅行详情、世界收藏地图、Access 登录入口和设置页面。
- DeepSeek BYOK 浏览器直连、会话存储、主动持久化、Zod 校验、一次修复和分层错误诊断。
- Nominatim 串行队列、至少 1.1 秒间隔、匹配评分、IndexedDB 缓存、歧义与失败处理。
- 旅行四种状态、地点到访与备注、评分、总结、地图和严格 Sky4Sim PLN 导出。
- IndexedDB 版本化 Envelope、旧 LocalStorage 一次性安全迁移、JSON 导入导出、覆盖前备份和容量提示。
- Cloudflare Access + Worker + D1 元数据 + 私有 R2 不可变快照；幂等提交、乐观并发、人工冲突和版本保留。
- Vercel 前端配置、Cloudflare Worker 独立配置模板、PWA 离线应用壳和更新提示。

## 自动验证

交付时执行并要求全部通过：

```text
npm run typecheck
npm run lint
npm run test -- --run
npm run format:check
npm run build
openspec validate 2026-07-30-cloudflare-snapshot-sync --strict
```

浏览器回归覆盖手工创建旅行、添加地点、触发“查询全部未确认地点”、Nominatim 返回、刷新恢复和设置页元数据。

## 仍需真实环境验收

以下项目依赖维护者账号、本机软件或生产项目：

1. 使用真实 DeepSeek Key 验证余额和模型权限。
2. 创建 Cloudflare Access Application、D1 和私有 R2，应用 Worker migration 并预配置 Atlas 成员。
3. 使用两个成员验证冲突、历史版本、readonly 权限和跨用户隔离。
4. 把 Vercel 正式 Origin 加入 Worker CORS 和 Access Application。
5. 使用富士山—河口湖—箱根—东京湾路线，在 Sky4Sim 中核对 PLN。

## 交付入口

- 产品与架构说明：`README.md`
- 本地启动、Cloudflare 准备和后续手动发布：`START.md`
- Codex/OpenSpec 协作规则：`agents.md`
- Worker 和 D1：`worker/`
- 本次方案、风险与迁移：`openspec/changes/archive/2026-07-30-cloudflare-snapshot-sync/`
