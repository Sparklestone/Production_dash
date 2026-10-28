-- Add a dashboard roster entry only, never an authentication account or invite.
begin;
create or replace function public.add_dashboard_person(person jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare nm text:=trim(person->>'name'); em text:=nullif(lower(trim(person->>'email')),''); tm text:=nullif(trim(person->>'workload_team'),''); mt text:=coalesce(person->>'member_type','internal'); member public.team_members%rowtype;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 if nm is null or length(nm) not between 1 and 120 or mt not in('internal','freelance') or length(coalesce(tm,''))>60 then raise exception 'Invalid person';end if;
 if em is not null and (length(em)>254 or em !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Invalid email';end if;
 if exists(select 1 from public.team_members where lower(trim(name))=lower(nm) or em is not null and lower(email)=em) then raise exception 'Person already exists, including inactive records';end if;
 if tm is not null and not exists(select 1 from public.workload_teams where name=tm) and tm not in('Production','Freelancers','Creative') then raise exception 'Team missing. Refresh.';end if;
 insert into public.team_members(name,email,member_type,workload_team,active) values(nm,em,mt,tm,true) returning * into member;
 return to_jsonb(member);
end;$$;
revoke all on function public.add_dashboard_person(jsonb) from public,anon;
grant execute on function public.add_dashboard_person(jsonb) to authenticated;
commit;
begin;
alter table public.workload_teams add column if not exists display_name text;
create or replace function public.rename_dashboard_roster(kind text,target text,expected text,new_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare nm text:=trim(new_name); old text;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 if nm is null or length(nm)<1 or length(nm)>120 or (kind='team' and length(nm)>60) then raise exception 'Invalid name';end if;
 if kind='person' then
 select name into old from public.team_members where id=target::uuid and active for update;
 if old is null or old is distinct from expected then raise exception 'Person changed. Refresh.';end if;
 if exists(select 1 from public.team_members where lower(trim(name))=lower(nm) and id<>target::uuid) then raise exception 'Person name already exists';end if;
 update public.team_members set name=nm where id=target::uuid;
 elsif kind='team' then
 if target='No team set' or nm='No team set' then raise exception 'Reserved label';end if;
 if not exists(select 1 from public.workload_teams where name=target) and target not in('Production','Freelancers','Creative') and not exists(select 1 from public.team_members where workload_team=target) then raise exception 'Team missing. Refresh.';end if;
 insert into public.workload_teams(name) values(target) on conflict(name) do nothing;
 select coalesce(display_name,name) into old from public.workload_teams where name=target for update;
 if old is distinct from expected then raise exception 'Team changed. Refresh.';end if;
 if exists(select 1 from public.workload_teams where lower(coalesce(display_name,name))=lower(nm) and name<>target) or exists(select 1 from unnest(array['Production','Freelancers','Creative']) b where b<>target and lower(b)=lower(nm) and not exists(select 1 from public.workload_teams w where w.name=b and w.display_name is not null)) then raise exception 'Team name already exists';end if;
 update public.workload_teams set display_name=nm where name=target;
 else raise exception 'Invalid edit';end if;
 return jsonb_build_object('ok',true,'name',nm);
end;$$;
revoke all on function public.rename_dashboard_roster(text,text,text,text) from public,anon;
grant execute on function public.rename_dashboard_roster(text,text,text,text) to authenticated;
commit;
