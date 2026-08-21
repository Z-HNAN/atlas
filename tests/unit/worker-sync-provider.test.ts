import { describe, expect, it, vi } from "vitest";
import {
  gzipSnapshot,
  gunzipSnapshot,
  sha256Hex,
} from "../../src/lib/sync/snapshot-codec";
import { WorkerSyncProvider } from "../../src/lib/sync/worker-sync-provider";
import type { BrowserHttpClient } from "../../src/lib/http/browser-http-client";

const COMMIT_ID = "00000000-0000-4000-8000-000000000001";

describe("WorkerSyncProvider", () => {
  it("身份检查与登录 URL 都携带 Atlas appId", async () => {
    const request = vi.fn<BrowserHttpClient["request"]>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            user: { id: "a".repeat(64), email: "owner@example.com" },
            apps: [{ id: "atlas", name: "Atlas", role: "admin" }],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const provider = new WorkerSyncProvider({
      appId: "atlas",
      apiBaseUrl: "https://sync.example.com",
      httpClient: { request },
    });

    expect(provider.loginUrl).toBe(
      "https://sync.example.com/api/v1/me?appId=atlas",
    );
    await expect(provider.getCurrentUser()).resolves.toMatchObject({
      user: { id: "a".repeat(64) },
      apps: [{ id: "atlas" }],
    });
    expect(request).toHaveBeenCalledWith(
      "https://sync.example.com/api/v1/me?appId=atlas",
      expect.any(Object),
    );
  });

  it("读取真实云端 Head 版本和最后同步时间", async () => {
    const request = vi.fn<BrowserHttpClient["request"]>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            appId: "atlas",
            version: 8,
            baseVersion: 7,
            commitId: COMMIT_ID,
            payloadSchemaVersion: 2,
            deviceId: "device-a",
            createdAt: "2026-08-21T08:00:00.000Z",
            idempotent: false,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const provider = new WorkerSyncProvider({
      appId: "atlas",
      apiBaseUrl: "https://sync.example.com",
      httpClient: { request },
    });

    await expect(provider.getHead()).resolves.toMatchObject({
      version: 8,
      createdAt: "2026-08-21T08:00:00.000Z",
    });
    expect(request).toHaveBeenCalledWith(
      "https://sync.example.com/api/v1/apps/atlas/sync/head",
      expect.any(Object),
    );
  });

  it("云端还没有快照时返回空 Head", async () => {
    const provider = new WorkerSyncProvider({
      appId: "atlas",
      apiBaseUrl: "https://sync.example.com",
      httpClient: {
        request: () =>
          Promise.resolve(
            new Response(JSON.stringify({ head: null }), {
              headers: { "Content-Type": "application/json" },
            }),
          ),
      },
    });

    await expect(provider.getHead()).resolves.toBeNull();
  });

  it("拒绝其它 App 的 Head 元数据", async () => {
    const provider = new WorkerSyncProvider({
      appId: "atlas",
      apiBaseUrl: "https://sync.example.com",
      httpClient: {
        request: () =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                appId: "notes",
                version: 1,
                baseVersion: 0,
                commitId: COMMIT_ID,
                payloadSchemaVersion: 1,
                deviceId: "device-a",
                createdAt: "2026-08-21T08:00:00.000Z",
                idempotent: false,
              }),
            ),
          ),
      },
    });

    await expect(provider.getHead()).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });

  it("上传 gzip 字节、完整性摘要和独立云版本 Header", async () => {
    const request = vi.fn<BrowserHttpClient["request"]>(
      async (_input, init) => {
        const body = new Uint8Array(
          await new Response(init?.body).arrayBuffer(),
        );
        const envelope = await gunzipSnapshot(body);
        expect(envelope).toMatchObject({
          appId: "atlas",
          payloadSchemaVersion: 2,
          deviceId: "device-a",
          data: { trips: [] },
        });
        expect(init?.headers).toMatchObject({
          "X-Base-Version": "4",
          "X-Commit-Id": COMMIT_ID,
          "X-Payload-SHA256": await sha256Hex(body),
          "X-Payload-Encoding": "gzip",
          "X-Payload-Encryption": "none",
        });
        return new Response(
          JSON.stringify({
            appId: "atlas",
            version: 5,
            baseVersion: 4,
            commitId: COMMIT_ID,
            payloadSchemaVersion: 2,
            deviceId: "device-a",
            createdAt: "2026-07-30T08:00:00.000Z",
            idempotent: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    const provider = new WorkerSyncProvider<{ trips: never[] }>({
      appId: "atlas",
      apiBaseUrl: "https://sync.example.com",
      httpClient: { request },
      now: () => new Date("2026-07-30T08:00:00.000Z"),
    });

    const result = await provider.push({
      payload: { trips: [] },
      payloadSchemaVersion: 2,
      baseVersion: 4,
      commitId: COMMIT_ID,
      deviceId: "device-a",
    });
    expect(result).toMatchObject({
      version: 5,
      commitId: COMMIT_ID,
      payload: { trips: [] },
    });
  });

  it("下载时校验 SHA-256、解压并读取云端元数据", async () => {
    const bytes = await gzipSnapshot({
      formatVersion: 1,
      appId: "atlas",
      payloadSchemaVersion: 2,
      exportedAt: "2026-07-30T08:00:00.000Z",
      deviceId: "device-a",
      data: { trips: ["remote"] },
    });
    const hash = await sha256Hex(bytes);
    const request = vi.fn<BrowserHttpClient["request"]>(() =>
      Promise.resolve(
        new Response(bytes, {
          headers: {
            "X-Payload-SHA256": hash,
            "X-Cloud-Version": "8",
            "X-Commit-Id": COMMIT_ID,
            "X-Created-At": "2026-07-30T08:00:00.000Z",
          },
        }),
      ),
    );
    const provider = new WorkerSyncProvider({
      appId: "atlas",
      apiBaseUrl: "https://sync.example.com",
      httpClient: { request },
    });

    await expect(provider.pullLatest()).resolves.toMatchObject({
      appId: "atlas",
      version: 8,
      payloadSchemaVersion: 2,
      payload: { trips: ["remote"] },
    });
  });

  it("把 409 映射为远端版本冲突", async () => {
    const provider = new WorkerSyncProvider({
      appId: "atlas",
      apiBaseUrl: "https://sync.example.com",
      httpClient: {
        request: () =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                error: {
                  code: "VERSION_CONFLICT",
                  message: "云端版本已变化。",
                },
              }),
              { status: 409 },
            ),
          ),
      },
    });

    await expect(
      provider.push({
        payload: { trips: [] },
        payloadSchemaVersion: 2,
        baseVersion: 1,
        commitId: COMMIT_ID,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "REMOTE_VERSION_MISMATCH" });
  });
});
