# app-launch

## 术语与定义
- **跳转入口**：门户用于触发跳转的入口 URL：`/?appName=<name>&returnUrl=<encoded-url>`。
- **returnUrl**：目标应用用于“返回门户”的地址。

## 规范目标
- 统一门户启动应用的入口与参数协议。
- 保证目标应用可稳定拿到 `returnUrl` 实现返回。

## 行为与接口约束

### 要求：跳转入口协议
- 参数：
	- `appName`：应用名称（精确匹配已配置应用）。
	- `returnUrl`：URL 编码后的“当前页面地址”。

#### 场景：从门户发起启动
- **当** 用户点击某个应用卡片
- **则** 门户导航到 `/?appName=<appName>&returnUrl=<encodeURIComponent(currentUrl)>`

### 要求：重定向规则
门户在检测到 `appName` 后，按本地配置查找目标应用并执行浏览器级跳转。

#### 场景：匹配到应用则跳转
- **当** `appName` 能匹配到已配置应用
- **则** 门户跳转到该应用的配置 `url`

#### 场景：未知 appName 不跳转
- **当** `appName` 为空或无法匹配任何已配置应用
- **则** 门户不跳转，展示错误状态并允许返回首页

#### 场景：透传参数到目标应用
- **当** 门户跳转到目标应用
- **则** 在目标 URL 上追加（或覆盖）以下 query：
	- `appName=<appName>`
	- `returnUrl=<decodedReturnUrl>`

### 要求：returnUrl 默认与校验

#### 场景：缺省 returnUrl
- **当** `returnUrl` 缺失或为空
- **则** 使用“门户首页绝对地址”作为 `returnUrl`

#### 场景：returnUrl 非法
- **当** `returnUrl` 无法被解析为合法 URL
- **则** 回落为“门户首页绝对地址”

## 安全约束
- 目标跳转地址只能来自“本地已配置应用的 url”，不得由 `returnUrl` 等外部参数决定。

## 示例
- 门户发起启动：
	- `/` 上点击 `订单系统`，当前地址为 `https://portal.example.com/`
	- 导航到：`/?appName=%E8%AE%A2%E5%8D%95%E7%B3%BB%E7%BB%9F&returnUrl=https%3A%2F%2Fportal.example.com%2F`
- 门户跳转到目标应用：
	- `https://orders.example.com/?appName=订单系统&returnUrl=https://portal.example.com/`
