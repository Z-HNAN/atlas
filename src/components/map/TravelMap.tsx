import L, { type LatLngBoundsExpression } from "leaflet";
import { Fragment, useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { useNavigate } from "react-router-dom";
import type { TravelPoint, Trip } from "../../features/trips/types/trips";

interface TravelMapProps {
  trips: Trip[];
  className?: string;
  interactiveRoutes?: boolean;
}

type LocatedPoint = TravelPoint & { lat: number; lng: number };

const hasCoordinates = (point: TravelPoint): point is LocatedPoint =>
  point.lat !== null && point.lng !== null;

const FitDataBounds = ({ trips }: { trips: Trip[] }) => {
  const map = useMap();
  const bounds = useMemo(
    () =>
      trips.flatMap((trip) =>
        trip.points
          .filter(hasCoordinates)
          .map((point) => [point.lat, point.lng] as [number, number]),
      ),
    [trips],
  );

  useEffect(() => {
    if (bounds.length === 0) return;
    if (bounds.length === 1) {
      map.setView(bounds[0]!, 8);
      return;
    }
    map.fitBounds(bounds as LatLngBoundsExpression, {
      padding: [34, 34],
      maxZoom: 10,
    });
  }, [bounds, map]);
  return null;
};

const markerIcon = (order: number, visited: boolean, planned: boolean) =>
  L.divIcon({
    className: "atlas-marker-shell",
    html: `<span class="atlas-marker ${visited ? "is-visited" : planned ? "is-planned" : ""}">${order}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });

const statusColor = (trip: Trip) => {
  if (trip.status === "completed") return "#f97316";
  if (trip.status === "in_progress") return "#14b8a6";
  if (trip.status === "planned") return "#64748b";
  return "#94a3b8";
};

const TravelMap = ({
  trips,
  className = "",
  interactiveRoutes = false,
}: TravelMapProps) => {
  const navigate = useNavigate();

  return (
    <div className={`map-frame ${className}`.trim()}>
      <MapContainer
        center={[25, 105]}
        zoom={2}
        minZoom={2}
        scrollWheelZoom
        className="atlas-leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitDataBounds trips={trips} />
        {trips.map((trip) => {
          const points = [...trip.points]
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .filter(hasCoordinates);
          const positions = points.map(
            (point) => [point.lat, point.lng] as [number, number],
          );
          return (
            <Fragment key={trip.id}>
              {positions.length > 1 ? (
                <Polyline
                  positions={positions}
                  pathOptions={{
                    color: statusColor(trip),
                    weight: trip.status === "completed" ? 4 : 3,
                    opacity: trip.status === "draft" ? 0.45 : 0.8,
                    dashArray: trip.status === "completed" ? undefined : "8 10",
                  }}
                  eventHandlers={
                    interactiveRoutes
                      ? { click: () => navigate(`/trips/${trip.id}`) }
                      : undefined
                  }
                />
              ) : null}
              {points.map((point) => (
                <Marker
                  key={point.id}
                  position={[point.lat, point.lng]}
                  icon={markerIcon(
                    point.orderIndex + 1,
                    point.visited,
                    trip.status !== "completed",
                  )}
                >
                  <Popup>
                    <div className="map-popup">
                      <strong>
                        {point.orderIndex + 1}. {point.nameZh}
                      </strong>
                      {point.nameLocal ? <span>{point.nameLocal}</span> : null}
                      <p>{point.reason || "暂无推荐理由"}</p>
                      <small>
                        {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                      </small>
                      {point.geocodeDisplayName ? (
                        <small>{point.geocodeDisplayName}</small>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => navigate(`/trips/${trip.id}`)}
                      >
                        查看「{trip.title}」
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default TravelMap;
