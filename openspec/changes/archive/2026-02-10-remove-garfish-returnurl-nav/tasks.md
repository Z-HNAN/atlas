## 1. 依赖与代码清理（去 Garfish / 去子应用渲染）

- [x] 1.1 从 package.json 中移除 Garfish 相关依赖并执行安装校验
- [x] 1.2 删除或下线 Garfish 初始化与注册代码（例如 src/lib/garfish.ts）
- [x] 1.3 移除子应用容器渲染页面与路由（例如 src/pages/SubAppHost.tsx 及其路由入口）
- [x] 1.4 清理不再使用的子应用相关工具与 hooks（例如 src/hooks/useSubApps.ts、src/utils/subApp.ts）
- [x] 1.5 确认构建与开发启动无 Garfish 残留引用（TypeScript 编译通过）

## 2. 跳转入口与 returnUrl 机制（/?appName=...&returnUrl=...）

- [x] 2.1 定义并实现 query 解析：读取 appName/returnUrl（缺省 returnUrl 时回落到门户首页绝对地址）
- [x] 2.2 实现 appName -> 本地配置应用 URL 的查找逻辑（找不到时进入 NotFound/错误提示，不重定向）
- [x] 2.3 实现重定向：将 returnUrl 作为 query 透传到目标应用 URL（支持目标 URL 已包含 query 的拼接）
- [x] 2.4 在 Home 页点击卡片时生成跳转链接 `/?appName=<name>&returnUrl=<encodeURIComponent(currentUrl)>`
- [x] 2.5 补充边界处理：appName/returnUrl 的解码失败、空字符串、特殊字符等

## 3. Home 页卡片 UI（更小 + 响应式）

- [x] 3.1 调整 Home 页卡片样式为更紧凑（padding/字体/间距下调），并保持可点击区域合理
- [x] 3.2 使用响应式 Grid（auto-fit/minmax 等）优化不同屏宽下的列数与间距
- [x] 3.3 确保 [+] 添加卡片与普通应用卡片尺寸/栅格行为一致

## 4. 路由与页面体验

- [x] 4.1 更新 App 路由结构：移除子应用视图相关路径，保留 Home/Settings/NotFound
- [x] 4.2 确认 TopNav（如存在）不会再按“子应用视图”渲染；必要时移除或改为仅在非 Home 页显示
- [x] 4.3 为“正在跳转”增加轻量状态（可选）：在检测到 appName 且即将重定向时展示提示

## 5. 验收与回归

- [x] 5.1 验证：新增/删除/持久化应用配置仍正常
- [x] 5.2 验证：点击应用卡片会进入 `/?appName=...&returnUrl=...` 且随后跳转到目标应用并带上 returnUrl
- [x] 5.3 验证：unknown appName 不跳转，展示 NotFound/错误提示并可返回 Home
- [x] 5.4 验证：窄屏与宽屏下卡片布局均紧凑且可用
