import { describe, expect, it } from "vitest";
import { BrowserApiKeyStore } from "../../src/lib/api-keys/api-key-store";
import { MemoryStorage } from "../helpers/memory-storage";

describe("BrowserApiKeyStore", () => {
  it("默认写入 sessionStorage", () => {
    const session = new MemoryStorage();
    const persistent = new MemoryStorage();
    const store = new BrowserApiKeyStore(session, persistent, "test:key:");

    store.setSession("deepseek", " session-key ");

    expect(store.get("deepseek")).toBe("session-key");
    expect(session.getItem("test:key:deepseek")).toBe("session-key");
    expect(persistent.getItem("test:key:deepseek")).toBeNull();
  });

  it("只有显式选择持久化时写入 LocalStorage", () => {
    const session = new MemoryStorage();
    const persistent = new MemoryStorage();
    const store = new BrowserApiKeyStore(session, persistent, "test:key:");
    store.setSession("deepseek", "temporary");

    store.setPersistent("deepseek", "remembered");

    expect(session.getItem("test:key:deepseek")).toBeNull();
    expect(persistent.getItem("test:key:deepseek")).toBe("remembered");
  });

  it("clearAll 只清理由当前 Store 管理的 Key", () => {
    const session = new MemoryStorage();
    const persistent = new MemoryStorage();
    const store = new BrowserApiKeyStore(session, persistent, "test:key:");
    store.setSession("deepseek", "temporary");
    persistent.setItem("unrelated", "keep");

    store.clearAll();

    expect(store.get("deepseek")).toBeNull();
    expect(persistent.getItem("unrelated")).toBe("keep");
  });
});
