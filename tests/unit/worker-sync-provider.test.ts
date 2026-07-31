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
  it("上传 gzip 字节、完整性摘要和独立云版本 Header", async () => {
    const request = vi.fn<BrowserHttpClient["request"]>(
      async (_input, init) => {
        const body = new Uint8Array(
          await new Response(init?.body).arrayBuffer(),
        );
        const envelope = await gunzipSnapshot(body);
        expect(envelope).toMatchObject({
          appId: "atlas-travel",
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
            appId: "atlas-travel",
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
      appId: "atlas-travel",
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
      appId: "atlas-travel",
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
      appId: "atlas-travel",
      apiBaseUrl: "https://sync.example.com",
      httpClient: { request },
    });

    await expect(provider.pullLatest()).resolves.toMatchObject({
      appId: "atlas-travel",
      version: 8,
      payloadSchemaVersion: 2,
      payload: { trips: ["remote"] },
    });
  });

  it("把 409 映射为远端版本冲突", async () => {
    const provider = new WorkerSyncProvider({
      appId: "atlas-travel",
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

  it("把 422 映射为 Payload Schema 迁移错误", async () => {
    const provider = new WorkerSyncProvider({
      appId: "atlas-travel",
      apiBaseUrl: "https://sync.example.com",
      httpClient: {
        request: () =>
          Promise.resolve(
            new Response(
              JSON.stringify({
                error: {
                  code: "PAYLOAD_SCHEMA_VERSION_MISMATCH",
                  message: "请升级客户端。",
                },
              }),
              { status: 422 },
            ),
          ),
      },
    });

    await expect(
      provider.push({
        payload: { trips: [] },
        payloadSchemaVersion: 1,
        baseVersion: 0,
        commitId: COMMIT_ID,
        deviceId: "device-a",
      }),
    ).rejects.toMatchObject({ code: "DATA_MIGRATION_FAILED" });
  });
});
