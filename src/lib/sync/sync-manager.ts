import { AppError } from "../errors/app-error";
import type { LocalDataRepository } from "../local-data/local-data-repository";
import type {
  ConflictExports,
  RemoteSnapshot,
  SyncConflict,
  SyncProvider,
  SyncResult,
} from "./types";

interface SyncManagerOptions<TPayload> {
  repository: LocalDataRepository<TPayload>;
  provider: SyncProvider<TPayload>;
  isPayloadEmpty: (payload: TPayload) => boolean;
  createCommitId?: () => string;
}

export class SyncManager<TPayload> {
  private conflict: SyncConflict<TPayload> | null = null;
  private readonly createCommitId: () => string;

  constructor(private readonly options: SyncManagerOptions<TPayload>) {
    this.createCommitId = options.createCommitId ?? (() => crypto.randomUUID());
  }

  getConflict() {
    return this.conflict;
  }

  async sync(): Promise<SyncResult<TPayload>> {
    const local = await this.options.repository.load();
    const remoteRaw = await this.options.provider.pullLatest();
    if (!remoteRaw) return this.pushLocal(null);

    const remote =
      await this.options.repository.prepareRemoteSnapshot(remoteRaw);
    const lastCloudVersion = local.sync.lastCloudVersion;

    if (
      !local.sync.dirty &&
      lastCloudVersion === null &&
      this.options.isPayloadEmpty(local.payload)
    ) {
      await this.options.repository.applyRemoteSnapshot(remote);
      this.conflict = null;
      return this.synced("downloaded", remote.version);
    }

    if (!local.sync.dirty && lastCloudVersion !== null) {
      if (remote.version > lastCloudVersion) {
        await this.options.repository.applyRemoteSnapshot(remote);
        this.conflict = null;
        return this.synced("downloaded", remote.version);
      }
      if (remote.version === lastCloudVersion) {
        this.conflict = null;
        return this.synced("none", remote.version);
      }
    }

    if (
      local.sync.dirty &&
      lastCloudVersion !== null &&
      remote.version === lastCloudVersion
    ) {
      return this.pushLocal(remote.version);
    }

    return this.createConflict(remote);
  }

  async restoreRemote(): Promise<SyncResult<TPayload>> {
    const remoteRaw = await this.options.provider.pullLatest();
    if (!remoteRaw) {
      throw new AppError("INVALID_RESPONSE", "云端还没有可恢复的快照。");
    }
    const remote =
      await this.options.repository.prepareRemoteSnapshot(remoteRaw);
    await this.options.repository.applyRemoteSnapshot(remote);
    this.conflict = null;
    return this.synced("downloaded", remote.version);
  }

  async submitLocalVersion(): Promise<SyncResult<TPayload>> {
    const remoteRaw = await this.options.provider.pullLatest();
    const remote = remoteRaw
      ? await this.options.repository.prepareRemoteSnapshot(remoteRaw)
      : null;
    if (remote) await this.options.repository.backupRemoteSnapshot(remote);
    await this.options.repository.createBackup();
    return this.pushLocal(remote?.version ?? null);
  }

  async resolveWithLocal(): Promise<SyncResult<TPayload>> {
    if (!this.conflict) {
      throw new AppError("SYNC_CONFLICT", "当前没有需要处理的同步冲突。");
    }
    await this.options.repository.createBackup();
    await this.options.repository.backupRemoteSnapshot(this.conflict.remote);
    return this.pushLocal(this.conflict.remote.version);
  }

  async resolveWithRemote(): Promise<SyncResult<TPayload>> {
    if (!this.conflict) {
      throw new AppError("SYNC_CONFLICT", "当前没有需要处理的同步冲突。");
    }
    const remote = this.conflict.remote;
    await this.options.repository.applyRemoteSnapshot(remote);
    this.conflict = null;
    return this.synced("downloaded", remote.version);
  }

  async exportConflict(): Promise<ConflictExports> {
    if (!this.conflict) {
      throw new AppError("SYNC_CONFLICT", "当前没有可导出的同步冲突。");
    }
    return {
      localJson: await this.options.repository.exportJson(),
      remoteJson: await this.options.repository.exportSnapshotJson(
        this.conflict.remote,
      ),
    };
  }

  cancelConflict() {
    return this.conflict;
  }

  private async pushLocal(
    baseVersion: number | null,
  ): Promise<SyncResult<TPayload>> {
    let local = await this.options.repository.load();
    const commitId =
      local.sync.dirty && local.sync.lastSyncCommitId
        ? local.sync.lastSyncCommitId
        : this.createCommitId();
    local = await this.options.repository.markSyncPending(commitId);
    try {
      const remoteRaw = await this.options.provider.push({
        payload: local.payload,
        payloadSchemaVersion: local.schemaVersion,
        baseVersion,
        commitId,
        deviceId: local.deviceId,
      });
      const remote =
        await this.options.repository.prepareRemoteSnapshot(remoteRaw);
      await this.options.repository.markSynced(remote, local.dataVersion);
      this.conflict = null;
      return this.synced("uploaded", remote.version);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      if (error.code !== "REMOTE_VERSION_MISMATCH") {
        await this.options.repository.markSyncStatus("error");
        throw error;
      }
      const latestRaw = await this.options.provider.pullLatest();
      if (!latestRaw) {
        throw new AppError(
          "REMOTE_VERSION_MISMATCH",
          "云端版本在上传期间发生变化，请重新同步。",
          error,
        );
      }
      const latest =
        await this.options.repository.prepareRemoteSnapshot(latestRaw);
      return this.createConflict(latest);
    }
  }

  private async createConflict(
    remote: RemoteSnapshot<TPayload>,
  ): Promise<SyncResult<TPayload>> {
    const local = await this.options.repository.load();
    this.conflict = {
      localPayload: local.payload,
      localDataVersion: local.dataVersion,
      remote,
    };
    await this.options.repository.markSyncStatus("conflict");
    return { status: "conflict", action: "conflict", conflict: this.conflict };
  }

  private synced(
    action: "none" | "uploaded" | "downloaded",
    cloudVersion: number | null,
  ): SyncResult<TPayload> {
    return { status: "synced", action, cloudVersion };
  }
}
