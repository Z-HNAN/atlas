import { APP_CONFIG } from "../../config/app-config";
import { downloadJson } from "../../lib/local-data/download";
import type { LocalAppEnvelope } from "../../lib/local-data/envelope";
import type {
  CloudSyncController,
  CloudSyncStatus,
} from "../../lib/sync/use-cloud-sync";

interface CloudSyncSettingsProps<TPayload> {
  controller: CloudSyncController<TPayload>;
  envelope: LocalAppEnvelope<TPayload> | null;
}

const statusText: Record<CloudSyncStatus, string> = {
  disabled: "未启用",
  "config-required": "等待配置",
  "signed-out": "未登录",
  checking: "正在检查云端状态",
  idle: "可以同步",
  syncing: "正在同步",
  synced: "同步完成",
  conflict: "需要处理冲突",
  offline: "等待网络",
  error: "同步失败",
};

const cloudTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const CloudSyncSettings = <TPayload,>({
  controller,
}: CloudSyncSettingsProps<TPayload>) => {
  const busy = ["checking", "syncing"].includes(controller.status);

  if (!controller.enabled) {
    return (
      <div className="settings-section">
        <h2 className="settings-section-title">可选云同步</h2>
        <p className="settings-note">
          当前为纯本地模式，功能完整可用。需要跨设备备份时，将
          <code> VITE_ENABLE_CLOUD_SYNC </code>设为 true，并配置 Gipsy
          已部署的共享同步 API；Atlas 不需要另建 Worker。
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
            云端使用 Cloudflare Access 登录。未登录时应用继续只保存到
            IndexedDB。登录完成后请返回本页并检查登录状态；隐私窗口或严格防跟踪
            可能拦截同步域名的跨域会话 Cookie，需要允许
            <code> sync.api.10242020.xyz </code>及 Access 团队域名的 Cookie。
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
              <dd>
                {controller.cloudHeadChecked
                  ? (controller.cloudHead?.version ?? "尚无云端备份")
                  : "尚未查询"}
              </dd>
            </div>
            <div>
              <dt>云端最后同步时间</dt>
              <dd>
                {controller.cloudHeadChecked
                  ? controller.cloudHead
                    ? cloudTimeFormatter.format(
                        new Date(controller.cloudHead.createdAt),
                      )
                    : "尚未同步"
                  : "尚未查询"}
              </dd>
            </div>
          </dl>

          <p className="settings-note">
            云端只保存当前账号的最新 Atlas 快照，不会随本地编辑自动上传。
            请在需要跨设备备份或恢复时手动同步；重要节点建议同时导出 JSON。
          </p>

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
                        "确认保留本地并覆盖云端最新快照吗？系统会先把当前云端数据保存为本地恢复备份。",
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
            </div>
          )}
          <div className="form-actions compact-actions">
            <button
              className="secondary-btn"
              type="button"
              disabled={busy}
              onClick={() => void controller.refreshCloudHead()}
            >
              {controller.status === "checking" ? "正在刷新…" : "刷新云端信息"}
            </button>
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
