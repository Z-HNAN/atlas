import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { isQuotaExceededError } from "../../src/lib/errors/app-error";
import { DexieKeyValueStore } from "../../src/lib/local-data/key-value-store";

const databaseNames: string[] = [];

const createStore = () => {
  const databaseName = `atlas-key-value-${crypto.randomUUID()}`;
  databaseNames.push(databaseName);
  return new DexieKeyValueStore(databaseName);
};

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

describe("DexieKeyValueStore", () => {
  it("在新的 IndexedDB 中完成字符串记录的读写和删除", async () => {
    const store = createStore();

    expect(await store.get("app:test:data")).toBeNull();
    await store.set("app:test:data", '{"version":1}');
    expect(await store.get("app:test:data")).toBe('{"version":1}');
    await store.remove("app:test:data");
    expect(await store.get("app:test:data")).toBeNull();

    store.close();
  });

  it("拒绝绕过适配层写入的非字符串记录", async () => {
    const databaseName = `atlas-invalid-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);
    const database = new Dexie(databaseName);
    database.version(1).stores({ records: "" });
    await database.table("records").put({ invalid: true }, "app:test:data");
    database.close();

    const store = new DexieKeyValueStore(databaseName);
    await expect(store.get("app:test:data")).rejects.toMatchObject({
      code: "DATA_VALIDATION_FAILED",
    });

    store.close();
  });

  it("识别 Dexie 包装后的配额错误", () => {
    const error = new Error("空间不足");
    error.name = "QuotaExceededError";

    expect(isQuotaExceededError(error)).toBe(true);
  });
});
