import { AppError, isQuotaExceededError } from "../errors/app-error";
import { z } from "zod";

export interface ApiKeyStore {
  get(providerId: string): string | null;
  setSession(providerId: string, apiKey: string): void;
  setPersistent(providerId: string, apiKey: string): void;
  remove(providerId: string): void;
  clearAll(): void;
}

const providerIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const apiKeySchema = z.string().trim().min(1);

export class BrowserApiKeyStore implements ApiKeyStore {
  constructor(
    private readonly session: Storage = window.sessionStorage,
    private readonly persistent: Storage = window.localStorage,
    private readonly prefix = "personal-web-seed:api-key:",
  ) {}

  get(providerId: string) {
    const key = this.keyFor(providerId);
    return this.read(this.session, key) ?? this.read(this.persistent, key);
  }

  setSession(providerId: string, apiKey: string) {
    const key = this.keyFor(providerId);
    const value = this.validateApiKey(apiKey);
    this.write(this.session, key, value);
    this.removeFrom(this.persistent, key);
  }

  setPersistent(providerId: string, apiKey: string) {
    const key = this.keyFor(providerId);
    const value = this.validateApiKey(apiKey);
    this.write(this.persistent, key, value);
    this.removeFrom(this.session, key);
  }

  remove(providerId: string) {
    const key = this.keyFor(providerId);
    this.removeFrom(this.session, key);
    this.removeFrom(this.persistent, key);
  }

  clearAll() {
    this.clearStorage(this.session);
    this.clearStorage(this.persistent);
  }

  private keyFor(providerId: string) {
    const parsed = providerIdSchema.safeParse(providerId);
    if (!parsed.success) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "Provider ID 只能包含小写字母、数字和连字符。",
      );
    }
    return `${this.prefix}${parsed.data}`;
  }

  private validateApiKey(apiKey: string) {
    const parsed = apiKeySchema.safeParse(apiKey);
    if (!parsed.success) {
      throw new AppError("API_KEY_MISSING", "API Key 不能为空。");
    }
    return parsed.data;
  }

  private clearStorage(storage: Storage) {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(this.prefix)) keys.push(key);
    }
    keys.forEach((key) => this.removeFrom(storage, key));
  }

  private read(storage: Storage, key: string) {
    try {
      return storage.getItem(key);
    } catch (error) {
      throw new AppError("UNKNOWN", "浏览器禁止读取 API Key 存储。", error);
    }
  }

  private write(storage: Storage, key: string, value: string) {
    try {
      storage.setItem(key, value);
    } catch (error) {
      if (isQuotaExceededError(error)) {
        throw new AppError(
          "LOCAL_STORAGE_QUOTA_EXCEEDED",
          "浏览器空间不足，无法保存 API Key。",
          error,
        );
      }
      throw new AppError("UNKNOWN", "API Key 保存失败。", error);
    }
  }

  private removeFrom(storage: Storage, key: string) {
    try {
      storage.removeItem(key);
    } catch (error) {
      throw new AppError("UNKNOWN", "API Key 清除失败。", error);
    }
  }
}
