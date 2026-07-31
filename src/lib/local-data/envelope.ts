import { z } from "zod";

export type SyncStatus =
  | "idle"
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "error";

export interface LocalAppEnvelope<TPayload> {
  appId: string;
  schemaVersion: number;
  dataVersion: number;
  updatedAt: string;
  deviceId: string;
  payload: TPayload;
  sync: {
    dirty: boolean;
    lastCloudVersion: number | null;
    lastSyncAt: string | null;
    lastSyncCommitId: string | null;
    syncStatus: SyncStatus;
  };
}

export interface AppDataExport<TPayload> {
  format: "personal-web-seed-export";
  appId: string;
  schemaVersion: number;
  dataVersion: number;
  exportedAt: string;
  payload: TPayload;
}

const rawSyncMetadataSchema = z
  .object({
    dirty: z.boolean(),
    lastCloudVersion: z.number().int().positive().nullable(),
    lastSyncAt: z.string().datetime().nullable(),
    lastSyncCommitId: z.string().uuid().nullable(),
    syncStatus: z.enum([
      "idle",
      "pending",
      "syncing",
      "synced",
      "conflict",
      "error",
    ]),
  })
  .strict();

export const syncMetadataSchema = z.preprocess((candidate) => {
  if (!candidate || typeof candidate !== "object") return candidate;
  const value = candidate as Record<string, unknown>;
  return {
    dirty: value.dirty,
    lastCloudVersion: value.lastCloudVersion ?? value.lastRemoteVersion ?? null,
    lastSyncAt: value.lastSyncAt ?? value.lastSyncedAt ?? null,
    lastSyncCommitId: value.lastSyncCommitId ?? null,
    syncStatus:
      value.syncStatus ??
      (value.dirty === true
        ? "pending"
        : value.lastSyncedAt
          ? "synced"
          : "idle"),
  };
}, rawSyncMetadataSchema);

export const envelopeBaseSchema = z
  .object({
    appId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
    dataVersion: z.number().int().positive(),
    updatedAt: z.string().datetime(),
    deviceId: z.string().min(1),
    payload: z.unknown(),
    sync: syncMetadataSchema,
  })
  .strict();

export const exportBaseSchema = z
  .object({
    format: z.literal("personal-web-seed-export"),
    appId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
    dataVersion: z.number().int().positive(),
    exportedAt: z.string().datetime(),
    payload: z.unknown(),
  })
  .strict();
