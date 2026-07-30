import { Link } from "react-router-dom";
import { TRIP_STATUS_LABEL } from "../../features/trips/status";
import type { Trip } from "../../features/trips/types/trips";

const TripCard = ({ trip }: { trip: Trip }) => {
  const visited = trip.points.filter((point) => point.visited).length;
  const progress =
    trip.points.length === 0
      ? 0
      : Math.round((visited / trip.points.length) * 100);

  return (
    <article className="trip-card">
      <div className="trip-card-topline">
        <span className={`status-pill status-${trip.status}`}>
          {TRIP_STATUS_LABEL[trip.status]}
        </span>
        <span>{new Date(trip.createdAt).getFullYear()}</span>
      </div>
      <div>
        <p className="eyebrow">{trip.theme || "未设主题"}</p>
        <h3>{trip.title}</h3>
        <p>{trip.summary || "这趟旅行还没有简介。"}</p>
      </div>
      <div className="trip-card-meta">
        <span>{trip.region || "未设地区"}</span>
        <span>{trip.points.length} 个地点</span>
        <span>{progress}% 到访</span>
      </div>
      <div className="progress-track" aria-label={`完成比例 ${progress}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <Link className="card-link" to={`/trips/${trip.id}`}>
        打开旅行
      </Link>
    </article>
  );
};

export default TripCard;
