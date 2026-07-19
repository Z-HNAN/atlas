import type { z } from "zod";
import { AppError, isQuotaExceededError } from "../errors/app-error";
import {
  envelopeBaseSchema,
  exportBaseSchema,
  type AppDataExport,
  type LocalAppEnvelope,
} from "./envelope";
import { migratePayload, type SchemaMigration } from "./schema-migrations";
import { getStorageSizeInfo, type StorageSizeInfo } from "./storage-size";
import { remoteSnapshotBaseSchema } from "../sync/schemas";
import type { RemoteSnapshot } from "../sync/types";

export interface LocalDataRepository<TPayload> {
  load(): LocalAppEnvelope<TPayload>;
  save(next: LocalAppEnvelope<TPayload>): void;
  update(updater: (current: TPayload) => TPayload): LocalAppEnvelope<TPayload>;
  reset(): LocalAppEnvelope<TPayload>;
  exportJson(): string;
  importJson(raw: string): LocalAppEnvelope<TPayload>;
  getStorageSize(): StorageSizeInfo;
  getLatestBackupJson(): string | null;
  exportLatestBackupJson(): string | null;
  getLatestRemoteBackupJson(): string | null;
  createBackup(): string | null;
  backupRemoteSnapshot(remote: RemoteSnapshot<unknown>): string;
  prepareRemoteSnapshot(
    remote: RemoteSnapshot<unknown>,
  ): RemoteSnapshot<TPayload>;
  applyRemoteSnapshot(
    remote: RemoteSnapshot<unknown>,
  ): LocalAppEnvelope<TPayload>;
  markSynced(remote: RemoteSnapshot<unknown>): LocalAppEnvelope<TPayload>;
  clearRemoteSyncState(): LocalAppEnvelope<TPayload>;
  exportSnapshotJson(remote: RemoteSnapshot<unknown>): string;
}

interface LegacyStorageOptions<TPayload> {
  key: string;
  parse: (raw: string) => TPayload;
}

export interface LocalRepositoryOptions<TPayload> {
  appId: string;
  schemaVersion: number;
  storageKey: string;
  payloadSchema: z.ZodType<TPayload>;
  createDefaultPayload: () => TPayload;
  migrations?: Readonly<Record<number, SchemaMigration>>;
  legacy?: LegacyStorageOptions<TPayload>;
  storage?: Storage;
  now?: () => Date;
  createId?: () => string;
}

const parseJson = (raw: string, message: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new AppError("DATA_VALIDATION_FAILED", message, error);
  }
};

const stringifyJson = (value: unknown, formatted = false) => {
  try {
    return JSON.stringify(value, null, formatted ? 2 : undefined);
  } catch (error) {
    throw new AppError(
      "DATA_VALIDATION_FAILED",
      "数据无法序列化为 JSON，请检查后重试。",
      error,
    );
  }
};

