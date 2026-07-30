import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TravelMap from "../components/map/TravelMap";
import type { TripOperationResult } from "../features/trips/hooks/useTrips";
import { downloadPln } from "../features/trips/pln/generate-pln";
import {
  NominatimGeocoder,
  SerialGeocodeQueue,
} from "../features/trips/providers/nominatim-geocoder";
import { TRIP_STATUS_LABEL } from "../features/trips/status";
import type {
  GeocodeCacheEntry,
  TravelPoint,
  Trip,
} from "../features/trips/types/trips";
import { toAppError } from "../lib/errors/app-error";

interface TripDetailProps {
  trips: Trip[];
  geocodeCache: GeocodeCacheEntry[];
  onReplaceTrip: (trip: Trip) => TripOperationResult<Trip>;
  onRemoveTrip: (id: string) => TripOperationResult;
  onAddPoint: (
    tripId: string,
    nameZh?: string,
  ) => TripOperationResult<TravelPoint>;
  onCacheGeocode: (entry: GeocodeCacheEntry) => TripOperationResult;
}

const TripDetail = ({
  trips,
  geocodeCache,
  onReplaceTrip,
  onRemoveTrip,
  onAddPoint,
  onCacheGeocode,
}: TripDetailProps) => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const source = trips.find((trip) => trip.id === id);
  const [draft, setDraft] = useState<Trip | null>(source ?? null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [geocoding, setGeocoding] = useState("");
  const geocoderRef = useRef(new NominatimGeocoder());
  const queueRef = useRef(new SerialGeocodeQueue());

  useEffect(() => setDraft(source ?? null), [source]);

  const orderedPoints = useMemo(
    () =>
      [...(draft?.points ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [draft?.points],
  );
  const allConfirmed =
    orderedPoints.length >= 2 &&
    orderedPoints.every(
      (point) =>
        point.geocodeStatus === "resolved" &&
        point.lat !== null &&
        point.lng !== null,
    );
  const visitedCount = orderedPoints.filter((point) => point.visited).length;
  const progress =
    orderedPoints.length === 0
      ? 0
      : Math.round((visitedCount / orderedPoints.length) * 100);

  if (!source || !draft) {
    return (
      <div className="empty-panel content-page">
        <strong>没有找到这趟旅行</strong>
        <p>它可能已被删除，或者链接来自另一台设备。</p>
        <Link className="primary-btn" to="/trips">
          返回旅行列表
        </Link>
      </div>
    );
  }

  const save = (candidate: Trip, successMessage: string) => {
    const result = onReplaceTrip(candidate);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setDraft(result.value);
    setMessage(successMessage);
    setError("");
    return true;
  };

  const updatePoint = (
    pointId: string,
    updater: (point: TravelPoint) => TravelPoint,
    downgrade = true,
  ) => {
    const timestamp = new Date().toISOString();
    setDraft((current) =>
      current
        ? {
            ...current,
            status: downgrade ? "draft" : current.status,
            startedAt: downgrade ? null : current.startedAt,
            completedAt: downgrade ? null : current.completedAt,
            updatedAt: timestamp,
            points: current.points.map((point) =>
              point.id === pointId
                ? { ...updater(point), updatedAt: timestamp }
                : point,
            ),
          }
        : current,
    );
  };

  const handleGeocodeOne = async (pointId: string) => {
    const point = draft.points.find((item) => item.id === pointId);
    if (!point) return;
    setGeocoding(pointId);
    setError("");
    try {
      const resolution = await queueRef.current.enqueue(() =>
        geocoderRef.current.resolve(point, geocodeCache),
      );
      if (resolution.status === "failed") {
        const next = {
          ...draft,
          status: "draft" as const,
          points: draft.points.map((item) =>
            item.id === pointId
              ? { ...item, geocodeStatus: "failed" as const }
              : item,
          ),
          updatedAt: new Date().toISOString(),
        };
        save(next, "未找到可靠坐标，请修改搜索词或手工填写。");
        return;
      }
      const next = {
        ...draft,
        status: "draft" as const,
        points: draft.points.map((item) =>
          item.id === pointId
            ? {
                ...item,
                lat: resolution.lat,
                lng: resolution.lng,
                geocodeDisplayName: resolution.displayName,
                geocodeStatus: resolution.status,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
        updatedAt: new Date().toISOString(),
      };
      const saved = save(
        next,
        resolution.status === "ambiguous"
          ? "找到多个相近结果，请检查地图后手工确认。"
          : "地点坐标已解析并保存。",
      );
      if (saved && resolution.status === "resolved") {
        onCacheGeocode(resolution.cacheEntry);
      }
    } catch (caught) {
      setError(toAppError(caught, "地点查询失败。").message);
    } finally {
      setGeocoding("");
    }
  };

  const handleGeocodeAll = async () => {
    let next = draft;
    let cache = [...geocodeCache];
    const newCacheEntries: GeocodeCacheEntry[] = [];
    const targets = orderedPoints.filter(
      (point) => point.geocodeStatus !== "resolved",
    );
    if (targets.length === 0) {
      setMessage("所有地点都已确认，无需再次查询。");
      return;
    }
    setGeocoding("all");
    setError("");
    for (const target of targets) {
      setMessage(`正在查询：${target.nameZh}`);
      try {
        const resolution = await queueRef.current.enqueue(() =>
          geocoderRef.current.resolve(target, cache),
        );
        if (resolution.status !== "failed") {
          if (resolution.status === "resolved") {
            cache = [
              resolution.cacheEntry,
              ...cache.filter(
                (entry) => entry.queryKey !== resolution.cacheEntry.queryKey,
              ),
            ];
            newCacheEntries.push(resolution.cacheEntry);
          }
          next = {
            ...next,
            status: "draft",
            updatedAt: new Date().toISOString(),
            points: next.points.map((point) =>
              point.id === target.id
                ? {
                    ...point,
                    lat: resolution.lat,
                    lng: resolution.lng,
                    geocodeDisplayName: resolution.displayName,
                    geocodeStatus: resolution.status,
                    updatedAt: new Date().toISOString(),
                  }
                : point,
            ),
          };
        } else {
          next = {
            ...next,
            status: "draft",
            updatedAt: new Date().toISOString(),
            points: next.points.map((point) =>
              point.id === target.id
                ? { ...point, geocodeStatus: "failed" }
                : point,
            ),
          };
        }
        setDraft(next);
      } catch (caught) {
        next = {
          ...next,
          status: "draft",
          updatedAt: new Date().toISOString(),
          points: next.points.map((point) =>
            point.id === target.id
              ? { ...point, geocodeStatus: "failed" }
              : point,
          ),
        };
        setError(toAppError(caught, `${target.nameZh} 查询失败。`).message);
      }
    }
    const saved = save(next, "批量查询完成，请人工检查歧义或失败地点。");
    if (saved) {
      newCacheEntries.forEach((entry) => onCacheGeocode(entry));
    }
    setGeocoding("");
  };

  const movePoint = (pointId: string, direction: -1 | 1) => {
    const index = orderedPoints.findIndex((point) => point.id === pointId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= orderedPoints.length)
      return;
    const reordered = [...orderedPoints];
    const [moving] = reordered.splice(index, 1);
    if (!moving) return;
    reordered.splice(targetIndex, 0, moving);
    setDraft({
      ...draft,
      status: "draft",
      startedAt: null,
      completedAt: null,
      updatedAt: new Date().toISOString(),
      points: reordered.map((point, orderIndex) => ({ ...point, orderIndex })),
    });
  };

  const removePoint = (pointId: string) => {
    if (!window.confirm("确认删除这个地点吗？")) return;
    const points = orderedPoints
      .filter((point) => point.id !== pointId)
      .map((point, orderIndex) => ({ ...point, orderIndex }));
    setDraft({
      ...draft,
      status: "draft",
      startedAt: null,
      completedAt: null,
      updatedAt: new Date().toISOString(),
      points,
    });
  };

  const changeStatus = (status: Trip["status"]) => {
    if (status === "planned" && !allConfirmed) {
      setError("确认计划前，至少添加两个地点并确认全部坐标。");
      return;
    }
    const now = new Date().toISOString();
    const next: Trip = {
      ...draft,
      status,
      startedAt:
        status === "in_progress"
          ? (draft.startedAt ?? now)
          : status === "draft" || status === "planned"
            ? null
            : draft.startedAt,
      completedAt: status === "completed" ? now : null,
      updatedAt: now,
    };
    save(next, `旅行状态已更新为“${TRIP_STATUS_LABEL[status]}”。`);
  };

  return (
    <div className="content-page trip-detail-page">
      <div className="detail-topbar">
        <Link className="text-link" to="/trips">
          ← 返回旅行列表
        </Link>
        <div className="detail-actions">
          <button
            className="danger-link"
            type="button"
            onClick={() => {
              if (!window.confirm(`确认删除“${draft.title}”及全部地点吗？`))
                return;
              const result = onRemoveTrip(draft.id);
              if (result.ok) navigate("/trips");
              else setError(result.error);
            }}
          >
            删除旅行
          </button>
          <button
            className="secondary-btn"
            type="button"
            disabled={!allConfirmed}
            onClick={() => {
              try {
                downloadPln(draft);
                setMessage("PLN 已生成，请在下载目录中查看。");
              } catch (caught) {
                setError(toAppError(caught, "PLN 导出失败。").message);
              }
            }}
          >
            导出 MSFS / Sky4Sim PLN
          </button>
          <button
            className="primary-btn"
            type="button"
            onClick={() => save(draft, "旅行修改已保存。")}
          >
            保存修改
          </button>
        </div>
      </div>

      <header className="trip-detail-header">
        <div>
          <div className="trip-card-topline">
            <span className={`status-pill status-${draft.status}`}>
              {TRIP_STATUS_LABEL[draft.status]}
            </span>
            <span>{draft.region || "未设地区"}</span>
          </div>
          <input
            className="title-input"
            aria-label="旅行标题"
            value={draft.title}
            maxLength={160}
            onChange={(event) =>
              setDraft({
                ...draft,
                title: event.target.value,
                updatedAt: new Date().toISOString(),
              })
            }
          />
          <textarea
            className="summary-input"
            aria-label="旅行简介"
            rows={2}
            value={draft.summary}
            onChange={(event) =>
              setDraft({
                ...draft,
                summary: event.target.value,
                updatedAt: new Date().toISOString(),
              })
            }
            placeholder="写下这趟旅行为什么值得出发。"
          />
        </div>
        <div className="progress-ring">
          <strong>{progress}%</strong>
          <span>
            {visitedCount}/{orderedPoints.length} 到访
          </span>
        </div>
      </header>

      <div className="detail-grid">
        <section className="detail-map-panel">
          <TravelMap trips={[draft]} className="detail-map" />
          <div className="map-caption">
            <span>地图仅用于路线预览与人工确认，不提供航空导航。</span>
            <span>© OpenStreetMap contributors</span>
          </div>
        </section>
        <aside className="status-panel">
          <p className="eyebrow">TRIP STATUS</p>
          <h2>旅行进度</h2>
          <div className="status-actions">
            {draft.status === "draft" ? (
              <button
                type="button"
                className="primary-btn"
                onClick={() => changeStatus("planned")}
                disabled={!allConfirmed}
              >
                确认旅行计划
              </button>
            ) : null}
            {draft.status === "planned" ? (
              <button
                type="button"
                className="primary-btn"
                onClick={() => changeStatus("in_progress")}
              >
                开始旅行
              </button>
            ) : null}
            {draft.status === "in_progress" ? (
              <button
                type="button"
                className="primary-btn"
                onClick={() => changeStatus("completed")}
              >
                完成旅行
              </button>
            ) : null}
            {draft.status !== "draft" ? (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => changeStatus("draft")}
              >
                退回草稿编辑
              </button>
            ) : null}
          </div>
          <dl className="trip-facts">
            <div>
              <dt>创建</dt>
              <dd>{new Date(draft.createdAt).toLocaleDateString("zh-CN")}</dd>
            </div>
            <div>
              <dt>开始</dt>
              <dd>
                {draft.startedAt
                  ? new Date(draft.startedAt).toLocaleString("zh-CN")
                  : "尚未开始"}
              </dd>
            </div>
            <div>
              <dt>完成</dt>
              <dd>
                {draft.completedAt
                  ? new Date(draft.completedAt).toLocaleString("zh-CN")
                  : "尚未完成"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <section className="points-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ROUTE POINTS</p>
            <h2>路线与人工确认</h2>
            <p>编辑地点会把旅行退回草稿；顺序编号会同步到地图与 PLN。</p>
          </div>
          <div className="detail-actions">
            <button
              className="secondary-btn"
              type="button"
              disabled={Boolean(geocoding)}
              onClick={() => void handleGeocodeAll()}
            >
              {geocoding === "all" ? "正在串行查询…" : "查询全部未确认地点"}
            </button>
            <button
              className="primary-btn"
              type="button"
              onClick={() => {
                if (!save(draft, "当前修改已保存。")) return;
                const result = onAddPoint(draft.id);
                if (!result.ok) setError(result.error);
                else setMessage("新地点已添加到路线末尾。");
              }}
            >
              添加地点
            </button>
          </div>
        </div>
        {orderedPoints.length > 0 ? (
          <ol className="point-editor-list">
            {orderedPoints.map((point, index) => (
              <li
                key={point.id}
                className={`point-editor status-${point.geocodeStatus}`}
              >
                <div className="point-order">{index + 1}</div>
                <div className="point-fields">
                  <div className="form-row">
                    <label className="form-field">
                      <span>中文名称</span>
                      <input
                        value={point.nameZh}
                        onChange={(event) =>
                          updatePoint(point.id, (current) => ({
                            ...current,
                            nameZh: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="form-field">
                      <span>当地 / 英文名称</span>
                      <input
                        value={point.nameLocal}
                        onChange={(event) =>
                          updatePoint(point.id, (current) => ({
                            ...current,
                            nameLocal: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label className="form-field">
                      <span>国家</span>
                      <input
                        value={point.country}
                        onChange={(event) =>
                          updatePoint(point.id, (current) => ({
                            ...current,
                            country: event.target.value,
                            geocodeStatus: "pending",
                          }))
                        }
                      />
                    </label>
                    <label className="form-field">
                      <span>地区</span>
                      <input
                        value={point.region}
                        onChange={(event) =>
                          updatePoint(point.id, (current) => ({
                            ...current,
                            region: event.target.value,
                            geocodeStatus: "pending",
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="form-field">
                    <span>地理编码搜索词</span>
                    <input
                      value={point.searchQuery}
                      onChange={(event) =>
                        updatePoint(point.id, (current) => ({
                          ...current,
                          searchQuery: event.target.value,
                          geocodeStatus: "pending",
                        }))
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>推荐理由</span>
                    <textarea
                      rows={2}
                      value={point.reason}
                      onChange={(event) =>
                        updatePoint(point.id, (current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="form-row coordinate-row">
                    <label className="form-field">
                      <span>纬度</span>
                      <input
                        type="number"
                        step="any"
                        min={-90}
                        max={90}
                        value={point.lat ?? ""}
                        onChange={(event) =>
                          updatePoint(point.id, (current) => ({
                            ...current,
                            lat:
                              event.target.value === ""
                                ? null
                                : Number(event.target.value),
                            geocodeStatus: "ambiguous",
                          }))
                        }
                      />
                    </label>
                    <label className="form-field">
                      <span>经度</span>
                      <input
                        type="number"
                        step="any"
                        min={-180}
                        max={180}
                        value={point.lng ?? ""}
                        onChange={(event) =>
                          updatePoint(point.id, (current) => ({
                            ...current,
                            lng:
                              event.target.value === ""
                                ? null
                                : Number(event.target.value),
                            geocodeStatus: "ambiguous",
                          }))
                        }
                      />
                    </label>
                    <div className="geocode-state">
                      <span>
                        {point.geocodeStatus === "resolved"
                          ? "坐标已确认"
                          : point.geocodeStatus === "ambiguous"
                            ? "需要人工确认"
                            : point.geocodeStatus === "failed"
                              ? "查询失败"
                              : "等待查询"}
                      </span>
                      {point.geocodeDisplayName ? (
                        <small>{point.geocodeDisplayName}</small>
                      ) : null}
                    </div>
                  </div>
                  <div className="point-record-row">
                    <label className="visit-check">
                      <input
                        type="checkbox"
                        checked={point.visited}
                        onChange={() =>
                          updatePoint(
                            point.id,
                            (current) => ({
                              ...current,
                              visited: !current.visited,
                            }),
                            false,
                          )
                        }
                      />{" "}
                      已到访
                    </label>
                    <input
                      aria-label="地点备注"
                      value={point.pointNote}
                      onChange={(event) =>
                        updatePoint(
                          point.id,
                          (current) => ({
                            ...current,
                            pointNote: event.target.value,
                          }),
                          false,
                        )
                      }
                      placeholder="添加到访备注"
                    />
                  </div>
                </div>
                <div className="point-actions">
                  <button
                    type="button"
                    title="上移"
                    disabled={index === 0}
                    onClick={() => movePoint(point.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title="下移"
                    disabled={index === orderedPoints.length - 1}
                    onClick={() => movePoint(point.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={geocoding === point.id}
                    onClick={() => void handleGeocodeOne(point.id)}
                  >
                    {geocoding === point.id ? "…" : "查询"}
                  </button>
                  {point.lat !== null &&
                  point.lng !== null &&
                  point.geocodeStatus !== "resolved" ? (
                    <button
                      type="button"
                      onClick={() =>
                        updatePoint(point.id, (current) => ({
                          ...current,
                          geocodeStatus: "resolved",
                        }))
                      }
                    >
                      确认坐标
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="danger-link"
                    onClick={() => removePoint(point.id)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-panel">
            <strong>路线还没有地点</strong>
            <p>添加至少两个地点，然后查询或手工确认坐标。</p>
          </div>
        )}
      </section>

      <section className="record-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TRAVEL LOG</p>
            <h2>评分与旅行总结</h2>
          </div>
        </div>
        <div className="form-row">
          <label className="form-field rating-field">
            <span>整条旅行评分</span>
            <select
              value={draft.rating ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  rating: event.target.value
                    ? Number(event.target.value)
                    : null,
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              <option value="">尚未评分</option>
              {Array.from({ length: 10 }, (_, index) => index + 1).map(
                (rating) => (
                  <option key={rating} value={rating}>
                    {rating} / 10
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="form-field">
            <span>主题</span>
            <input
              value={draft.theme}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  theme: event.target.value,
                  updatedAt: new Date().toISOString(),
                })
              }
            />
          </label>
          <label className="form-field">
            <span>地区</span>
            <input
              value={draft.region}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  region: event.target.value,
                  updatedAt: new Date().toISOString(),
                })
              }
            />
          </label>
        </div>
        <label className="form-field">
          <span>旅行总结</span>
          <textarea
            rows={5}
            maxLength={3000}
            value={draft.notes}
            onChange={(event) =>
              setDraft({
                ...draft,
                notes: event.target.value,
                updatedAt: new Date().toISOString(),
              })
            }
            placeholder="记录航线体验、最喜欢的地点，或下一次想调整的地方。"
          />
        </label>
      </section>
      {error ? (
        <div className="floating-feedback error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="floating-feedback success" role="status">
          {message}
        </div>
      ) : null}
    </div>
  );
};

export default TripDetail;
