import { useCallback, useEffect, useRef, useState } from "react";
import { APP_CONFIG } from "../../../config/app-config";
import { isCloudSyncConfigured } from "../../../config/env";
import { toAppError } from "../../../lib/errors/app-error";
import type { LocalDataRepository } from "../../../lib/local-data/local-data-repository";
import { shouldAutoSync } from "../../../lib/sync/auto-sync";
import { BrowserSyncPreferencesStore } from "../../../lib/sync/sync-preferences";
import { SyncManager } from "../../../lib/sync/sync-manager";
import type {
  ConflictExports,
  SyncConflict,
  SyncResult,
} from "../../../lib/sync/types";
import { WorkerSyncProvider } from "../../../lib/sync/worker-sync-provider";
import type { TripPayload } from "../types/trips";

export type CloudSyncStatus =
  | "disabled"
  | "config-required"
  | "signed-out"
  | "checking"
  | "idle"
  | "syncing"
  | "synced"
  | "conflict"
  | "offline"
  | "error";

interface UseCloudSyncOptions {
  repository: LocalDataRepository<TripPayload>;
  localDataVersion: number | null;
  localDirty: boolean;
  onLocalChange: () => void | Promise<void>;
}

const initialStatus = (): CloudSyncStatus => {
  if (!APP_CONFIG.cloudSyncEnabled) return "disabled";
  if (!isCloudSyncConfigured) return "config-required";
  return "checking";
};

