import type { SupabaseClient } from "@supabase/supabase-js";
import { ENV, isSupabaseConfigured } from "../../config/env";
import { AppError } from "../errors/app-error";

let clientPromise: Promise<SupabaseClient> | null = null;

export const getSupabaseClient = async (): Promise<SupabaseClient> => {
  if (!isSupabaseConfigured) {
    throw new AppError(
      "DATA_VALIDATION_FAILED",
      "云同步尚未配置 Supabase URL 和 Publishable Key。",
    );
  }

  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(ENV.VITE_SUPABASE_URL, ENV.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
  );
  return clientPromise;
};
