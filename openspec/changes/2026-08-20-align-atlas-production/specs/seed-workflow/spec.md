# seed-workflow 增量规范

## MODIFIED Requirements

### Requirement: 派生 App 不维护同步服务端

Atlas SHALL 作为 Gipsy 的派生 App，只复用 `https://sync.api.10242020.xyz`。START、README 和 npm scripts SHALL NOT 指示 Atlas 开发者复制 Wrangler 配置、注册 App、执行 D1 migration、创建 R2/Access 或发布 Worker。

#### Scenario: 启用 Atlas 正式云备份

- **WHEN** 维护者部署 `https://atlas.app.10242020.xyz`
- **THEN** 只配置 `atlas`、同步开关和共享 API URL，不创建或修改 Cloudflare 服务端资源

### Requirement: 当前 Atlas 产品边界

Atlas SHALL 保留 `atlas` appId、TripPayload、旅行 Feature、DeepSeek BYOK、Nominatim、Leaflet、PLN、IndexedDB、导入导出、PWA 和手动共享云备份；Seed 的 Todo Demo、独立 Worker、自动同步和旧 LocalStorage 初始化兼容 SHALL NOT 进入当前产品。

#### Scenario: 回顾 Gipsy Seed 升级

- **WHEN** Gipsy 的通用基础设施产生新版本
- **THEN** Atlas 只迁移仍符合自身业务与架构不变量的通用改进，并通过 OpenSpec 记录兼容、删除和恢复边界
