-- Owner request (Oct 27): when one item is selected, Rename is an option.
-- Adds a 'rename' bulk action for one selected step (title change with an
-- expected-title stale check) and rename_dashboard_project for one selected
-- project (expected-name stale check). All other actions unchanged.
begin;
create or replace function public.apply_dashboard_bulk(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare row jsonb; item public.schedule_items%rowtype; dest public.projects%rowtype; ids uuid[]; action text:=payload->>'action'; target uuid; new_id uuid; note text; min_steps int:=1; new_title text;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required'; end if;
 if action not in ('done','move','comment','rename') or jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'Invalid action'; end if;
 select array_agg((x->>'id')::uuid) into ids from jsonb_array_elements(payload->'items') x;
 target=nullif(payload->>'target_id','')::uuid;
 if coalesce(cardinality(ids),0)<min_steps or cardinality(ids)>100 or cardinality(ids)<>(select count(distinct x) from unnest(ids)x) then raise exception 'Select % to 100 distinct steps',min_steps; end if;
 if action='rename' and cardinality(ids)<>1 then raise exception 'Rename applies to one step at a time'; end if;
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
   if length(trim(payload->>'new_name')) not between 1 and 120 then raise exception 'Project name required'; end if;
   if exists(select 1 from public.projects where parent_id=dest.id and lower(trim(name))=lower(trim(payload->>'new_name'))) then raise exception 'Project already exists'; end if;
   insert into public.projects(client_id,parent_id,name,status,owner_id) values(dest.client_id,dest.id,trim(payload->>'new_name'),'active',dest.owner_id) returning id into target;
  end if;
  select * into dest from public.projects where id=target;
  if not found then raise exception 'Destination missing'; end if;
  if exists(with recursive parents as (select id,parent_id,status from public.projects where id=target union select p.id,p.parent_id,p.status from public.projects p join parents a on p.id=a.parent_id) select 1 from parents where status='done') then raise exception 'Destination completed'; end if;
  update public.schedule_items set project_id=target where id=any(ids);
  update public.dashboard_questions set project_id=target where schedule_item_id=any(ids);
 elsif action='done' then update public.schedule_items set status='done' where id=any(ids);
 elsif action='rename' then
  new_title=trim(payload->>'new_name');
  if length(new_title) not between 1 and 120 then raise exception 'Step name required'; end if;
  select * into item from public.schedule_items where id=ids[1];
  if item.title is distinct from nullif(trim(payload->>'expected_title'),'') then raise exception 'Step changed. Refresh before applying.'; end if;
  update public.schedule_items set title=new_title where id=ids[1];
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

create or replace function public.rename_dashboard_project(target_project_id uuid, expected_name text, new_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare proj public.projects%rowtype; nm text;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required'; end if;
 nm:=trim(new_name);
 if length(nm) not between 1 and 120 then raise exception 'Project name required'; end if;
 select * into proj from public.projects where id=target_project_id for update;
 if not found then raise exception 'Project missing. Refresh.'; end if;
 if proj.name is distinct from expected_name then raise exception 'Project changed. Refresh before applying.'; end if;
 update public.projects set name=nm where id=target_project_id;
 return jsonb_build_object('ok',true,'id',proj.id,'name',nm);
end; $$;
revoke all on function public.rename_dashboard_project(uuid,text,text) from public,anon;
grant execute on function public.rename_dashboard_project(uuid,text,text) to authenticated;
commit;
