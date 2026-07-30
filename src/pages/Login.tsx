import { Link } from "react-router-dom";
import CloudSyncSettings from "../components/settings/CloudSyncSettings";
import type { CloudSyncController } from "../features/trips/hooks/useCloudSync";
import type { TripPayload } from "../features/trips/types/trips";
import type { LocalAppEnvelope } from "../lib/local-data/envelope";

interface LoginProps {
  envelope: LocalAppEnvelope<TripPayload> | null;
  cloudSync: CloudSyncController;
}

const Login = ({ envelope, cloudSync }: LoginProps) => (
  <div className="content-page narrow-page">
    <header className="page-header">
      <div>
        <p className="eyebrow">OPTIONAL CLOUD ACCOUNT</p>
        <h1>登录 Atlas</h1>
        <p>
          使用 Supabase 邮箱 Magic Link
          开启跨设备备份。登录不是本地旅行功能的前置条件。
        </p>
      </div>
      <Link className="ghost-btn" to="/">
        暂不登录
      </Link>
    </header>
    <section className="settings-card login-card">
      <CloudSyncSettings controller={cloudSync} envelope={envelope} />
    </section>
    <p className="login-footnote">
      账号 Token 由 Supabase SDK 管理，不进入旅行 Payload 或 JSON 导出。
      <Link className="text-link" to="/settings">
        查看完整数据设置
      </Link>
    </p>
  </div>
);

export default Login;
