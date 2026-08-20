import { createContext, useContext } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import type { TripOperation } from "../features/trips/hooks/useTrips";
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
import type { CloudSyncController } from "../lib/sync/use-cloud-sync";
import Atlas from "../pages/Atlas";
import Dashboard from "../pages/Dashboard";
import Login from "../pages/Login";
import NewTrip from "../pages/NewTrip";
import NotFound from "../pages/NotFound";
import Settings from "../pages/Settings";
import TripDetail from "../pages/TripDetail";
import Trips from "../pages/Trips";
import { getPageTitle } from "./page-title";

interface AppRouterProps {
  trips: Trip[];
  geocodeCache: GeocodeCacheEntry[];
  envelope: LocalAppEnvelope<TripPayload> | null;
  storageSize: StorageSizeInfo;
  cloudSync: CloudSyncController<TripPayload>;
  onAddTrip: (draft: TripDraft) => TripOperation<Trip>;
  onAddGeneratedTrip: (plan: GeneratedTravelPlan) => TripOperation<Trip>;
  onReplaceTrip: (trip: Trip) => TripOperation<Trip>;
  onRemoveTrip: (id: string) => TripOperation;
  onAddPoint: (tripId: string, nameZh?: string) => TripOperation<TravelPoint>;
  onCacheGeocode: (entry: GeocodeCacheEntry) => TripOperation;
  onExportData: () => TripOperation<string>;
  onExportLatestBackup: () => TripOperation<string>;
  onImportData: (raw: string) => TripOperation;
  onResetData: () => TripOperation;
}

const AppRouterContext = createContext<AppRouterProps | null>(null);

const useAppRouter = () => {
  const value = useContext(AppRouterContext);
  if (!value) throw new Error("AppRouterContext 尚未初始化。");
  return value;
};

const LayoutRoute = () => {
  const props = useAppRouter();
  const location = useLocation();
  return <AppLayout pageTitle={getPageTitle(location.pathname, props.trips)} />;
};

const DashboardRoute = () => {
  const props = useAppRouter();
  return <Dashboard trips={props.trips} />;
};

const AtlasRoute = () => {
  const props = useAppRouter();
  return <Atlas trips={props.trips} />;
};

const TripsRoute = () => {
  const props = useAppRouter();
  return <Trips trips={props.trips} />;
};

const LoginRoute = () => {
  const props = useAppRouter();
  return <Login envelope={props.envelope} cloudSync={props.cloudSync} />;
};

const NewTripRoute = () => {
  const props = useAppRouter();
  return (
    <NewTrip
      onAddTrip={props.onAddTrip}
      onAddGeneratedTrip={props.onAddGeneratedTrip}
    />
  );
};

const TripDetailRoute = () => {
  const props = useAppRouter();
  return (
    <TripDetail
      trips={props.trips}
      geocodeCache={props.geocodeCache}
      onReplaceTrip={props.onReplaceTrip}
      onRemoveTrip={props.onRemoveTrip}
      onAddPoint={props.onAddPoint}
      onCacheGeocode={props.onCacheGeocode}
    />
  );
};

const SettingsRoute = () => {
  const props = useAppRouter();
  return (
    <Settings
      envelope={props.envelope}
      storageSize={props.storageSize}
      cloudSync={props.cloudSync}
      onExportData={props.onExportData}
      onExportLatestBackup={props.onExportLatestBackup}
      onImportData={props.onImportData}
      onResetData={props.onResetData}
    />
  );
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<LayoutRoute />}>
      <Route path="/" element={<DashboardRoute />} />
      <Route path="/atlas" element={<AtlasRoute />} />
      <Route path="/trips" element={<TripsRoute />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/trips/new" element={<NewTripRoute />} />
      <Route path="/trips/:id" element={<TripDetailRoute />} />
      <Route path="/settings" element={<SettingsRoute />} />
      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
  { future: { v7_relativeSplatPath: true } },
);

const AppRouter = (props: AppRouterProps) => (
  <AppRouterContext.Provider value={props}>
    <RouterProvider router={router} future={{ v7_startTransition: true }} />
  </AppRouterContext.Provider>
);

export default AppRouter;
