import type { Trip } from "../features/trips/types/trips";

const STATIC_PAGE_TITLES: Record<string, string> = {
  "/": "首页",
  "/atlas": "世界地图",
  "/trips": "旅行收藏",
  "/trips/new": "新建旅行",
  "/settings": "设置",
  "/login": "登录",
};

const withBrand = (title: string) => `${title} · Atlas`;

export const getPageTitle = (pathname: string, trips: Trip[] = []) => {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, "") : "/";
  const staticTitle = STATIC_PAGE_TITLES[normalized];
  if (staticTitle) return withBrand(staticTitle);

  const tripMatch = /^\/trips\/([^/]+)$/u.exec(normalized);
  if (tripMatch?.[1]) {
    const tripId = decodeURIComponent(tripMatch[1]);
    return withBrand(
      trips.find((trip) => trip.id === tripId)?.title || "旅行详情",
    );
  }

  return withBrand("页面不存在");
};
