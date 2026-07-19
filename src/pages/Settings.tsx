import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CloudSyncSettings from "../components/settings/CloudSyncSettings";
import { APP_CONFIG } from "../config/app-config";
import { useDeepSeekTaskBreakdown } from "../features/todos/hooks/useDeepSeekTaskBreakdown";
import type { CloudSyncController } from "../features/todos/hooks/useCloudSync";
import type { TodoOperationResult } from "../features/todos/hooks/useTodos";
import type { TodoPayload } from "../features/todos/types/todos";
import { downloadJson } from "../lib/local-data/download";
import type { LocalAppEnvelope } from "../lib/local-data/envelope";
import type { StorageSizeInfo } from "../lib/local-data/storage-size";

type SettingsProps = {
  envelope: LocalAppEnvelope<TodoPayload> | null;
  storageSize: StorageSizeInfo;
  cloudSync: CloudSyncController;
  onExportData: () => TodoOperationResult<string>;
  onExportLatestBackup: () => TodoOperationResult<string>;
  onImportData: (raw: string) => TodoOperationResult;
  onResetData: () => TodoOperationResult;
};

const Settings = ({
  envelope,
  storageSize,
  cloudSync,
  onExportData,
  onExportLatestBackup,
  onImportData,
  onResetData,
}: SettingsProps) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deepSeekKey, setDeepSeekKey] = useState("");
  const [rememberDeepSeekKey, setRememberDeepSeekKey] = useState(false);
  const deepSeek = useDeepSeekTaskBreakdown();

  const handleSaveDeepSeekKey = () => {
    const result = deepSeek.saveKey(deepSeekKey, rememberDeepSeekKey);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDeepSeekKey("");
    setError("");
    setMessage(
      rememberDeepSeekKey
        ? "DeepSeek API Key 已保存在此浏览器。"
        : "DeepSeek API Key 已保存在本次浏览器会话。",
    );
  };

  const handleExport = () => {
    setError("");
    setMessage("");
    const result = onExportData();
    if (!result.ok) {
      setError(result.error);
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    downloadJson(result.value, `${APP_CONFIG.appId}-backup-${date}.json`);
    setMessage("待办数据已导出。请妥善保存下载的备份文件。");
  };

  const handleExportLatestBackup = () => {
    setError("");
    setMessage("");
    const result = onExportLatestBackup();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const date = new Date().toISOString().replace(/[:.]/gu, "-");
    downloadJson(
      result.value,
      `${APP_CONFIG.appId}-latest-local-backup-${date}.json`,
    );
    setMessage("最近一次覆盖前的本地备份已导出，可通过“导入 JSON”恢复。");
  };

  const handleImportFile = async (file: File) => {
    setError("");
    setMessage("");
    const confirmed = window.confirm(
      "导入会覆盖当前待办列表，并在覆盖前创建浏览器内备份。确认继续吗？",
    );
    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const raw = await file.text();
      const result = onImportData(raw);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("待办数据导入成功。");
    } catch {
      setError("文件读取失败，请重新选择 JSON 备份。");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReset = () => {
    setError("");
    setMessage("");
    const confirmed = window.confirm(
      "确认清空全部本地待办吗？清空前会保留最近一次浏览器内备份。",
    );
    if (!confirmed) return;

    const result = onResetData();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("本地待办数据已清空。");
  };

  const pwaStatus = window.matchMedia("(display-mode: standalone)").matches
    ? "已以独立应用模式运行"
    : "serviceWorker" in navigator
      ? "浏览器模式（可通过浏览器菜单安装）"
      : "当前浏览器不支持 PWA";

  const capacityText =
    storageSize.level === "critical"
      ? "已接近 LocalStorage 的常见容量上限，请立即导出并考虑迁移到 IndexedDB。"
      : storageSize.level === "warning"
        ? "数据已超过 2 MB，建议定期导出备份。"
        : "容量正常。";

  return (
    <section className="settings-page">
      <header className="settings-header">
        <div>
          <p className="eyebrow">TODO SEED SETTINGS</p>
          <h1 className="page-title">设置与本地数据</h1>
        </div>
        <button
          className="secondary-btn"
          type="button"
          onClick={() => navigate("/")}
        >
          返回待办
        </button>
      </header>

      <div className="settings-section">
        <h2 className="settings-section-title">DeepSeek BYOK</h2>
        <p className="settings-note">
          配置后可在首页把一项任务拆成 2–6 个子任务。Key 默认只保存在
          sessionStorage；只有主动勾选后才写入 localStorage。Key
          不进入待办数据、云同步或 JSON 导出。
        </p>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="deepseek-key">DeepSeek API Key</label>
            <input
              id="deepseek-key"
              type="password"
              autoComplete="off"
              value={deepSeekKey}
              onChange={(event) => setDeepSeekKey(event.target.value)}
              placeholder={
                deepSeek.hasKey ? "已配置；输入新 Key 可替换" : "sk-…"
              }
            />
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={rememberDeepSeekKey}
              onChange={(event) => setRememberDeepSeekKey(event.target.checked)}
            />
            在此浏览器中记住 Key
          </label>
          <div className="form-actions">
            {deepSeek.hasKey ? (
              <button
                className="danger-btn"
                type="button"
                onClick={() => {
                  deepSeek.clearKey();
                  setMessage("DeepSeek API Key 已清除。");
                }}
              >
                清除 Key
              </button>
            ) : null}
            <button
              className="primary-btn"
              type="button"
              disabled={!deepSeekKey.trim()}
              onClick={handleSaveDeepSeekKey}
            >
              保存 Key
            </button>
          </div>
        </div>
        {deepSeek.error ? <p className="form-error">{deepSeek.error}</p> : null}
      </div>

      <CloudSyncSettings controller={cloudSync} envelope={envelope} />

      <div className="settings-section">
        <h2 className="settings-section-title">本地数据</h2>
        <dl className="metadata-grid">
          <div>
            <dt>应用 ID</dt>
            <dd>{APP_CONFIG.appId}</dd>
          </div>
          <div>
            <dt>Schema 版本</dt>
            <dd>{envelope?.schemaVersion ?? "无法读取"}</dd>
          </div>
          <div>
            <dt>数据版本</dt>
            <dd>{envelope?.dataVersion ?? "无法读取"}</dd>
          </div>
          <div>
            <dt>同步状态</dt>
            <dd>
              {envelope
                ? envelope.sync.dirty
                  ? "有未同步修改"
                  : "本地已保存"
                : "无法读取"}
            </dd>
          </div>
          <div>
            <dt>本地容量</dt>
            <dd>{storageSize.formatted}</dd>
          </div>
          <div>
            <dt>PWA</dt>
            <dd>{pwaStatus}</dd>
          </div>
        </dl>
        <p className={`capacity-hint capacity-${storageSize.level}`}>
          {capacityText}
        </p>
        <div className="data-actions">
          <button
            className="secondary-btn"
            type="button"
            onClick={handleExport}
          >
            导出 JSON 备份
          </button>
          <button
            className="secondary-btn"
            type="button"
            onClick={handleExportLatestBackup}
          >
            下载最近本地备份
          </button>
          <label className="secondary-btn file-btn">
            导入 JSON
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportFile(file);
              }}
            />
          </label>
          <button className="danger-btn" type="button" onClick={handleReset}>
            清空本地数据
          </button>
        </div>
      </div>

      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="form-success" role="status">
          {message}
        </div>
      ) : null}
    </section>
  );
};

export default Settings;
