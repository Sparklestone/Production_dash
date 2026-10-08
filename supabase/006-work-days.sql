begin;
alter table public.schedule_items add column if not exists work_days_needed integer check(work_days_needed between 1 and 260);
alter table public.schedule_items add column if not exists due_date_suggested boolean not null default false;
create or replace function public.set_dashboard_work_days(target_id uuid,days integer,expected_days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved access required'; end if;
 if exists(with recursive parents as (select p.id,p.parent_id,p.status from public.projects p join public.schedule_items i on i.project_id=p.id where i.id=target_id union select p.id,p.parent_id,p.status from public.projects p join parents a on p.id=a.parent_id) select 1 from parents where status='done') then raise exception 'Completed project'; end if;
 if days is null or days not between 1 and 260 then raise exception 'Choose 1 to 260 work days'; end if;
 update public.schedule_items set work_days_needed=days where id=target_id and work_days_needed is not distinct from expected_days returning id into result;
 if result is null then raise exception 'Step changed or missing. Refresh.'; end if;
 return jsonb_build_object('id',result,'work_days_needed',days);
end; $$;
revoke all on function public.set_dashboard_work_days(uuid,integer,integer) from public,anon;
grant execute on function public.set_dashboard_work_days(uuid,integer,integer) to authenticated;
commit;
