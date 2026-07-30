import { z } from "zod";

export const tripStatusSchema = z.enum([
  "draft",
  "planned",
  "in_progress",
  "completed",
]);

export const geocodeStatusSchema = z.enum([
  "pending",
  "resolved",
  "ambiguous",
  "failed",
]);

const nullableCoordinate = z.number().finite().nullable();

export const travelPointSchema = z
  .object({
    id: z.string().min(1),
    orderIndex: z.number().int().nonnegative(),
    nameZh: z.string().trim().min(1, "地点中文名不能为空。").max(120),
    nameLocal: z.string().trim().max(160),
    country: z.string().trim().max(100),
    region: z.string().trim().max(120),
    searchQuery: z.string().trim().min(1, "地点搜索词不能为空。").max(240),
    reason: z.string().trim().max(600),
    lat: nullableCoordinate.refine(
      (value) => value === null || (value >= -90 && value <= 90),
      "纬度必须在 -90 到 90 之间。",
    ),
    lng: nullableCoordinate.refine(
      (value) => value === null || (value >= -180 && value <= 180),
      "经度必须在 -180 到 180 之间。",
    ),
    geocodeDisplayName: z.string().trim().max(500),
    geocodeStatus: geocodeStatusSchema,
    visited: z.boolean(),
    pointNote: z.string().trim().max(600),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((point, context) => {
    const hasCoordinates = point.lat !== null && point.lng !== null;
    if ((point.lat === null) !== (point.lng === null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lat"],
        message: "纬度和经度必须同时填写。",
      });
    }
    if (point.geocodeStatus === "resolved" && !hasCoordinates) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["geocodeStatus"],
        message: "已确认地点必须包含完整坐标。",
      });
    }
  });

export const tripSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1, "旅行标题不能为空。").max(160),
    summary: z.string().trim().max(1200),
    region: z.string().trim().max(120),
    theme: z.string().trim().max(120),
    status: tripStatusSchema,
    rating: z.number().int().min(1).max(10).nullable(),
    notes: z.string().trim().max(3000),
    createdAt: z.string().datetime(),
    startedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    updatedAt: z.string().datetime(),
    points: z.array(travelPointSchema).max(50),
  })
  .strict()
  .superRefine((trip, context) => {
    const pointIds = new Set<string>();
    const orderIndexes = new Set<number>();
    trip.points.forEach((point, index) => {
      if (pointIds.has(point.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["points", index, "id"],
          message: "旅行地点 ID 不能重复。",
        });
      }
      if (orderIndexes.has(point.orderIndex)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["points", index, "orderIndex"],
          message: "旅行地点顺序不能重复。",
        });
      }
      pointIds.add(point.id);
      orderIndexes.add(point.orderIndex);
    });
    if (trip.status !== "draft") {
      if (trip.points.length < 2) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["points"],
          message: "确认旅行至少需要两个地点。",
        });
      }
      trip.points.forEach((point, index) => {
        if (point.geocodeStatus !== "resolved") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["points", index, "geocodeStatus"],
            message: "确认旅行前必须确认所有地点坐标。",
          });
        }
      });
    }
    if (trip.status === "completed" && !trip.completedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["completedAt"],
        message: "已完成旅行必须记录完成时间。",
      });
    }
  });

export const geocodeCacheEntrySchema = z
  .object({
    queryKey: z.string().min(1),
    queryText: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    displayName: z.string().min(1).max(500),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const tripPayloadSchema = z
  .object({
    trips: z.array(tripSchema),
    geocodeCache: z.array(geocodeCacheEntrySchema).max(1000),
  })
  .strict()
  .superRefine(({ trips, geocodeCache }, context) => {
    const tripIds = new Set<string>();
    trips.forEach((trip, index) => {
      if (tripIds.has(trip.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["trips", index, "id"],
          message: "旅行 ID 不能重复。",
        });
      }
      tripIds.add(trip.id);
    });
    const keys = new Set<string>();
    geocodeCache.forEach((entry, index) => {
      if (keys.has(entry.queryKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["geocodeCache", index, "queryKey"],
          message: "地理编码缓存键不能重复。",
        });
      }
      keys.add(entry.queryKey);
    });
  });

export const travelPlanInputSchema = z
  .object({
    prompt: z
      .string()
      .trim()
      .min(10, "请至少用 10 个字符描述旅行想法。")
      .max(2000),
    region: z.string().trim().max(120),
    theme: z.string().trim().max(120),
    durationMinutes: z.number().int().min(15).max(480),
    pointCount: z.number().int().min(2).max(12),
    preferences: z.string().trim().max(600),
  })
  .strict();

export const generatedTravelPointSchema = z
  .object({
    nameZh: z.string().trim().min(1).max(120),
    nameLocal: z.string().trim().max(160).optional().default(""),
    country: z.string().trim().max(100).optional().default(""),
    region: z.string().trim().max(120).optional().default(""),
    searchQuery: z.string().trim().min(1).max(240),
    reason: z.string().trim().min(1).max(600),
    order: z.number().int().positive(),
  })
  .strict();

export const generatedTravelPlanSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1).max(1200),
    region: z.string().trim().max(120).optional().default(""),
    theme: z.string().trim().max(120).optional().default(""),
    points: z.array(generatedTravelPointSchema).min(2).max(12),
  })
  .strict()
  .superRefine(({ points }, context) => {
    const orders = new Set<number>();
    points.forEach((point, index) => {
      if (orders.has(point.order)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["points", index, "order"],
          message: "AI 返回的地点顺序不能重复。",
        });
      }
      orders.add(point.order);
    });
    const sorted = [...orders].sort((a, b) => a - b);
    if (sorted.some((value, index) => value !== index + 1)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["points"],
        message: "AI 返回的地点顺序必须从 1 连续编号。",
      });
    }
  });

export const tripDraftSchema = z
  .object({
    title: z.string().trim().min(1, "请填写旅行标题。").max(160),
    summary: z.string().trim().max(1200),
    region: z.string().trim().max(120),
    theme: z.string().trim().max(120),
  })
  .strict();
