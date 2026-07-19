import { describe, expect, it } from "vitest";
import {
  getStorageSizeInfo,
  STORAGE_CRITICAL_BYTES,
  STORAGE_WARNING_BYTES,
} from "../../src/lib/local-data/storage-size";

describe("本地数据容量分级", () => {
  it("按 2 MB 和 4 MB 阈值给出状态", () => {
    expect(getStorageSizeInfo("small").level).toBe("normal");
    expect(getStorageSizeInfo("a".repeat(STORAGE_WARNING_BYTES)).level).toBe(
      "warning",
    );
    expect(
      getStorageSizeInfo("a".repeat(STORAGE_CRITICAL_BYTES + 1)).level,
    ).toBe("critical");
  });
});
