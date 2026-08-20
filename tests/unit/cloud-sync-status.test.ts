import { describe, expect, it } from "vitest";
import { getInitialCloudSyncStatus } from "../../src/lib/sync/use-cloud-sync";

describe("云同步初始状态", () => {
  it("云能力可用时等待用户主动检查，不进入自动检查状态", () => {
    expect(getInitialCloudSyncStatus(true, true)).toBe("signed-out");
  });

  it("保留关闭和配置缺失状态", () => {
    expect(getInitialCloudSyncStatus(false, true)).toBe("disabled");
    expect(getInitialCloudSyncStatus(true, false)).toBe("config-required");
  });
});
