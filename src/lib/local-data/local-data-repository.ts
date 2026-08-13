import type { z } from "zod";
import { AppError } from "../errors/app-error";
import { remoteSnapshotBaseSchema } from "../sync/schemas";
import type { RemoteSnapshot } from "../sync/types";
import {
  envelopeBaseSchema,
  exportBaseSchema,
  type AppDataExport,
  type LocalAppEnvelope,
  type SyncStatus,
} from "./envelope";
import {
  DexieKeyValueStore,
  StorageKeyValueStore,
  type AsyncKeyValueStore,
} from "./key-value-store";
import { migratePayload, type SchemaMigration } from "./schema-migrations";
import { getStorageSizeInfo, type StorageSizeInfo } from "./storage-size";

export interface LocalDataRepository<TPayload> {
  load(): Promise<LocalAppEnvelope<TPayload>>;
  save(next: LocalAppEnvelope<TPayload>): Promise<void>;
  update(
    updater: (current: TPayload) => TPayload,
  ): Promise<LocalAppEnvelope<TPayload>>;
  reset(): Promise<LocalAppEnvelope<TPayload>>;
  exportJson(): Promise<string>;
  importJson(raw: string): Promise<LocalAppEnvelope<TPayload>>;
  getStorageSize(): Promise<StorageSizeInfo>;
  getLatestBackupJson(): Promise<string | null>;
  exportLatestBackupJson(): Promise<string | null>;
  getLatestRemoteBackupJson(): Promise<string | null>;
  createBackup(): Promise<string | null>;
  backupRemoteSnapshot(remote: RemoteSnapshot<unknown>): Promise<string>;
  prepareRemoteSnapshot(
    remote: RemoteSnapshot<unknown>,
  ): Promise<RemoteSnapshot<TPayload>>;
  applyRemoteSnapshot(
    remote: RemoteSnapshot<unknown>,
  ): Promise<LocalAppEnvelope<TPayload>>;
  markSyncPending(commitId: string): Promise<LocalAppEnvelope<TPayload>>;
  markSyncStatus(status: SyncStatus): Promise<LocalAppEnvelope<TPayload>>;
  markSynced(
    remote: RemoteSnapshot<unknown>,
    uploadedDataVersion: number,
  ): Promise<LocalAppEnvelope<TPayload>>;
  exportSnapshotJson(remote: RemoteSnapshot<unknown>): Promise<string>;
}

export interface LocalRepositoryOptions<TPayload> {
  appId: string;
  schemaVersion: number;
  storageKey: string;
  databaseName?: string;
  payloadSchema: z.ZodType<TPayload>;
  createDefaultPayload: () => TPayload;
  migrations?: Readonly<Record<number, SchemaMigration>>;
  store?: AsyncKeyValueStore;
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
  private readonly store: AsyncKeyValueStore;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly migrations: Readonly<Record<number, SchemaMigration>>;
  private mutationQueue: Promise<unknown> = Promise.resolve();
  private initializationPromise: Promise<LocalAppEnvelope<TPayload>> | null =
    null;

  constructor(private readonly options: LocalRepositoryOptions<TPayload>) {
    this.store =
      options.store ??
      (options.storage
        ? new StorageKeyValueStore(options.storage)
        : new DexieKeyValueStore(
            options.databaseName ?? `${options.appId}-local`,
          ));
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.migrations = options.migrations ?? {};
  }

  async load(): Promise<LocalAppEnvelope<TPayload>> {
    const raw = await this.store.get(this.options.storageKey);
    if (!raw) {
      this.initializationPromise ??= this.initialize().catch(
        (error: unknown) => {
          this.initializationPromise = null;
          throw error;
        },
      );
      return this.initializationPromise;
    }
    return this.parseStoredEnvelope(raw);
  }

  async save(next: LocalAppEnvelope<TPayload>): Promise<void> {
    const valid = this.validateCurrentEnvelope(next);
    await this.store.set(this.options.storageKey, stringifyJson(valid));
  }

  update(
    updater: (current: TPayload) => TPayload,
  ): Promise<LocalAppEnvelope<TPayload>> {
    return this.withMutation(async () => {
      const current = await this.load();
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
      const next: LocalAppEnvelope<TPayload> = {
        ...current,
        dataVersion: current.dataVersion + 1,
        updatedAt: this.now().toISOString(),
        payload: this.validatePayload(candidate),
        sync: {
          ...current.sync,
          dirty: true,
          lastSyncCommitId: null,
          syncStatus: "pending",
        },
      };
      await this.save(next);
      return next;
    });
  }

