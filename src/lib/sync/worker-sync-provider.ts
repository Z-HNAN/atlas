import { z } from "zod";
import { AppError } from "../errors/app-error";
import {
  BrowserHttpError,
  KyBrowserHttpClient,
  isBrowserOnline,
  type BrowserHttpClient,
} from "../http/browser-http-client";
import {
  apiErrorSchema,
  syncMeResponseSchema,
  uploadResultSchema,
} from "./schemas";
import { gunzipSnapshot, gzipSnapshot, sha256Hex } from "./snapshot-codec";
import type { RemoteSnapshot, SyncProvider } from "./types";

interface WorkerSyncProviderOptions {
  appId: string;
  apiBaseUrl: string;
  httpClient?: BrowserHttpClient;
  now?: () => Date;
  timeoutMs?: number;
}

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

const toApiError = async (response: Response) => {
  const body = apiErrorSchema.safeParse(await readJson(response));
  const message = body.success
    ? body.data.error.message
    : `同步服务返回 HTTP ${response.status}。`;
  if (response.status === 401) return new AppError("AUTH_REQUIRED", message);
  if (response.status === 403)
    return new AppError("PERMISSION_DENIED", message);
  if (response.status === 409)
    return new AppError("REMOTE_VERSION_MISMATCH", message);
  if (response.status === 422)
    return new AppError("DATA_MIGRATION_FAILED", message);
  if (response.status === 429) return new AppError("RATE_LIMITED", message);
  return new AppError("NETWORK_ERROR", message);
};

export class WorkerSyncProvider<TPayload> implements SyncProvider<TPayload> {
  private readonly httpClient: BrowserHttpClient;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(private readonly options: WorkerSyncProviderOptions) {
    this.httpClient = options.httpClient ?? new KyBrowserHttpClient();
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  get loginUrl() {
    return `${this.options.apiBaseUrl}/api/v1/me`;
  }

  async getCurrentUser() {
    const response = await this.request("/api/v1/me");
    if (!response.ok) throw await toApiError(response);
    const parsed = syncMeResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new AppError(
        "INVALID_RESPONSE",
        "同步服务返回的用户信息不正确。",
        parsed.error,
      );
    }
    return parsed.data;
  }

  async pullLatest(): Promise<RemoteSnapshot<unknown> | null> {
    const response = await this.request(
      `/api/v1/apps/${encodeURIComponent(this.options.appId)}/sync/latest`,
    );
    if (response.status === 404) return null;
    if (!response.ok) throw await toApiError(response);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const expectedHash = response.headers.get("X-Payload-SHA256");
    if (!expectedHash || (await sha256Hex(bytes)) !== expectedHash) {
      throw new AppError(
        "INVALID_RESPONSE",
        "云端快照完整性校验失败，未覆盖本地数据。",
      );
    }
    const envelope = await gunzipSnapshot(bytes);
    if (envelope.appId !== this.options.appId) {
      throw new AppError("PERMISSION_DENIED", "同步服务返回了其它应用的快照。");
    }
    const version = z.coerce
      .number()
      .int()
      .positive()
      .parse(response.headers.get("X-Cloud-Version"));
    const commitId = z
      .string()
      .uuid()
      .parse(response.headers.get("X-Commit-Id"));
    const createdAt = z
      .string()
      .datetime()
      .parse(response.headers.get("X-Created-At"));
    return {
      appId: envelope.appId,
      version,
      commitId,
      payloadSchemaVersion: envelope.payloadSchemaVersion,
      payload: envelope.data,
      deviceId: envelope.deviceId,
      createdAt,
    };
  }

  async push(input: {
    payload: TPayload;
    payloadSchemaVersion: number;
    baseVersion: number | null;
    commitId: string;
    deviceId: string;
  }): Promise<RemoteSnapshot<unknown>> {
    const bytes = await gzipSnapshot({
      formatVersion: 1,
      appId: this.options.appId,
      payloadSchemaVersion: input.payloadSchemaVersion,
      exportedAt: this.now().toISOString(),
      deviceId: input.deviceId,
      data: input.payload,
    });
    const hash = await sha256Hex(bytes);
    const response = await this.request(
      `/api/v1/apps/${encodeURIComponent(this.options.appId)}/sync`,
      {
        method: "PUT",
        body: bytes,
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Base-Version": String(input.baseVersion ?? 0),
          "X-Commit-Id": input.commitId,
          "X-Payload-Schema-Version": String(input.payloadSchemaVersion),
          "X-Payload-SHA256": hash,
          "X-Payload-Encoding": "gzip",
          "X-Payload-Encryption": "none",
          "X-Device-Id": input.deviceId,
        },
      },
    );
    if (!response.ok) throw await toApiError(response);
    const parsed = uploadResultSchema.safeParse(await readJson(response));
    if (!parsed.success || parsed.data.appId !== this.options.appId) {
      throw new AppError(
        "INVALID_RESPONSE",
        "同步服务返回的提交结果不正确。",
        parsed.success ? undefined : parsed.error,
      );
    }
    return {
      appId: parsed.data.appId,
      version: parsed.data.version,
      commitId: parsed.data.commitId,
      payloadSchemaVersion: parsed.data.payloadSchemaVersion,
      payload: input.payload,
      deviceId: parsed.data.deviceId,
      createdAt: parsed.data.createdAt,
    };
  }

  private async request(path: string, init?: RequestInit) {
    try {
      return await this.httpClient.request(
        `${this.options.apiBaseUrl}${path}`,
        {
          ...init,
          credentials: "include",
          timeoutMs: this.timeoutMs,
          headers: {
            Accept: "application/json",
            ...init?.headers,
          },
        },
      );
    } catch (error) {
      const online = isBrowserOnline();
      const timeout =
        error instanceof BrowserHttpError && error.kind === "timeout";
      throw new AppError(
        online ? "NETWORK_ERROR" : "OFFLINE",
        online
          ? timeout
            ? "同步服务请求超时，请稍后重试。"
            : "未能连接同步服务，请检查网络、Access 登录或 API 地址。"
          : "当前离线，本地功能仍可继续使用。",
        error,
      );
    }
  }
}
