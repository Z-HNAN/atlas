import { describe, expect, it } from "vitest";
import {
  generatedTravelPlanSchema,
  tripPayloadSchema,
} from "../../src/features/trips/schemas/trip-schema";

const generatedPlan = () => ({
  title: "富士山湖海路线",
  summary: "从山岳飞向海湾。",
  region: "日本关东",
  theme: "自然景观",
  points: [
    {
      nameZh: "富士山",
      nameLocal: "Mount Fuji",
      country: "日本",
      region: "静冈县",
      searchQuery: "Mount Fuji, Japan",
      reason: "标志性山岳景观。",
      order: 1,
    },
    {
      nameZh: "河口湖",
      nameLocal: "Lake Kawaguchi",
      country: "日本",
      region: "山梨县",
      searchQuery: "Lake Kawaguchi, Japan",
      reason: "湖面与山景。",
      order: 2,
    },
  ],
});

describe("旅行计划 Schema", () => {
  it("接受完整且顺序连续的 AI 结果", () => {
    expect(generatedTravelPlanSchema.safeParse(generatedPlan()).success).toBe(
      true,
    );
  });

  it("拒绝缺少字段、空地点和非法字符串", () => {
    expect(
      generatedTravelPlanSchema.safeParse({ ...generatedPlan(), title: "" })
        .success,
    ).toBe(false);
    expect(
      generatedTravelPlanSchema.safeParse({
        ...generatedPlan(),
        points: [],
      }).success,
    ).toBe(false);
    expect(
      generatedTravelPlanSchema.safeParse({
        ...generatedPlan(),
        points: [{ ...generatedPlan().points[0], searchQuery: "" }],
      }).success,
    ).toBe(false);
  });

  it("拒绝重复或不连续的 order", () => {
    const duplicate = generatedPlan();
    duplicate.points[1]!.order = 1;
    expect(generatedTravelPlanSchema.safeParse(duplicate).success).toBe(false);

    const gap = generatedPlan();
    gap.points[1]!.order = 3;
    expect(generatedTravelPlanSchema.safeParse(gap).success).toBe(false);
  });
});

describe("旅行 Payload Schema", () => {
  it("拒绝重复旅行 ID", () => {
    const timestamp = "2026-07-30T00:00:00.000Z";
    const trip = {
      id: "same",
      title: "草稿",
      summary: "",
      region: "",
      theme: "",
      status: "draft" as const,
      rating: null,
      notes: "",
      createdAt: timestamp,
      startedAt: null,
      completedAt: null,
      updatedAt: timestamp,
      points: [],
    };
    expect(
      tripPayloadSchema.safeParse({
        trips: [trip, trip],
        geocodeCache: [],
      }).success,
    ).toBe(false);
  });
});
