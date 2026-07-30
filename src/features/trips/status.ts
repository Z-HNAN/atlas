import type { Trip } from "./types/trips";

export const TRIP_STATUS_LABEL: Record<Trip["status"], string> = {
  draft: "草稿",
  planned: "已计划",
  in_progress: "旅行中",
  completed: "已完成",
};
