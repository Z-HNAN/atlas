import { describe, expect, it } from "vitest";
import { AppError } from "../../src/lib/errors/app-error";
import { BrowserSyncPreferencesStore } from "../../src/lib/sync/sync-preferences";
import { MemoryStorage } from "../helpers/memory-storage";

describe("BrowserSyncPreferencesStore", () => {
  it("默认关闭，并按 appId 独立保存", () => {
    const storage = new MemoryStorage();
    const first = new BrowserSyncPreferencesStore("first", storage);
    const second = new BrowserSyncPreferencesStore("second", storage);

    expect(first.load()).toEqual({ autoSync: false });
    first.save({ autoSync: true });
    expect(first.load()).toEqual({ autoSync: true });
    expect(second.load()).toEqual({ autoSync: false });
  });

  it("拒绝损坏的设置数据", () => {
    const storage = new MemoryStorage();
    storage.setItem("app:first:sync-preferences", '{"autoSync":"yes"}');
    const store = new BrowserSyncPreferencesStore("first", storage);

    expect(() => store.load()).toThrow(AppError);
  });
});
