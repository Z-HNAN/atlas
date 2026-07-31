import { describe, expect, it } from "vitest";
import { AppError } from "../../src/lib/errors/app-error";
import { SyncManager } from "../../src/lib/sync/sync-manager";
import type { SyncProvider } from "../../src/lib/sync/types";
import {
  createSyncRepository,
  MemorySyncCloud,
  type SyncPayload,
} from "../helpers/sync-fixtures";

let commitSequence = 0;
const createManager = (
  repository: ReturnType<typeof createSyncRepository>,
  cloud: MemorySyncCloud,
) =>
  new SyncManager<SyncPayload>({
    repository,
    provider: cloud.createProvider(),
    isPayloadEmpty: (payload) => payload.items.length === 0,
    createCommitId: () =>
      `00000000-0000-4000-8000-${String(++commitSequence).padStart(12, "0")}`,
  });

describe("SyncManager 决策矩阵", () => {
  it("远程不存在时上传，并记录独立云端基线", async () => {
    const repository = createSyncRepository("device-a");
    const cloud = new MemorySyncCloud();
    const result = await createManager(repository, cloud).sync();

    expect(result).toMatchObject({
      status: "synced",
      action: "uploaded",
      cloudVersion: 1,
    });
    expect((await repository.load()).sync).toMatchObject({
      dirty: false,
      lastCloudVersion: 1,
      syncStatus: "synced",
    });
  });

  it("本地为初始空数据且远程存在时下载并备份", async () => {
    const cloud = new MemorySyncCloud();
    const source = createSyncRepository("source");
    await source.update(() => ({ items: ["cloud"] }));
    await createManager(source, cloud).sync();

    const target = createSyncRepository("target");
    const result = await createManager(target, cloud).sync();
    expect(result).toMatchObject({ status: "synced", action: "downloaded" });
    expect((await target.load()).payload.items).toEqual(["cloud"]);
    expect(await target.getLatestBackupJson()).not.toBeNull();
  });

  it("本地未修改且云版本更高时拉取", async () => {
    const cloud = new MemorySyncCloud();
    const first = createSyncRepository("first");
    const second = createSyncRepository("second");
    const firstManager = createManager(first, cloud);
    const secondManager = createManager(second, cloud);
    await firstManager.sync();
    await secondManager.sync();
    await first.update(() => ({ items: ["new-cloud"] }));
    await firstManager.sync();

    await secondManager.sync();
    expect((await second.load()).payload.items).toEqual(["new-cloud"]);
    expect((await second.load()).sync.lastCloudVersion).toBe(2);
  });

  it("双侧修改时保留冲突并可分别导出", async () => {
    const cloud = new MemorySyncCloud();
    const first = createSyncRepository("first");
    const second = createSyncRepository("second");
    const firstManager = createManager(first, cloud);
    const secondManager = createManager(second, cloud);
    await firstManager.sync();
    await secondManager.sync();
    await first.update(() => ({ items: ["remote-change"] }));
    await second.update(() => ({ items: ["local-change"] }));
    await firstManager.sync();

    const result = await secondManager.sync();
    expect(result.status).toBe("conflict");
    expect((await second.load()).payload.items).toEqual(["local-change"]);
    const exported = await secondManager.exportConflict();
    expect(JSON.parse(exported.localJson)).toMatchObject({
      payload: { items: ["local-change"] },
    });
    expect(JSON.parse(exported.remoteJson)).toMatchObject({
      payload: { items: ["remote-change"] },
    });
  });

  it("上传竞争后重新拉取并进入冲突", async () => {
    const cloud = new MemorySyncCloud();
    const repository = createSyncRepository("device-a");
    await createManager(repository, cloud).sync();
    await repository.update(() => ({ items: ["local-race"] }));
    const baseProvider = cloud.createProvider();
    const racingProvider: SyncProvider<SyncPayload> = {
      pullLatest: () => baseProvider.pullLatest(),
      push: () => {
        cloud.snapshot = {
          appId: "sync-test",
          version: 2,
          commitId: "00000000-0000-4000-8000-999999999999",
          payloadSchemaVersion: 1,
          payload: { items: ["remote-race"] },
          deviceId: "device-b",
          createdAt: "2026-07-17T08:02:00.000Z",
        };
        return Promise.reject(
          new AppError("REMOTE_VERSION_MISMATCH", "测试竞争。"),
        );
      },
    };
    const manager = new SyncManager<SyncPayload>({
      repository,
      provider: racingProvider,
      isPayloadEmpty: (payload) => payload.items.length === 0,
      createCommitId: () => "00000000-0000-4000-8000-888888888888",
    });

    const result = await manager.sync();
    expect(result).toMatchObject({
      status: "conflict",
      conflict: { remote: { version: 2, payload: { items: ["remote-race"] } } },
    });
    expect((await repository.load()).sync.syncStatus).toBe("conflict");
  });

  it("人工保留本地时提交新版本且保存远端备份", async () => {
    const cloud = new MemorySyncCloud();
    const repository = createSyncRepository("device-a");
    const manager = createManager(repository, cloud);
    await repository.update(() => ({ items: ["baseline"] }));
    await manager.sync();
    cloud.snapshot = {
      appId: "sync-test",
      version: 3,
      commitId: "00000000-0000-4000-8000-777777777777",
      payloadSchemaVersion: 1,
      payload: { items: ["remote-before-submit"] },
      deviceId: "device-b",
      createdAt: "2026-07-17T08:03:00.000Z",
    };
    await repository.update(() => ({ items: ["local-wins"] }));

    await manager.submitLocalVersion();
    expect(cloud.snapshot?.version).toBe(4);
    expect(cloud.snapshot?.payload.items).toEqual(["local-wins"]);
    expect(
      JSON.parse((await repository.getLatestRemoteBackupJson()) ?? "{}"),
    ).toMatchObject({ payload: { items: ["remote-before-submit"] } });
  });

  it("上传期间的新本地修改保持 dirty，不被旧响应误标为已同步", async () => {
    const repository = createSyncRepository("device-a");
    await repository.update(() => ({ items: ["uploading"] }));
    let signalUploadStarted!: () => void;
    const uploadStarted = new Promise<void>((resolve) => {
      signalUploadStarted = resolve;
    });
    let finishUpload!: (snapshot: {
      appId: string;
      version: number;
      commitId: string;
      payloadSchemaVersion: number;
      payload: SyncPayload;
      deviceId: string;
      createdAt: string;
    }) => void;
    const uploaded = new Promise<{
      appId: string;
      version: number;
      commitId: string;
      payloadSchemaVersion: number;
      payload: SyncPayload;
      deviceId: string;
      createdAt: string;
    }>((resolve) => {
      finishUpload = resolve;
    });
    const provider: SyncProvider<SyncPayload> = {
      pullLatest: () => Promise.resolve(null),
      push: (input) => {
        signalUploadStarted();
        return uploaded.then((snapshot) => ({
          ...snapshot,
          commitId: input.commitId,
        }));
      },
    };
    const manager = new SyncManager<SyncPayload>({
      repository,
      provider,
      isPayloadEmpty: (payload) => payload.items.length === 0,
      createCommitId: () => "00000000-0000-4000-8000-666666666666",
    });

    const syncing = manager.sync();
    await uploadStarted;
    await repository.update(() => ({ items: ["edited-during-upload"] }));
    finishUpload({
      appId: "sync-test",
      version: 1,
      commitId: "00000000-0000-4000-8000-666666666666",
      payloadSchemaVersion: 1,
      payload: { items: ["uploading"] },
      deviceId: "device-a",
      createdAt: "2026-07-17T08:04:00.000Z",
    });
    await syncing;

    expect(await repository.load()).toMatchObject({
      payload: { items: ["edited-during-upload"] },
      sync: {
        dirty: true,
        lastCloudVersion: 1,
        lastSyncCommitId: null,
        syncStatus: "pending",
      },
    });
  });
});
