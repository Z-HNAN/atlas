import { describe, expect, it } from "vitest";
import { SyncManager } from "../../src/lib/sync/sync-manager";
import {
  createSyncRepository,
  MemorySyncCloud,
  type SyncPayload,
} from "../helpers/sync-fixtures";

const managerFor = (
  repository: ReturnType<typeof createSyncRepository>,
  cloud: MemorySyncCloud,
) =>
  new SyncManager<SyncPayload>({
    repository,
    provider: cloud.createProvider(),
    isPayloadEmpty: (payload) => payload.items.length === 0,
  });

const createConflictScenario = async () => {
  const cloud = new MemorySyncCloud();
  const a = createSyncRepository("device-a");
  const b = createSyncRepository("device-b");
  const managerA = managerFor(a, cloud);
  const managerB = managerFor(b, cloud);

  await a.update(() => ({ items: ["initial"] }));
  await managerA.sync();
  await managerB.sync();
  await a.update(() => ({ items: ["from-a"] }));
  await b.update(() => ({ items: ["from-b"] }));
  await managerA.sync();
  expect((await managerB.sync()).status).toBe("conflict");
  return { cloud, a, b, managerA, managerB };
};

describe("双设备同步生命周期", () => {
  it("第二台设备恢复后并发修改，选择本地可覆盖云端", async () => {
    const { cloud, b, managerB } = await createConflictScenario();

    const resolved = await managerB.resolveWithLocal();

    expect(resolved).toMatchObject({ status: "synced", action: "uploaded" });
    expect(cloud.snapshot?.payload.items).toEqual(["from-b"]);
    expect((await b.load()).sync.dirty).toBe(false);
    expect(await b.getLatestBackupJson()).not.toBeNull();
    expect(
      JSON.parse((await b.getLatestRemoteBackupJson()) ?? "{}"),
    ).toMatchObject({
      payload: { items: ["from-a"] },
    });
  });

  it("第二台设备并发修改时，选择云端会备份并覆盖本地", async () => {
    const { b, managerB } = await createConflictScenario();

    const resolved = await managerB.resolveWithRemote();

    expect(resolved).toMatchObject({ status: "synced", action: "downloaded" });
    expect((await b.load()).payload.items).toEqual(["from-a"]);
    const backup = JSON.parse((await b.getLatestBackupJson()) ?? "{}") as {
      payload?: SyncPayload;
    };
    expect(backup.payload?.items).toEqual(["from-b"]);
  });
});
