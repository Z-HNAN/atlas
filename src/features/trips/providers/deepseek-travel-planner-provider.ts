import { z } from "zod";
import { APP_CONFIG } from "../../../config/app-config";
import { AppError } from "../../../lib/errors/app-error";
import type { ExternalApiProvider } from "../../../lib/providers/types";
import {
  generatedTravelPlanSchema,
  travelPlanInputSchema,
} from "../schemas/trip-schema";
import type { GeneratedTravelPlan, TravelPlanInput } from "../types/trips";

const chatResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z.object({ content: z.string().nullable() }).passthrough(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

interface ProviderDependencies {
  fetch?: typeof fetch;
  timeoutMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

const isOnline = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

export const stripMarkdownCodeFence = (content: string) => {
  const trimmed = content.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
};

export const parseGeneratedTravelPlan = (
  content: string,
): GeneratedTravelPlan => {
  let candidate: unknown;
  try {
    candidate = JSON.parse(stripMarkdownCodeFence(content)) as unknown;
  } catch (error) {
    throw new AppError(
      "INVALID_RESPONSE",
      "DeepSeek 未返回合法的旅行计划 JSON。",
      error,
    );
  }
  const parsed = generatedTravelPlanSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_RESPONSE",
      "DeepSeek 返回的旅行计划缺少必要字段或顺序不正确。",
      parsed.error,
    );
  }
  return {
    ...parsed.data,
    points: [...parsed.data.points].sort((a, b) => a.order - b.order),
  };
};

export class DeepSeekTravelPlannerProvider
  implements ExternalApiProvider<TravelPlanInput, GeneratedTravelPlan>
{
  readonly id = "deepseek";
  private readonly request: typeof fetch;
  private readonly timeoutMs: number;
  private readonly wait: (milliseconds: number) => Promise<void>;

  constructor(dependencies: ProviderDependencies = {}) {
    this.request = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = dependencies.timeoutMs ?? 30_000;
    this.wait = dependencies.wait ?? wait;
  }

  async execute(
    input: TravelPlanInput,
    options: { apiKey?: string; signal?: AbortSignal },
  ) {
    const parsedInput = travelPlanInputSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        parsedInput.error.issues[0]?.message ?? "旅行需求格式不正确。",
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
      throw new AppError("OFFLINE", "当前离线，无法生成 AI 旅行计划。");
    }

    let previousInvalid = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.performRequest(
        parsedInput.data,
        apiKey,
        options.signal,
        attempt === 1 ? previousInvalid : "",
      );
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt === 0
      ) {
        await this.wait(500);
        continue;
      }
      const content = await this.readContent(response);
      try {
        return parseGeneratedTravelPlan(content);
      } catch (error) {
        if (attempt === 0) {
          previousInvalid = content.slice(0, 4000);
          continue;
        }
        throw error;
      }
    }
    throw new AppError(
      "INVALID_RESPONSE",
      "DeepSeek 两次返回均未通过旅行计划校验。",
    );
  }

  private async performRequest(
    input: TravelPlanInput,
    apiKey: string,
    externalSignal: AbortSignal | undefined,
    invalidOutput: string,
  ) {
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) abortFromCaller();
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = globalThis.setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    const systemPrompt =
      "你是虚拟旅行策划师。为 Microsoft Flight Simulator 目视探索设计景点顺序，但不要提供经纬度、机场、航路或航空导航建议。必须只输出 JSON：title、summary、region、theme、points；每个 point 必须包含 nameZh、nameLocal、country、region、searchQuery、reason、order。order 从 1 连续编号且不重复。searchQuery 要适合 OpenStreetMap Nominatim 地理编码。";
    const originalRequest = [
      `旅行想法：${input.prompt}`,
      `地区：${input.region || "由你判断"}`,
      `主题：${input.theme || "由你判断"}`,
      `预计时长：${input.durationMinutes} 分钟`,
      `地点数量：严格生成 ${input.pointCount} 个`,
      `偏好：${input.preferences || "无额外偏好"}`,
    ].join("\n");
    const userPrompt = invalidOutput
      ? `${originalRequest}\n\n上一次输出没有通过严格校验。请在保留上述需求的前提下修复，并只返回完整 JSON，不要使用 Markdown。\n上次输出：${invalidOutput}`
      : originalRequest;

    try {
      return await this.request(
        `${APP_CONFIG.deepSeekBaseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: APP_CONFIG.deepSeekModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            thinking: { type: "disabled" },
            max_tokens: 1800,
            stream: false,
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (!isOnline()) {
        throw new AppError("OFFLINE", "当前离线，无法生成 AI 旅行计划。");
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new AppError(
          "NETWORK_ERROR",
          externalSignal?.aborted
            ? "AI 旅行计划请求已取消。"
            : "AI 旅行计划请求超时，请稍后重试。",
          error,
        );
      }
      if (error instanceof TypeError) {
        throw new AppError(
          "NETWORK_ERROR",
          "未能连接 DeepSeek（未收到 HTTP 响应）。请检查网络、代理、浏览器扩展或 API 地址；官方端点当前支持浏览器直连。",
          error,
        );
      }
      throw new AppError("NETWORK_ERROR", "DeepSeek 请求失败。", error);
    } finally {
      globalThis.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    }
  }

  private async readContent(response: Response) {
    if ([400, 404].includes(response.status)) {
      throw new AppError(
        "API_CONFIGURATION_ERROR",
        "DeepSeek 不接受当前模型或请求配置。请使用 deepseek-v4-pro 或 deepseek-v4-flash，并检查 API 地址。",
      );
    }
    if (response.status === 401) {
      throw new AppError(
        "PERMISSION_DENIED",
        "DeepSeek API Key 无效，请检查后重新保存。",
      );
    }
    if (response.status === 402) {
      throw new AppError(
        "PERMISSION_DENIED",
        "DeepSeek 账户余额不足，请充值后重试。",
      );
    }
    if (response.status === 403) {
      throw new AppError(
        "PERMISSION_DENIED",
        "当前 DeepSeek API Key 无权使用所选模型。",
      );
    }
    if (response.status === 429) {
      throw new AppError("RATE_LIMITED", "DeepSeek 请求过于频繁，请稍后重试。");
    }
    if (response.status >= 500) {
      throw new AppError(
        "NETWORK_ERROR",
        `DeepSeek 服务暂时不可用（HTTP ${response.status}）。`,
      );
    }
    if (!response.ok) {
      throw new AppError(
        "NETWORK_ERROR",
        `DeepSeek 请求未被接受（HTTP ${response.status}）。`,
      );
    }

    let candidate: unknown;
    try {
      candidate = (await response.json()) as unknown;
    } catch (error) {
      throw new AppError(
        "INVALID_RESPONSE",
        "DeepSeek 返回无法解析的响应。",
        error,
      );
    }
    const parsed = chatResponseSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new AppError(
        "INVALID_RESPONSE",
        "DeepSeek 响应结构不符合预期。",
        parsed.error,
      );
    }
    const content = parsed.data.choices[0]?.message.content?.trim();
    if (!content) {
      throw new AppError("INVALID_RESPONSE", "DeepSeek 未返回旅行计划。");
    }
    return content;
  }
}
