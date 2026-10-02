-- Run after 001-comments.sql. Does not grant general table write access.
begin;
create or replace function public.complete_dashboard_project(target_project_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare completed_id uuid;
begin
 if auth.uid() is null or not public.is_dashboard_member() then
  raise exception 'Approved team access required' using errcode = '42501';
 end if;
 update public.projects set status = 'done' where id = target_project_id
 returning id into completed_id;
 if completed_id is null then
  raise exception 'Project not found' using errcode = 'P0002';
 end if;
 return jsonb_build_object('id', completed_id, 'status', 'done');
end;
$$;
revoke all on function public.complete_dashboard_project(uuid) from public, anon;
grant execute on function public.complete_dashboard_project(uuid) to authenticated;
commit;
