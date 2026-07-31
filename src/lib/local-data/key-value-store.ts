import Dexie, { type Table } from "dexie";
import { AppError, isQuotaExceededError } from "../errors/app-error";

export interface AsyncKeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const toStorageError = (error: unknown, action: string) => {
  if (isQuotaExceededError(error)) {
    return new AppError(
      "LOCAL_STORAGE_QUOTA_EXCEEDED",
      "浏览器本地空间不足。请先导出数据并清理不再需要的内容。",
      error,
    );
  }
  return new AppError(
    "UNKNOWN",
    `浏览器本地数据库${action}失败，请检查隐私或站点设置。`,
    error,
  );
};

export class StorageKeyValueStore implements AsyncKeyValueStore {
  constructor(private readonly storage: Storage) {}

  get(key: string) {
    try {
      return Promise.resolve(this.storage.getItem(key));
    } catch (error) {
      return Promise.reject(toStorageError(error, "读取"));
    }
  }

  set(key: string, value: string) {
    try {
      this.storage.setItem(key, value);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(toStorageError(error, "写入"));
    }
  }

  remove(key: string) {
    try {
      this.storage.removeItem(key);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(toStorageError(error, "清理"));
    }
  }
}

export class DexieKeyValueStore implements AsyncKeyValueStore {
  private readonly database: Dexie;
  private readonly records: Table<unknown, string>;

  constructor(databaseName: string, storeName = "records") {
    this.database = new Dexie(databaseName);
    this.database.version(1).stores({ [storeName]: "" });
    this.records = this.database.table<unknown, string>(storeName);
  }

  async get(key: string): Promise<string | null> {
    return this.execute("读取", async () => {
      const result = await this.records.get(key);
      if (result === undefined) return null;
      if (typeof result !== "string") {
        throw new AppError(
          "DATA_VALIDATION_FAILED",
          "IndexedDB 中的记录格式不正确。",
        );
      }
      return result;
    });
  }

  async set(key: string, value: string): Promise<void> {
    await this.execute("写入", () => this.records.put(value, key));
  }

  async remove(key: string): Promise<void> {
    await this.execute("清理", () => this.records.delete(key));
  }

  close(): void {
    this.database.close();
  }

  private async execute<T>(
    action: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw toStorageError(error, action);
    }
  }
}
