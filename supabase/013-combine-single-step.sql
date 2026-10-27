-- Combine (and move-to-existing-workstream) is a deliberate dialog action: allow a
-- single-step move when an explicit target workstream is given. The 2-step minimum
-- still protects the other bulk actions, and the 100-step cap applies everywhere.
-- Stale-snapshot, membership, completed-project and atomicity behavior unchanged.
begin;
create or replace function public.apply_dashboard_bulk(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare row jsonb; item public.schedule_items%rowtype; dest public.projects%rowtype; ids uuid[]; action text:=payload->>'action'; target uuid; new_id uuid; note text; min_steps int;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required'; end if;
 if action not in ('done','move','comment') or jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'Invalid action'; end if;
 select array_agg((x->>'id')::uuid) into ids from jsonb_array_elements(payload->'items') x;
 target=nullif(payload->>'target_id','')::uuid;
 min_steps=case when action='move' and target is not null then 1 else 2 end;
 if coalesce(cardinality(ids),0)<min_steps or cardinality(ids)>100 or cardinality(ids)<>(select count(distinct x) from unnest(ids)x) then raise exception 'Select % to 100 distinct steps',min_steps; end if;
 perform id from public.schedule_items where id=any(ids) order by id for update;
 for row in select * from jsonb_array_elements(payload->'items') loop
  select * into item from public.schedule_items where id=(row->>'id')::uuid;
  if not found then raise exception 'Step missing. Refresh.'; end if;
  if item.project_id::text is distinct from row->>'project_id' or item.status is distinct from row->>'status' or item.start_date::text is distinct from row->>'start_date' or item.due_date::text is distinct from row->>'due_date' then raise exception 'Step changed. Refresh before applying.'; end if;
  if exists(with recursive parents as (select id,parent_id,status from public.projects where id=item.project_id union select p.id,p.parent_id,p.status from public.projects p join parents a on p.id=a.parent_id) select 1 from parents where status='done') then raise exception 'Completed project'; end if;
 end loop;
 if action='move' then
  if target is null then
   select * into dest from public.projects where id=(payload->>'parent_id')::uuid;
   if not found or dest.parent_id is not null or dest.status='done' then raise exception 'Choose an active parent project'; end if;
   if length(trim(payload->>'new_name')) not between 1 and 120 then raise exception 'Workstream name required'; end if;
   if exists(select 1 from public.projects where parent_id=dest.id and lower(trim(name))=lower(trim(payload->>'new_name'))) then raise exception 'Workstream already exists'; end if;
   insert into public.projects(client_id,parent_id,name,status,owner_id) values(dest.client_id,dest.id,trim(payload->'new_name'),'active',dest.owner_id) returning id into target;
  end if;
  select * into dest from public.projects where id=target;
  if not found then raise exception 'Destination missing'; end if;
  if exists(with recursive parents as (select id,parent_id,status from public.projects where id=target union select p.id,p.parent_id,p.status from public.projects p join parents a on p.id=a.parent_id) select 1 from parents where status='done') then raise exception 'Destination completed'; end if;
  update public.schedule_items set project_id=target where id=any(ids);
  update public.dashboard_questions set project_id=target where schedule_item_id=any(ids);
 elsif action='done' then update public.schedule_items set status='done' where id=any(ids);
 else
  note=trim(payload->>'note');if note is null or length(note) not between 1 and 5000 then raise exception 'Comment required'; end if;
  for item in select * from public.schedule_items where id=any(ids) loop
   insert into public.dashboard_comments(project_id,schedule_item_id,author_name,note) values(item.project_id,item.id,coalesce(nullif(trim(payload->>'author_name'),''),auth.jwt()->>'email'),note);
  end loop;
 end if;
 return jsonb_build_object('ok',true,'count',cardinality(ids),'target_id',target);
end; $$;
revoke all on function public.apply_dashboard_bulk(jsonb) from public,anon;
grant execute on function public.apply_dashboard_bulk(jsonb) to authenticated;
commit;
