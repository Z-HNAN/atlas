import { Route, Routes } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import type { CloudSyncController } from "../features/trips/hooks/useCloudSync";
import type { TripOperationResult } from "../features/trips/hooks/useTrips";
import type {
  GeneratedTravelPlan,
  GeocodeCacheEntry,
  TravelPoint,
  Trip,
  TripDraft,
  TripPayload,
} from "../features/trips/types/trips";
import type { LocalAppEnvelope } from "../lib/local-data/envelope";
import type { StorageSizeInfo } from "../lib/local-data/storage-size";
import Atlas from "../pages/Atlas";
import Dashboard from "../pages/Dashboard";
import NewTrip from "../pages/NewTrip";
import NotFound from "../pages/NotFound";
import Settings from "../pages/Settings";
import TripDetail from "../pages/TripDetail";
import Trips from "../pages/Trips";

interface AppRouterProps {
  trips: Trip[];
  geocodeCache: GeocodeCacheEntry[];
  envelope: LocalAppEnvelope<TripPayload> | null;
  storageSize: StorageSizeInfo;
  cloudSync: CloudSyncController;
  onAddTrip: (draft: TripDraft) => TripOperationResult<Trip>;
  onAddGeneratedTrip: (plan: GeneratedTravelPlan) => TripOperationResult<Trip>;
  onReplaceTrip: (trip: Trip) => TripOperationResult<Trip>;
  onRemoveTrip: (id: string) => TripOperationResult;
  onAddPoint: (
    tripId: string,
    nameZh?: string,
  ) => TripOperationResult<TravelPoint>;
  onCacheGeocode: (entry: GeocodeCacheEntry) => TripOperationResult;
  onExportData: () => TripOperationResult<string>;
  onExportLatestBackup: () => TripOperationResult<string>;
  onImportData: (raw: string) => TripOperationResult;
  onResetData: () => TripOperationResult;
}

const AppRouter = (props: AppRouterProps) => (
  <Routes>
    <Route element={<AppLayout />}>
      <Route path="/" element={<Dashboard trips={props.trips} />} />
      <Route path="/atlas" element={<Atlas trips={props.trips} />} />
      <Route path="/trips" element={<Trips trips={props.trips} />} />
      <Route
        path="/trips/new"
        element={
          <NewTrip
            onAddTrip={props.onAddTrip}
            onAddGeneratedTrip={props.onAddGeneratedTrip}
          />
        }
      />
      <Route
        path="/trips/:id"
        element={
          <TripDetail
            trips={props.trips}
            geocodeCache={props.geocodeCache}
            onReplaceTrip={props.onReplaceTrip}
            onRemoveTrip={props.onRemoveTrip}
            onAddPoint={props.onAddPoint}
            onCacheGeocode={props.onCacheGeocode}
          />
        }
      />
      <Route
        path="/settings"
        element={
          <Settings
            envelope={props.envelope}
            storageSize={props.storageSize}
            cloudSync={props.cloudSync}
            onExportData={props.onExportData}
            onExportLatestBackup={props.onExportLatestBackup}
            onImportData={props.onImportData}
            onResetData={props.onResetData}
          />
        }
      />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);

export default AppRouter;
