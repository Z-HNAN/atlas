import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { APP_CONFIG } from "../../../config/app-config";
import { isSupabaseConfigured } from "../../../config/env";
import { toAppError } from "../../../lib/errors/app-error";
import type { LocalDataRepository } from "../../../lib/local-data/local-data-repository";
import {
  SupabaseCloudAuthGateway,
  type CloudAuthGateway,
} from "../../../lib/supabase/auth";
import { getSupabaseClient } from "../../../lib/supabase/client";
import { shouldAutoSync } from "../../../lib/sync/auto-sync";
import { BrowserSyncPreferencesStore } from "../../../lib/sync/sync-preferences";
import { SyncManager } from "../../../lib/sync/sync-manager";
import {
  SupabaseSnapshotGateway,
  SupabaseSyncProvider,
} from "../../../lib/sync/supabase-sync-provider";
import type {
  ConflictExports,
  SyncConflict,
  SyncResult,
} from "../../../lib/sync/types";
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
  onLocalChange: () => void;
}

const initialStatus = (): CloudSyncStatus => {
  if (!APP_CONFIG.cloudSyncEnabled) return "disabled";
  if (!isSupabaseConfigured) return "config-required";
  return "signed-out";
};

export const useCloudSync = ({
  repository,
  localDataVersion,
  localDirty,
  onLocalChange,
}: UseCloudSyncOptions) => {
  const preferencesRef = useRef<BrowserSyncPreferencesStore | null>(null);
  preferencesRef.current ??= new BrowserSyncPreferencesStore(APP_CONFIG.appId);
  const managerRef = useRef<SyncManager<TripPayload> | null>(null);
  const authGatewayRef = useRef<CloudAuthGateway | null>(null);
  const operationRef = useRef<Promise<SyncResult<TripPayload> | null> | null>(
    null,
  );
  const sessionUserIdRef = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
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
  const sessionUserId = session?.user.id ?? null;

  const getAuthGateway = useCallback(async () => {
    if (authGatewayRef.current) return authGatewayRef.current;
    const client = await getSupabaseClient();
    const gateway = SupabaseCloudAuthGateway.fromClient(client);
    authGatewayRef.current = gateway;
    return gateway;
  }, []);

  const applyResult = useCallback(
    (result: SyncResult<TripPayload>, successMessage: string) => {
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
        onLocalChange();
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
      const manager = managerRef.current;
      if (!manager) return null;
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
          return applyResult(await action(manager), successMessage);
        } catch (caught) {
          const appError = toAppError(caught, "云同步失败，请稍后重试。");
          setStatus(appError.code === "OFFLINE" ? "offline" : "error");
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
    [applyResult],
  );

  useEffect(() => {
    if (!APP_CONFIG.cloudSyncEnabled || !isSupabaseConfigured) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void getAuthGateway()
      .then(async (auth) => {
        const initialSession = await auth.getSession();
        if (!active) return;
        sessionUserIdRef.current = initialSession?.user.id ?? null;
        setSession(initialSession);
        setStatus(initialSession ? "idle" : "signed-out");
        unsubscribe = auth.subscribe((next) => {
          if (!active) return;
          const nextUserId = next?.user.id ?? null;
          const userChanged = sessionUserIdRef.current !== nextUserId;
          sessionUserIdRef.current = nextUserId;
          setSession(next);
          if (userChanged) {
            setStatus(next ? "idle" : "signed-out");
            setConflict(null);
            setError("");
            setMessage("");
          }
        });
      })
      .catch((caught) => {
        if (!active) return;
        setStatus("error");
        setError(toAppError(caught, "Supabase 初始化失败。").message);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [getAuthGateway]);

  useEffect(() => {
    if (!sessionUserId) {
      managerRef.current = null;
      return;
    }
    let active = true;
    void getSupabaseClient()
      .then((client) => {
        if (!active) return;
        const provider = new SupabaseSyncProvider<TripPayload>({
          userId: sessionUserId,
          appId: APP_CONFIG.appId,
          gateway: new SupabaseSnapshotGateway(client),
        });
        managerRef.current = new SyncManager({
          repository,
          provider,
          isPayloadEmpty: (payload) => payload.trips.length === 0,
        });
        void execute(
          (manager) => manager.sync(),
          "checking",
          "云端版本检查完成。",
        );
      })
      .catch((caught) => {
        if (!active) return;
        setStatus("error");
        setError(toAppError(caught, "同步模块初始化失败。").message);
      });
    return () => {
      active = false;
      managerRef.current = null;
    };
  }, [execute, repository, sessionUserId]);

  const syncNow = useCallback(
    () => execute((manager) => manager.sync(), "syncing", "本地与云端已同步。"),
    [execute],
  );

  useEffect(() => {
    if (
      !shouldAutoSync({
        enabled: autoSync,
        authenticated: Boolean(session),
        online: navigator.onLine,
        dirty: localDirty,
        hasConflict: Boolean(conflict),
      })
    )
      return;
    const timeout = window.setTimeout(() => void syncNow(), 3_000);
    return () => window.clearTimeout(timeout);
  }, [autoSync, conflict, localDataVersion, localDirty, session, syncNow]);

  const signIn = useCallback(
    async (email: string) => {
      setStatus("checking");
      try {
        const auth = await getAuthGateway();
        await auth.sendMagicLink(
          email,
          new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
        );
        setStatus("signed-out");
        setMessage("登录链接已发送，请在当前设备打开邮件中的链接。");
        setError("");
        return true;
      } catch (caught) {
        setStatus("error");
        setError(toAppError(caught, "登录邮件发送失败。").message);
        return false;
      }
    },
    [getAuthGateway],
  );

  const signOut = useCallback(async () => {
    setStatus("checking");
    try {
      const auth = await getAuthGateway();
      await auth.signOut();
      managerRef.current = null;
      setSession(null);
      setStatus("signed-out");
      setMessage("已退出云同步，本地数据不受影响。");
      setError("");
    } catch (caught) {
      setStatus("error");
      setError(toAppError(caught, "退出登录失败。").message);
    }
  }, [getAuthGateway]);

  const restoreRemote = useCallback(
    () =>
      execute(
        (manager) => manager.restoreRemote(),
        "syncing",
        "已从云端恢复，并保留覆盖前的本地备份。",
      ),
    [execute],
  );
  const overwriteRemote = useCallback(
    () =>
      execute(
        (manager) => manager.overwriteRemote(),
        "syncing",
        "本地数据已覆盖云端快照。",
      ),
    [execute],
  );
  const deleteRemote = useCallback(
    () =>
      execute(
        (manager) => manager.deleteRemote(),
        "syncing",
        "云端快照已删除，本地数据保留。",
      ),
    [execute],
  );
  const resolveWithLocal = useCallback(
    () =>
      execute(
        (manager) => manager.resolveWithLocal(),
        "syncing",
        "已保留本地数据并覆盖云端。",
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
  const exportConflict = useCallback((): ConflictExports | null => {
    try {
      return managerRef.current?.exportConflict() ?? null;
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
    configured: isSupabaseConfigured,
    authenticated: Boolean(session),
    userEmail: session?.user.email ?? "",
    status,
    message,
    error,
    conflict,
    autoSync,
    signIn,
    signOut,
    syncNow,
    restoreRemote,
    overwriteRemote,
    deleteRemote,
    resolveWithLocal,
    resolveWithRemote,
    exportConflict,
    cancelConflict,
    setAutoSync,
  };
};

export type CloudSyncController = ReturnType<typeof useCloudSync>;
