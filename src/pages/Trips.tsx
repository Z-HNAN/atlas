import { Link } from "react-router-dom";
import TripCard from "../components/trips/TripCard";
import type { Trip } from "../features/trips/types/trips";

const Trips = ({ trips }: { trips: Trip[] }) => (
  <div className="content-page">
    <header className="page-header">
      <div>
        <p className="eyebrow">JOURNEY LIBRARY</p>
        <h1>旅行收藏</h1>
        <p>从灵感草稿到完成记录，所有路线都在这里。</p>
      </div>
      <Link className="primary-btn" to="/trips/new">
        创建旅行
      </Link>
    </header>
    {trips.length > 0 ? (
      <div className="trip-grid">
        {[...trips]
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
          .map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
      </div>
    ) : (
      <div className="empty-panel">
        <strong>还没有旅行计划</strong>
        <p>可以手工创建，也可以让 DeepSeek 根据一句话生成。</p>
      </div>
    )}
  </div>
);

export default Trips;
