import { describe, expect, it } from "vitest";
import { shouldAutoSync } from "../../src/lib/sync/auto-sync";

describe("自动同步准入规则", () => {
  const ready = {
    enabled: true,
    authenticated: true,
    online: true,
    dirty: true,
    hasConflict: false,
  };

  it("仅在开启、登录、在线、dirty 且无冲突时允许上传", () => {
    expect(shouldAutoSync(ready)).toBe(true);
    expect(shouldAutoSync({ ...ready, enabled: false })).toBe(false);
    expect(shouldAutoSync({ ...ready, authenticated: false })).toBe(false);
    expect(shouldAutoSync({ ...ready, online: false })).toBe(false);
    expect(shouldAutoSync({ ...ready, dirty: false })).toBe(false);
    expect(shouldAutoSync({ ...ready, hasConflict: true })).toBe(false);
  });
});
