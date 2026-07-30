import { useCallback, useRef, useState } from "react";
import { AppError, toAppError } from "../../../lib/errors/app-error";
import type { LocalAppEnvelope } from "../../../lib/local-data/envelope";
import type { StorageSizeInfo } from "../../../lib/local-data/storage-size";
import { createTripsRepository } from "../repository/trips-repository";
import {
  generatedTravelPlanSchema,
  tripDraftSchema,
  tripSchema,
} from "../schemas/trip-schema";
import type {
  GeneratedTravelPlan,
  GeocodeCacheEntry,
  TravelPoint,
  Trip,
  TripDraft,
  TripPayload,
} from "../types/trips";

export type TripOperationResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: string };

interface TripsState {
  envelope: LocalAppEnvelope<TripPayload> | null;
  error: AppError | null;
}

const readInitialState = (
  repository: ReturnType<typeof createTripsRepository>,
): TripsState => {
  try {
    return { envelope: repository.load(), error: null };
  } catch (error) {
    return {
      envelope: null,
      error: toAppError(error, "本地旅行数据加载失败。"),
    };
  }
};

const createPoint = (
  input: {
    nameZh: string;
    nameLocal?: string;
    country?: string;
    region?: string;
    searchQuery?: string;
    reason?: string;
  },
  orderIndex: number,
  timestamp: string,
): TravelPoint => ({
  id: crypto.randomUUID(),
  orderIndex,
  nameZh: input.nameZh,
  nameLocal: input.nameLocal ?? "",
  country: input.country ?? "",
  region: input.region ?? "",
  searchQuery: input.searchQuery || input.nameLocal || input.nameZh,
  reason: input.reason ?? "",
  lat: null,
  lng: null,
  geocodeDisplayName: "",
  geocodeStatus: "pending",
  visited: false,
  pointNote: "",
  createdAt: timestamp,
  updatedAt: timestamp,
});

const createTrip = (
  draft: TripDraft,
  timestamp: string,
  points: TravelPoint[] = [],
): Trip => ({
  id: crypto.randomUUID(),
  title: draft.title,
  summary: draft.summary,
  region: draft.region,
  theme: draft.theme,
  status: "draft",
  rating: null,
  notes: "",
  createdAt: timestamp,
  startedAt: null,
  completedAt: null,
  updatedAt: timestamp,
  points,
});

