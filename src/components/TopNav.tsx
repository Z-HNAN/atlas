import { useLocation, useNavigate } from "react-router-dom";
import type { SubApp } from "../types";
import { toSubAppId } from "../utils/subApp";

type TopNavProps = {
  subApps: SubApp[];
};

const TopNav = ({ subApps }: TopNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're in a sub-app route
  const isInSubApp = location.pathname.startsWith("/apps/");
  const currentAppId = isInSubApp
    ? location.pathname.split("/")[2]
    : undefined;

  const activeApp = isInSubApp
    ? subApps.find((app) => toSubAppId(app.name) === currentAppId)
    : undefined;

  if (!isInSubApp || !activeApp) {
    return null;
  }

  return (
    <header className="top-nav">
      <button
        className="home-btn"
        onClick={() => navigate("/")}
        aria-label="返回主页"
        title="返回主页"
      >
        <svg
          className="home-icon"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4 11.5L12 5l8 6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 10.5V19a1 1 0 0 0 1 1h4v-5h2v5h4a1 1 0 0 0 1-1v-8.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="nav-center">
        <span className="nav-title">{activeApp.name}</span>
      </div>
    </header>
  );
};

export default TopNav;
