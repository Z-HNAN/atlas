import { z } from "zod";

export interface LocalAppEnvelope<TPayload> {
  appId: string;
  schemaVersion: number;
  dataVersion: number;
  updatedAt: string;
  deviceId: string;
  payload: TPayload;
  sync: {
    dirty: boolean;
    lastRemoteVersion: number | null;
    lastSyncedAt: string | null;
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

export const syncMetadataSchema = z
  .object({
    dirty: z.boolean(),
    lastRemoteVersion: z.number().int().positive().nullable(),
    lastSyncedAt: z.string().datetime().nullable(),
  })
  .strict();

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
