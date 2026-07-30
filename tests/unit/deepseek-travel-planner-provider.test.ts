import { describe, expect, it, vi } from "vitest";
import {
  DeepSeekTravelPlannerProvider,
  parseGeneratedTravelPlan,
} from "../../src/features/trips/providers/deepseek-travel-planner-provider";

const validPlan = {
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
      reason: "标志性山岳。",
      order: 1,
    },
    {
      nameZh: "河口湖",
      nameLocal: "Lake Kawaguchi",
      country: "日本",
      region: "山梨县",
      searchQuery: "Lake Kawaguchi, Japan",
      reason: "湖面景观。",
      order: 2,
    },
  ],
};

const input = {
  prompt: "想进行一次包含山湖的日本自然景观虚拟旅行。",
  region: "日本",
  theme: "自然",
  durationMinutes: 60,
  pointCount: 2,
  preferences: "避开大城市",
};

describe("DeepSeekTravelPlannerProvider", () => {
  it("解析 Markdown JSON 代码块并经过 Zod 校验", () => {
    expect(
      parseGeneratedTravelPlan(
        `\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\``,
      ).title,
    ).toBe("富士山湖海路线");
  });

  it("第一次结果非法时修复重试一次", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"title":"不完整"}' } }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(validPlan) } }],
          }),
          { status: 200 },
        ),
      );
    const provider = new DeepSeekTravelPlannerProvider({
      fetch: request,
      wait: () => Promise.resolve(),
    });

    const result = await provider.execute(input, { apiKey: "secret-key" });

    expect(result.points).toHaveLength(2);
    expect(request).toHaveBeenCalledTimes(2);
    const rawBody = request.mock.calls[1]?.[1]?.body;
    expect(typeof rawBody).toBe("string");
    const secondBody = JSON.parse(
      typeof rawBody === "string" ? rawBody : "{}",
    ) as { messages: Array<{ content: string }> };
    expect(secondBody.messages[1]?.content).toContain("上一次输出没有通过");
    expect(JSON.stringify(secondBody)).not.toContain("secret-key");
  });

  it("拒绝空地点数组和非 JSON 内容", () => {
    expect(() =>
      parseGeneratedTravelPlan(JSON.stringify({ ...validPlan, points: [] })),
    ).toThrow();
    expect(() => parseGeneratedTravelPlan("不是 JSON")).toThrow();
  });
});
