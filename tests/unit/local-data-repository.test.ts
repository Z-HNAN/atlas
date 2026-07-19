import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../../src/lib/errors/app-error";
import { BrowserLocalDataRepository } from "../../src/lib/local-data/local-data-repository";
import { MemoryStorage, QuotaStorage } from "../helpers/memory-storage";

const payloadSchema = z
  .object({
    items: z.array(z.string()),
  })
  .strict();

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
  it("创建并持久化默认 Envelope", () => {
    const storage = new MemoryStorage();
    const repository = createRepository(storage);

    const envelope = repository.load();

    expect(envelope).toMatchObject({
      appId: "test-app",
      schemaVersion: 1,
      dataVersion: 1,
      deviceId: "device-1",
      payload: { items: [] },
      sync: { dirty: false },
    });
    expect(storage.getItem("app:test-app:data")).not.toBeNull();
  });

  it("业务更新递增 dataVersion 并设置 dirty，刷新后可以恢复", () => {
    const storage = new MemoryStorage();
    const firstRepository = createRepository(storage);
    firstRepository.load();

    const updated = firstRepository.update((payload) => ({
      items: [...payload.items, "first"],
    }));
    const refreshed = createRepository(storage).load();

    expect(updated.dataVersion).toBe(2);
    expect(updated.sync.dirty).toBe(true);
    expect(refreshed.payload.items).toEqual(["first"]);
  });

  it("导出不包含设备和同步元数据，导入前自动备份", () => {
    const storage = new MemoryStorage();
    const repository = createRepository(storage);
    repository.update(() => ({ items: ["local"] }));
    const exportedRaw = repository.exportJson();
    const exported = JSON.parse(exportedRaw) as Record<string, unknown>;

    expect(exported.format).toBe("personal-web-seed-export");
    expect(exported).not.toHaveProperty("deviceId");
    expect(exported).not.toHaveProperty("sync");

    repository.update(() => ({ items: ["newer-local"] }));
    const imported = repository.importJson(exportedRaw);

    expect(imported.payload.items).toEqual(["local"]);
    expect(imported.dataVersion).toBe(4);
    expect(imported.sync.dirty).toBe(true);
    expect(storage.getItem("app:test-app:data:backup:latest")).not.toBeNull();
    const backupExport = JSON.parse(
      repository.exportLatestBackupJson() ?? "{}",
    ) as Record<string, unknown>;
    expect(backupExport).toMatchObject({
      format: "personal-web-seed-export",
      appId: "test-app",
      payload: { items: ["newer-local"] },
    });
    expect(backupExport).not.toHaveProperty("deviceId");
    expect(backupExport).not.toHaveProperty("sync");
  });

  it("拒绝导入其它 appId 的文件", () => {
    const storage = new MemoryStorage();
    const repository = createRepository(storage);
    const raw = JSON.stringify({
      format: "personal-web-seed-export",
      appId: "another-app",
      schemaVersion: 1,
      dataVersion: 1,
      exportedAt: "2026-07-17T08:00:00.000Z",
      payload: { items: [] },
    });

    try {
      repository.importJson(raw);
      throw new Error("预期导入被拒绝");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      if (error instanceof AppError) {
        expect(error.code).toBe("DATA_VALIDATION_FAILED");
      }
    }
  });

  it("按顺序迁移旧 schemaVersion 并保存迁移备份", () => {
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

    const migrated = repository.load();

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.dataVersion).toBe(8);
    expect(migrated.payload.items).toEqual(["migrated"]);
    expect(migrated.sync.dirty).toBe(true);
    expect(storage.getItem("app:test-app:data:backup:latest")).not.toBeNull();
  });

  it("将 LocalStorage 配额错误转换为统一 AppError", () => {
    const repository = createRepository(new QuotaStorage());

    try {
      repository.load();
      throw new Error("预期 load 抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("LOCAL_STORAGE_QUOTA_EXCEEDED");
    }
  });
});
