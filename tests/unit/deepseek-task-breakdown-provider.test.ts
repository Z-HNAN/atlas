import { describe, expect, it } from "vitest";
import { DeepSeekTaskBreakdownProvider } from "../../src/features/todos/providers/deepseek-task-breakdown-provider";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const completion = (content: string) => ({
  choices: [{ message: { content } }],
});

describe("DeepSeekTaskBreakdownProvider", () => {
  it("通过 Chat Completions JSON 模式请求并校验子任务", async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const request: typeof fetch = (input, init) => {
      calls.push({ input, init });
      return Promise.resolve(
        jsonResponse(
          completion('{"subtasks":["梳理需求","补齐测试","验证构建"]}'),
        ),
      );
    };
    const provider = new DeepSeekTaskBreakdownProvider({ fetch: request });

    const result = await provider.execute(
      { title: "升级 Todo 种子", notes: "保持本地优先" },
      { apiKey: "test-key" },
    );

    expect(result).toEqual({
      subtasks: ["梳理需求", "补齐测试", "验证构建"],
    });
    expect(calls[0]?.input).toBe("https://api.deepseek.com/chat/completions");
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    const requestBody = calls[0]?.init?.body;
    const body = JSON.parse(
      typeof requestBody === "string" ? requestBody : "{}",
    ) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "deepseek-v4-flash",
      response_format: { type: "json_object" },
      max_tokens: 512,
      stream: false,
    });
  });

  it("429 或服务端错误只进行一次有限重试", async () => {
    let requestCount = 0;
    const waits: number[] = [];
    const request: typeof fetch = () => {
      requestCount += 1;
      return Promise.resolve(
        requestCount === 1
          ? jsonResponse({}, 429)
          : jsonResponse(completion('{"subtasks":["第一步","第二步"]}')),
      );
    };
    const provider = new DeepSeekTaskBreakdownProvider({
      fetch: request,
      wait: (milliseconds) => {
        waits.push(milliseconds);
        return Promise.resolve();
      },
    });

    await expect(
      provider.execute({ title: "测试重试", notes: "" }, { apiKey: "key" }),
    ).resolves.toEqual({ subtasks: ["第一步", "第二步"] });
    expect(requestCount).toBe(2);
    expect(waits).toEqual([400]);
  });

  it("归一化权限、CORS 和无效响应错误", async () => {
    const unauthorized = new DeepSeekTaskBreakdownProvider({
      fetch: () => Promise.resolve(jsonResponse({}, 401)),
    });
    const blocked = new DeepSeekTaskBreakdownProvider({
      fetch: () => Promise.reject(new TypeError("Failed to fetch")),
    });
    const invalid = new DeepSeekTaskBreakdownProvider({
      fetch: () => Promise.resolve(jsonResponse(completion(""))),
    });
    const input = { title: "拆解任务", notes: "" };
    const options = { apiKey: "test-key" };

    await expect(unauthorized.execute(input, options)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    await expect(blocked.execute(input, options)).rejects.toMatchObject({
      code: "API_CORS_BLOCKED",
    });
    await expect(invalid.execute(input, options)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
});
