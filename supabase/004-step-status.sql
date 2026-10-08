-- Narrow status-only write. Keep schedule_items direct writes closed.
begin;
create or replace function public.set_dashboard_step_status(target_schedule_item_id uuid, new_status text, expected_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item public.schedule_items%rowtype;
begin
 if auth.uid() is null or not public.is_dashboard_member() then
  raise exception 'Approved dashboard access required';
 end if;
 if new_status is null or new_status not in ('pending','in_progress','blocked','done') then
  raise exception 'Invalid status';
 end if;
 select * into item from public.schedule_items where id=target_schedule_item_id for update;
 if not found then raise exception 'Step not found'; end if;
 if item.status is distinct from expected_status then
  raise exception 'Step changed. Refresh.';
 end if;
 if exists(with recursive parents as (
  select id,parent_id,status from public.projects where id=item.project_id
  union select p.id,p.parent_id,p.status from public.projects p join parents a on p.id=a.parent_id
 ) select 1 from parents where status='done') then
  raise exception 'Completed project';
 end if;
 update public.schedule_items set status=new_status where id=item.id;
 return jsonb_build_object('id',item.id,'status',new_status);
end;
$$;
revoke all on function public.set_dashboard_step_status(uuid,text,text) from public,anon;
grant execute on function public.set_dashboard_step_status(uuid,text,text) to authenticated;
commit;
