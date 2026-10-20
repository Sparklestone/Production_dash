alter table public.projects add column if not exists cx text[] not null default '{}';
alter table public.schedule_items add column if not exists co_owner_ids uuid[] not null default '{}';
update public.projects p set cx=v.cx from (select c.id cid,x.cx from public.clients c join (values ('Canal Barge (Marquette Transport)',array['Sara Zweig']),('Denver Preschool Program',array['Paige Keefe']),('Billings (One Sky)',array['Sam Wapnick']),('Ametros',array['Sara Zweig','Drew Beveridge']),('Portage Point',array['Yana Ossenova','Drew Beveridge']),('Sutter Health',array['Alissa Faust']),('VCU Health',array['Drew Beveridge']),('argenx',array['Paige Keefe'])) x(n,cx) on x.n=c.name) v where p.client_id=v.cid;
update public.projects set cx=array['Alissa Faust'] where id='9800c187-f7d6-4c43-98cc-872b81adf3e2';
update public.projects set cx=array['Paige Keefe'] where id in ('baf9d0db-eda8-4dd1-9309-e87f4b8e78e7','35c7a88c-0a8e-443a-8f35-6eb1f7ac729c','9a359d2a-fa90-49b7-aea2-b104c3da0338');
update public.projects set cx=array['Sam Wapnick'] where id='e3fcdfc0-cc6c-4beb-acf7-b0e2b452774a';
select (select count(*) from public.projects where cardinality(cx)>0)||' projects with CX of '||(select count(*) from public.projects)||'; co_owner col ok='||(select count(*) from information_schema.columns where table_name='schedule_items' and column_name='co_owner_ids');
create or replace function public.set_dashboard_step_co_owners(target_id uuid,new_co uuid[],expected_co uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.schedule_items%rowtype; clean uuid[];
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 select * into item from public.schedule_items where id=target_id for update;
 if not found or item.co_owner_ids is distinct from coalesce(expected_co,'{}') then raise exception 'Step changed or missing. Refresh.';end if;
 select coalesce(array_agg(distinct m.id),'{}') into clean from public.team_members m where m.id=any(coalesce(new_co,'{}')) and m.active=true and m.id is distinct from item.owner_id;
 update public.schedule_items set co_owner_ids=clean where id=item.id;
 return jsonb_build_object('id',item.id,'co_owner_ids',clean);
end; $$;
revoke all on function public.set_dashboard_step_co_owners(uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.set_dashboard_step_co_owners(uuid,uuid[],uuid[]) to authenticated;
create or replace function public.set_dashboard_project_cx(target_id uuid,new_cx text[],expected_cx text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare pr public.projects%rowtype; clean text[];
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 select * into pr from public.projects where id=target_id for update;
 if not found or pr.cx is distinct from coalesce(expected_cx,'{}') then raise exception 'Project changed or missing. Refresh.';end if;
 select coalesce(array_agg(x),'{}') into clean from (select distinct on (lower(trim(v))) trim(v) x from unnest(coalesce(new_cx,'{}')) v where trim(v)<>'' order by lower(trim(v)),1) s;
 update public.projects set cx=clean where id=pr.id;
 return jsonb_build_object('id',pr.id,'cx',clean);
end; $$;
revoke all on function public.set_dashboard_project_cx(uuid,text[],text[]) from public,anon;
grant execute on function public.set_dashboard_project_cx(uuid,text[],text[]) to authenticated;
select count(*)||' functions' from pg_proc where proname in ('set_dashboard_step_co_owners','set_dashboard_project_cx');
