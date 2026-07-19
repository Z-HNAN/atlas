import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "../errors/app-error";
import type { RemoteSnapshot, SyncProvider } from "./types";

const snapshotRowSchema = z
  .object({
    user_id: z.string().uuid(),
    app_id: z.string().min(1),
    schema_version: z.number().int().positive(),
    data_version: z.number().int().positive(),
    payload: z.unknown(),
    device_id: z.string().min(1).nullable(),
    updated_at: z.string().datetime(),
  })
  .strict();

export type SnapshotRow = z.infer<typeof snapshotRowSchema>;

interface GatewayResult<T> {
  data: T;
  error: unknown;
}

export interface SnapshotGateway {
  get(userId: string, appId: string): Promise<GatewayResult<unknown>>;
  insert(row: {
    user_id: string;
    app_id: string;
    schema_version: number;
    data_version: number;
    payload: unknown;
    device_id: string;
  }): Promise<GatewayResult<unknown>>;
  update(
    userId: string,
    appId: string,
    expectedVersion: number,
    patch: {
      schema_version: number;
      data_version: number;
      payload: unknown;
      device_id: string;
    },
  ): Promise<GatewayResult<unknown>>;
  remove(userId: string, appId: string): Promise<GatewayResult<null>>;
}

const SNAPSHOT_COLUMNS =
  "user_id,app_id,schema_version,data_version,payload,device_id,updated_at";

export class SupabaseSnapshotGateway implements SnapshotGateway {
  constructor(private readonly client: SupabaseClient) {}

  async get(userId: string, appId: string) {
    const result = await this.client
      .from("app_sync_snapshots")
      .select(SNAPSHOT_COLUMNS)
      .eq("user_id", userId)
      .eq("app_id", appId)
      .maybeSingle();
    return { data: result.data, error: result.error };
  }

  async insert(row: Parameters<SnapshotGateway["insert"]>[0]) {
    const result = await this.client
      .from("app_sync_snapshots")
      .insert(row)
      .select(SNAPSHOT_COLUMNS)
      .single();
    return { data: result.data, error: result.error };
  }

  async update(
    userId: string,
    appId: string,
    expectedVersion: number,
    patch: Parameters<SnapshotGateway["update"]>[3],
  ) {
    const result = await this.client
      .from("app_sync_snapshots")
      .update(patch)
      .eq("user_id", userId)
      .eq("app_id", appId)
      .eq("data_version", expectedVersion)
      .select(SNAPSHOT_COLUMNS)
      .maybeSingle();
    return { data: result.data, error: result.error };
  }

  async remove(userId: string, appId: string) {
    const result = await this.client
      .from("app_sync_snapshots")
      .delete()
      .eq("user_id", userId)
      .eq("app_id", appId);
    return { data: null, error: result.error };
  }
}

interface SupabaseSyncProviderOptions {
  userId: string;
  appId: string;
  gateway: SnapshotGateway;
}

const errorCode = (error: unknown) => {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
};

const toProviderError = (error: unknown, fallback: string) => {
  const code = errorCode(error);
  if (code === "42501") {
    return new AppError(
      "PERMISSION_DENIED",
      "云端拒绝了当前操作，请检查登录状态和 RLS 策略。",
      error,
    );
  }
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  return new AppError(
    online ? "NETWORK_ERROR" : "OFFLINE",
    online ? fallback : "当前离线，云同步将在恢复网络后可用。",
    error,
  );
};

export class SupabaseSyncProvider<TPayload> implements SyncProvider<TPayload> {
  constructor(private readonly options: SupabaseSyncProviderOptions) {}

  async pull(): Promise<RemoteSnapshot<unknown> | null> {
    const result = await this.options.gateway.get(
      this.options.userId,
      this.options.appId,
    );
    if (result.error) {
      throw toProviderError(result.error, "读取云端快照失败，请稍后重试。");
    }
    if (!result.data) return null;
    return this.toSnapshot(result.data);
  }

  async push(input: {
    payload: TPayload;
    schemaVersion: number;
    dataVersion: number;
    expectedRemoteVersion: number | null;
    deviceId: string;
  }): Promise<RemoteSnapshot<unknown>> {
    if (input.expectedRemoteVersion === null) {
      const result = await this.options.gateway.insert({
        user_id: this.options.userId,
        app_id: this.options.appId,
        schema_version: input.schemaVersion,
        data_version: input.dataVersion,
        payload: input.payload,
        device_id: input.deviceId,
      });
      if (result.error) {
        if (errorCode(result.error) === "23505") {
          throw new AppError(
            "REMOTE_VERSION_MISMATCH",
            "云端快照已由另一台设备创建。",
            result.error,
          );
        }
        throw toProviderError(result.error, "创建云端快照失败，请稍后重试。");
      }
      if (!result.data) {
        throw new AppError("INVALID_RESPONSE", "云端未返回新建的快照。");
      }
      return this.toSnapshot(result.data);
    }

    const result = await this.options.gateway.update(
      this.options.userId,
      this.options.appId,
      input.expectedRemoteVersion,
      {
        schema_version: input.schemaVersion,
        data_version: Math.max(
          input.dataVersion,
          input.expectedRemoteVersion + 1,
        ),
        payload: input.payload,
        device_id: input.deviceId,
      },
    );
    if (result.error) {
      throw toProviderError(result.error, "更新云端快照失败，请稍后重试。");
    }
    if (!result.data) {
      throw new AppError(
        "REMOTE_VERSION_MISMATCH",
        "云端快照已被另一台设备更新。",
      );
    }
    return this.toSnapshot(result.data);
  }

  async remove(): Promise<void> {
    const result = await this.options.gateway.remove(
      this.options.userId,
      this.options.appId,
    );
    if (result.error) {
      throw toProviderError(result.error, "删除云端快照失败，请稍后重试。");
    }
  }

  private toSnapshot(candidate: unknown): RemoteSnapshot<unknown> {
    const parsed = snapshotRowSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new AppError(
        "INVALID_RESPONSE",
        "云端快照返回结构不正确。",
        parsed.error,
      );
    }
    if (
      parsed.data.user_id !== this.options.userId ||
      parsed.data.app_id !== this.options.appId
    ) {
      throw new AppError(
        "PERMISSION_DENIED",
        "云端返回了不属于当前用户或应用的数据。",
      );
    }
    return {
      appId: parsed.data.app_id,
      schemaVersion: parsed.data.schema_version,
      dataVersion: parsed.data.data_version,
      payload: parsed.data.payload,
      deviceId: parsed.data.device_id,
      updatedAt: parsed.data.updated_at,
    };
  }
}
