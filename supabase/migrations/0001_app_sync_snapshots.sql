create table if not exists public.app_sync_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  schema_version integer not null default 1,
  data_version bigint not null default 1,
  payload jsonb not null default '{}'::jsonb,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, app_id),
  constraint app_sync_snapshots_app_id_not_empty
    check (length(trim(app_id)) > 0),
  constraint app_sync_snapshots_schema_version_positive
    check (schema_version > 0),
  constraint app_sync_snapshots_data_version_positive
    check (data_version > 0)
);

create or replace function public.set_app_sync_snapshots_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_sync_snapshots_updated_at
on public.app_sync_snapshots;

create trigger set_app_sync_snapshots_updated_at
before update on public.app_sync_snapshots
for each row
execute function public.set_app_sync_snapshots_updated_at();

alter table public.app_sync_snapshots enable row level security;

revoke all on table public.app_sync_snapshots from anon;
grant select, insert, update, delete
on table public.app_sync_snapshots to authenticated;

drop policy if exists "read own app snapshots"
on public.app_sync_snapshots;
create policy "read own app snapshots"
on public.app_sync_snapshots
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "insert own app snapshots"
on public.app_sync_snapshots;
create policy "insert own app snapshots"
on public.app_sync_snapshots
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "update own app snapshots"
on public.app_sync_snapshots;
create policy "update own app snapshots"
on public.app_sync_snapshots
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "delete own app snapshots"
on public.app_sync_snapshots;
create policy "delete own app snapshots"
on public.app_sync_snapshots
for delete
to authenticated
using ((select auth.uid()) = user_id);
