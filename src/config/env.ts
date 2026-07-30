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
      message: "Supabase URL 格式不正确。",
    },
  );

const environmentSchema = z
  .object({
    VITE_APP_ID: appIdSchema.optional().default("atlas-travel"),
    VITE_ENABLE_CLOUD_SYNC: z
      .enum(["true", "false"])
      .optional()
      .default("false"),
    VITE_SUPABASE_URL: optionalPublicUrlSchema.optional().default(""),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().trim().optional().default(""),
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

export const isSupabaseConfigured = Boolean(
  ENV.VITE_SUPABASE_URL && ENV.VITE_SUPABASE_PUBLISHABLE_KEY,
);
