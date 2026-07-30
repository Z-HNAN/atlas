import { APP_CONFIG } from "../../../config/app-config";
import { BrowserLocalDataRepository } from "../../../lib/local-data/local-data-repository";
import { tripPayloadSchema } from "../schemas/trip-schema";
import type { Trip, TripPayload } from "../types/trips";

interface TripsRepositoryDependencies {
  storage?: Storage;
  now?: () => Date;
  createId?: () => string;
  includeDemo?: boolean;
}

const createDemoTrip = (timestamp: string): Trip => {
  const coordinates = [
    ["富士山", "Mount Fuji", 35.3606, 138.7274, "日本最高峰与标志性火山景观。"],
    [
      "河口湖",
      "Lake Kawaguchi",
      35.5171,
      138.7518,
      "从湖面方向欣赏富士山倒影。",
    ],
    ["箱根", "Hakone", 35.2324, 139.1069, "穿越山谷、湖泊与温泉小镇。"],
    ["东京湾", "Tokyo Bay", 35.4806, 139.8098, "以开阔海湾作为路线终点。"],
  ] as const;

  return {
    id: "demo-fuji-route",
    title: "示例计划 · 富士山到东京湾",
    summary: "一条用于验证地图、到访记录和 Sky4Sim PLN 导出的示例目视路线。",
    region: "日本关东",
    theme: "山湖与海湾",
    status: "planned",
    rating: null,
    notes: "这是内置示例，可自由编辑或删除。",
    createdAt: timestamp,
    startedAt: null,
    completedAt: null,
    updatedAt: timestamp,
    points: coordinates.map(([nameZh, nameLocal, lat, lng, reason], index) => ({
      id: `demo-fuji-point-${index + 1}`,
      orderIndex: index,
      nameZh,
      nameLocal,
      country: "日本",
      region: "关东",
      searchQuery: `${nameLocal}, Japan`,
      reason,
      lat,
      lng,
      geocodeDisplayName: `${nameLocal}, Japan`,
      geocodeStatus: "resolved" as const,
      visited: false,
      pointNote: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  };
};

export const createTripsRepository = (
  dependencies: TripsRepositoryDependencies = {},
) => {
  const now = dependencies.now ?? (() => new Date());
  const timestamp = now().toISOString();

  return new BrowserLocalDataRepository<TripPayload>({
    appId: APP_CONFIG.appId,
    schemaVersion: APP_CONFIG.schemaVersion,
    storageKey: APP_CONFIG.storageKey,
    payloadSchema: tripPayloadSchema,
    createDefaultPayload: () => ({
      trips:
        dependencies.includeDemo === false ? [] : [createDemoTrip(timestamp)],
      geocodeCache: [],
    }),
    storage: dependencies.storage,
    now,
    createId: dependencies.createId,
  });
};
