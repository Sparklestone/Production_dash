begin;
-- Office-only dates and month coverage. Populated only from verified Monigle sources.
create table if not exists public.office_holidays(day date primary key,label text not null,source text not null);
create table if not exists public.office_holiday_coverage(month date primary key check(extract(day from month)=1),source text not null);
alter table public.office_holidays enable row level security;
alter table public.office_holiday_coverage enable row level security;
create or replace function public.dashboard_is_workday(day date) returns boolean language sql stable security definer set search_path='' as $$ select extract(isodow from day)<6 and not exists(select 1 from public.office_holidays h where h.day=$1); $$;
create or replace function public.dashboard_shift_workdays(day date,n integer) returns date language plpgsql stable security definer set search_path='' as $$
declare d date:=day;direction integer:=case when n<0 then -1 else 1 end;
begin if abs(n)>1040 then raise exception 'Invalid workday shift'; end if;while n<>0 loop d=d+direction;if public.dashboard_is_workday(d) then n=n-direction;end if;end loop;return d;end; $$;
create or replace function public.dashboard_workday_count(a date,b date) returns integer language sql stable security definer set search_path='' as $$ select count(*)::integer from generate_series(a::timestamp,b::timestamp,'1 day') d where public.dashboard_is_workday(d::date); $$;
create or replace function public.dashboard_footprint(item jsonb) returns daterange language plpgsql stable security definer set search_path='' as $$
declare s date:=nullif(item->>'start_date','')::date;e date:=nullif(item->>'due_date','')::date;n integer:=coalesce((item->>'work_days_needed')::integer,1);
begin if s is not null then e=greatest(e,public.dashboard_shift_workdays(s,n-1));elsif e is not null then s=public.dashboard_shift_workdays(e,1-n);else return null;end if;return daterange(s,e,'[]');end; $$;
create or replace function public.dashboard_protected_step(item jsonb) returns boolean language sql immutable set search_path='' as $$
select coalesce(item->>'auto_adjust','true')='false' or item->>'step_type'='client_meeting' or coalesce(item->>'title','') ~* '\mrelease\M|\mclient\M.{0,40}\m(delivery|handoff)\M|\m(send|deliver|submit|share|handoff|hand\s+off)\M.{0,60}\m(to|with)\s+(the\s+)?client\M|\mfiles?\s+to\s+(the\s+)?client\M|\mapproval\M|\mclient\M.{0,40}\m(meeting|review|presentation|call)\M|\m(meeting|review|presentation|call)\M.{0,40}\m(with|to)\s+(the\s+)?client\M'; $$;
create or replace function public.apply_dashboard_timing(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare row jsonb;change jsonb;item public.schedule_items%rowtype;pids uuid[];ids uuid[];explicit_ids uuid[];automatic_ids uuid[]:=array[]::uuid[];working jsonb:='{}';old jsonb;next_item jsonb;pid uuid;id uuid;barrier date;f daterange;s date;e date;n integer;expected jsonb:='[]';actual jsonb;affected_count integer;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_typeof(payload->'explicit') is distinct from 'array' or jsonb_typeof(payload->'changes') is distinct from 'array' then raise exception 'Invalid timing review';end if;
 select array_agg((x->>'id')::uuid),array_agg(distinct (x->>'project_id')::uuid) into ids,pids from jsonb_array_elements(payload->'items') x;
 select array_agg((x->>'id')::uuid) into explicit_ids from jsonb_array_elements(payload->'explicit') x;
 if coalesce(cardinality(ids),0)=0 or cardinality(ids)>1000 or cardinality(ids)<>(select count(distinct x) from unnest(ids)x) or coalesce(cardinality(explicit_ids),0)=0 or cardinality(explicit_ids)>100 or cardinality(explicit_ids)<>(select count(distinct x) from unnest(explicit_ids)x) or not explicit_ids<@ids then raise exception 'Invalid selected steps';end if;
 perform p.id from public.projects p where p.id=any(pids) order by p.id for update;
 perform i.id from public.schedule_items i where i.project_id=any(pids) order by i.id for update;
 if exists(with recursive parents as (select p.id,p.parent_id,p.status from public.projects p where p.id=any(pids) union select p.id,p.parent_id,p.status from public.projects p join parents a on p.id=a.parent_id) select 1 from parents where status='done') then raise exception 'Completed project';end if;
 select count(*) into affected_count from public.schedule_items i where i.project_id=any(pids);
 if affected_count<>cardinality(ids) then raise exception 'Workstream changed. Refresh.';end if;
 for row in select * from jsonb_array_elements(payload->'items') loop
  select * into item from public.schedule_items i where i.id=(row->>'id')::uuid;
  if not found or item.project_id::text is distinct from row->>'project_id' or item.status is distinct from row->>'status' or item.start_date::text is distinct from row->>'start_date' or item.due_date::text is distinct from row->>'due_date' or item.work_days_needed is distinct from (row->>'work_days_needed')::integer or item.updated_at is distinct from (row->>'updated_at')::timestamptz then raise exception 'Workstream changed. Refresh before applying.';end if;
  working=jsonb_set(working,array[item.id::text],to_jsonb(item));
 end loop;
 for change in select * from jsonb_array_elements(payload->'explicit') loop
  id=(change->>'id')::uuid;next_item=working->id::text;
  if next_item->>'status'='done' or next_item->>'starts_at' is not null then raise exception 'Step not date editable';end if;
  if change->>'due_date' is null or not public.dashboard_is_workday((change->>'due_date')::date) or (change->>'start_date' is not null and not public.dashboard_is_workday((change->>'start_date')::date)) then raise exception 'Choose workdays excluding Monigle office holidays';end if;
  next_item=next_item||jsonb_build_object('due_date',change->>'due_date','start_date',change->>'start_date','due_date_suggested',false);working=jsonb_set(working,array[id::text],next_item);
 end loop;
 foreach pid in array pids loop
  barrier=null;
  for item in select * from public.schedule_items i where i.project_id=pid and i.status<>'done' and (i.due_date is not null or i.id=any(explicit_ids)) order by coalesce(i.due_date,(working->i.id::text->>'due_date')::date),i.id loop
   id=item.id;next_item=working->id::text;f=public.dashboard_footprint(next_item);if f is null then continue;end if;
   if id=any(explicit_ids) then barrier=greatest(barrier,upper(f)-1);continue;end if;
   if barrier is not null and lower(f)<=barrier and not coalesce(public.dashboard_protected_step(next_item),false) then
    s=public.dashboard_shift_workdays(barrier,1);n=greatest(coalesce(item.work_days_needed,1),public.dashboard_workday_count(lower(f),upper(f)-1));e=public.dashboard_shift_workdays(s,n-1);
    next_item=next_item||jsonb_build_object('start_date',s,'due_date',e,'due_date_suggested',true);working=jsonb_set(working,array[id::text],next_item);automatic_ids=array_append(automatic_ids,id);
   end if;
   if barrier is not null then barrier=greatest(barrier,upper(public.dashboard_footprint(next_item))-1);end if;
  end loop;
 end loop;
 for item in select * from public.schedule_items i where i.project_id=any(pids) loop
  next_item=working->item.id::text;f=public.dashboard_footprint(next_item);
  if f is not null and exists(select 1 from generate_series(date_trunc('month',lower(f)::timestamp),date_trunc('month',(upper(f)-1)::timestamp),'1 month') m where not exists(select 1 from public.office_holiday_coverage c where c.month=m::date)) then raise exception 'Monigle holiday coverage is not verified for these dates';end if;
  if item.start_date::text is distinct from next_item->>'start_date' or item.due_date::text is distinct from next_item->>'due_date' then expected=expected||jsonb_build_array(jsonb_build_object('id',item.id,'start_date',next_item->>'start_date','due_date',next_item->>'due_date','due_date_suggested',coalesce((next_item->>'due_date_suggested')::boolean,false),'automatic',item.id=any(automatic_ids)));end if;
 end loop;
 select jsonb_agg(x order by x->>'id') into expected from jsonb_array_elements(expected)x;
 select jsonb_agg(x order by x->>'id') into actual from jsonb_array_elements(payload->'changes')x;
 if expected is null or expected is distinct from actual then raise exception 'Timing plan changed. Refresh and review again.';end if;
 for change in select * from jsonb_array_elements(expected) loop
  update public.schedule_items set start_date=(change->>'start_date')::date,due_date=(change->>'due_date')::date,due_date_suggested=(change->>'due_date_suggested')::boolean where schedule_items.id=(change->>'id')::uuid;
 end loop;
 return jsonb_build_object('ok',true,'count',jsonb_array_length(expected));
end; $$;
revoke all on function public.dashboard_is_workday(date),public.dashboard_shift_workdays(date,integer),public.dashboard_workday_count(date,date),public.dashboard_footprint(jsonb),public.dashboard_protected_step(jsonb),public.apply_dashboard_timing(jsonb) from public,anon,authenticated;
grant execute on function public.apply_dashboard_timing(jsonb) to authenticated;
commit;
