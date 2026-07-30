import { z } from "zod";
import { APP_CONFIG } from "../../../config/app-config";
import { AppError } from "../../../lib/errors/app-error";
import type { GeocodeCacheEntry, TravelPoint } from "../types/trips";

const nominatimResultSchema = z
  .object({
    lat: z.string(),
    lon: z.string(),
    display_name: z.string().min(1),
    importance: z.number().optional().default(0),
    address: z
      .object({
        country: z.string().optional(),
        state: z.string().optional(),
        region: z.string().optional(),
        county: z.string().optional(),
      })
      .passthrough()
      .optional()
      .default({}),
  })
  .passthrough()
  .transform((value, context) => {
    const lat = Number(value.lat);
    const lng = Number(value.lon);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nominatim 返回了无效坐标。",
      });
      return z.NEVER;
    }
    return { ...value, lat, lng };
  });

const nominatimResponseSchema = z.array(nominatimResultSchema).max(10);

export type GeocodeResolution =
  | {
      status: "resolved" | "ambiguous";
      lat: number;
      lng: number;
      displayName: string;
      cacheEntry: GeocodeCacheEntry;
    }
  | { status: "failed" };

interface GeocoderDependencies {
  fetch?: typeof fetch;
  now?: () => Date;
}

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/gu, " ");

export const createGeocodeQueryKey = (
  point: Pick<TravelPoint, "searchQuery" | "country" | "region">,
) =>
  [point.searchQuery, point.region, point.country]
    .map(normalize)
    .filter(Boolean)
    .join("|");

const scoreResult = (
  result: z.infer<typeof nominatimResultSchema>,
  point: Pick<TravelPoint, "searchQuery" | "country" | "region">,
) => {
  const display = normalize(result.display_name);
  const country = normalize(point.country);
  const region = normalize(point.region);
  const queryTokens = normalize(point.searchQuery)
    .split(/[\s,，]+/u)
    .filter((token) => token.length > 1);

  let score = result.importance;
  if (country && display.includes(country)) score += 5;
  if (region && display.includes(region)) score += 3;
  score += queryTokens.filter((token) => display.includes(token)).length;
  return score;
};

export class NominatimGeocoder {
  private readonly request: typeof fetch;
  private readonly now: () => Date;

  constructor(dependencies: GeocoderDependencies = {}) {
    this.request = dependencies.fetch ?? fetch;
    this.now = dependencies.now ?? (() => new Date());
  }

  async resolve(
    point: Pick<TravelPoint, "searchQuery" | "country" | "region">,
    cache: readonly GeocodeCacheEntry[],
    signal?: AbortSignal,
  ): Promise<GeocodeResolution> {
    const queryKey = createGeocodeQueryKey(point);
    const cached = cache.find((entry) => entry.queryKey === queryKey);
    if (cached) {
      return {
        status: "resolved",
        lat: cached.lat,
        lng: cached.lng,
        displayName: cached.displayName,
        cacheEntry: cached,
      };
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new AppError("OFFLINE", "当前离线，无法查询地点坐标。");
    }

    const params = new URLSearchParams({
      q: [point.searchQuery, point.region, point.country]
        .filter(Boolean)
        .join(", "),
      format: "jsonv2",
      addressdetails: "1",
      limit: "6",
      "accept-language": "zh-CN,zh,en",
    });

    let response: Response;
    try {
      response = await this.request(
        `${APP_CONFIG.nominatimBaseUrl}/search?${params.toString()}`,
        {
          headers: { Accept: "application/json" },
          signal,
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        throw error;
      throw new AppError(
        "NETWORK_ERROR",
        "地点查询失败，请检查网络后重试。",
        error,
      );
    }
    if (!response.ok) {
      throw new AppError(
        response.status === 429 ? "RATE_LIMITED" : "NETWORK_ERROR",
        response.status === 429
          ? "地点查询过于频繁，请稍后重试。"
          : `地点查询服务暂时不可用（HTTP ${response.status}）。`,
      );
    }
    let json: unknown;
    try {
      json = (await response.json()) as unknown;
    } catch (error) {
      throw new AppError(
        "INVALID_RESPONSE",
        "地点查询返回无法解析的数据。",
        error,
      );
    }
    const parsed = nominatimResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        "INVALID_RESPONSE",
        "地点查询结果结构不正确。",
        parsed.error,
      );
    }
    if (parsed.data.length === 0) return { status: "failed" };

    const ranked = parsed.data
      .map((result) => ({ result, score: scoreResult(result, point) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best) return { status: "failed" };
    const second = ranked[1];
    const ambiguous =
      Boolean(second) && Math.abs(best.score - (second?.score ?? 0)) < 1.25;
    const timestamp = this.now().toISOString();
    const cacheEntry: GeocodeCacheEntry = {
      queryKey,
      queryText: point.searchQuery,
      lat: best.result.lat,
      lng: best.result.lng,
      displayName: best.result.display_name,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return {
      status: ambiguous ? "ambiguous" : "resolved",
      lat: best.result.lat,
      lng: best.result.lng,
      displayName: best.result.display_name,
      cacheEntry,
    };
  }
}

export class SerialGeocodeQueue {
  private tail = Promise.resolve();
  private lastStartedAt = 0;

  constructor(
    private readonly minimumIntervalMs = 1100,
    private readonly wait: (milliseconds: number) => Promise<void> = (
      milliseconds,
    ) =>
      new Promise<void>((resolve) =>
        globalThis.setTimeout(resolve, milliseconds),
      ),
  ) {}

  enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const remaining =
        this.minimumIntervalMs - (Date.now() - this.lastStartedAt);
      if (remaining > 0) await this.wait(remaining);
      this.lastStartedAt = Date.now();
      return job();
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