export const useCloudSync = ({
  repository,
  localDataVersion,
  localDirty,
  onLocalChange,
}: UseCloudSyncOptions) => {
  const preferencesRef = useRef<BrowserSyncPreferencesStore | null>(null);
  preferencesRef.current ??= new BrowserSyncPreferencesStore(APP_CONFIG.appId);
  const providerRef = useRef<WorkerSyncProvider<TripPayload> | null>(null);
  const managerRef = useRef<SyncManager<TripPayload> | null>(null);
  const operationRef = useRef<Promise<SyncResult<TripPayload> | null> | null>(
    null,
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [status, setStatus] = useState<CloudSyncStatus>(initialStatus);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<SyncConflict<TripPayload> | null>(
    null,
  );
  const [autoSync, setAutoSyncState] = useState(() => {
    try {
      return preferencesRef.current?.load().autoSync ?? false;
    } catch {
      return false;
    }
  });

  const getProvider = useCallback(() => {
    providerRef.current ??= new WorkerSyncProvider<TripPayload>({
      appId: APP_CONFIG.appId,
      apiBaseUrl: APP_CONFIG.syncApiBaseUrl,
    });
    return providerRef.current;
  }, []);

  const getManager = useCallback(() => {
    managerRef.current ??= new SyncManager({
      repository,
      provider: getProvider(),
      isPayloadEmpty: (payload: TripPayload) => payload.trips.length === 0,
    });
    return managerRef.current;
  }, [getProvider, repository]);

  const applyResult = useCallback(
    async (result: SyncResult<TripPayload>, successMessage: string) => {
      if (result.status === "conflict") {
        setConflict(result.conflict);
        setStatus("conflict");
        setMessage("");
        setError("检测到另一台设备的数据变化，请选择处理方式。");
      } else {
        setConflict(null);
        setStatus("synced");
        setMessage(successMessage);
        setError("");
        await onLocalChange();
      }
      return result;
    },
    [onLocalChange],
  );

  const execute = useCallback(
    async (
      action: (
        manager: SyncManager<TripPayload>,
      ) => SyncResult<TripPayload> | Promise<SyncResult<TripPayload>>,
      pendingStatus: "checking" | "syncing",
      successMessage: string,
    ) => {
      if (operationRef.current) return operationRef.current;
      if (!authenticated) {
        setStatus("signed-out");
        setError("请先完成 Cloudflare Access 登录。");
        return null;
      }
      if (!navigator.onLine) {
        setStatus("offline");
        setError("当前离线，本地编辑仍可继续；联网后再同步。");
        return null;
      }
      const operation = (async () => {
        setStatus(pendingStatus);
        setMessage("");
        setError("");
        try {
          return await applyResult(await action(getManager()), successMessage);
        } catch (caught) {
          const appError = toAppError(caught, "云同步失败，请稍后重试。");
          if (appError.code === "AUTH_REQUIRED") {
            setAuthenticated(false);
            setStatus("signed-out");
          } else {
            setStatus(appError.code === "OFFLINE" ? "offline" : "error");
          }
          setError(appError.message);
          return null;
        }
      })();
      operationRef.current = operation;
      try {
        return await operation;
      } finally {
        if (operationRef.current === operation) operationRef.current = null;
      }
    },
    [applyResult, authenticated, getManager],
  );

  const checkSession = useCallback(async () => {
    if (!APP_CONFIG.cloudSyncEnabled || !isCloudSyncConfigured) return false;
    setStatus("checking");
    setError("");
    try {
      const current = await getProvider().getCurrentUser();
      const membership = current.apps.some(
        (membershipItem) => membershipItem.id === APP_CONFIG.appId,
      );
      if (!membership) {
        setAuthenticated(false);
        setStatus("error");
        setError("当前 Access 账号没有 Atlas 的访问权限。");
        return false;
      }
      setAuthenticated(true);
      setUserEmail(current.user.email);
      setStatus("idle");
      setMessage("Cloudflare Access 身份已确认。");
      return true;
    } catch (caught) {
      const appError = toAppError(caught, "Access 会话检查失败。");
      setAuthenticated(false);
      setStatus(
        appError.code === "AUTH_REQUIRED" ? "signed-out" : "signed-out",
      );
      setError(
        appError.code === "AUTH_REQUIRED"
          ? "尚未登录 Cloudflare Access。"
          : appError.message,
      );
      return false;
    }
  }, [getProvider]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const syncNow = useCallback(
    () => execute((manager) => manager.sync(), "syncing", "本地与云端已同步。"),
    [execute],
  );

  useEffect(() => {
    if (
      !shouldAutoSync({
        enabled: autoSync,
        authenticated,
        online: navigator.onLine,
        dirty: localDirty,
        hasConflict: Boolean(conflict),
      })
    )
      return;
    const timeout = window.setTimeout(() => void syncNow(), 3_000);
    return () => window.clearTimeout(timeout);
  }, [
    authenticated,
    autoSync,
    conflict,
    localDataVersion,
    localDirty,
    syncNow,
  ]);

  useEffect(() => {
    const handleOnline = () => {
      if (autoSync && authenticated && !conflict) void syncNow();
      else if (authenticated) {
        setStatus("idle");
        setMessage("网络已恢复，可以手动同步。");
        setError("");
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [authenticated, autoSync, conflict, syncNow]);

  const signIn = useCallback(() => {
    window.open(getProvider().loginUrl, "_blank", "noopener,noreferrer");
    setStatus("signed-out");
    setMessage("已打开 Access 登录页；完成后返回并点击“检查登录状态”。");
    setError("");
  }, [getProvider]);

  const signOut = useCallback(() => {
    window.open(
      `${APP_CONFIG.syncApiBaseUrl}/cdn-cgi/access/logout`,
      "_blank",
      "noopener,noreferrer",
    );
    setAuthenticated(false);
    setUserEmail("");
    managerRef.current = null;
    setStatus("signed-out");
    setMessage("已打开 Access 退出页，本地数据不受影响。");
    setError("");
  }, []);

  const restoreRemote = useCallback(
    () =>
      execute(
        (manager) => manager.restoreRemote(),
        "syncing",
        "已从云端恢复，并保留覆盖前的本地备份。",
      ),
    [execute],
  );
  const submitLocalVersion = useCallback(
    () =>
      execute(
        (manager) => manager.submitLocalVersion(),
        "syncing",
        "本地数据已提交为新的云端版本。",
      ),
    [execute],
  );
  const resolveWithLocal = useCallback(
    () =>
      execute(
        (manager) => manager.resolveWithLocal(),
        "syncing",
        "已保留本地数据并提交新的云端版本。",
      ),
    [execute],
  );
  const resolveWithRemote = useCallback(
    () =>
      execute(
        (manager) => manager.resolveWithRemote(),
        "syncing",
        "已使用云端数据，并保留覆盖前的本地备份。",
      ),
    [execute],
  );

  const exportConflict =
    useCallback(async (): Promise<ConflictExports | null> => {
      try {
        return (await managerRef.current?.exportConflict()) ?? null;
      } catch (caught) {
        setError(toAppError(caught, "冲突数据导出失败。").message);
        return null;
      }
    }, []);

  const cancelConflict = useCallback(() => {
    managerRef.current?.cancelConflict();
    setStatus("conflict");
    setMessage("已取消选择，冲突仍保留，期间不会自动同步。");
  }, []);

  const setAutoSync = useCallback((enabled: boolean) => {
    try {
      preferencesRef.current?.save({ autoSync: enabled });
      setAutoSyncState(enabled);
      setMessage(enabled ? "自动同步已开启。" : "自动同步已关闭。");
      setError("");
    } catch (caught) {
      setError(toAppError(caught, "自动同步设置保存失败。").message);
    }
  }, []);

  return {
    enabled: APP_CONFIG.cloudSyncEnabled,
    configured: isCloudSyncConfigured,
    authenticated,
    userEmail,
    status,
    message,
    error,
    conflict,
    autoSync,
    signIn,
    signOut,
    checkSession,
    syncNow,
    restoreRemote,
    submitLocalVersion,
    resolveWithLocal,
    resolveWithRemote,
    exportConflict,
    cancelConflict,
    setAutoSync,
  };
};

export type CloudSyncController = ReturnType<typeof useCloudSync>;