  reset(): Promise<LocalAppEnvelope<TPayload>> {
    return this.withMutation(async () => {
      const current = await this.tryLoad();
      await this.createBackup();
      const next: LocalAppEnvelope<TPayload> = {
        appId: this.options.appId,
        schemaVersion: this.options.schemaVersion,
        dataVersion: (current?.dataVersion ?? 0) + 1,
        updatedAt: this.now().toISOString(),
        deviceId: current?.deviceId ?? this.createId(),
        payload: this.validatePayload(this.options.createDefaultPayload()),
        sync: {
          dirty: true,
          lastCloudVersion: current?.sync.lastCloudVersion ?? null,
          lastSyncAt: current?.sync.lastSyncAt ?? null,
          lastSyncCommitId: null,
          syncStatus: "pending",
        },
      };
      await this.save(next);
      return next;
    });
  }

  async exportJson(): Promise<string> {
    return this.toExportJson(await this.load());
  }

  importJson(raw: string): Promise<LocalAppEnvelope<TPayload>> {
    return this.withMutation(async () => {
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
      const payload = this.validatePayload(
        migratePayload(
          parsed.data.payload,
          parsed.data.schemaVersion,
          this.options.schemaVersion,
          this.migrations,
        ),
      );
      const current = await this.tryLoad();
      await this.createBackup();
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
          lastCloudVersion: current?.sync.lastCloudVersion ?? null,
          lastSyncAt: current?.sync.lastSyncAt ?? null,
          lastSyncCommitId: null,
          syncStatus: "pending",
        },
      };
      await this.save(next);
      return next;
    });
  }

  async getStorageSize(): Promise<StorageSizeInfo> {
    return getStorageSizeInfo(await this.store.get(this.options.storageKey));
  }

  getLatestBackupJson() {
    return this.store.get(this.backupKey);
  }

  async exportLatestBackupJson(): Promise<string | null> {
    const raw = await this.getLatestBackupJson();
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
    return this.toExportJson({
      ...parsed.data,
      payload: this.validatePayload(parsed.data.payload),
    });
  }

  getLatestRemoteBackupJson() {
    return this.store.get(this.remoteBackupKey);
  }

  async createBackup(): Promise<string | null> {
    const raw = await this.store.get(this.options.storageKey);
    if (!raw) return null;
    await this.store.set(this.backupKey, raw);
    return raw;
  }

  async backupRemoteSnapshot(remote: RemoteSnapshot<unknown>): Promise<string> {
    const exported = await this.exportSnapshotJson(remote);
    await this.store.set(this.remoteBackupKey, exported);
    return exported;
  }

  prepareRemoteSnapshot(
    remote: RemoteSnapshot<unknown>,
  ): Promise<RemoteSnapshot<TPayload>> {
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
    return Promise.resolve({
      ...parsed.data,
      payloadSchemaVersion: this.options.schemaVersion,
      payload: this.validatePayload(
        migratePayload(
          parsed.data.payload,
          parsed.data.payloadSchemaVersion,
          this.options.schemaVersion,
          this.migrations,
        ),
      ),
    });
  }

  async applyRemoteSnapshot(
    remote: RemoteSnapshot<unknown>,
  ): Promise<LocalAppEnvelope<TPayload>> {
    const prepared = await this.prepareRemoteSnapshot(remote);
    const current = await this.tryLoad();
    await this.createBackup();
    const next: LocalAppEnvelope<TPayload> = {
      appId: this.options.appId,
      schemaVersion: this.options.schemaVersion,
      dataVersion: (current?.dataVersion ?? 0) + 1,
      updatedAt: this.now().toISOString(),
      deviceId: current?.deviceId ?? this.createId(),
      payload: prepared.payload,
      sync: {
        dirty: false,
        lastCloudVersion: prepared.version,
        lastSyncAt: this.now().toISOString(),
        lastSyncCommitId: prepared.commitId,
        syncStatus: "synced",
      },
    };
    await this.save(next);
    return next;
  }

  markSyncPending(commitId: string): Promise<LocalAppEnvelope<TPayload>> {
    return this.withMutation(async () => {
      const current = await this.load();
      const next = {
        ...current,
        sync: {
          ...current.sync,
          lastSyncCommitId: commitId,
          syncStatus: "syncing" as const,
        },
      };
      await this.save(next);
      return next;
    });
  }

  markSyncStatus(status: SyncStatus): Promise<LocalAppEnvelope<TPayload>> {
    return this.withMutation(async () => {
      const current = await this.load();
      const next = {
        ...current,
        sync: { ...current.sync, syncStatus: status },
      };
      await this.save(next);
      return next;
    });
  }

  markSynced(
    remote: RemoteSnapshot<unknown>,
    uploadedDataVersion: number,
  ): Promise<LocalAppEnvelope<TPayload>> {
    return this.withMutation(async () => {
      const prepared = await this.prepareRemoteSnapshot(remote);
      const current = await this.load();
      const changedDuringUpload = current.dataVersion !== uploadedDataVersion;
      const next: LocalAppEnvelope<TPayload> = {
        ...current,
        sync: {
          dirty: changedDuringUpload,
          lastCloudVersion: prepared.version,
          lastSyncAt: this.now().toISOString(),
          lastSyncCommitId: changedDuringUpload
            ? current.sync.lastSyncCommitId
            : prepared.commitId,
          syncStatus: changedDuringUpload ? "pending" : "synced",
        },
      };
      await this.save(next);
      return next;
    });
  }

  async exportSnapshotJson(remote: RemoteSnapshot<unknown>): Promise<string> {
    const prepared = await this.prepareRemoteSnapshot(remote);
    const current = await this.tryLoad();
    const exported: AppDataExport<TPayload> = {
      format: "personal-web-seed-export",
      appId: prepared.appId,
      schemaVersion: prepared.payloadSchemaVersion,
      dataVersion: current?.dataVersion ?? 1,
      exportedAt: this.now().toISOString(),
      payload: prepared.payload,
    };
    return stringifyJson(exported, true);
  }

  private async initialize(): Promise<LocalAppEnvelope<TPayload>> {
    const initial = this.createInitialEnvelope(
      this.validatePayload(this.options.createDefaultPayload()),
    );
    await this.save(initial);
    return initial;
  }

  private async parseStoredEnvelope(
    raw: string,
    persistMigration = true,
  ): Promise<LocalAppEnvelope<TPayload>> {
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
    if (requiresMigration && persistMigration) await this.createBackup();
    const envelope: LocalAppEnvelope<TPayload> = {
      ...parsed.data,
      schemaVersion: this.options.schemaVersion,
      dataVersion: requiresMigration
        ? parsed.data.dataVersion + 1
        : parsed.data.dataVersion,
      payload: this.validatePayload(
        migratePayload(
          parsed.data.payload,
          parsed.data.schemaVersion,
          this.options.schemaVersion,
          this.migrations,
        ),
      ),
    };
    if (requiresMigration) {
      envelope.updatedAt = this.now().toISOString();
      envelope.sync = {
        ...envelope.sync,
        dirty: true,
        lastSyncCommitId: null,
        syncStatus: "pending",
      };
      if (persistMigration) await this.save(envelope);
    }
    return envelope;
  }

  private createInitialEnvelope(payload: TPayload): LocalAppEnvelope<TPayload> {
    return {
      appId: this.options.appId,
      schemaVersion: this.options.schemaVersion,
      dataVersion: 1,
      updatedAt: this.now().toISOString(),
      deviceId: this.createId(),
      payload,
      sync: {
        dirty: false,
        lastCloudVersion: null,
        lastSyncAt: null,
        lastSyncCommitId: null,
        syncStatus: "idle",
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

  private toExportJson(envelope: LocalAppEnvelope<TPayload>) {
    return stringifyJson(
      {
        format: "personal-web-seed-export",
        appId: envelope.appId,
        schemaVersion: envelope.schemaVersion,
        dataVersion: envelope.dataVersion,
        exportedAt: this.now().toISOString(),
        payload: envelope.payload,
      } satisfies AppDataExport<TPayload>,
      true,
    );
  }

  private tryLoad() {
    return this.load().catch(() => null);
  }

  private withMutation<TResult>(action: () => Promise<TResult>) {
    const pending = this.mutationQueue.then(action, action);
    this.mutationQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  private get backupKey() {
    return `${this.options.storageKey}:backup:latest`;
  }

  private get remoteBackupKey() {
    return `${this.options.storageKey}:backup:remote-latest`;
  }
}
