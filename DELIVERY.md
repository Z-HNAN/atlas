# Atlas 当前交付说明

## 交付结论

Atlas 是可独立运行的 Local-first Vite 应用。纯本地模式具备完整手工旅行闭环；DeepSeek、Nominatim 和 Gipsy 共享云备份是可选网络增强。

`npm run dev` 用于本地开发，`npm run build` 生成静态 `dist/`；`vercel.json` 提供 SPA 回退。Atlas 只部署前端，不包含或发布 Cloudflare Worker、D1、R2、Cron 或 Access 配置。

## 已交付能力

- Dashboard、旅行列表、AI/手工创建、旅行详情、世界收藏地图、Access 登录入口和设置页面。
- DeepSeek BYOK、Nominatim 串行查询、Zod 校验、地图确认与严格 Sky4Sim PLN 导出。
- Dexie/IndexedDB 版本化 Envelope、顺序 Schema 迁移、JSON 导入导出、覆盖前备份和容量提示。
- Gipsy 共享 Worker 的私有 R2 单 Head手动云备份、幂等提交、乐观并发和人工冲突。
- Vercel 静态配置、PWA 离线应用壳、更新提示和完整工程门禁。

## 自动验证

```text
npm run typecheck
npm run lint
npm run test -- --run
npm run format:check
npm run build
openspec validate --all --strict
```

## 仍需真实环境验收

以下项目依赖维护者账号、线上基础设施或本机软件：

1. 使用真实 DeepSeek Key 验证模型权限和结构化计划。
2. 在 `https://atlas-travel.app.10242020.xyz` 验证共享 Access 登录、跨站 Cookie 和 Origin/appId 绑定。
3. 使用两个浏览器验证手动上传、恢复、双端冲突与不同 Access 用户隔离。
4. 验证共享 Worker 的线上 R2 Head 覆盖、Hash 和 ETag 竞争。
5. 使用示例路线在 Sky4Sim 中核对 PLN。

## 交付入口

- 产品与架构说明：`README.md`
- 本地启动、共享云备份和 Vercel 准备：`START.md`
- Codex/OpenSpec 协作规则：`AGENTS.md`
- 当前主规范：`openspec/specs/`
