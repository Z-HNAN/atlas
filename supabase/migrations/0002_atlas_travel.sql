-- Atlas 虚拟旅行收藏地图：公开读取、仅项目所有者写入。
-- 首次部署后，项目管理员需要在 SQL Editor 执行：
-- insert into public.atlas_owners (user_id) values ('<Supabase Auth 用户 UUID>');

create table if not exists public.atlas_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_atlas_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.atlas_owners
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_atlas_owner() from public;
grant execute on function public.is_atlas_owner() to authenticated;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  region text,
  theme text,
  status text not null default 'draft',
  rating integer,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint trips_title_not_empty check (length(trim(title)) > 0),
  constraint trips_status_valid
    check (status in ('draft', 'planned', 'in_progress', 'completed')),
  constraint trips_rating_valid check (rating is null or rating between 1 and 10)
);

create table if not exists public.trip_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  order_index integer not null,
  name_zh text not null,
  name_local text,
  country text,
  region text,
  search_query text not null,
  reason text,
  lat double precision,
  lng double precision,
  geocode_display_name text,
  geocode_status text not null default 'pending',
  visited boolean not null default false,
  point_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_points_order_nonnegative check (order_index >= 0),
  constraint trip_points_name_not_empty check (length(trim(name_zh)) > 0),
  constraint trip_points_query_not_empty check (length(trim(search_query)) > 0),
  constraint trip_points_lat_valid check (lat is null or lat between -90 and 90),
  constraint trip_points_lng_valid check (lng is null or lng between -180 and 180),
  constraint trip_points_coordinate_pair
    check ((lat is null and lng is null) or (lat is not null and lng is not null)),
  constraint trip_points_geocode_status_valid
    check (geocode_status in ('pending', 'resolved', 'ambiguous', 'failed')),
  unique (trip_id, order_index)
);

create table if not exists public.geocode_cache (
  query_key text primary key,
  query_text text not null,
  lat double precision not null,
  lng double precision not null,
  display_name text not null,
  raw_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geocode_cache_query_key_not_empty check (length(trim(query_key)) > 0),
  constraint geocode_cache_lat_valid check (lat between -90 and 90),
  constraint geocode_cache_lng_valid check (lng between -180 and 180)
);

create index if not exists trips_status_idx on public.trips(status);
create index if not exists trips_created_at_idx on public.trips(created_at desc);
create index if not exists trips_theme_idx on public.trips(theme);
create index if not exists trip_points_trip_order_idx
  on public.trip_points(trip_id, order_index);
create index if not exists trip_points_visited_idx on public.trip_points(visited);

create or replace function public.set_atlas_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
before update on public.trips
for each row execute function public.set_atlas_updated_at();

drop trigger if exists set_trip_points_updated_at on public.trip_points;
create trigger set_trip_points_updated_at
before update on public.trip_points
for each row execute function public.set_atlas_updated_at();

drop trigger if exists set_geocode_cache_updated_at on public.geocode_cache;
create trigger set_geocode_cache_updated_at
before update on public.geocode_cache
for each row execute function public.set_atlas_updated_at();

alter table public.atlas_owners enable row level security;
alter table public.trips enable row level security;
alter table public.trip_points enable row level security;
alter table public.geocode_cache enable row level security;

revoke all on table public.atlas_owners from anon, authenticated;
revoke all on table public.trips from anon, authenticated;
revoke all on table public.trip_points from anon, authenticated;
revoke all on table public.geocode_cache from anon, authenticated;

grant select on table public.trips to anon, authenticated;
grant select on table public.trip_points to anon, authenticated;
grant select on table public.geocode_cache to anon, authenticated;
grant insert, update, delete on table public.trips to authenticated;
grant insert, update, delete on table public.trip_points to authenticated;
grant insert, update, delete on table public.geocode_cache to authenticated;

drop policy if exists "public read trips" on public.trips;
create policy "public read trips"
on public.trips for select
to anon, authenticated
using (true);

drop policy if exists "owner insert trips" on public.trips;
create policy "owner insert trips"
on public.trips for insert
to authenticated
with check (
  public.is_atlas_owner()
  and created_by = (select auth.uid())
);

drop policy if exists "owner update trips" on public.trips;
create policy "owner update trips"
on public.trips for update
to authenticated
using (public.is_atlas_owner())
with check (
  public.is_atlas_owner()
  and created_by = (select auth.uid())
);

drop policy if exists "owner delete trips" on public.trips;
create policy "owner delete trips"
on public.trips for delete
to authenticated
using (public.is_atlas_owner());

drop policy if exists "public read trip points" on public.trip_points;
create policy "public read trip points"
on public.trip_points for select
to anon, authenticated
using (true);

drop policy if exists "owner insert trip points" on public.trip_points;
create policy "owner insert trip points"
on public.trip_points for insert
to authenticated
with check (
  public.is_atlas_owner()
  and exists (
    select 1 from public.trips
    where public.trips.id = public.trip_points.trip_id
      and public.trips.created_by = (select auth.uid())
  )
);

drop policy if exists "owner update trip points" on public.trip_points;
create policy "owner update trip points"
on public.trip_points for update
to authenticated
using (public.is_atlas_owner())
with check (
  public.is_atlas_owner()
  and exists (
    select 1 from public.trips
    where public.trips.id = public.trip_points.trip_id
      and public.trips.created_by = (select auth.uid())
  )
);

drop policy if exists "owner delete trip points" on public.trip_points;
create policy "owner delete trip points"
on public.trip_points for delete
to authenticated
using (public.is_atlas_owner());

drop policy if exists "public read geocode cache" on public.geocode_cache;
create policy "public read geocode cache"
on public.geocode_cache for select
to anon, authenticated
using (true);

drop policy if exists "owner insert geocode cache" on public.geocode_cache;
create policy "owner insert geocode cache"
on public.geocode_cache for insert
to authenticated
with check (public.is_atlas_owner());

drop policy if exists "owner update geocode cache" on public.geocode_cache;
create policy "owner update geocode cache"
on public.geocode_cache for update
to authenticated
using (public.is_atlas_owner())
with check (public.is_atlas_owner());

drop policy if exists "owner delete geocode cache" on public.geocode_cache;
create policy "owner delete geocode cache"
on public.geocode_cache for delete
to authenticated
using (public.is_atlas_owner());
