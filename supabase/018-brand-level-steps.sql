begin;
alter table public.projects add column if not exists is_brand_bucket boolean not null default false;
create unique index if not exists projects_one_brand_bucket on public.projects(client_id) where is_brand_bucket;
create or replace function public.create_dashboard_brand_step(target_client_id uuid,target_project_id uuid,title text,due_date date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text:=trim(title); pid uuid;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved dashboard access required'; end if;
 if length(t) not between 1 and 500 then raise exception 'Step title required'; end if;
 perform 1 from public.clients where id=target_client_id for update;
 if not found then raise exception 'Choose a brand'; end if;
 if target_project_id is null then
  insert into public.projects(client_id,name,status,is_brand_bucket) values(target_client_id,'No project','active',true) on conflict(client_id) where is_brand_bucket do nothing;
  select id into pid from public.projects where client_id=target_client_id and is_brand_bucket;
 else
  select p.id into pid from public.projects p where p.id=target_project_id and not p.is_brand_bucket and coalesce(p.client_id,(with recursive ancestors as(select id,parent_id,client_id from public.projects where id=p.id union select q.id,q.parent_id,q.client_id from public.projects q join ancestors a on q.id=a.parent_id) select client_id from ancestors where client_id is not null limit 1))=target_client_id;
  if pid is null then raise exception 'Project does not belong to this brand. Refresh.'; end if;
 end if;
 return public.create_dashboard_step(pid,t,due_date);
end; $$;
revoke all on function public.create_dashboard_brand_step(uuid,uuid,text,date) from public,anon;
grant execute on function public.create_dashboard_brand_step(uuid,uuid,text,date) to authenticated;
commit;
