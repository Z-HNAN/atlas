export const STORAGE_WARNING_BYTES = 10 * 1024 * 1024;
export const STORAGE_CRITICAL_BYTES = 18 * 1024 * 1024;

export type StorageSizeLevel = "normal" | "warning" | "critical";

export interface StorageSizeInfo {
  bytes: number;
  formatted: string;
  level: StorageSizeLevel;
}

export const getUtf8ByteLength = (value: string) =>
  new TextEncoder().encode(value).byteLength;

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export const getStorageSizeInfo = (raw: string | null): StorageSizeInfo => {
  const bytes = raw ? getUtf8ByteLength(raw) : 0;
  const level: StorageSizeLevel =
    bytes > STORAGE_CRITICAL_BYTES
      ? "critical"
      : bytes >= STORAGE_WARNING_BYTES
        ? "warning"
        : "normal";

  return { bytes, formatted: formatBytes(bytes), level };
};
