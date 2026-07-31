import ky, {
  isNetworkError,
  isTimeoutError,
  type KyInstance,
  type RetryOptions,
} from "ky";

export type BrowserHttpErrorKind =
  | "aborted"
  | "timeout"
  | "network"
  | "unexpected";

export class BrowserHttpError extends Error {
  constructor(
    public readonly kind: BrowserHttpErrorKind,
    public readonly originalCause?: unknown,
  ) {
    super(`浏览器 HTTP 请求失败：${kind}`);
    this.name = "BrowserHttpError";
  }
}

export type BrowserHttpRequestOptions = RequestInit & {
  timeoutMs?: number;
  retry?: RetryOptions | number;
};

export interface BrowserHttpClient {
  request(
    input: string | URL | Request,
    options?: BrowserHttpRequestOptions,
  ): Promise<Response>;
}

interface BrowserHttpClientDependencies {
  fetch?: typeof fetch;
}

const callNativeFetch: typeof fetch = (...arguments_) =>
  globalThis.fetch(...arguments_);

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

export const isBrowserOnline = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

export class KyBrowserHttpClient implements BrowserHttpClient {
  private readonly client: KyInstance;

  constructor(dependencies: BrowserHttpClientDependencies = {}) {
    this.client = ky.create({
      fetch: dependencies.fetch ?? callNativeFetch,
      retry: 0,
      timeout: false,
      throwHttpErrors: false,
    });
  }

  async request(
    input: string | URL | Request,
    options: BrowserHttpRequestOptions = {},
  ): Promise<Response> {
    const { timeoutMs, retry, ...requestOptions } = options;
    try {
      return await this.client(input, {
        ...requestOptions,
        retry: retry ?? 0,
        timeout: timeoutMs ?? false,
        throwHttpErrors: false,
      });
    } catch (error) {
      if (options.signal?.aborted) {
        throw new BrowserHttpError("aborted", error);
      }
      if (isTimeoutError(error)) {
        throw new BrowserHttpError("timeout", error);
      }
      if (isAbortError(error)) {
        throw new BrowserHttpError("aborted", error);
      }
      if (isNetworkError(error) || error instanceof TypeError) {
        throw new BrowserHttpError("network", error);
      }
      throw new BrowserHttpError("unexpected", error);
    }
  }
}
