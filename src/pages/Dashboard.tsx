import { Link } from "react-router-dom";
import TravelMap from "../components/map/TravelMap";
import TripCard from "../components/trips/TripCard";
import type { Trip } from "../features/trips/types/trips";

const Dashboard = ({ trips }: { trips: Trip[] }) => {
  const visitedPoints = trips
    .flatMap((trip) => trip.points)
    .filter((point) => point.visited);
  const completedTrips = trips.filter((trip) => trip.status === "completed");
  const plannedTrips = trips.filter(
    (trip) => trip.status === "planned" || trip.status === "in_progress",
  );
  const recent = [...trips]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 3);

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">PERSONAL VIRTUAL TRAVEL ATLAS</p>
          <h1>
            让每一次起飞，
            <br />
            都有值得抵达的地方。
          </h1>
          <p>
            用 AI 生成旅行灵感，确认真实坐标，导出 Sky4Sim
            路线，并把飞过的世界一点点收藏起来。
          </p>
          <div className="hero-actions">
            <Link className="primary-btn" to="/trips/new">
              创建一次旅行
            </Link>
            <Link className="ghost-btn" to="/atlas">
              浏览世界地图
            </Link>
          </div>
        </div>
        <TravelMap trips={trips} className="hero-map" interactiveRoutes />
      </section>

      <section className="dashboard-stats" aria-label="旅行收藏统计">
        <div>
          <strong>{trips.length}</strong>
          <span>旅行计划</span>
        </div>
        <div>
          <strong>{plannedTrips.length}</strong>
          <span>等待起飞</span>
        </div>
        <div>
          <strong>{completedTrips.length}</strong>
          <span>完成路线</span>
        </div>
        <div>
          <strong>{visitedPoints.length}</strong>
          <span>点亮地点</span>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RECENT JOURNEYS</p>
            <h2>最近的旅行</h2>
          </div>
          <Link className="text-link" to="/trips">
            查看全部
          </Link>
        </div>
        {recent.length > 0 ? (
          <div className="trip-grid">
            {recent.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <strong>世界还没有被点亮</strong>
            <p>创建第一条路线，从一个真正想去看看的地方开始。</p>
            <Link className="primary-btn" to="/trips/new">
              创建旅行
            </Link>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
