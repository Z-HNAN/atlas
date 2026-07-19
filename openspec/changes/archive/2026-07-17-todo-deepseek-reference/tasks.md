# Todo + DeepSeek 参考业务任务

## 规范与迁移

- [x] **P0 / Codex**：新增 Todo + DeepSeek 提案、设计、任务和变更规范；验收：目标、迁移、风险和实现一致。
- [x] **P0 / Codex**：定义 TodoPayload v2 与 v1 迁移；验收：旧应用名称、URL 被保留，迁移前有备份。
- [x] **P0 / Codex**：更新旧裸数组迁移；验收：`gipsy-apps` 可直接转换为有效 Todo。

## Todo 参考业务

- [x] **P0 / Codex**：实现 useTodos 的新增、完成切换、删除和清理；验收：每次修改经 Zod 和 Repository。
- [x] **P0 / Codex**：首页替换为 Todo List；验收：表单、三种过滤、统计、空状态和确认操作可用。
- [x] **P0 / Codex**：移除应用跳转协议和 URL 管理；验收：运行时代码与首页不再出现导航业务。

## DeepSeek BYOK

- [x] **P0 / Codex**：实现 DeepSeek Chat Completions Provider；验收：官方请求格式、JSON Output、超时、取消、重试和 Zod 校验有测试。
- [x] **P0 / Codex**：将 Key 设置切换到 deepseek；验收：默认 session、可选持久化、可清除且不进入业务数据。
- [x] **P1 / Codex**：实现任务拆解交互；验收：建议可预览并一次加入 Todo，失败不影响手工操作。

## 文档与交付

- [x] **P0 / Codex**：更新 PWA、README、START、AGENTS 与全部受影响主规范；验收：不再将导航/OpenAI描述为当前业务。
- [x] **P0 / Codex**：重写业务测试并回归云同步；验收：迁移、Todo 生命周期、DeepSeek 与双设备同步覆盖。
- [x] **P0 / Codex**：执行最终门禁和浏览器回归；验收：全部命令、PWA 路径及 Todo 真实交互通过。

## 依赖与风险

- DeepSeek 真实请求需要用户自己的 Key，仓库只使用 Fetch mock 验证请求与响应。
- 真实旧浏览器数据不可直接读取，使用版本 1 Envelope 和 `gipsy-apps` fixture 验证迁移。
- 若 DeepSeek 不允许目标部署域名浏览器直连，需后续独立实现 Server Provider。
