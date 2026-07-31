import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../../src/lib/errors/app-error";
import { StorageKeyValueStore } from "../../src/lib/local-data/key-value-store";
import { BrowserLocalDataRepository } from "../../src/lib/local-data/local-data-repository";
import { MemoryStorage, QuotaStorage } from "../helpers/memory-storage";

const payloadSchema = z.object({ items: z.array(z.string()) }).strict();
type TestPayload = z.infer<typeof payloadSchema>;

const createRepository = (
  storage: Storage,
  overrides: Partial<{
    appId: string;
    schemaVersion: number;
    migrations: Record<number, (payload: unknown) => unknown>;
  }> = {},
) =>
  new BrowserLocalDataRepository<TestPayload>({
    appId: overrides.appId ?? "test-app",
    schemaVersion: overrides.schemaVersion ?? 1,
    storageKey: "app:test-app:data",
    payloadSchema,
    createDefaultPayload: () => ({ items: [] }),
    migrations: overrides.migrations,
    storage,
    now: () => new Date("2026-07-17T08:00:00.000Z"),
    createId: () => "device-1",
  });

describe("BrowserLocalDataRepository", () => {
  it("创建并持久化默认 Envelope", async () => {
    const storage = new MemoryStorage();
    const envelope = await createRepository(storage).load();

    expect(envelope).toMatchObject({
      appId: "test-app",
      schemaVersion: 1,
      dataVersion: 1,
      deviceId: "device-1",
      payload: { items: [] },
      sync: { dirty: false, lastCloudVersion: null, syncStatus: "idle" },
    });
    expect(storage.getItem("app:test-app:data")).not.toBeNull();
  });

  it("业务更新递增版本、设置 dirty，并可刷新恢复", async () => {
    const storage = new MemoryStorage();
    const first = createRepository(storage);
    await first.load();
    const updated = await first.update((payload) => ({
      items: [...payload.items, "first"],
    }));
    const refreshed = await createRepository(storage).load();

    expect(updated.dataVersion).toBe(2);
    expect(updated.sync).toMatchObject({
      dirty: true,
      lastSyncCommitId: null,
      syncStatus: "pending",
    });
    expect(refreshed.payload.items).toEqual(["first"]);
  });

  it("导出排除设备与同步元数据，导入前自动备份", async () => {
    const storage = new MemoryStorage();
    const repository = createRepository(storage);
    await repository.update(() => ({ items: ["local"] }));
    const exportedRaw = await repository.exportJson();
    const exported = JSON.parse(exportedRaw) as Record<string, unknown>;

    expect(exported.format).toBe("personal-web-seed-export");
    expect(exported).not.toHaveProperty("deviceId");
    expect(exported).not.toHaveProperty("sync");

    await repository.update(() => ({ items: ["newer-local"] }));
    const imported = await repository.importJson(exportedRaw);
    expect(imported.payload.items).toEqual(["local"]);
    expect(imported.dataVersion).toBe(4);
    const backupExport = JSON.parse(
      (await repository.exportLatestBackupJson()) ?? "{}",
    ) as Record<string, unknown>;
    expect(backupExport).toMatchObject({
      appId: "test-app",
      payload: { items: ["newer-local"] },
    });
  });

  it("拒绝导入其它 appId 的文件", async () => {
    const repository = createRepository(new MemoryStorage());
    const raw = JSON.stringify({
      format: "personal-web-seed-export",
      appId: "another-app",
      schemaVersion: 1,
      dataVersion: 1,
      exportedAt: "2026-07-17T08:00:00.000Z",
      payload: { items: [] },
    });
    await expect(repository.importJson(raw)).rejects.toMatchObject({
      code: "DATA_VALIDATION_FAILED",
    });
  });

  it("按顺序迁移旧 schemaVersion 并保存备份", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "app:test-app:data",
      JSON.stringify({
        appId: "test-app",
        schemaVersion: 1,
        dataVersion: 7,
        updatedAt: "2026-07-16T08:00:00.000Z",
        deviceId: "old-device",
        payload: { names: ["migrated"] },
        sync: {
          dirty: false,
          lastRemoteVersion: 7,
          lastSyncedAt: "2026-07-16T08:00:00.000Z",
        },
      }),
    );
    const repository = createRepository(storage, {
      schemaVersion: 2,
      migrations: {
        1: (payload) => {
          const previous = z
            .object({ names: z.array(z.string()) })
            .parse(payload);
          return { items: previous.names };
        },
      },
    });
    const migrated = await repository.load();
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      dataVersion: 8,
      payload: { items: ["migrated"] },
      sync: { dirty: true, lastCloudVersion: 7 },
    });
    expect(storage.getItem("app:test-app:data:backup:latest")).not.toBeNull();
  });

  it("把旧 LocalStorage 正式快照一次性迁入主 Store", async () => {
    const indexedDbMemory = new MemoryStorage();
    const legacyStorage = new MemoryStorage();
    const old = JSON.stringify({
      appId: "test-app",
      schemaVersion: 1,
      dataVersion: 2,
      updatedAt: "2026-07-16T08:00:00.000Z",
      deviceId: "old-device",
      payload: { items: ["legacy"] },
      sync: {
        dirty: true,
        lastRemoteVersion: null,
        lastSyncedAt: null,
      },
    });
    legacyStorage.setItem("app:test-app:data", old);
    const repository = new BrowserLocalDataRepository<TestPayload>({
      appId: "test-app",
      schemaVersion: 1,
      storageKey: "app:test-app:data",
      payloadSchema,
      createDefaultPayload: () => ({ items: [] }),
      store: new StorageKeyValueStore(indexedDbMemory),
      legacyStorage,
      createId: () => "device-1",
    });

    expect((await repository.load()).payload.items).toEqual(["legacy"]);
    expect(legacyStorage.getItem("app:test-app:data")).toBeNull();
    expect(
      indexedDbMemory.getItem("app:test-app:data:localstorage-backup"),
    ).toBe(old);
  });

  it("将容量错误转换为统一 AppError", async () => {
    const repository = createRepository(new QuotaStorage());
    await expect(repository.load()).rejects.toBeInstanceOf(AppError);
    await expect(repository.load()).rejects.toMatchObject({
      code: "LOCAL_STORAGE_QUOTA_EXCEEDED",
    });
  });
});
