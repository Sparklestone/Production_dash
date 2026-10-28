begin;
create table if not exists public.workload_teams(name text primary key check(length(trim(name)) between 1 and 60),created_at timestamptz not null default now());
alter table public.workload_teams enable row level security;
grant select,insert,update on public.workload_teams to authenticated;
create policy workload_teams_read on public.workload_teams for select to authenticated using(public.is_dashboard_member());
create policy workload_teams_add on public.workload_teams for insert to authenticated with check(public.is_dashboard_member());
create policy workload_teams_upsert on public.workload_teams for update to authenticated using(public.is_dashboard_member()) with check(public.is_dashboard_member());
commit;
