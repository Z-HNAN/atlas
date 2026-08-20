import { Link } from "react-router-dom";
import CloudSyncSettings from "../components/settings/CloudSyncSettings";
import type { TripPayload } from "../features/trips/types/trips";
import type { LocalAppEnvelope } from "../lib/local-data/envelope";
import type { CloudSyncController } from "../lib/sync/use-cloud-sync";

interface LoginProps {
  envelope: LocalAppEnvelope<TripPayload> | null;
  cloudSync: CloudSyncController<TripPayload>;
}

const Login = ({ envelope, cloudSync }: LoginProps) => (
  <div className="content-page narrow-page">
    <header className="page-header">
      <div>
        <p className="eyebrow">可选云端账户</p>
        <h1>登录 Atlas</h1>
        <p>
          使用 Cloudflare Access
          固定团队身份开启跨设备备份。登录不是本地旅行功能的前置条件。
        </p>
      </div>
      <Link className="ghost-btn login-skip-link" to="/">
        暂不登录
      </Link>
    </header>
    <section className="settings-card login-card">
      <CloudSyncSettings controller={cloudSync} envelope={envelope} />
    </section>
    <p className="login-footnote">
      Access 会话由受保护域名管理，不进入旅行 Payload 或 JSON 导出。
      <Link className="text-link" to="/settings">
        查看完整数据设置
      </Link>
    </p>
  </div>
);

export default Login;
