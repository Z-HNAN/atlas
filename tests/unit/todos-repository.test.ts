import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../../src/config/app-config";
import { createTodosRepository } from "../../src/features/todos/repository/todos-repository";
import { AppError } from "../../src/lib/errors/app-error";
import { MemoryStorage } from "../helpers/memory-storage";

const now = () => new Date("2026-07-17T08:00:00.000Z");

describe("Todo 旧数据迁移", () => {
  it("把 schemaVersion 1 的应用导航快照迁移为待办并先备份", () => {
    const storage = new MemoryStorage();
    const previous = {
      appId: APP_CONFIG.appId,
      schemaVersion: 1,
      dataVersion: 7,
      updatedAt: "2026-07-16T08:00:00.000Z",
      deviceId: "old-device",
      payload: {
        apps: [
          {
            id: "app-1",
            name: "文档中心",
            url: "https://example.com/docs",
          },
        ],
      },
      sync: {
        dirty: false,
        lastRemoteVersion: 7,
        lastSyncedAt: "2026-07-16T08:00:00.000Z",
      },
    };
    storage.setItem(APP_CONFIG.storageKey, JSON.stringify(previous));

    const repository = createTodosRepository({ storage, now });
    const envelope = repository.load();

    expect(envelope.schemaVersion).toBe(2);
    expect(envelope.dataVersion).toBe(8);
    expect(envelope.sync.dirty).toBe(true);
    expect(envelope.payload.todos).toEqual([
      expect.objectContaining({
        id: "app-1",
        title: "迁移的应用：文档中心",
        notes: "旧名称：文档中心\n旧入口：https://example.com/docs",
        completed: false,
      }),
    ]);
    expect(storage.getItem(`${APP_CONFIG.storageKey}:backup:latest`)).toBe(
      JSON.stringify(previous),
    );
  });

  it("迁移裸 gipsy-apps 数据并保留 legacy backup", () => {
    const storage = new MemoryStorage();
    const legacy = JSON.stringify([
      { name: "示例应用", url: "https://example.com/" },
    ]);
    storage.setItem("gipsy-apps", legacy);
    const repository = createTodosRepository({
      storage,
      createId: () => "todo-1",
      now,
    });

    const envelope = repository.load();

    expect(envelope.payload.todos[0]).toMatchObject({
      id: "todo-1",
      title: "迁移的应用：示例应用",
      completed: false,
    });
    expect(envelope.sync.dirty).toBe(true);
    expect(storage.getItem("gipsy-apps")).toBeNull();
    expect(storage.getItem(`${APP_CONFIG.storageKey}:legacy-backup`)).toBe(
      legacy,
    );
  });

  it("旧数据无效时保留原始键且不创建正式数据", () => {
    const storage = new MemoryStorage();
    storage.setItem("gipsy-apps", "not-json");
    const repository = createTodosRepository({ storage });

    try {
      repository.load();
      throw new Error("预期旧数据迁移失败");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      if (error instanceof AppError) {
        expect(error.code).toBe("DATA_MIGRATION_FAILED");
      }
    }
    expect(storage.getItem("gipsy-apps")).toBe("not-json");
    expect(storage.getItem(APP_CONFIG.storageKey)).toBeNull();
  });
});
