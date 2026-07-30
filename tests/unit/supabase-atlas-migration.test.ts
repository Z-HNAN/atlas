import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../supabase/migrations/0002_atlas_travel.sql",
  import.meta.url,
);

describe("Atlas Supabase migration", () => {
  it("包含规范化旅行表、约束和 owner RLS，且不授予匿名写权限", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toContain("create table if not exists public.trips");
    expect(sql).toContain("create table if not exists public.trip_points");
    expect(sql).toContain("create table if not exists public.geocode_cache");
    expect(sql).toContain("create table if not exists public.atlas_owners");
    expect(sql).toContain("public.is_atlas_owner()");
    expect(sql).toContain("alter table public.trips enable row level security");
    expect(sql).toContain("to anon, authenticated");
    expect(sql).toContain("created_by = (select auth.uid())");
    expect(sql).toContain("public.trips.id = public.trip_points.trip_id");
    expect(sql).toMatch(
      /grant select on table public\.trips to anon, authenticated/u,
    );
    expect(sql).not.toMatch(
      /grant\s+(?:insert|update|delete)[^;]*\s+to\s+anon/iu,
    );
    expect(sql).not.toMatch(/service_role|secret key|database password/iu);
  });

  it("限制旅行状态、评分、经纬度与地点顺序", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toContain(
      "status in ('draft', 'planned', 'in_progress', 'completed')",
    );
    expect(sql).toContain("rating between 1 and 10");
    expect(sql).toContain("lat between -90 and 90");
    expect(sql).toContain("lng between -180 and 180");
    expect(sql).toContain("unique (trip_id, order_index)");
  });
});
