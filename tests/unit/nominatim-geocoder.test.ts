import { describe, expect, it, vi } from "vitest";
import { NominatimGeocoder } from "../../src/features/trips/providers/nominatim-geocoder";

describe("NominatimGeocoder", () => {
  it("根据国家和地区评分，不无条件选择第一个结果", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: "35.0",
            lon: "120.0",
            display_name: "Mount Fuji Restaurant, United States",
            importance: 0.8,
            address: { country: "United States" },
          },
          {
            lat: "35.3606",
            lon: "138.7274",
            display_name: "富士山, 静冈县, 日本",
            importance: 0.6,
            address: { country: "日本", state: "静冈县" },
          },
        ]),
        { status: 200 },
      ),
    );
    const geocoder = new NominatimGeocoder({
      fetch: request,
      now: () => new Date("2026-07-30T00:00:00Z"),
    });

    const result = await geocoder.resolve(
      {
        searchQuery: "富士山",
        country: "日本",
        region: "静冈县",
      },
      [],
    );

    expect(result.status).toBe("resolved");
    if (result.status !== "failed") {
      expect(result.lat).toBe(35.3606);
      expect(result.displayName).toContain("日本");
    }
  });

  it("命中持久缓存时不发网络请求", async () => {
    const request = vi.fn<typeof fetch>();
    const geocoder = new NominatimGeocoder({ fetch: request });
    const result = await geocoder.resolve(
      { searchQuery: "Fuji", country: "Japan", region: "" },
      [
        {
          queryKey: "fuji|japan",
          queryText: "Fuji",
          lat: 35,
          lng: 138,
          displayName: "Fuji, Japan",
          createdAt: "2026-07-30T00:00:00.000Z",
          updatedAt: "2026-07-30T00:00:00.000Z",
        },
      ],
    );
    expect(result.status).toBe("resolved");
    expect(request).not.toHaveBeenCalled();
  });
});
