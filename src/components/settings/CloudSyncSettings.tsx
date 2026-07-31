import { APP_CONFIG } from "../../config/app-config";
import type { CloudSyncController } from "../../features/trips/hooks/useCloudSync";
import type { TripPayload } from "../../features/trips/types/trips";
import { downloadJson } from "../../lib/local-data/download";
import type { LocalAppEnvelope } from "../../lib/local-data/envelope";

interface CloudSyncSettingsProps {
  controller: CloudSyncController;
  envelope: LocalAppEnvelope<TripPayload> | null;
}

const statusText: Record<CloudSyncController["status"], string> = {
  disabled: "未启用",
  "config-required": "等待配置",
  "signed-out": "未登录",
  checking: "正在检查 Access 身份",
  idle: "可以同步",
  syncing: "正在同步",
  synced: "同步完成",
  conflict: "需要处理冲突",
  offline: "等待网络",
  error: "同步失败",
};

const CloudSyncSettings = ({
  controller,
  envelope,
}: CloudSyncSettingsProps) => {
  const busy = ["checking", "syncing"].includes(controller.status);

  if (!controller.enabled) {
    return (
      <div className="settings-section">
        <h2 className="settings-section-title">可选云同步</h2>
        <p className="settings-note">
          当前为纯本地模式，功能完整可用。需要跨设备备份时，将
          <code> VITE_ENABLE_CLOUD_SYNC </code>设为 true，并配置同步 Worker
          地址。
        </p>
      </div>
    );
  }

  if (!controller.configured) {
    return (
      <div className="settings-section">
        <h2 className="settings-section-title">可选云同步</h2>
        <div className="form-error" role="alert">
          已启用云同步，但缺少 VITE_SYNC_API_BASE_URL。请参考 START.md 配置。
        </div>
      </div>
    );
  }

  const handleConflictExport = async () => {
    const exported = await controller.exportConflict();
    if (!exported) return;
    const date = new Date().toISOString().replace(/[:.]/gu, "-");
    downloadJson(
      exported.localJson,
      `${APP_CONFIG.appId}-conflict-local-${date}.json`,
    );
    downloadJson(
      exported.remoteJson,
      `${APP_CONFIG.appId}-conflict-cloud-${date}.json`,
    );
  };

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">可选云同步</h2>
      {!controller.authenticated ? (
        <div className="form-grid">
          <p className="settings-note">
            云端使用 Cloudflare Access 固定团队登录。未登录时应用继续只保存到
            IndexedDB。
          </p>
          <div className="form-actions">
            <button
              className="primary-btn"
              type="button"
              disabled={busy}
              onClick={controller.signIn}
            >
              打开 Access 登录
            </button>
            <button
              className="secondary-btn"
              type="button"
              disabled={busy}
              onClick={() => void controller.checkSession()}
            >
              {busy ? "正在检查…" : "检查登录状态"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <dl className="metadata-grid">
            <div>
              <dt>账号</dt>
              <dd>{controller.userEmail}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>{statusText[controller.status]}</dd>
            </div>
            <div>
              <dt>云端版本</dt>
              <dd>{envelope?.sync.lastCloudVersion ?? "尚无"}</dd>
            </div>
            <div>
              <dt>最后同步</dt>
              <dd>{envelope?.sync.lastSyncAt ?? "尚未同步"}</dd>
            </div>
          </dl>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={controller.autoSync}
              onChange={(event) => controller.setAutoSync(event.target.checked)}
            />
            本地修改后自动同步（3 秒防抖）
          </label>

          {controller.conflict ? (
            <div className="conflict-panel" role="alert">
              <strong>检测到另一台设备的数据变化</strong>
              <p>
                本地数据版本 {controller.conflict.localDataVersion}
                ，云端提交版本 {controller.conflict.remote.version}
                。系统不会自动合并或覆盖。
              </p>
              <div className="data-actions">
                <button
                  className="danger-btn"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "确认保留本地并提交新的云端版本吗？旧版本仍按保留策略保存。",
                      )
                    ) {
                      void controller.resolveWithLocal();
                    }
                  }}
                >
                  保留本地并提交
                </button>
                <button
                  className="danger-btn"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("确认使用云端并覆盖本地吗？")) {
                      void controller.resolveWithRemote();
                    }
                  }}
                >
                  使用云端覆盖本地
                </button>
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => void handleConflictExport()}
                >
                  分别导出两份数据
                </button>
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={controller.cancelConflict}
                >
                  取消（保留冲突）
                </button>
              </div>
            </div>
          ) : (
            <div className="data-actions cloud-actions">
              <button
                className="primary-btn"
                type="button"
                disabled={busy}
                onClick={() => void controller.syncNow()}
              >
                立即同步
              </button>
              <button
                className="secondary-btn"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("确认用云端快照覆盖本地数据吗？")) {
                    void controller.restoreRemote();
                  }
                }}
              >
                从云端恢复
              </button>
              <button
                className="secondary-btn"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm("确认将当前本地数据提交为新的云端版本吗？")
                  ) {
                    void controller.submitLocalVersion();
                  }
                }}
              >
                提交本地新版本
              </button>
            </div>
          )}
          <div className="form-actions compact-actions">
            <button
              className="secondary-btn"
              type="button"
              disabled={busy}
              onClick={controller.signOut}
            >
              退出 Access
            </button>
          </div>
        </>
      )}
      {controller.error ? (
        <div className="form-error" role="alert">
          {controller.error}
        </div>
      ) : null}
      {controller.message ? (
        <div className="form-success" role="status">
          {controller.message}
        </div>
      ) : null}
    </div>
  );
};

export default CloudSyncSettings;
