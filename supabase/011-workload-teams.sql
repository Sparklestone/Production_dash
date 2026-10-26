begin;
alter table public.team_members add column if not exists workload_team text;
create or replace function public.set_dashboard_member_team(target_id uuid,new_team text,expected_team text) returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.team_members%rowtype;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 if new_team is not null and (length(trim(new_team))=0 or length(new_team)>60) then raise exception 'Team must be 1-60 characters';end if;
 select * into member from public.team_members where id=target_id for update;
 if not found or member.workload_team is distinct from expected_team then raise exception 'Team changed or missing. Refresh.';end if;
 update public.team_members set workload_team=nullif(trim(new_team),'') where id=target_id;
 return jsonb_build_object('id',target_id,'workload_team',nullif(trim(new_team),''));
end; $$;
revoke all on function public.set_dashboard_member_team(uuid,text,text) from public,anon;
grant execute on function public.set_dashboard_member_team(uuid,text,text) to authenticated;
commit;
