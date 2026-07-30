import type { z } from "zod";
import type {
  generatedTravelPlanSchema,
  geocodeCacheEntrySchema,
  travelPlanInputSchema,
  travelPointSchema,
  tripDraftSchema,
  tripPayloadSchema,
  tripSchema,
} from "../schemas/trip-schema";

export type Trip = z.infer<typeof tripSchema>;
export type TripPayload = z.infer<typeof tripPayloadSchema>;
export type TravelPoint = z.infer<typeof travelPointSchema>;
export type TripDraft = z.infer<typeof tripDraftSchema>;
export type GeneratedTravelPlan = z.infer<typeof generatedTravelPlanSchema>;
export type TravelPlanInput = z.infer<typeof travelPlanInputSchema>;
export type GeocodeCacheEntry = z.infer<typeof geocodeCacheEntrySchema>;
export type TripStatus = Trip["status"];
export type GeocodeStatus = TravelPoint["geocodeStatus"];

export type AtlasFilter = {
  view: "all" | "visited" | "planned";
  tripId: string;
  year: string;
  theme: string;
};
