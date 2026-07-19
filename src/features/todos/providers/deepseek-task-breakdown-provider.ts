import { z } from "zod";
import { APP_CONFIG } from "../../../config/app-config";
import { AppError } from "../../../lib/errors/app-error";
import type { ExternalApiProvider } from "../../../lib/providers/types";
import { todoTitleSchema } from "../schemas/todo-schema";

const inputSchema = z
  .object({
    title: todoTitleSchema,
    notes: z.string().trim().max(500),
  })
  .strict();

const chatResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.string().nullable(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

const jsonOutputSchema = z
  .object({
    subtasks: z.array(z.string()),
  })
  .strict();

const breakdownSchema = z
  .object({
    subtasks: z.array(todoTitleSchema).min(2).max(6),
  })
  .strict();

interface ProviderDependencies {
  fetch?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

const isOnline = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

export class DeepSeekTaskBreakdownProvider
  implements
    ExternalApiProvider<
      { title: string; notes: string },
      { subtasks: string[] }
    >
{
  readonly id = "deepseek";
  private readonly request: typeof fetch;
  private readonly wait: (milliseconds: number) => Promise<void>;
  private readonly timeoutMs: number;

  constructor(dependencies: ProviderDependencies = {}) {
    this.request = dependencies.fetch ?? fetch;
    this.wait = dependencies.wait ?? wait;
    this.timeoutMs = dependencies.timeoutMs ?? 20_000;
  }

  async execute(
    input: { title: string; notes: string },
    options: { apiKey?: string; signal?: AbortSignal },
  ) {
    const parsedInput = inputSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "请先填写合法的待办标题。",
        parsedInput.error,
      );
    }
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new AppError(
        "API_KEY_MISSING",
        "请先在设置页保存 DeepSeek API Key。",
      );
    }
    if (!isOnline()) {
      throw new AppError("OFFLINE", "当前离线，无法使用 DeepSeek 拆解任务。");
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.performRequest(
        parsedInput.data,
        apiKey,
        options.signal,
      );
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt === 0
      ) {
        await this.wait(400);
        continue;
      }
      return this.parseResponse(response);
    }

    throw new AppError("UNKNOWN", "DeepSeek 任务拆解请求未完成。");
  }

  private async performRequest(
    input: { title: string; notes: string },
    apiKey: string,
    externalSignal?: AbortSignal,
  ) {
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) abortFromCaller();
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = globalThis.setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    try {
      return await this.request("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: APP_CONFIG.deepSeekModel,
          messages: [
            {
              role: "system",
              content:
                '你是任务规划助手。将用户任务拆解为 2 到 6 个清晰、可执行的中文子任务。必须只输出 json，格式示例：{"subtasks":["子任务一","子任务二"]}。每项不超过 120 个字符。',
            },
            {
              role: "user",
              content: `任务：${input.title}\n补充说明：${input.notes || "无"}`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 512,
          stream: false,
          thinking: { type: "disabled" },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (!isOnline()) {
        throw new AppError(
          "OFFLINE",
          "当前离线，无法使用 DeepSeek 拆解任务。",
          error,
        );
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new AppError(
          "NETWORK_ERROR",
          externalSignal?.aborted
            ? "DeepSeek 请求已取消。"
            : "DeepSeek 请求超时，请稍后重试。",
          error,
        );
      }
      if (error instanceof TypeError) {
        throw new AppError(
          "API_CORS_BLOCKED",
          "浏览器无法直连 DeepSeek，可能被 CORS 或网络策略拦截；请改用 Server Provider。",
          error,
        );
      }
      throw new AppError("NETWORK_ERROR", "DeepSeek 任务拆解请求失败。", error);
    } finally {
      globalThis.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    }
  }

  private async parseResponse(response: Response) {
    if ([401, 402, 403].includes(response.status)) {
      throw new AppError(
        "PERMISSION_DENIED",
        "DeepSeek API Key 无效、余额不足或无权使用当前模型。",
      );
    }
    if (response.status === 429) {
      throw new AppError("RATE_LIMITED", "DeepSeek 请求过于频繁，请稍后重试。");
    }
    if (!response.ok) {
      throw new AppError(
        "NETWORK_ERROR",
        `DeepSeek 服务暂时不可用（HTTP ${response.status}）。`,
      );
    }

    let candidate: unknown;
    try {
      candidate = (await response.json()) as unknown;
    } catch (error) {
      throw new AppError(
        "INVALID_RESPONSE",
        "DeepSeek 返回了无法解析的响应。",
        error,
      );
    }
    const chatResponse = chatResponseSchema.safeParse(candidate);
    if (!chatResponse.success) {
      throw new AppError(
        "INVALID_RESPONSE",
        "DeepSeek Chat Completion 返回结构不符合预期。",
        chatResponse.error,
      );
    }
    const content = chatResponse.data.choices[0]?.message.content?.trim();
    if (!content) {
      throw new AppError("INVALID_RESPONSE", "DeepSeek 未返回任务拆解内容。");
    }

    let jsonOutput: unknown;
    try {
      jsonOutput = JSON.parse(content) as unknown;
    } catch (error) {
      throw new AppError(
        "INVALID_RESPONSE",
        "DeepSeek 未返回合法 JSON。",
        error,
      );
    }
    const raw = jsonOutputSchema.safeParse(jsonOutput);
    if (!raw.success) {
      throw new AppError(
        "INVALID_RESPONSE",
        "DeepSeek JSON 不包含合法的 subtasks。",
        raw.error,
      );
    }
    const uniqueSubtasks = [
      ...new Set(raw.data.subtasks.map((item) => item.trim()).filter(Boolean)),
    ];
    const output = breakdownSchema.safeParse({ subtasks: uniqueSubtasks });
    if (!output.success) {
      throw new AppError(
        "INVALID_RESPONSE",
        "DeepSeek 子任务数量或长度不符合要求。",
        output.error,
      );
    }
    return output.data;
  }
}
