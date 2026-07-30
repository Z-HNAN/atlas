import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import CloudSyncSettings from "../components/settings/CloudSyncSettings";
import { APP_CONFIG } from "../config/app-config";
import type { CloudSyncController } from "../features/trips/hooks/useCloudSync";
import type { TripOperationResult } from "../features/trips/hooks/useTrips";
import { useTravelPlanner } from "../features/trips/hooks/useTravelPlanner";
import type { TripPayload } from "../features/trips/types/trips";
import { downloadJson } from "../lib/local-data/download";
import type { LocalAppEnvelope } from "../lib/local-data/envelope";
import type { StorageSizeInfo } from "../lib/local-data/storage-size";

interface SettingsProps {
  envelope: LocalAppEnvelope<TripPayload> | null;
  storageSize: StorageSizeInfo;
  cloudSync: CloudSyncController;
  onExportData: () => TripOperationResult<string>;
  onExportLatestBackup: () => TripOperationResult<string>;
  onImportData: (raw: string) => TripOperationResult;
  onResetData: () => TripOperationResult;
}

const Settings = ({
  envelope,
  storageSize,
  cloudSync,
  onExportData,
  onExportLatestBackup,
  onImportData,
  onResetData,
}: SettingsProps) => {
  const planner = useTravelPlanner();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const exportData = () => {
    const result = onExportData();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    downloadJson(
      result.value,
      `${APP_CONFIG.appId}-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
    setMessage("旅行数据已导出，文件不包含 API Key 或认证信息。");
    setError("");
  };

  const exportBackup = () => {
    const result = onExportLatestBackup();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    downloadJson(result.value, `${APP_CONFIG.appId}-latest-local-backup.json`);
    setMessage("最近覆盖前备份已导出。");
    setError("");
  };

  const importFile = async (file: File) => {
    if (
      !window.confirm("导入会覆盖当前旅行数据，并先创建本地备份。确认继续吗？")
    )
      return;
    try {
      const result = onImportData(await file.text());
      if (!result.ok) setError(result.error);
      else {
        setMessage("旅行数据导入成功。");
        setError("");
      }
    } catch {
      setError("文件读取失败，请重新选择 JSON 备份。");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const capacityText =
    storageSize.level === "normal"
      ? "本地容量正常。"
      : storageSize.level === "warning"
        ? "数据已接近建议容量，请定期导出。"
        : "数据量较大，请立即导出并评估升级存储。";

  return (
    <div className="content-page narrow-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SETTINGS & DATA</p>
          <h1>设置与数据</h1>
          <p>管理浏览器中的 Key、本地备份和可选 Supabase 云同步。</p>
        </div>
        <Link className="ghost-btn" to="/">
          返回首页
        </Link>
      </header>

      <section className="settings-card">
        <div className="settings-section">
          <h2>DeepSeek BYOK</h2>
          <p className="settings-note">
            API Key
            默认只保存到本次浏览器会话。只有你主动勾选后才会持久保存在此浏览器；Key
            不进入旅行数据、导出文件、Supabase 或日志。
          </p>
          <p className="settings-note">
            当前浏览器直连地址：<code>{APP_CONFIG.deepSeekBaseUrl}</code>
            ；模型：<code>{APP_CONFIG.deepSeekModel}</code>
            。官方端点当前支持 C 端跨域请求，无需项目共享 Key。
          </p>
          <label className="form-field">
            <span>DeepSeek API Key</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                planner.hasKey ? "已保存；输入新 Key 可替换" : "sk-..."
              }
            />
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            在此浏览器中记住 Key
          </label>
          <div className="data-actions">
            <button
              className="primary-btn"
              type="button"
              disabled={!apiKey.trim()}
              onClick={() => {
                const result = planner.saveKey(apiKey, remember);
                if (!result.ok) setError(result.error);
                else {
                  setApiKey("");
                  setMessage(
                    remember
                      ? "Key 已保存在此浏览器。"
                      : "Key 已保存到本次会话。",
                  );
                  setError("");
                }
              }}
            >
              保存 Key
            </button>
            <button
              className="danger-btn"
              type="button"
              disabled={!planner.hasKey}
              onClick={() => {
                planner.clearKey();
                setMessage("DeepSeek Key 已从浏览器清除。");
              }}
            >
              清除 Key
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h2>本地数据与恢复</h2>
          <dl className="metadata-grid">
            <div>
              <dt>App ID</dt>
              <dd>{APP_CONFIG.appId}</dd>
            </div>
            <div>
              <dt>Schema</dt>
              <dd>{envelope?.schemaVersion ?? "—"}</dd>
            </div>
            <div>
              <dt>数据版本</dt>
              <dd>{envelope?.dataVersion ?? "—"}</dd>
            </div>
            <div>
              <dt>本地容量</dt>
              <dd>{storageSize.formatted}</dd>
            </div>
            <div>
              <dt>待同步</dt>
              <dd>{envelope?.sync.dirty ? "是" : "否"}</dd>
            </div>
            <div>
              <dt>PWA</dt>
              <dd>
                {window.matchMedia("(display-mode: standalone)").matches
                  ? "已安装"
                  : "浏览器模式"}
              </dd>
            </div>
          </dl>
          <p className={`capacity-hint capacity-${storageSize.level}`}>
            {capacityText}
          </p>
          <div className="data-actions">
            <button className="primary-btn" type="button" onClick={exportData}>
              导出 JSON
            </button>
            <button
              className="secondary-btn"
              type="button"
              onClick={exportBackup}
            >
              导出最近备份
            </button>
            <label className="secondary-btn file-btn">
              导入 JSON
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                }}
              />
            </label>
            <button
              className="danger-btn"
              type="button"
              onClick={() => {
                if (
                  !window.confirm("确认清空全部本地旅行吗？清空前会自动备份。")
                )
                  return;
                const result = onResetData();
                if (!result.ok) setError(result.error);
                else {
                  setMessage("本地数据已重置为初始示例。");
                  setError("");
                }
              }}
            >
              重置本地数据
            </button>
          </div>
        </div>

        <CloudSyncSettings controller={cloudSync} envelope={envelope} />
      </section>
      {error || planner.error ? (
        <div className="form-error" role="alert">
          {error || planner.error}
        </div>
      ) : null}
      {message ? (
        <div className="form-success" role="status">
          {message}
        </div>
      ) : null}
    </div>
  );
};

export default Settings;
