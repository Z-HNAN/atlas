import { describe, expect, it } from "vitest";
import { SupabaseCloudAuthGateway } from "../../src/lib/supabase/auth";
import { SyncManager } from "../../src/lib/sync/sync-manager";
import { FakeSupabaseAuthClient } from "../helpers/fake-supabase-auth";
import {
  createSyncRepository,
  MemorySyncCloud,
  type SyncPayload,
} from "../helpers/sync-fixtures";

describe("登录后的云同步生命周期", () => {
  it("未登录保持本地可用，Magic Link 建立会话后首次上传并供另一设备恢复", async () => {
    const authClient = new FakeSupabaseAuthClient();
    const auth = new SupabaseCloudAuthGateway(authClient);
    let authenticated = false;
    auth.subscribe((session) => {
      authenticated = Boolean(session);
    });
    const first = createSyncRepository("device-a");
    first.update(() => ({ items: ["local-before-login"] }));
    expect(first.load().payload.items).toEqual(["local-before-login"]);
    expect(await auth.getSession()).toBeNull();

    await auth.sendMagicLink("user@example.com", "https://portal.example.com/");
    authClient.establishSession();
    expect(authenticated).toBe(true);

    const cloud = new MemorySyncCloud();
    const firstManager = new SyncManager<SyncPayload>({
      repository: first,
      provider: cloud.createProvider(),
      isPayloadEmpty: (payload) => payload.items.length === 0,
    });
    expect(await firstManager.sync()).toMatchObject({ action: "uploaded" });

    const second = createSyncRepository("device-b");
    const secondManager = new SyncManager<SyncPayload>({
      repository: second,
      provider: cloud.createProvider(),
      isPayloadEmpty: (payload) => payload.items.length === 0,
    });
    expect(await secondManager.sync()).toMatchObject({ action: "downloaded" });
    expect(second.load().payload.items).toEqual(["local-before-login"]);
  });
});
