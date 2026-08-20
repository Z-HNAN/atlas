import { describe, expect, it } from "vitest";
import { getPageTitle } from "../../src/app/page-title";
import type { Trip } from "../../src/features/trips/types/trips";

const trip = {
  id: "trip-1",
  title: "富士山环线",
} as Trip;

describe("页面标题", () => {
  it.each([
    ["/", "首页 · Atlas"],
    ["/atlas", "世界地图 · Atlas"],
    ["/trips", "旅行收藏 · Atlas"],
    ["/trips/new", "新建旅行 · Atlas"],
    ["/settings/", "设置 · Atlas"],
    ["/login", "登录 · Atlas"],
  ])("为 %s 返回对应中文标题", (pathname, expected) => {
    expect(getPageTitle(pathname, [trip])).toBe(expected);
  });

  it("旅行详情优先显示旅行名称", () => {
    expect(getPageTitle("/trips/trip-1", [trip])).toBe("富士山环线 · Atlas");
    expect(getPageTitle("/trips/missing", [trip])).toBe("旅行详情 · Atlas");
  });

  it("未知路由显示页面不存在", () => {
    expect(getPageTitle("/missing", [trip])).toBe("页面不存在 · Atlas");
  });
});
