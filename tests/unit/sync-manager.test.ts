import { describe, expect, it } from "vitest";
import { AppError } from "../../src/lib/errors/app-error";
import { SyncManager } from "../../src/lib/sync/sync-manager";
import type { SyncProvider } from "../../src/lib/sync/types";
import {
  createSyncRepository,
  MemorySyncCloud,
  type SyncPayload,
} from "../helpers/sync-fixtures";

const createManager = (
  repository: ReturnType<typeof createSyncRepository>,
  cloud: MemorySyncCloud,
) =>
  new SyncManager<SyncPayload>({
    repository,
    provider: cloud.createProvider(),
    isPayloadEmpty: (payload) => payload.items.length === 0,
  });

describe("SyncManager 决策矩阵", () => {
  it("远程不存在时上传本地，并记录同步基线", async () => {
    const repository = createSyncRepository("device-a");
    const cloud = new MemorySyncCloud();
    const result = await createManager(repository, cloud).sync();

    expect(result).toMatchObject({ status: "synced", action: "uploaded" });
    expect(repository.load().sync).toMatchObject({
      dirty: false,
      lastRemoteVersion: 1,
    });
    expect(cloud.snapshot?.payload).toEqual({ items: [] });
  });

  it("本地刚初始化且远程存在时下载，并备份本地", async () => {
    const cloud = new MemorySyncCloud();
    const source = createSyncRepository("source");
    source.update(() => ({ items: ["cloud"] }));
    await createManager(source, cloud).sync();

    const target = createSyncRepository("target");
    const result = await createManager(target, cloud).sync();

    expect(result).toMatchObject({ status: "synced", action: "downloaded" });
    expect(target.load().payload.items).toEqual(["cloud"]);
    expect(target.getLatestBackupJson()).not.toBeNull();
  });

  it("本地未修改而远程版本更高时拉取远程", async () => {
    const cloud = new MemorySyncCloud();
    const first = createSyncRepository("first");
    const second = createSyncRepository("second");
    const firstManager = createManager(first, cloud);
    const secondManager = createManager(second, cloud);
    await firstManager.sync();
    await secondManager.sync();

    first.update(() => ({ items: ["new-cloud"] }));
    await firstManager.sync();
    const result = await secondManager.sync();

    expect(result).toMatchObject({ status: "synced", action: "downloaded" });
    expect(second.load().payload.items).toEqual(["new-cloud"]);
  });

  it("本地与远程均变化时保留冲突，导出和取消不修改数据", async () => {
    const cloud = new MemorySyncCloud();
    const first = createSyncRepository("first");
    const second = createSyncRepository("second");
    const firstManager = createManager(first, cloud);
    const secondManager = createManager(second, cloud);
    await firstManager.sync();
    await secondManager.sync();
    first.update(() => ({ items: ["remote-change"] }));
    second.update(() => ({ items: ["local-change"] }));
    await firstManager.sync();

    const result = await secondManager.sync();
    expect(result.status).toBe("conflict");
    expect(second.load().payload.items).toEqual(["local-change"]);

    const exported = secondManager.exportConflict();
    expect(JSON.parse(exported.localJson)).toMatchObject({
      payload: { items: ["local-change"] },
    });
    expect(JSON.parse(exported.remoteJson)).toMatchObject({
      payload: { items: ["remote-change"] },
    });
    secondManager.cancelConflict();
    expect(secondManager.getConflict()).not.toBeNull();
    expect(second.load().payload.items).toEqual(["local-change"]);
  });

  it("上传期间发生版本竞争时重新拉取并进入冲突", async () => {
    const cloud = new MemorySyncCloud();
    const repository = createSyncRepository("device-a");
    const initialManager = createManager(repository, cloud);
    await initialManager.sync();
    repository.update(() => ({ items: ["local-race"] }));
    const baseProvider = cloud.createProvider();
    let pushed = false;
    const racingProvider: SyncProvider<SyncPayload> = {
      pull: () => baseProvider.pull(),
      push: () => {
        pushed = true;
        cloud.snapshot = {
          appId: "sync-test",
          schemaVersion: 1,
          dataVersion: 2,
          payload: { items: ["remote-race"] },
          deviceId: "device-b",
          updatedAt: "2026-07-17T08:02:00.000Z",
        };
        return Promise.reject(
          new AppError("REMOTE_VERSION_MISMATCH", "测试竞争。"),
        );
      },
      remove: () => baseProvider.remove(),
    };
    const manager = new SyncManager<SyncPayload>({
      repository,
      provider: racingProvider,
      isPayloadEmpty: (payload) => payload.items.length === 0,
    });

    const result = await manager.sync();

    expect(pushed).toBe(true);
    expect(result).toMatchObject({
      status: "conflict",
      conflict: { remote: { payload: { items: ["remote-race"] } } },
    });
    expect(repository.load().payload.items).toEqual(["local-race"]);
  });

  it("显式覆盖和删除云端时保留恢复备份且不删除本地", async () => {
    const cloud = new MemorySyncCloud();
    const repository = createSyncRepository("device-a");
    const manager = createManager(repository, cloud);
    repository.update(() => ({ items: ["baseline"] }));
    await manager.sync();
    cloud.snapshot = {
      appId: "sync-test",
      schemaVersion: 1,
      dataVersion: 3,
      payload: { items: ["remote-before-overwrite"] },
      deviceId: "device-b",
      updatedAt: "2026-07-17T08:03:00.000Z",
    };
    repository.update(() => ({ items: ["local-wins"] }));

    await manager.overwriteRemote();
    expect(cloud.snapshot?.payload.items).toEqual(["local-wins"]);
    expect(
      JSON.parse(repository.getLatestRemoteBackupJson() ?? "{}"),
    ).toMatchObject({ payload: { items: ["remote-before-overwrite"] } });

    await manager.deleteRemote();
    expect(cloud.snapshot).toBeNull();
    expect(repository.load()).toMatchObject({
      payload: { items: ["local-wins"] },
      sync: { dirty: false, lastRemoteVersion: null },
    });
    expect(
      JSON.parse(repository.getLatestRemoteBackupJson() ?? "{}"),
    ).toMatchObject({ payload: { items: ["local-wins"] } });
  });
});
