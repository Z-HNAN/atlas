import { z } from "zod";
import { AppError } from "../../src/lib/errors/app-error";
import { BrowserLocalDataRepository } from "../../src/lib/local-data/local-data-repository";
import type { RemoteSnapshot, SyncProvider } from "../../src/lib/sync/types";
import { MemoryStorage } from "./memory-storage";

export const syncPayloadSchema = z
  .object({ items: z.array(z.string()) })
  .strict();
export type SyncPayload = z.infer<typeof syncPayloadSchema>;

export const createSyncRepository = (deviceId: string) =>
  new BrowserLocalDataRepository<SyncPayload>({
    appId: "sync-test",
    schemaVersion: 1,
    storageKey: "app:sync-test:data",
    payloadSchema: syncPayloadSchema,
    createDefaultPayload: () => ({ items: [] }),
    storage: new MemoryStorage(),
    now: () => new Date("2026-07-17T08:00:00.000Z"),
    createId: () => deviceId,
  });

export class MemorySyncCloud {
  snapshot: RemoteSnapshot<SyncPayload> | null = null;

  createProvider(): SyncProvider<SyncPayload> {
    return {
      pullLatest: () => Promise.resolve(this.clone(this.snapshot)),
      push: (input) => {
        const currentVersion = this.snapshot?.version ?? 0;
        const requestedBase = input.baseVersion ?? 0;
        if (requestedBase !== currentVersion) {
          throw new AppError("REMOTE_VERSION_MISMATCH", "测试云端版本已变化。");
        }
        if (
          this.snapshot?.commitId === input.commitId &&
          this.snapshot.payload === input.payload
        ) {
          return Promise.resolve(this.clone(this.snapshot));
        }
        this.snapshot = {
          appId: "sync-test",
          version: currentVersion + 1,
          commitId: input.commitId,
          payloadSchemaVersion: input.payloadSchemaVersion,
          payload: structuredClone(input.payload),
          deviceId: input.deviceId,
          createdAt: "2026-07-17T08:01:00.000Z",
        };
        return Promise.resolve(this.clone(this.snapshot));
      },
    };
  }

  private clone<T>(value: T): T {
    return structuredClone(value);
  }
}
