import { z } from "zod";

const appIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "VITE_APP_ID 只能包含小写 ASCII 字母、数字和连字符。",
  );

const optionalPublicUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || z.string().url().safeParse(value).success,
    {
      message: "公开 URL 格式不正确。",
    },
  );

const environmentSchema = z
  .object({
    VITE_APP_ID: appIdSchema.optional().default("atlas"),
    VITE_ENABLE_CLOUD_SYNC: z
      .enum(["true", "false"])
      .optional()
      .default("false"),
    VITE_SYNC_API_BASE_URL: optionalPublicUrlSchema.optional().default(""),
    VITE_DEEPSEEK_MODEL: z
      .string()
      .trim()
      .min(1)
      .optional()
      .default("deepseek-v4-pro"),
    VITE_DEEPSEEK_BASE_URL: optionalPublicUrlSchema
      .optional()
      .default("https://api.deepseek.com"),
    VITE_NOMINATIM_BASE_URL: optionalPublicUrlSchema
      .optional()
      .default("https://nominatim.openstreetmap.org"),
  })
  .passthrough();

export const ENV = environmentSchema.parse(import.meta.env);

export const isCloudSyncConfigured = Boolean(ENV.VITE_SYNC_API_BASE_URL);
