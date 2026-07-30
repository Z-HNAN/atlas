import { describe, expect, it } from "vitest";
import { createTripsRepository } from "../../src/features/trips/repository/trips-repository";
import { MemoryStorage } from "../helpers/memory-storage";

describe("本地旅行生命周期", () => {
  it("离线创建、刷新恢复、导出与重置均保持严格 Envelope", () => {
    const storage = new MemoryStorage();
    const dependencies = {
      storage,
      includeDemo: false,
      now: () => new Date("2026-07-30T00:00:00.000Z"),
      createId: () => "device",
    };
    const repository = createTripsRepository(dependencies);
    const initial = repository.load();
    expect(initial.payload.trips).toEqual([]);
    expect(initial.sync.dirty).toBe(false);

    const updated = repository.update((payload) => ({
      ...payload,
      trips: [
        {
          id: "trip-1",
          title: "本地测试旅行",
          summary: "",
          region: "",
          theme: "",
          status: "draft",
          rating: null,
          notes: "",
          createdAt: "2026-07-30T00:00:00.000Z",
          startedAt: null,
          completedAt: null,
          updatedAt: "2026-07-30T00:00:00.000Z",
          points: [],
        },
      ],
    }));
    expect(updated.dataVersion).toBe(2);
    expect(updated.sync.dirty).toBe(true);

    const refreshed = createTripsRepository(dependencies).load();
    expect(refreshed.payload.trips[0]?.title).toBe("本地测试旅行");
    expect(repository.exportJson()).not.toContain("api-key");

    const reset = repository.reset();
    expect(reset.dataVersion).toBe(3);
    expect(reset.payload.trips).toEqual([]);
    expect(repository.getLatestBackupJson()).not.toBeNull();
  });
});
