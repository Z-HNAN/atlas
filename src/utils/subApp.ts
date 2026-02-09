import type { SubApp } from "../types";

export const toSubAppId = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "app";

export const getSubAppRoute = (name: string) => `/apps/${toSubAppId(name)}`;

export const isSubAppRouteActive = (pathname: string, app: SubApp) => {
  const route = getSubAppRoute(app.name);
  return pathname === route || pathname.startsWith(`${route}/`);
};