export const useTrips = () => {
  const repositoryRef = useRef<ReturnType<typeof createTripsRepository> | null>(
    null,
  );
  repositoryRef.current ??= createTripsRepository();
  const repository = repositoryRef.current;
  const [state, setState] = useState<TripsState>(() =>
    readInitialState(repository),
  );

  const setFailure = useCallback((error: unknown, fallback: string) => {
    const appError = toAppError(error, fallback);
    setState((current) => ({ ...current, error: appError }));
    return { ok: false, error: appError.message } as const;
  }, []);

  const commit = useCallback(
    <T>(
      action: () => { envelope: LocalAppEnvelope<TripPayload>; value: T },
      fallback: string,
    ): TripOperationResult<T> => {
      try {
        const { envelope, value } = action();
        setState({ envelope, error: null });
        return { ok: true, value };
      } catch (error) {
        return setFailure(error, fallback);
      }
    },
    [setFailure],
  );

  const addTrip = useCallback(
    (draft: TripDraft) => {
      const parsed = tripDraftSchema.safeParse(draft);
      if (!parsed.success) {
        return setFailure(
          parsed.error,
          parsed.error.issues[0]?.message ?? "旅行信息无效。",
        );
      }
      return commit(() => {
        const trip = createTrip(parsed.data, new Date().toISOString());
        const envelope = repository.update((payload) => ({
          ...payload,
          trips: [trip, ...payload.trips],
        }));
        return { envelope, value: trip };
      }, "旅行创建失败。");
    },
    [commit, repository, setFailure],
  );

  const addGeneratedTrip = useCallback(
    (plan: GeneratedTravelPlan) => {
      const parsed = generatedTravelPlanSchema.safeParse(plan);
      if (!parsed.success) {
        return setFailure(parsed.error, "AI 旅行计划格式不正确。");
      }
      return commit(() => {
        const timestamp = new Date().toISOString();
        const points = [...parsed.data.points]
          .sort((a, b) => a.order - b.order)
          .map((point, index) => createPoint(point, index, timestamp));
        const trip = createTrip(
          {
            title: parsed.data.title,
            summary: parsed.data.summary,
            region: parsed.data.region,
            theme: parsed.data.theme,
          },
          timestamp,
          points,
        );
        const envelope = repository.update((payload) => ({
          ...payload,
          trips: [trip, ...payload.trips],
        }));
        return { envelope, value: trip };
      }, "AI 旅行计划保存为草稿失败。");
    },
    [commit, repository, setFailure],
  );

  const replaceTrip = useCallback(
    (candidate: Trip) => {
      const parsed = tripSchema.safeParse(candidate);
      if (!parsed.success) {
        return setFailure(
          parsed.error,
          parsed.error.issues[0]?.message ?? "旅行数据校验失败。",
        );
      }
      return commit(() => {
        const current = repository.load();
        if (!current.payload.trips.some((trip) => trip.id === parsed.data.id)) {
          throw new AppError("DATA_VALIDATION_FAILED", "该旅行已不存在。");
        }
        const envelope = repository.update((payload) => ({
          ...payload,
          trips: payload.trips.map((trip) =>
            trip.id === parsed.data.id ? parsed.data : trip,
          ),
        }));
        return { envelope, value: parsed.data };
      }, "旅行保存失败。");
    },
    [commit, repository, setFailure],
  );

  const removeTrip = useCallback(
    (id: string) =>
      commit(() => {
        const current = repository.load();
        if (!current.payload.trips.some((trip) => trip.id === id)) {
          throw new AppError("DATA_VALIDATION_FAILED", "该旅行已不存在。");
        }
        const envelope = repository.update((payload) => ({
          ...payload,
          trips: payload.trips.filter((trip) => trip.id !== id),
        }));
        return { envelope, value: undefined };
      }, "旅行删除失败。"),
    [commit, repository],
  );

  const addPoint = useCallback(
    (tripId: string, nameZh = "新地点") =>
      commit(() => {
        const timestamp = new Date().toISOString();
        let created: TravelPoint | null = null;
        const envelope = repository.update((payload) => ({
          ...payload,
          trips: payload.trips.map((trip) => {
            if (trip.id !== tripId) return trip;
            created = createPoint(
              { nameZh, searchQuery: nameZh },
              trip.points.length,
              timestamp,
            );
            return {
              ...trip,
              status: "draft",
              updatedAt: timestamp,
              points: [...trip.points, created],
            };
          }),
        }));
        if (!created) {
          throw new AppError("DATA_VALIDATION_FAILED", "该旅行已不存在。");
        }
        return { envelope, value: created };
      }, "地点添加失败。"),
    [commit, repository],
  );

  const cacheGeocode = useCallback(
    (entry: GeocodeCacheEntry) =>
      commit(() => {
        const envelope = repository.update((payload) => ({
          ...payload,
          geocodeCache: [
            entry,
            ...payload.geocodeCache.filter(
              (cached) => cached.queryKey !== entry.queryKey,
            ),
          ].slice(0, 1000),
        }));
        return { envelope, value: undefined };
      }, "地点缓存保存失败。"),
    [commit, repository],
  );

  const importData = useCallback(
    (raw: string) =>
      commit(
        () => ({
          envelope: repository.importJson(raw),
          value: undefined,
        }),
        "旅行数据导入失败。",
      ),
    [commit, repository],
  );
  const resetData = useCallback(
    () =>
      commit(
        () => ({ envelope: repository.reset(), value: undefined }),
        "本地旅行数据清空失败。",
      ),
    [commit, repository],
  );
  const exportData = useCallback((): TripOperationResult<string> => {
    try {
      return { ok: true, value: repository.exportJson() };
    } catch (error) {
      return setFailure(error, "旅行数据导出失败。");
    }
  }, [repository, setFailure]);
  const exportLatestBackup = useCallback((): TripOperationResult<string> => {
    try {
      const backup = repository.exportLatestBackupJson();
      if (!backup) {
        throw new AppError(
          "DATA_VALIDATION_FAILED",
          "当前还没有覆盖前的本地备份。",
        );
      }
      return { ok: true, value: backup };
    } catch (error) {
      return setFailure(error, "最近本地备份导出失败。");
    }
  }, [repository, setFailure]);
  const reload = useCallback(() => {
    setState(readInitialState(repository));
  }, [repository]);
  const dismissError = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
  }, []);

  let storageSize: StorageSizeInfo = {
    bytes: 0,
    formatted: "0 B",
    level: "normal",
  };
  try {
    storageSize = repository.getStorageSize();
  } catch {
    // 主错误状态提供恢复入口，容量读取失败不覆盖更具体的错误。
  }

  return {
    repository,
    trips: state.envelope?.payload.trips ?? [],
    geocodeCache: state.envelope?.payload.geocodeCache ?? [],
    envelope: state.envelope,
    storageSize,
    error: state.error,
    addTrip,
    addGeneratedTrip,
    replaceTrip,
    removeTrip,
    addPoint,
    cacheGeocode,
    importData,
    exportData,
    exportLatestBackup,
    resetData,
    reload,
    dismissError,
  };
};
