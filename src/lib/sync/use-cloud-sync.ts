import { useCallback, useEffect, useRef, useState } from "react";
import { APP_CONFIG } from "../../config/app-config";
import { isCloudSyncConfigured } from "../../config/env";
import { toAppError } from "../errors/app-error";
import type { LocalDataRepository } from "../local-data/local-data-repository";
import { SyncManager } from "./sync-manager";
import type {
  CloudHeadMetadata,
  ConflictExports,
  SyncConflict,
  SyncResult,
} from "./types";
import { WorkerSyncProvider } from "./worker-sync-provider";

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

interface UseCloudSyncOptions<TPayload> {
  repository: LocalDataRepository<TPayload>;
  isPayloadEmpty: (payload: TPayload) => boolean;
  onLocalChange: () => void | Promise<void>;
}

type CloudHeadSummary = Pick<CloudHeadMetadata, "version" | "createdAt">;

export const getInitialCloudSyncStatus = (
  cloudSyncEnabled: boolean,
  configured: boolean,
): CloudSyncStatus => {
  if (!cloudSyncEnabled) return "disabled";
  if (!configured) return "config-required";
  return "signed-out";
};

export const useCloudSync = <TPayload>({
  repository,
  isPayloadEmpty,
  onLocalChange,
}: UseCloudSyncOptions<TPayload>) => {
  const providerRef = useRef<WorkerSyncProvider<TPayload> | null>(null);
  const managerRef = useRef<SyncManager<TPayload> | null>(null);
  const operationRef = useRef<Promise<SyncResult<TPayload> | null> | null>(
    null,
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [status, setStatus] = useState<CloudSyncStatus>(() =>
    getInitialCloudSyncStatus(
      APP_CONFIG.cloudSyncEnabled,
      isCloudSyncConfigured,
    ),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<SyncConflict<TPayload> | null>(null);
  const [cloudHead, setCloudHead] = useState<CloudHeadSummary | null>(null);
  const [cloudHeadChecked, setCloudHeadChecked] = useState(false);

  const getProvider = useCallback(() => {
    providerRef.current ??= new WorkerSyncProvider<TPayload>({
      appId: APP_CONFIG.appId,
      apiBaseUrl: APP_CONFIG.syncApiBaseUrl,
    });
    return providerRef.current;
  }, []);

  const getManager = useCallback(() => {
    managerRef.current ??= new SyncManager({
      repository,
      provider: getProvider(),
      isPayloadEmpty,
    });
    return managerRef.current;
  }, [getProvider, isPayloadEmpty, repository]);

  const loadCloudHead = useCallback(async () => {
    const head = await getProvider().getHead();
    setCloudHead(head);
    setCloudHeadChecked(true);
    return head;
  }, [getProvider]);

  const applyResult = useCallback(
    async (result: SyncResult<TPayload>, successMessage: string) => {
      if (result.status === "conflict") {
        setCloudHead({
          version: result.conflict.remote.version,
          createdAt: result.conflict.remote.createdAt,
        });
        setCloudHeadChecked(true);
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
        try {
          await loadCloudHead();
        } catch (caught) {
          const appError = toAppError(caught, "云端信息刷新失败。");
          setCloudHeadChecked(false);
          if (appError.code === "AUTH_REQUIRED") {
            setAuthenticated(false);
            setUserEmail("");
            setCloudHead(null);
            setStatus("signed-out");
          }
          setError(`同步操作已完成，但${appError.message}`);
        }
      }
      return result;
    },
    [loadCloudHead, onLocalChange],
  );

  const execute = useCallback(
    async (
      action: (
        manager: SyncManager<TPayload>,
      ) => SyncResult<TPayload> | Promise<SyncResult<TPayload>>,
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
            setUserEmail("");
            setCloudHead(null);
            setCloudHeadChecked(false);
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
    setMessage("");
    setCloudHeadChecked(false);
    let current: Awaited<
      ReturnType<WorkerSyncProvider<TPayload>["getCurrentUser"]>
    >;
    try {
      current = await getProvider().getCurrentUser();
    } catch (caught) {
      const appError = toAppError(caught, "Access 会话检查失败。");
      setAuthenticated(false);
      setUserEmail("");
      setCloudHead(null);
      setStatus(appError.code === "OFFLINE" ? "offline" : "signed-out");
      setError(
        appError.code === "AUTH_REQUIRED"
          ? "尚未登录 Cloudflare Access。"
          : appError.message,
      );
      return false;
    }

    const appAvailable = current.apps.some(
      (appItem) => appItem.id === APP_CONFIG.appId,
    );
    if (!appAvailable) {
      setAuthenticated(false);
      setUserEmail("");
      setCloudHead(null);
      setCloudHeadChecked(false);
      setStatus("error");
      setError(`同步服务没有返回当前 App：${APP_CONFIG.appId}。`);
      return false;
    }
    setAuthenticated(true);
    setUserEmail(current.user.email);
    try {
      await loadCloudHead();
      setStatus("idle");
      setMessage("Cloudflare Access 身份和云端信息已确认。");
      return true;
    } catch (caught) {
      const appError = toAppError(caught, "云端信息查询失败。");
      if (appError.code === "AUTH_REQUIRED") {
        setAuthenticated(false);
        setUserEmail("");
        setCloudHead(null);
        setStatus("signed-out");
        setError("Access 会话已失效，请重新登录。");
        return false;
      }
      setStatus(appError.code === "OFFLINE" ? "offline" : "error");
      setError(`身份已确认，但${appError.message}`);
      return true;
    }
  }, [getProvider, loadCloudHead]);

  const refreshCloudHead = useCallback(async () => {
    if (!authenticated) {
      setStatus("signed-out");
      setError("请先完成 Cloudflare Access 登录。");
      return false;
    }
    if (!navigator.onLine) {
      setStatus("offline");
      setError("当前离线，无法刷新云端信息。");
      return false;
    }
    setStatus("checking");
    setMessage("");
    setError("");
    setCloudHeadChecked(false);
    try {
      await loadCloudHead();
      setStatus("idle");
      setMessage("云端信息已刷新。");
      return true;
    } catch (caught) {
      const appError = toAppError(caught, "云端信息刷新失败。");
      if (appError.code === "AUTH_REQUIRED") {
        setAuthenticated(false);
        setUserEmail("");
        setCloudHead(null);
        setStatus("signed-out");
      } else {
        setStatus(appError.code === "OFFLINE" ? "offline" : "error");
      }
      setError(appError.message);
      return false;
    }
  }, [authenticated, loadCloudHead]);

  const syncNow = useCallback(
    () => execute((manager) => manager.sync(), "syncing", "本地与云端已同步。"),
    [execute],
  );

  useEffect(() => {
    const handleOnline = () => {
      if (authenticated) {
        setStatus("idle");
        setMessage("网络已恢复，可以手动同步。");
        setError("");
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [authenticated]);

  const signIn = useCallback(() => {
    window.open(getProvider().loginUrl, "_blank", "noopener,noreferrer");
    setStatus("signed-out");
    setCloudHead(null);
    setCloudHeadChecked(false);
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
    setCloudHead(null);
    setCloudHeadChecked(false);
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
  const resolveWithLocal = useCallback(
    () =>
      execute(
        (manager) => manager.resolveWithLocal(),
        "syncing",
        "已保留本地数据并覆盖云端最新快照。",
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
    setMessage("已取消选择，冲突仍保留；再次同步时继续处理。");
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
    cloudHead,
    cloudHeadChecked,
    signIn,
    signOut,
    checkSession,
    refreshCloudHead,
    syncNow,
    restoreRemote,
    resolveWithLocal,
    resolveWithRemote,
    exportConflict,
    cancelConflict,
  };
};

export type CloudSyncController<TPayload> = ReturnType<
  typeof useCloudSync<TPayload>
>;