export class BrowserLocalDataRepository<TPayload>
  implements LocalDataRepository<TPayload>
{
  private readonly storage: Storage;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly migrations: Readonly<Record<number, SchemaMigration>>;

  constructor(private readonly options: LocalRepositoryOptions<TPayload>) {
    this.storage = options.storage ?? window.localStorage;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.migrations = options.migrations ?? {};
  }

  load(): LocalAppEnvelope<TPayload> {
    const raw = this.read(this.options.storageKey);

    if (!raw) {
      return this.initialize();
    }

    return this.parseStoredEnvelope(raw);
  }

  save(next: LocalAppEnvelope<TPayload>): void {
    const valid = this.validateCurrentEnvelope(next);
    this.write(this.options.storageKey, stringifyJson(valid));
  }

  update(updater: (current: TPayload) => TPayload): LocalAppEnvelope<TPayload> {
    const current = this.load();
    let candidate: TPayload;

    try {
      candidate = updater(current.payload);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "更新本地数据时失败。",
        error,
      );
    }

    const payload = this.validatePayload(candidate);
    const next: LocalAppEnvelope<TPayload> = {
      ...current,
      dataVersion: current.dataVersion + 1,
      updatedAt: this.now().toISOString(),
      payload,
      sync: {
        ...current.sync,
        dirty: true,
      },
    };

    this.save(next);
    return next;
  }

  reset(): LocalAppEnvelope<TPayload> {
    let current: LocalAppEnvelope<TPayload> | null = null;

    try {
      current = this.load();
    } catch {
      // 显式重置是用户从损坏数据恢复的路径，原始字符串会在下方先备份。
    }

    this.backupCurrent();

    const next: LocalAppEnvelope<TPayload> = {
      appId: this.options.appId,
      schemaVersion: this.options.schemaVersion,
      dataVersion: (current?.dataVersion ?? 0) + 1,
      updatedAt: this.now().toISOString(),
      deviceId: current?.deviceId ?? this.createId(),
      payload: this.validatePayload(this.options.createDefaultPayload()),
      sync: {
        dirty: true,
        lastRemoteVersion: current?.sync.lastRemoteVersion ?? null,
        lastSyncedAt: current?.sync.lastSyncedAt ?? null,
      },
    };

    this.save(next);
    return next;
  }

  exportJson(): string {
    const current = this.load();
    const exported: AppDataExport<TPayload> = {
      format: "personal-web-seed-export",
      appId: current.appId,
      schemaVersion: current.schemaVersion,
      dataVersion: current.dataVersion,
      exportedAt: this.now().toISOString(),
      payload: current.payload,
    };

    return stringifyJson(exported, true);
  }

  importJson(raw: string): LocalAppEnvelope<TPayload> {
    const parsed = exportBaseSchema.safeParse(
      parseJson(raw, "导入文件不是有效的 JSON。"),
    );

    if (!parsed.success) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "导入文件格式不正确。",
        parsed.error,
      );
    }

    if (parsed.data.appId !== this.options.appId) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        `该文件属于 ${parsed.data.appId}，不能导入到 ${this.options.appId}。`,
      );
    }

    const migratedPayload = migratePayload(
      parsed.data.payload,
      parsed.data.schemaVersion,
      this.options.schemaVersion,
      this.migrations,
    );
    const payload = this.validatePayload(migratedPayload);

    let current: LocalAppEnvelope<TPayload> | null = null;
    try {
      current = this.load();
    } catch {
      // 允许用户用有效导出文件恢复损坏的正式数据。
    }

    this.backupCurrent();

    const next: LocalAppEnvelope<TPayload> = {
      appId: this.options.appId,
      schemaVersion: this.options.schemaVersion,
      dataVersion:
        Math.max(current?.dataVersion ?? 0, parsed.data.dataVersion) + 1,
      updatedAt: this.now().toISOString(),
      deviceId: current?.deviceId ?? this.createId(),
      payload,
      sync: {
        dirty: true,
        lastRemoteVersion: current?.sync.lastRemoteVersion ?? null,
        lastSyncedAt: current?.sync.lastSyncedAt ?? null,
      },
    };

    this.save(next);
    return next;
  }

  getStorageSize(): StorageSizeInfo {
    return getStorageSizeInfo(this.read(this.options.storageKey));
  }

  getLatestBackupJson(): string | null {
    return this.read(this.backupKey);
  }

  exportLatestBackupJson(): string | null {
    const raw = this.getLatestBackupJson();
    if (!raw) return null;
    const parsed = envelopeBaseSchema.safeParse(
      parseJson(raw, "最近本地备份不是有效的 JSON。"),
    );
    if (!parsed.success || parsed.data.appId !== this.options.appId) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "最近本地备份结构不正确，无法下载。",
        parsed.success ? undefined : parsed.error,
      );
    }
    const exported: AppDataExport<unknown> = {
      format: "personal-web-seed-export",
      appId: parsed.data.appId,
      schemaVersion: parsed.data.schemaVersion,
      dataVersion: parsed.data.dataVersion,
      exportedAt: this.now().toISOString(),
      payload: parsed.data.payload,
    };
    return stringifyJson(exported, true);
  }

  getLatestRemoteBackupJson(): string | null {
    return this.read(this.remoteBackupKey);
  }

  createBackup(): string | null {
    const currentRaw = this.read(this.options.storageKey);
    if (!currentRaw) return null;
    this.write(this.backupKey, currentRaw);
    return currentRaw;
  }

  backupRemoteSnapshot(remote: RemoteSnapshot<unknown>): string {
    const exported = this.exportSnapshotJson(remote);
    this.write(this.remoteBackupKey, exported);
    return exported;
  }

  prepareRemoteSnapshot(
    remote: RemoteSnapshot<unknown>,
  ): RemoteSnapshot<TPayload> {
    const parsed = remoteSnapshotBaseSchema.safeParse(remote);
    if (!parsed.success) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "云端快照结构不正确。",
        parsed.error,
      );
    }
    if (parsed.data.appId !== this.options.appId) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        `云端快照属于 ${parsed.data.appId}，当前应用无法读取。`,
      );
    }

    const payload = this.validatePayload(
      migratePayload(
        parsed.data.payload,
        parsed.data.schemaVersion,
        this.options.schemaVersion,
        this.migrations,
      ),
    );

    return {
      ...parsed.data,
      schemaVersion: this.options.schemaVersion,
      payload,
    };
  }

  applyRemoteSnapshot(
    remote: RemoteSnapshot<unknown>,
  ): LocalAppEnvelope<TPayload> {
    const prepared = this.prepareRemoteSnapshot(remote);
    let current: LocalAppEnvelope<TPayload> | null = null;
    try {
      current = this.load();
    } catch {
      // 有效云端快照也是损坏本地数据的恢复路径。
    }

    this.createBackup();
    const next: LocalAppEnvelope<TPayload> = {
      appId: this.options.appId,
      schemaVersion: this.options.schemaVersion,
      dataVersion: Math.max(current?.dataVersion ?? 0, prepared.dataVersion),
      updatedAt: prepared.updatedAt,
      deviceId: current?.deviceId ?? this.createId(),
      payload: prepared.payload,
      sync: {
        dirty: false,
        lastRemoteVersion: prepared.dataVersion,
        lastSyncedAt: this.now().toISOString(),
      },
    };
    this.save(next);
    return next;
  }

  markSynced(remote: RemoteSnapshot<unknown>): LocalAppEnvelope<TPayload> {
    const prepared = this.prepareRemoteSnapshot(remote);
    const current = this.load();
    const next: LocalAppEnvelope<TPayload> = {
      ...current,
      dataVersion: Math.max(current.dataVersion, prepared.dataVersion),
      sync: {
        dirty: false,
        lastRemoteVersion: prepared.dataVersion,
        lastSyncedAt: this.now().toISOString(),
      },
    };
    this.save(next);
    return next;
  }

  clearRemoteSyncState(): LocalAppEnvelope<TPayload> {
    const current = this.load();
    const next: LocalAppEnvelope<TPayload> = {
      ...current,
      sync: {
        dirty: false,
        lastRemoteVersion: null,
        lastSyncedAt: this.now().toISOString(),
      },
    };
    this.save(next);
    return next;
  }

  exportSnapshotJson(remote: RemoteSnapshot<unknown>): string {
    const prepared = this.prepareRemoteSnapshot(remote);
    const exported: AppDataExport<TPayload> = {
      format: "personal-web-seed-export",
      appId: prepared.appId,
      schemaVersion: prepared.schemaVersion,
      dataVersion: prepared.dataVersion,
      exportedAt: this.now().toISOString(),
      payload: prepared.payload,
    };
    return stringifyJson(exported, true);
  }

  private initialize(): LocalAppEnvelope<TPayload> {
    const legacyRaw = this.options.legacy
      ? this.read(this.options.legacy.key)
      : null;

    if (legacyRaw && this.options.legacy) {
      const payload = this.validatePayload(
        this.options.legacy.parse(legacyRaw),
      );
      const migrated = this.createInitialEnvelope(payload, true);

      this.write(this.legacyBackupKey, legacyRaw);
      this.save(migrated);
      this.remove(this.options.legacy.key);
      return migrated;
    }

    const initial = this.createInitialEnvelope(
      this.validatePayload(this.options.createDefaultPayload()),
      false,
    );
    this.save(initial);
    return initial;
  }

  private parseStoredEnvelope(raw: string): LocalAppEnvelope<TPayload> {
    const parsed = envelopeBaseSchema.safeParse(
      parseJson(raw, "本地数据不是有效的 JSON。"),
    );

    if (!parsed.success) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "本地数据结构不正确，请从备份恢复或清空数据。",
        parsed.error,
      );
    }

    if (parsed.data.appId !== this.options.appId) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        `本地数据属于 ${parsed.data.appId}，当前应用无法读取。`,
      );
    }

    const requiresMigration =
      parsed.data.schemaVersion !== this.options.schemaVersion;
    if (requiresMigration) this.backupCurrent();

    const migratedPayload = migratePayload(
      parsed.data.payload,
      parsed.data.schemaVersion,
      this.options.schemaVersion,
      this.migrations,
    );
    const payload = this.validatePayload(migratedPayload);
    const envelope: LocalAppEnvelope<TPayload> = {
      ...parsed.data,
      schemaVersion: this.options.schemaVersion,
      dataVersion: requiresMigration
        ? parsed.data.dataVersion + 1
        : parsed.data.dataVersion,
      payload,
    };

    if (requiresMigration) {
      envelope.updatedAt = this.now().toISOString();
      envelope.sync = { ...envelope.sync, dirty: true };
      this.save(envelope);
    }

    return envelope;
  }

  private createInitialEnvelope(
    payload: TPayload,
    dirty: boolean,
  ): LocalAppEnvelope<TPayload> {
    return {
      appId: this.options.appId,
      schemaVersion: this.options.schemaVersion,
      dataVersion: 1,
      updatedAt: this.now().toISOString(),
      deviceId: this.createId(),
      payload,
      sync: {
        dirty,
        lastRemoteVersion: null,
        lastSyncedAt: null,
      },
    };
  }

  private validateCurrentEnvelope(
    envelope: LocalAppEnvelope<TPayload>,
  ): LocalAppEnvelope<TPayload> {
    const parsed = envelopeBaseSchema.safeParse(envelope);
    if (!parsed.success || parsed.data.appId !== this.options.appId) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "准备写入的本地数据结构不正确。",
        parsed.success ? undefined : parsed.error,
      );
    }
    if (parsed.data.schemaVersion !== this.options.schemaVersion) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "准备写入的数据结构版本与当前应用不一致。",
      );
    }

    return {
      ...parsed.data,
      payload: this.validatePayload(parsed.data.payload),
    };
  }

  private validatePayload(payload: unknown): TPayload {
    const parsed = this.options.payloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "业务数据校验失败，未写入浏览器。",
        parsed.error,
      );
    }
    return parsed.data;
  }

  private backupCurrent() {
    this.createBackup();
  }

  private read(key: string) {
    try {
      return this.storage.getItem(key);
    } catch (error) {
      throw new AppError(
        "UNKNOWN",
        "浏览器禁止访问本地存储，请检查隐私或站点设置。",
        error,
      );
    }
  }

  private write(key: string, value: string) {
    try {
      this.storage.setItem(key, value);
    } catch (error) {
      if (isQuotaExceededError(error)) {
        throw new AppError(
          "LOCAL_STORAGE_QUOTA_EXCEEDED",
          "浏览器本地空间不足。请先导出数据并清理不再需要的内容。",
          error,
        );
      }
      throw new AppError(
        "UNKNOWN",
        "本地数据写入失败，请检查浏览器隐私或站点设置。",
        error,
      );
    }
  }

  private remove(key: string) {
    try {
      this.storage.removeItem(key);
    } catch (error) {
      throw new AppError(
        "UNKNOWN",
        "旧数据已迁移，但无法清理旧存储键。",
        error,
      );
    }
  }

  private get backupKey() {
    return `${this.options.storageKey}:backup:latest`;
  }

  private get legacyBackupKey() {
    return `${this.options.storageKey}:legacy-backup`;
  }

  private get remoteBackupKey() {
    return `${this.options.storageKey}:backup:remote-latest`;
  }
}
