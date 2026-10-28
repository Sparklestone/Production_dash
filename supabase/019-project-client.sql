begin;
create or replace function public.assign_dashboard_projects_client(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[]; scoped uuid[]; target uuid; rowp public.projects%rowtype; snap jsonb;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required';end if;
 select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'selected_ids');
 target:=(payload->>'target_client_id')::uuid;
 if coalesce(cardinality(ids),0) not between 1 and 100 then raise exception 'Select 1 to 100 projects';end if;
 perform 1 from public.clients where id=target for share;if not found then raise exception 'Client missing. Refresh.';end if;
 if exists(select 1 from unnest(ids) x left join public.projects p on p.id=x where p.id is null or p.is_brand_bucket or (p.parent_id is not null and not(p.parent_id=any(ids)))) then raise exception 'Select parent projects to keep the hierarchy together. Refresh.';end if;
 with recursive tree as (select id from public.projects where id=any(ids) union select p.id from public.projects p join tree t on p.parent_id=t.id) select array_agg(id) into scoped from tree;
 if cardinality(scoped)>100 or cardinality(scoped)<>jsonb_array_length(payload->'items') then raise exception 'Project hierarchy changed or exceeds 100 projects. Refresh.';end if;
 for rowp in select * from public.projects where id=any(scoped) order by id for update loop
  select value into snap from jsonb_array_elements(payload->'items') where value->>'id'=rowp.id::text;
  if snap is null or rowp.name is distinct from snap->>'name' or rowp.client_id is distinct from (snap->>'client_id')::uuid or rowp.parent_id is distinct from (snap->>'parent_id')::uuid or rowp.updated_at is distinct from (snap->>'updated_at')::timestamptz then raise exception 'Project changed. Refresh before applying.';end if;
 end loop;
 update public.projects set client_id=target where id=any(scoped) and client_id is distinct from target;
 return jsonb_build_object('ok',true,'count',cardinality(scoped),'client_id',target);
end;$$;
revoke all on function public.assign_dashboard_projects_client(jsonb) from public,anon;
grant execute on function public.assign_dashboard_projects_client(jsonb) to authenticated;
commit;
