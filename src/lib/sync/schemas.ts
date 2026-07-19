import { z } from "zod";

export const remoteSnapshotBaseSchema = z
  .object({
    appId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
    dataVersion: z.number().int().positive(),
    payload: z.unknown(),
    deviceId: z.string().min(1).nullable(),
    updatedAt: z.string().datetime(),
  })
  .strict();
