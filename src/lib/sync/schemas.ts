import { z } from "zod";

export const remoteSnapshotBaseSchema = z
  .object({
    appId: z.string().min(1),
    version: z.number().int().positive(),
    commitId: z.string().uuid(),
    payloadSchemaVersion: z.number().int().positive(),
    payload: z.unknown(),
    deviceId: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const snapshotEnvelopeSchema = z
  .object({
    formatVersion: z.literal(1),
    appId: z.string().min(1),
    payloadSchemaVersion: z.number().int().positive(),
    exportedAt: z.string().datetime(),
    deviceId: z.string().min(1),
    data: z.unknown(),
  })
  .strict();

export const syncMeResponseSchema = z
  .object({
    user: z
      .object({
        id: z.string().regex(/^[0-9a-f]{64}$/u),
        email: z.string().email(),
      })
      .strict(),
    apps: z.array(
      z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          role: z.enum(["admin", "member", "readonly"]),
        })
        .strict(),
    ),
  })
  .strict();

export const uploadResultSchema = z
  .object({
    appId: z.string().min(1),
    version: z.number().int().positive(),
    baseVersion: z.number().int().nonnegative(),
    commitId: z.string().uuid(),
    payloadSchemaVersion: z.number().int().positive(),
    deviceId: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
    idempotent: z.boolean(),
  })
  .strict();

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        requestId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();
