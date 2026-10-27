-- Owner request (Oct 27): Clients-page New client / New project / New step,
-- client AKA with Flip names, and a queue for automatic Teams/Outlook source
-- discovery on manually created items. All writes stay RPC-only.
begin;
alter table public.clients add column if not exists aka text;

create table if not exists public.source_requests(
 id uuid primary key default gen_random_uuid(),
 project_id uuid references public.projects(id) on delete cascade,
 schedule_item_id uuid references public.schedule_items(id) on delete cascade,
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
revoke all on public.source_requests from public,anon,authenticated;

create or replace function public.create_dashboard_client(name text, aka text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare nm text:=trim(name); ak text:=nullif(trim(coalesce(aka,'')),''); base text; sl text; n int:=1; new_id uuid;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required'; end if;
 if length(nm) not between 1 and 120 then raise exception 'Client name required'; end if;
 if ak is not null and length(ak)>120 then raise exception 'AKA too long'; end if;
 if exists(select 1 from public.clients c where lower(c.name)=lower(nm) or lower(coalesce(c.aka,''))=lower(nm)) then raise exception 'A client with that name already exists'; end if;
 if ak is not null and exists(select 1 from public.clients c where lower(c.name)=lower(ak) or lower(coalesce(c.aka,''))=lower(ak)) then raise exception 'A client with that AKA already exists'; end if;
 base:=trim(both '-' from regexp_replace(lower(nm),'[^a-z0-9]+','-','g'));if base='' then base:='client';end if;
 sl:=base;while exists(select 1 from public.clients c where c.slug=sl) loop n:=n+1;sl:=base||'-'||n;end loop;
 insert into public.clients(name,slug,aka) values(nm,sl,ak) returning id into new_id;
 return jsonb_build_object('ok',true,'id',new_id,'name',nm,'aka',ak,'slug',sl);
end; $$;
revoke all on function public.create_dashboard_client(text,text) from public,anon;
grant execute on function public.create_dashboard_client(text,text) to authenticated;

create or replace function public.create_dashboard_project(target_client_id uuid, name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare nm text:=trim(name); new_id uuid;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required'; end if;
 if length(nm) not between 1 and 120 then raise exception 'Project name required'; end if;
 if not exists(select 1 from public.clients c where c.id=target_client_id) then raise exception 'Client missing. Refresh.'; end if;
 if exists(select 1 from public.projects p where p.client_id=target_client_id and p.parent_id is null and lower(trim(p.name))=lower(nm)) then raise exception 'Project already exists for this client'; end if;
 insert into public.projects(client_id,name,status) values(target_client_id,nm,'active') returning id into new_id;
 insert into public.source_requests(project_id) values(new_id);
 return jsonb_build_object('ok',true,'id',new_id,'name',nm);
end; $$;
revoke all on function public.create_dashboard_project(uuid,text) from public,anon;
grant execute on function public.create_dashboard_project(uuid,text) to authenticated;

create or replace function public.create_dashboard_step(target_project_id uuid, title text, due_date date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text:=trim(title); new_id uuid;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required'; end if;
 if length(t) not between 1 and 500 then raise exception 'Step title required'; end if;
 if not exists(select 1 from public.projects p where p.id=target_project_id) then raise exception 'Project missing. Refresh.'; end if;
 if exists(with recursive parents as (select id,parent_id,status from public.projects where id=target_project_id union select p.id,p.parent_id,p.status from public.projects p join parents a on p.id=a.parent_id) select 1 from parents where status='done') then raise exception 'Completed project'; end if;
 if exists(select 1 from public.schedule_items si where si.project_id=target_project_id and lower(trim(si.title))=lower(t) and si.status<>'done') then raise exception 'An open step with that title already exists'; end if;
 insert into public.schedule_items(project_id,title,status,due_date) values(target_project_id,t,'pending',due_date) returning id into new_id;
 insert into public.source_requests(project_id,schedule_item_id) values(target_project_id,new_id);
 return jsonb_build_object('ok',true,'id',new_id,'title',t);
end; $$;
revoke all on function public.create_dashboard_step(uuid,text,date) from public,anon;
grant execute on function public.create_dashboard_step(uuid,text,date) to authenticated;

create or replace function public.set_dashboard_client_aka(target_client_id uuid, expected_name text, expected_aka text, new_aka text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.clients%rowtype; ak text:=nullif(trim(coalesce(new_aka,'')),'');
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required'; end if;
 select * into c from public.clients where id=target_client_id for update;
 if not found then raise exception 'Client missing. Refresh.'; end if;
 if c.name is distinct from expected_name or coalesce(c.aka,'') is distinct from coalesce(expected_aka,'') then raise exception 'Client changed. Refresh before applying.'; end if;
 if ak is not null then
  if length(ak)>120 then raise exception 'AKA too long'; end if;
  if lower(ak)=lower(c.name) then raise exception 'AKA matches the current name'; end if;
  if exists(select 1 from public.clients c2 where c2.id<>target_client_id and (lower(c2.name)=lower(ak) or lower(coalesce(c2.aka,''))=lower(ak))) then raise exception 'Another client already uses that name'; end if;
 end if;
 update public.clients set aka=ak where id=target_client_id;
 return jsonb_build_object('ok',true,'id',c.id,'name',c.name,'aka',ak);
end; $$;
revoke all on function public.set_dashboard_client_aka(uuid,text,text,text) from public,anon;
grant execute on function public.set_dashboard_client_aka(uuid,text,text,text) to authenticated;

create or replace function public.flip_dashboard_client_names(target_client_id uuid, expected_name text, expected_aka text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.clients%rowtype;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required'; end if;
 select * into c from public.clients where id=target_client_id for update;
 if not found then raise exception 'Client missing. Refresh.'; end if;
 if c.aka is null then raise exception 'No AKA to flip with'; end if;
 if c.name is distinct from expected_name or coalesce(c.aka,'') is distinct from coalesce(expected_aka,'') then raise exception 'Client changed. Refresh before applying.'; end if;
 update public.clients set name=c.aka, aka=c.name where id=target_client_id;
 return jsonb_build_object('ok',true,'id',c.id,'name',c.aka,'aka',c.name);
end; $$;
revoke all on function public.flip_dashboard_client_names(uuid,text,text) from public,anon;
grant execute on function public.flip_dashboard_client_names(uuid,text,text) to authenticated;
commit;
