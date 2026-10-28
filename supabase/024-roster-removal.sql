begin;
alter table public.workload_teams add column if not exists removed_at timestamptz;
create or replace function public.remove_dashboard_roster(kind text,target text,expected text,confirmation text,password text) returns jsonb language plpgsql security definer set search_path='' as $$
declare old text;hash text;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 if confirmation is distinct from 'REMOVE' then raise exception 'Type REMOVE to confirm';end if;
 select encrypted_password into hash from auth.users where id=auth.uid();
 if coalesce(password,'')='' or coalesce(hash,'')='' or extensions.crypt(password,hash) is distinct from hash then raise exception 'Password not confirmed. Nothing removed.';end if;
 if kind='person' then
 select name into old from public.team_members where id=target::uuid and active for update;
 if old is null or old is distinct from expected then raise exception 'Person changed. Refresh.';end if;
 update public.team_members set active=false where id=target::uuid;
 elsif kind='team' then
 if target='No team set' or not exists(select 1 from public.workload_teams where name=target) and target not in('Production','Freelancers','Creative') and not exists(select 1 from public.team_members where workload_team=target) then raise exception 'Reserved team';end if;
 lock table public.team_members in share row exclusive mode;
 insert into public.workload_teams(name) values(target) on conflict(name) do nothing;
 select coalesce(display_name,name) into old from public.workload_teams where name=target and removed_at is null for update;
 if old is null or old is distinct from expected then raise exception 'Team changed. Refresh.';end if;
 if exists(select 1 from public.team_members where active and coalesce(workload_team,case when member_type='freelance' then 'Freelancers' when role ilike '%production%' then 'Production' else 'No team set' end)=target) then raise exception 'Move all active people to another team first';end if;
 update public.workload_teams set removed_at=now() where name=target;
 else raise exception 'Invalid removal';end if;
 return jsonb_build_object('ok',true,'kind',kind,'target',target);
end;$$;
revoke all on function public.remove_dashboard_roster(text,text,text,text,text) from public,anon;
grant execute on function public.remove_dashboard_roster(text,text,text,text,text) to authenticated;
create or replace function public.set_dashboard_member_team(target_id uuid,new_team text,expected_team text) returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.team_members%rowtype;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 lock table public.team_members in share row exclusive mode;
 if new_team is not null and (length(trim(new_team))=0 or length(new_team)>60 or exists(select 1 from public.workload_teams where name=new_team and removed_at is not null)) then raise exception 'Team unavailable. Refresh.';end if;
 select * into member from public.team_members where id=target_id and active for update;
 if not found or member.workload_team is distinct from expected_team then raise exception 'Person changed. Refresh.';end if;
 update public.team_members set workload_team=nullif(trim(new_team),'') where id=target_id;
 return jsonb_build_object('id',target_id,'workload_team',nullif(trim(new_team),''));
end;$$;
commit;
