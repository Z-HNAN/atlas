import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KyBrowserHttpClient,
  type BrowserHttpClient,
} from "../../src/lib/http/browser-http-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KyBrowserHttpClient", () => {
  it("绑定正确的浏览器接收者，并把非 2xx 响应交给 Provider 判定", async () => {
    const request = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis);
      return Promise.resolve(new Response("denied", { status: 401 }));
    });
    vi.stubGlobal("fetch", request);

    const response = await new KyBrowserHttpClient().request(
      "https://example.com/test",
    );

    expect(response.status).toBe(401);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("区分网络层失败", async () => {
    const request = vi
      .fn<BrowserHttpClient["request"]>()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    const client = new KyBrowserHttpClient({ fetch: request });

    await expect(
      client.request("https://example.com/test"),
    ).rejects.toMatchObject({ kind: "network" });
  });

  it("区分超时与外部取消", async () => {
    const neverCompletes: typeof fetch = (input) => {
      const request =
        input instanceof Request ? input : new Request(input as RequestInfo);
      return new Promise((_resolve, reject) => {
        if (request.signal.aborted) {
          reject(new Error("请求已取消"));
          return;
        }
        request.signal.addEventListener(
          "abort",
          () => reject(new Error("请求已取消")),
          { once: true },
        );
      });
    };
    const client = new KyBrowserHttpClient({ fetch: neverCompletes });

    await expect(
      client.request("https://example.com/timeout", { timeoutMs: 5 }),
    ).rejects.toMatchObject({ kind: "timeout" });

    const controller = new AbortController();
    controller.abort();
    await expect(
      client.request("https://example.com/cancelled", {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ kind: "aborted" });
  });
});
