import { describe, expect, it } from "vitest";
import { SupabaseCloudAuthGateway } from "../../src/lib/supabase/auth";
import {
  FakeSupabaseAuthClient,
  testSession,
} from "../helpers/fake-supabase-auth";

describe("SupabaseCloudAuthGateway", () => {
  it("发送 Magic Link、监听会话并退出", async () => {
    const client = new FakeSupabaseAuthClient();
    const gateway = new SupabaseCloudAuthGateway(client);
    const sessions: Array<string | null> = [];
    const unsubscribe = gateway.subscribe((session) => {
      sessions.push(session?.user.id ?? null);
    });

    expect(await gateway.getSession()).toBeNull();
    await gateway.sendMagicLink(
      " user@example.com ",
      "https://portal.example.com/",
    );
    expect(client.magicLinkInput).toEqual({
      email: "user@example.com",
      options: { emailRedirectTo: "https://portal.example.com/" },
    });

    client.establishSession(testSession);
    expect(sessions).toEqual([testSession.user.id]);
    expect(await gateway.getSession()).toEqual(testSession);

    await gateway.signOut();
    expect(sessions).toEqual([testSession.user.id, null]);
    expect(client.signedOut).toBe(true);
    unsubscribe();
    expect(client.unsubscribed).toBe(true);
  });

  it("发送前拒绝非法邮箱", async () => {
    const client = new FakeSupabaseAuthClient();
    const gateway = new SupabaseCloudAuthGateway(client);

    await expect(
      gateway.sendMagicLink("not-an-email", "https://portal.example.com/"),
    ).rejects.toMatchObject({ code: "DATA_VALIDATION_FAILED" });
    expect(client.magicLinkInput).toBeNull();
  });
});
