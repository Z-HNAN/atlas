import { describe, expect, it } from "vitest";
import { hasUnsavedTripChanges } from "../../src/features/trips/unsaved-changes";
import type { Trip } from "../../src/features/trips/types/trips";

const source: Trip = {
  id: "trip-1",
  title: "富士山环线",
  summary: "围绕富士山的调试路线。",
  region: "日本",
  theme: "自然景观",
  status: "draft",
  rating: null,
  notes: "",
  createdAt: "2026-08-20T08:00:00.000Z",
  points: [],
  startedAt: null,
  completedAt: null,
  updatedAt: "2026-08-20T08:00:00.000Z",
};

describe("旅行未保存判断", () => {
  it("相同内容视为已保存", () => {
    expect(hasUnsavedTripChanges(source, structuredClone(source))).toBe(false);
  });

  it("任一草稿内容变化都视为未保存", () => {
    expect(
      hasUnsavedTripChanges(source, {
        ...source,
        title: "新的富士山路线",
        updatedAt: "2026-08-20T08:01:00.000Z",
      }),
    ).toBe(true);
  });

  it("没有对应持久化旅行时不拦截", () => {
    expect(hasUnsavedTripChanges(undefined, source)).toBe(false);
    expect(hasUnsavedTripChanges(source, null)).toBe(false);
  });
});
