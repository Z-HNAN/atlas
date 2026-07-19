import { z } from "zod";
import { AppError } from "../errors/app-error";

const syncPreferencesSchema = z
  .object({
    autoSync: z.boolean(),
  })
  .strict();

export type SyncPreferences = z.infer<typeof syncPreferencesSchema>;

export class BrowserSyncPreferencesStore {
  private readonly key: string;

  constructor(
    appId: string,
    private readonly storage: Storage = window.localStorage,
  ) {
    this.key = `app:${appId}:sync-preferences`;
  }

  load(): SyncPreferences {
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.key);
    } catch (error) {
      throw new AppError("UNKNOWN", "同步设置读取失败。", error);
    }
    if (!raw) return { autoSync: false };

    try {
      return syncPreferencesSchema.parse(JSON.parse(raw) as unknown);
    } catch (error) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "同步设置格式不正确，请重置站点设置后重试。",
        error,
      );
    }
  }

  save(next: SyncPreferences) {
    const valid = syncPreferencesSchema.parse(next);
    try {
      this.storage.setItem(this.key, JSON.stringify(valid));
    } catch (error) {
      throw new AppError("UNKNOWN", "同步设置保存失败。", error);
    }
    return valid;
  }
}
