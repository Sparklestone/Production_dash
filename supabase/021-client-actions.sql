begin;
alter table public.clients add column if not exists merged_into uuid references public.clients(id);
create or replace function public.set_dashboard_client_names(target_client_id uuid,expected_name text,expected_aka text,new_name text,new_aka text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.clients%rowtype;nm text:=trim(new_name);ak text:=nullif(trim(coalesce(new_aka,'')),'');
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 select * into c from public.clients where id=target_client_id for update;
 if not found or c.merged_into is not null then raise exception 'Client unavailable. Refresh.';end if;
 if c.name is distinct from expected_name or coalesce(c.aka,'') is distinct from coalesce(expected_aka,'') then raise exception 'Client changed. Refresh.';end if;
 if length(nm) not between 1 and 120 or length(ak)>120 then raise exception 'Client name required, maximum 120 characters';end if;
 if lower(nm)=lower(ak) then raise exception 'Name and AKA must differ';end if;
 if exists(select 1 from public.clients x where x.id<>c.id and x.merged_into is null and (lower(x.name)=lower(nm) or lower(x.aka)=lower(nm) or ak is not null and (lower(x.name)=lower(ak) or lower(x.aka)=lower(ak)))) then raise exception 'Another client uses that name';end if;
 update public.clients set name=nm,aka=ak where id=c.id;
 return jsonb_build_object('ok',true,'id',c.id);
end;$$;
revoke all on function public.set_dashboard_client_names(uuid,text,text,text,text) from public,anon;
grant execute on function public.set_dashboard_client_names(uuid,text,text,text,text) to authenticated;
create or replace function public.combine_dashboard_clients(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare k public.clients%rowtype;s public.clients%rowtype;p public.projects%rowtype;snap jsonb;n int;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 if payload->'keep'->>'id'=payload->'source'->>'id' then raise exception 'Choose two clients';end if;
 perform 1 from public.clients where id in ((payload->'keep'->>'id')::uuid,(payload->'source'->>'id')::uuid) order by id for update;
 select * into k from public.clients where id=(payload->'keep'->>'id')::uuid;
 select * into s from public.clients where id=(payload->'source'->>'id')::uuid;
 if k.id is null or s.id is null or k.merged_into is not null or s.merged_into is not null then raise exception 'Client unavailable. Refresh.';end if;
 if k.name is distinct from payload->'keep'->>'name' or coalesce(k.aka,'') is distinct from payload->'keep'->>'aka' or s.name is distinct from payload->'source'->>'name' or coalesce(s.aka,'') is distinct from payload->'source'->>'aka' then raise exception 'Client changed. Refresh.';end if;
 perform 1 from public.projects where client_id in(k.id,s.id) order by id for update;
 select count(*) into n from public.projects where client_id=s.id;
 if n<>jsonb_array_length(payload->'projects') then raise exception 'Projects changed. Refresh.';end if;
 if exists(select 1 from public.projects where client_id=k.id and is_brand_bucket) and exists(select 1 from public.projects where client_id=s.id and is_brand_bucket) then raise exception 'Both clients have unassigned-step buckets. Review before combining.';end if;
 for p in select * from public.projects where client_id=s.id loop
  select value into snap from jsonb_array_elements(payload->'projects') where value->>'id'=p.id::text;
  if snap is null or p.updated_at is distinct from (snap->>'updated_at')::timestamptz then raise exception 'Project changed. Refresh.';end if;
 end loop;
 update public.projects set client_id=k.id where client_id=s.id;
 update public.clients set merged_into=k.id where id=s.id;
 return jsonb_build_object('ok',true,'keep_id',k.id,'source_id',s.id,'projects',n);
end;$$;
revoke all on function public.combine_dashboard_clients(jsonb) from public,anon;
grant execute on function public.combine_dashboard_clients(jsonb) to authenticated;
commit;
