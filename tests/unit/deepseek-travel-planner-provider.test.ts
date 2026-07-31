import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DeepSeekTravelPlannerProvider,
  parseGeneratedTravelPlan,
} from "../../src/features/trips/providers/deepseek-travel-planner-provider";
import { AppError } from "../../src/lib/errors/app-error";
import {
  BrowserHttpError,
  type BrowserHttpClient,
} from "../../src/lib/http/browser-http-client";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

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
      .fn<BrowserHttpClient["request"]>()
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
      httpClient: { request },
      wait: () => Promise.resolve(),
    });

    const result = await provider.execute(input, { apiKey: "secret-key" });

    expect(result.points).toHaveLength(2);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toBe(
      "https://api.deepseek.com/chat/completions",
    );
    const rawBody = request.mock.calls[1]?.[1]?.body;
    expect(typeof rawBody).toBe("string");
    const secondBody = JSON.parse(
      typeof rawBody === "string" ? rawBody : "{}",
    ) as {
      messages: Array<{ content: string }>;
      model: string;
      thinking: { type: string };
    };
    expect(secondBody.model).toBe("deepseek-v4-pro");
    expect(secondBody.thinking.type).toBe("disabled");
    expect(secondBody.messages[1]?.content).toContain("上一次输出没有通过");
    expect(JSON.stringify(secondBody)).not.toContain("secret-key");
    const headers = new Headers(request.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer secret-key");
  });

  it("拒绝空地点数组和非 JSON 内容", () => {
    expect(() =>
      parseGeneratedTravelPlan(JSON.stringify({ ...validPlan, points: [] })),
    ).toThrow();
    expect(() => parseGeneratedTravelPlan("不是 JSON")).toThrow();
  });

  it("以 globalThis 为接收者调用浏览器原生 fetch", async () => {
    const request = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(validPlan) } }],
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", request);
    const provider = new DeepSeekTravelPlannerProvider();

    await provider.execute(input, { apiKey: "secret-key" });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("网络层 TypeError 不武断归因为 CORS", async () => {
    const provider = new DeepSeekTravelPlannerProvider({
      httpClient: {
        request: vi
          .fn<BrowserHttpClient["request"]>()
          .mockRejectedValue(new BrowserHttpError("network")),
      },
    });

    const caught: unknown = await provider
      .execute(input, { apiKey: "secret-key" })
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(AppError);
    if (!(caught instanceof AppError)) throw caught;
    expect(caught.code).toBe("NETWORK_ERROR");
    expect(caught.message).toContain("未收到 HTTP 响应");
  });

  it.each([
    [400, "API_CONFIGURATION_ERROR", "模型或请求配置"],
    [404, "API_CONFIGURATION_ERROR", "模型或请求配置"],
    [401, "PERMISSION_DENIED", "API Key 无效"],
    [402, "PERMISSION_DENIED", "余额不足"],
    [403, "PERMISSION_DENIED", "无权使用"],
    [429, "RATE_LIMITED", "请求过于频繁"],
    [500, "NETWORK_ERROR", "服务暂时不可用"],
  ])("将 HTTP %i 映射为脱敏错误", async (status, code, message) => {
    const request = vi
      .fn<BrowserHttpClient["request"]>()
      .mockResolvedValue(new Response("third-party detail", { status }));
    const provider = new DeepSeekTravelPlannerProvider({
      httpClient: { request },
      wait: () => Promise.resolve(),
    });

    const caught: unknown = await provider
      .execute(input, { apiKey: "secret-key" })
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(AppError);
    if (!(caught instanceof AppError)) throw caught;
    expect(caught.code).toBe(code);
    expect(caught.message).toContain(message);
    expect(caught.message).not.toContain("third-party detail");
  });
});
