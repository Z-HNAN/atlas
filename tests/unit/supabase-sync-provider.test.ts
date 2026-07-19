import { describe, expect, it } from "vitest";
import {
  SupabaseSyncProvider,
  type SnapshotGateway,
} from "../../src/lib/sync/supabase-sync-provider";

const userId = "00000000-0000-4000-8000-000000000001";
const row = (dataVersion: number, payload: unknown) => ({
  user_id: userId,
  app_id: "test-app",
  schema_version: 1,
  data_version: dataVersion,
  payload,
  device_id: "device-a",
  updated_at: "2026-07-17T08:00:00.000Z",
});

describe("SupabaseSyncProvider", () => {
  it("首次上传使用 insert，更新时使用 expectedRemoteVersion 乐观锁", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const gateway: SnapshotGateway = {
      get: () => Promise.resolve({ data: null, error: null }),
      insert: (input) => {
        calls.push({ type: "insert", ...input });
        return Promise.resolve({
          data: row(input.data_version, input.payload),
          error: null,
        });
      },
      update: (_userId, _appId, expectedVersion, patch) => {
        calls.push({ type: "update", expectedVersion, ...patch });
        return Promise.resolve({
          data: row(patch.data_version, patch.payload),
          error: null,
        });
      },
      remove: () => Promise.resolve({ data: null, error: null }),
    };
    const provider = new SupabaseSyncProvider<{ items: string[] }>({
      userId,
      appId: "test-app",
      gateway,
    });

    const inserted = await provider.push({
      payload: { items: ["first"] },
      schemaVersion: 1,
      dataVersion: 1,
      expectedRemoteVersion: null,
      deviceId: "device-a",
    });
    const updated = await provider.push({
      payload: { items: ["second"] },
      schemaVersion: 1,
      dataVersion: 1,
      expectedRemoteVersion: 4,
      deviceId: "device-a",
    });

    expect(inserted.dataVersion).toBe(1);
    expect(updated.dataVersion).toBe(5);
    expect(calls).toEqual([
      expect.objectContaining({ type: "insert", data_version: 1 }),
      expect.objectContaining({
        type: "update",
        expectedVersion: 4,
        data_version: 5,
      }),
    ]);
  });

  it("带版本条件的 update 返回零行时转换为版本冲突", async () => {
    const gateway: SnapshotGateway = {
      get: () => Promise.resolve({ data: row(2, {}), error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      remove: () => Promise.resolve({ data: null, error: null }),
    };
    const provider = new SupabaseSyncProvider<Record<string, never>>({
      userId,
      appId: "test-app",
      gateway,
    });

    await expect(
      provider.push({
        payload: {},
        schemaVersion: 1,
        dataVersion: 3,
        expectedRemoteVersion: 2,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "REMOTE_VERSION_MISMATCH" });
  });

  it("拒绝不属于当前用户的返回行", async () => {
    const gateway: SnapshotGateway = {
      get: () =>
        Promise.resolve({
          data: {
            ...row(1, {}),
            user_id: "00000000-0000-4000-8000-000000000002",
          },
          error: null,
        }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      remove: () => Promise.resolve({ data: null, error: null }),
    };
    const provider = new SupabaseSyncProvider<Record<string, never>>({
      userId,
      appId: "test-app",
      gateway,
    });

    await expect(provider.pull()).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });
});
