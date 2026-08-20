import type { Trip } from "./types/trips";

export const hasUnsavedTripChanges = (
  source: Trip | null | undefined,
  draft: Trip | null | undefined,
) =>
  Boolean(
    source &&
      draft &&
      source.id === draft.id &&
      JSON.stringify(source) !== JSON.stringify(draft),
  );
