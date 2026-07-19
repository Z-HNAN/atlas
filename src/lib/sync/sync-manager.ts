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
}

export class SyncManager<TPayload> {
  private conflict: SyncConflict<TPayload> | null = null;

  constructor(private readonly options: SyncManagerOptions<TPayload>) {}

  getConflict() {
    return this.conflict;
  }

  async sync(): Promise<SyncResult<TPayload>> {
    const local = this.options.repository.load();
    const remoteRaw = await this.options.provider.pull();

    if (!remoteRaw) {
      return this.pushLocal(null);
    }

    const remote = this.options.repository.prepareRemoteSnapshot(remoteRaw);
    const lastRemoteVersion = local.sync.lastRemoteVersion;

    if (
      !local.sync.dirty &&
      lastRemoteVersion === null &&
      this.options.isPayloadEmpty(local.payload)
    ) {
      this.options.repository.applyRemoteSnapshot(remote);
      this.conflict = null;
      return this.synced("downloaded", remote.dataVersion);
    }

    if (!local.sync.dirty && lastRemoteVersion !== null) {
      if (remote.dataVersion > lastRemoteVersion) {
        this.options.repository.applyRemoteSnapshot(remote);
        this.conflict = null;
        return this.synced("downloaded", remote.dataVersion);
      }

      if (remote.dataVersion === lastRemoteVersion) {
        this.conflict = null;
        return this.synced("none", remote.dataVersion);
      }
    }

    if (
      local.sync.dirty &&
      lastRemoteVersion !== null &&
      remote.dataVersion === lastRemoteVersion
    ) {
      return this.pushLocal(remote.dataVersion);
    }

    return this.createConflict(remote);
  }

  async restoreRemote(): Promise<SyncResult<TPayload>> {
    const remoteRaw = await this.options.provider.pull();
    if (!remoteRaw) {
      throw new AppError("INVALID_RESPONSE", "云端还没有可恢复的快照。");
    }

    const remote = this.options.repository.prepareRemoteSnapshot(remoteRaw);
    this.options.repository.applyRemoteSnapshot(remote);
    this.conflict = null;
    return this.synced("downloaded", remote.dataVersion);
  }

  async overwriteRemote(): Promise<SyncResult<TPayload>> {
    const remoteRaw = await this.options.provider.pull();
    const preparedRemote = remoteRaw
      ? this.options.repository.prepareRemoteSnapshot(remoteRaw)
      : null;
    if (preparedRemote) {
      this.options.repository.backupRemoteSnapshot(preparedRemote);
    }
    this.options.repository.createBackup();
    const expectedRemoteVersion = preparedRemote?.dataVersion ?? null;
    return this.pushLocal(expectedRemoteVersion);
  }

  async deleteRemote(): Promise<SyncResult<TPayload>> {
    const remoteRaw = await this.options.provider.pull();
    if (remoteRaw) {
      this.options.repository.backupRemoteSnapshot(remoteRaw);
    }
    await this.options.provider.remove();
    this.options.repository.clearRemoteSyncState();
    this.conflict = null;
    return this.synced("remote-deleted", null);
  }

  async resolveWithLocal(): Promise<SyncResult<TPayload>> {
    if (!this.conflict) {
      throw new AppError("SYNC_CONFLICT", "当前没有需要处理的同步冲突。");
    }
    this.options.repository.createBackup();
    this.options.repository.backupRemoteSnapshot(this.conflict.remote);
    return this.pushLocal(this.conflict.remote.dataVersion);
  }

  resolveWithRemote(): SyncResult<TPayload> {
    if (!this.conflict) {
      throw new AppError("SYNC_CONFLICT", "当前没有需要处理的同步冲突。");
    }
    const remote = this.conflict.remote;
    this.options.repository.applyRemoteSnapshot(remote);
    this.conflict = null;
    return this.synced("downloaded", remote.dataVersion);
  }

  exportConflict(): ConflictExports {
    if (!this.conflict) {
      throw new AppError("SYNC_CONFLICT", "当前没有可导出的同步冲突。");
    }
    return {
      localJson: this.options.repository.exportJson(),
      remoteJson: this.options.repository.exportSnapshotJson(
        this.conflict.remote,
      ),
    };
  }

  cancelConflict() {
    return this.conflict;
  }

  private async pushLocal(
    expectedRemoteVersion: number | null,
  ): Promise<SyncResult<TPayload>> {
    const local = this.options.repository.load();
    try {
      const remoteRaw = await this.options.provider.push({
        payload: local.payload,
        schemaVersion: local.schemaVersion,
        dataVersion: local.dataVersion,
        expectedRemoteVersion,
        deviceId: local.deviceId,
      });
      const remote = this.options.repository.prepareRemoteSnapshot(remoteRaw);
      this.options.repository.markSynced(remote);
      this.conflict = null;
      return this.synced("uploaded", remote.dataVersion);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      if (error.code !== "REMOTE_VERSION_MISMATCH") throw error;

      const latestRaw = await this.options.provider.pull();
      if (!latestRaw) {
        throw new AppError(
          "REMOTE_VERSION_MISMATCH",
          "云端版本在上传期间发生变化，请重新同步。",
          error,
        );
      }
      const latest = this.options.repository.prepareRemoteSnapshot(latestRaw);
      return this.createConflict(latest);
    }
  }

  private createConflict(
    remote: RemoteSnapshot<TPayload>,
  ): SyncResult<TPayload> {
    const local = this.options.repository.load();
    this.conflict = {
      localPayload: local.payload,
      localDataVersion: local.dataVersion,
      remote,
    };
    return { status: "conflict", action: "conflict", conflict: this.conflict };
  }

  private synced(
    action: "none" | "uploaded" | "downloaded" | "remote-deleted",
    remoteVersion: number | null,
  ): SyncResult<TPayload> {
    return { status: "synced", action, remoteVersion };
  }
}
