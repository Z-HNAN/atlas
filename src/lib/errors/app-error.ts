export type AppErrorCode =
  | "AUTH_REQUIRED"
  | "PERMISSION_DENIED"
  | "OFFLINE"
  | "NETWORK_ERROR"
  | "API_KEY_MISSING"
  | "API_CONFIGURATION_ERROR"
  | "INVALID_RESPONSE"
  | "RATE_LIMITED"
  | "LOCAL_STORAGE_QUOTA_EXCEEDED"
  | "DATA_VALIDATION_FAILED"
  | "DATA_MIGRATION_FAILED"
  | "SYNC_CONFLICT"
  | "REMOTE_VERSION_MISMATCH"
  | "UNKNOWN";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly originalCause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const isQuotaExceededError = (error: unknown) => {
  if (!(error instanceof DOMException)) return false;

  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
};

export const toAppError = (
  error: unknown,
  fallbackMessage = "发生了未知错误，请重试。",
) => {
  if (error instanceof AppError) return error;
  if (isQuotaExceededError(error)) {
    return new AppError(
      "LOCAL_STORAGE_QUOTA_EXCEEDED",
      "浏览器本地空间不足。请先导出数据并清理不再需要的内容。",
      error,
    );
  }

  return new AppError("UNKNOWN", fallbackMessage, error);
};
