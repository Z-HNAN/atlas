import { useNavigate } from "react-router-dom";
import type { AppConfig } from "../types";

type HomeProps = {
  apps: AppConfig[];
  onRemoveApp: (name: string) => void;
};

const Home = ({ apps, onRemoveApp }: HomeProps) => {
  const navigate = useNavigate();

  const handleRemove = (name: string) => {
    const confirmed = window.confirm(`确认删除 ${name} 吗？`);
    if (!confirmed) return;
    onRemoveApp(name);
  };

  return (
    <section className="home-page">
      <h1 className="home-title">Gipsy</h1>
      <div className="app-grid">
        {apps.map((app) => (
          <div
            key={app.name}
            className="app-card"
            onClick={() => {
              const currentUrl = window.location.href;
              const href = `/?appName=${encodeURIComponent(app.name)}&returnUrl=${encodeURIComponent(
                currentUrl
              )}`;
              navigate(href);
            }}
            role="button"
            tabIndex={0}
          >
            <button
              className="delete-btn"
              onClick={(event) => {
                event.stopPropagation();
                handleRemove(app.name);
              }}
              aria-label={`删除 ${app.name}`}
              title="删除"
            >
              ×
            </button>
            <div className="app-card-name">{app.name}</div>
          </div>
        ))}
        <div
          className="app-card add-card"
          onClick={() => navigate("/settings")}
          role="button"
          tabIndex={0}
        >
          <div className="add-icon">+</div>
          <div className="add-text">添加应用</div>
        </div>
      </div>
      {apps.length === 0 && (
        <div className="empty-hint">
          点击【+】块添加你的第一个应用
        </div>
      )}
    </section>
  );
};

export default Home;
