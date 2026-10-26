begin;
create or replace function public.set_dashboard_project_owner(target_id uuid,new_owner uuid,expected_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.projects%rowtype;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 select * into p from public.projects where id=target_id for update;
 if not found or p.owner_id is distinct from expected_owner then raise exception 'Project changed or missing. Refresh.';end if;
 if exists(with recursive parents as(select id,parent_id,status from public.projects where id=target_id union select p.id,p.parent_id,p.status from public.projects p join parents a on p.id=a.parent_id)select 1 from parents where status='done') then raise exception 'Completed project';end if;
 if new_owner is not null and not exists(select 1 from public.team_members where id=new_owner and active=true) then raise exception 'Choose an active team member';end if;
 update public.projects set owner_id=new_owner where id=target_id;
 return jsonb_build_object('id',target_id,'owner_id',new_owner);
end; $$;
revoke all on function public.set_dashboard_project_owner(uuid,uuid,uuid) from public,anon;
grant execute on function public.set_dashboard_project_owner(uuid,uuid,uuid) to authenticated;
commit;
