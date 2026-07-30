import { AppError } from "../../../lib/errors/app-error";
import type { TravelPoint, Trip } from "../types/trips";
import { coordinatesToDms } from "./dms";

export const escapeXml = (value: string) =>
  value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");

const confirmedPoints = (points: readonly TravelPoint[]) =>
  [...points]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .filter(
      (
        point,
      ): point is TravelPoint & {
        lat: number;
        lng: number;
      } =>
        point.geocodeStatus === "resolved" &&
        point.lat !== null &&
        point.lng !== null,
    );

export const generatePln = (trip: Pick<Trip, "points">) => {
  const points = confirmedPoints(trip.points);
  if (points.length !== trip.points.length || points.length < 2) {
    throw new AppError(
      "DATA_VALIDATION_FAILED",
      "导出前请至少确认两个地点，并确保所有地点都有有效坐标。",
    );
  }
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) {
    throw new AppError("DATA_VALIDATION_FAILED", "旅行路线缺少有效地点。");
  }
  const waypoints = points
    .map(
      (point) => `    <ATCWaypoint id="Custom">
      <ATCWaypointType>User</ATCWaypointType>
      <WorldPosition>${coordinatesToDms(point.lat, point.lng)}</WorldPosition>
      <SpeedMaxFP>-1</SpeedMaxFP>
    </ATCWaypoint>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<SimBase.Document Type="AceXML" version="1,0">
  <Descr>AceXML Document</Descr>
  <FlightPlan.FlightPlan>
    <Title>Custom to Custom</Title>
    <DepartureID>
    </DepartureID>
    <DepartureLLA>${coordinatesToDms(first.lat, first.lng)}</DepartureLLA>
    <DestinationID>
    </DestinationID>
    <DestinationLLA>${coordinatesToDms(last.lat, last.lng)}</DestinationLLA>
    <Descr>Custom to Custom</Descr>
    <DepartureName>Custom</DepartureName>
    <DestinationName>Custom</DestinationName>
    <AppVersion>
      <AppVersionMajor>11</AppVersionMajor>
      <AppVersionBuild>282174</AppVersionBuild>
    </AppVersion>

${waypoints}
  </FlightPlan.FlightPlan>
</SimBase.Document>`;
};

export const toSafePlnFilename = (title: string, date = new Date()) => {
  const asciiTitle = Array.from(title)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code <= 126;
    })
    .join("");
  const normalized = asciiTitle
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 60);
  const fallback = "virtual-trip";
  return `${normalized || fallback}-${date.toISOString().slice(0, 10)}.pln`;
};

export const downloadPln = (trip: Trip) => {
  const xml = generatePln(trip);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = toSafePlnFilename(trip.title);
  anchor.click();
  URL.revokeObjectURL(url);
};
