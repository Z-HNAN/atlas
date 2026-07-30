import { AppError } from "../../../lib/errors/app-error";

const normalizeDmsParts = (absolute: number) => {
  let degrees = Math.floor(absolute);
  let minutes = Math.floor((absolute - degrees) * 60);
  let seconds = Number((((absolute - degrees) * 60 - minutes) * 60).toFixed(2));
  if (seconds >= 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes = 0;
    degrees += 1;
  }
  return { degrees, minutes, seconds };
};

export const coordinateToDms = (
  value: number,
  axis: "latitude" | "longitude",
) => {
  const limit = axis === "latitude" ? 90 : 180;
  if (!Number.isFinite(value) || value < -limit || value > limit) {
    throw new AppError(
      "DATA_VALIDATION_FAILED",
      axis === "latitude"
        ? "纬度必须在 -90 到 90 之间。"
        : "经度必须在 -180 到 180 之间。",
    );
  }
  const hemisphere =
    axis === "latitude" ? (value < 0 ? "S" : "N") : value < 0 ? "W" : "E";
  const { degrees, minutes, seconds } = normalizeDmsParts(Math.abs(value));
  return `${hemisphere}${degrees}° ${minutes}' ${seconds.toFixed(2)}"`;
};

export const coordinatesToDms = (lat: number, lng: number) =>
  `${coordinateToDms(lat, "latitude")},${coordinateToDms(lng, "longitude")}`;
