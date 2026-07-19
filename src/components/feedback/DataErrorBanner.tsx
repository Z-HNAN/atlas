import type { AppError } from "../../lib/errors/app-error";

interface DataErrorBannerProps {
  error: AppError;
  onDismiss: () => void;
  onRetry: () => void;
}

const DataErrorBanner = ({
  error,
  onDismiss,
  onRetry,
}: DataErrorBannerProps) => {
  return (
    <div className="error-banner" role="alert">
      <div>
        <strong>本地数据操作失败</strong>
        <p>{error.message}</p>
      </div>
      <div className="banner-actions">
        <button type="button" className="banner-btn" onClick={onRetry}>
          重试
        </button>
        <button type="button" className="banner-btn" onClick={onDismiss}>
          关闭
        </button>
      </div>
    </div>
  );
};

export default DataErrorBanner;
