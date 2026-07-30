import { useMemo, useState } from "react";
import TravelMap from "../components/map/TravelMap";
import type { AtlasFilter, Trip } from "../features/trips/types/trips";

const Atlas = ({ trips }: { trips: Trip[] }) => {
  const [filter, setFilter] = useState<AtlasFilter>({
    view: "all",
    tripId: "",
    year: "",
    theme: "",
  });
  const years = [
    ...new Set(
      trips.map((trip) => String(new Date(trip.createdAt).getFullYear())),
    ),
  ]
    .sort()
    .reverse();
  const themes = [
    ...new Set(trips.map((trip) => trip.theme).filter(Boolean)),
  ].sort();
  const visibleTrips = useMemo(
    () =>
      trips
        .filter((trip) => !filter.tripId || trip.id === filter.tripId)
        .filter(
          (trip) =>
            !filter.year ||
            String(new Date(trip.createdAt).getFullYear()) === filter.year,
        )
        .filter((trip) => !filter.theme || trip.theme === filter.theme)
        .filter(
          (trip) =>
            filter.view !== "planned" ||
            trip.status === "draft" ||
            trip.status === "planned" ||
            trip.status === "in_progress",
        )
        .map((trip) => {
          if (filter.view === "all") return trip;
          const points = trip.points.filter((point) =>
            filter.view === "visited" ? point.visited : !point.visited,
          );
          return { ...trip, points };
        })
        .filter((trip) => filter.view === "all" || trip.points.length > 0),
    [filter, trips],
  );

  return (
    <div className="atlas-page">
      <header className="page-header atlas-header">
        <div>
          <p className="eyebrow">WORLD COLLECTION MAP</p>
          <h1>我的世界收藏地图</h1>
          <p>橙色是已经到访，灰色是仍在等待的下一站。</p>
        </div>
        <div className="atlas-legend">
          <span>
            <i className="legend-dot visited" />
            已到访
          </span>
          <span>
            <i className="legend-dot planned" />
            计划中
          </span>
          <span>
            <i className="legend-line" />
            旅行路线
          </span>
        </div>
      </header>
      <div className="atlas-toolbar">
        <div className="segmented-control compact">
          {(
            [
              ["all", "查看全部"],
              ["visited", "只看已到访"],
              ["planned", "只看计划中"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter.view === value}
              onClick={() => setFilter({ ...filter, view: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          aria-label="按旅行筛选"
          value={filter.tripId}
          onChange={(event) =>
            setFilter({ ...filter, tripId: event.target.value })
          }
        >
          <option value="">全部旅行</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.title}
            </option>
          ))}
        </select>
        <select
          aria-label="按年份筛选"
          value={filter.year}
          onChange={(event) =>
            setFilter({ ...filter, year: event.target.value })
          }
        >
          <option value="">全部年份</option>
          {years.map((year) => (
            <option key={year}>{year}</option>
          ))}
        </select>
        <select
          aria-label="按主题筛选"
          value={filter.theme}
          onChange={(event) =>
            setFilter({ ...filter, theme: event.target.value })
          }
        >
          <option value="">全部主题</option>
          {themes.map((theme) => (
            <option key={theme}>{theme}</option>
          ))}
        </select>
      </div>
      <TravelMap trips={visibleTrips} className="world-map" interactiveRoutes />
      <div className="atlas-summary">
        <strong>{visibleTrips.length}</strong> 条路线 ·{" "}
        <strong>{visibleTrips.flatMap((trip) => trip.points).length}</strong>{" "}
        个可见地点
      </div>
    </div>
  );
};

export default Atlas;
