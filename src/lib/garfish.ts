import Garfish, { interfaces } from "garfish";
import type { SubApp } from "../types";
import { toSubAppId } from "../utils/subApp";

let garfishInstance: typeof Garfish | null = null;

const emitSubAppError = (error: Error, appInfo: interfaces.AppInfo) => {
  window.dispatchEvent(
    new CustomEvent("subapp:load-error", {
      detail: {
        name: appInfo.name,
        message: error.message
      }
    })
  );
};

export const initGarfish = (subApps: SubApp[]) => {
  if (subApps.length === 0) {
    return;
  }

  const apps = subApps.map((app) => ({
    name: toSubAppId(app.name),
    entry: app.url,
    activeWhen: `/apps/${toSubAppId(app.name)}`
  }));

  if (!garfishInstance) {
    garfishInstance = Garfish.run({
      basename: "/",
      domGetter: "#subapp-root",
      apps,
      errorLoadApp: emitSubAppError,
      errorMountApp: emitSubAppError
    });
  } else {
    // Register new apps if Garfish is already initialized
    apps.forEach((app) => {
      try {
        garfishInstance?.registerApp(app);
      } catch (e) {
        console.warn(`Failed to register app ${app.name}:`, e);
      }
    });
  }
};

export { garfishInstance };
