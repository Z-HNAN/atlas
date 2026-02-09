import { registerSW } from "virtual:pwa-register";

type UpdateSW = (reloadPage?: boolean) => Promise<void>;

let updateSW: UpdateSW | null = null;

export const initPwa = () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  updateSW = registerSW({
    onNeedRefresh() {
      window.dispatchEvent(new Event("pwa:need-refresh"));
    },
    onOfflineReady() {
      window.dispatchEvent(new Event("pwa:offline-ready"));
    }
  });
};

export const applyPwaUpdate = () => {
  return updateSW?.(true);
};
