import { describe, expect, it } from "vitest";
import {
  coordinateToDms,
  coordinatesToDms,
} from "../../src/features/trips/pln/dms";
import {
  escapeXml,
  generatePln,
  toSafePlnFilename,
} from "../../src/features/trips/pln/generate-pln";
import type { Trip } from "../../src/features/trips/types/trips";

const makeTrip = (): Trip => {
  const timestamp = "2026-07-30T00:00:00.000Z";
  return {
    id: "trip",
    title: "富士山 & 湖",
    summary: "",
    region: "日本",
    theme: "自然",
    status: "planned",
    rating: null,
    notes: "",
    createdAt: timestamp,
    startedAt: null,
    completedAt: null,
    updatedAt: timestamp,
    points: [
      {
        id: "a",
        orderIndex: 0,
        nameZh: "富士山",
        nameLocal: "",
        country: "日本",
        region: "",
        searchQuery: "Fuji",
        reason: "",
        lat: 35.3606,
        lng: 138.7274,
        geocodeDisplayName: "",
        geocodeStatus: "resolved",
        visited: false,
        pointNote: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "b",
        orderIndex: 1,
        nameZh: "南西测试点",
        nameLocal: "",
        country: "",
        region: "",
        searchQuery: "test",
        reason: "",
        lat: -33.5,
        lng: -70.75,
        geocodeDisplayName: "",
        geocodeStatus: "resolved",
        visited: false,
        pointNote: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };
};

describe("DMS 转换", () => {
  it("覆盖正负经纬度、零和秒进位", () => {
    expect(coordinatesToDms(35.3606, 138.7274)).toBe(
      "N35° 21' 38.16\",E138° 43' 38.64\"",
    );
    expect(coordinateToDms(-33.5, "latitude")).toBe("S33° 30' 0.00\"");
    expect(coordinateToDms(-70.75, "longitude")).toBe("W70° 45' 0.00\"");
    expect(coordinateToDms(0, "latitude")).toBe("N0° 0' 0.00\"");
    expect(coordinateToDms(12.9999999, "latitude")).toBe("N13° 0' 0.00\"");
  });

  it("覆盖边界并拒绝越界", () => {
    expect(coordinateToDms(90, "latitude")).toBe("N90° 0' 0.00\"");
    expect(coordinateToDms(-180, "longitude")).toBe("W180° 0' 0.00\"");
    expect(() => coordinateToDms(90.1, "latitude")).toThrow();
    expect(() => coordinateToDms(-180.1, "longitude")).toThrow();
  });
});

describe("PLN 生成", () => {
  it("严格生成 Custom User 航点与首尾坐标", () => {
    const xml = generatePln(makeTrip());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.match(/<ATCWaypoint id="Custom">/gu)).toHaveLength(2);
    expect(
      xml.match(/<ATCWaypointType>User<\/ATCWaypointType>/gu),
    ).toHaveLength(2);
    expect(xml.match(/<SpeedMaxFP>-1<\/SpeedMaxFP>/gu)).toHaveLength(2);
    expect(xml).toContain(
      "<DepartureLLA>N35° 21' 38.16\",E138° 43' 38.64\"</DepartureLLA>",
    );
    expect(xml).toContain(
      "<DestinationLLA>S33° 30' 0.00\",W70° 45' 0.00\"</DestinationLLA>",
    );
    expect(xml).not.toMatch(/FPType|CruisingAlt|DeparturePosition|ICAO/gu);
  });

  it("转义 XML 并生成 ASCII 文件名", () => {
    expect(escapeXml(`<地点 & "A">`)).toBe("&lt;地点 &amp; &quot;A&quot;&gt;");
    expect(
      toSafePlnFilename("Fuji & 河口湖", new Date("2026-07-11T00:00:00Z")),
    ).toBe("fuji-2026-07-11.pln");
  });
});
