begin;
create table if not exists public.dashboard_members (
 email text primary key check (email=lower(email)),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.dashboard_members enable row level security;
revoke all on public.dashboard_members from anon, authenticated;
create or replace function public.is_dashboard_member() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.dashboard_members m where m.email=lower(auth.jwt()->>'email') and m.active);
$$;
revoke all on function public.is_dashboard_member() from public;
grant execute on function public.is_dashboard_member() to authenticated;
create table if not exists public.dashboard_comments (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete restrict,
 schedule_item_id uuid references public.schedule_items(id) on delete restrict,
 author_id uuid not null default auth.uid(),
 author_email text not null default (auth.jwt()->>'email'),
 author_name text not null check(length(trim(author_name)) between 1 and 120),
 note text not null check(length(trim(note)) between 1 and 5000),
 context jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 review_note text
);
create or replace function public.set_dashboard_comment_context() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p record; i record; item_title text;
begin
 select projects.id,projects.name,clients.name as client_name into p from public.projects left join public.clients on clients.id=projects.client_id where projects.id=new.project_id;
 if new.schedule_item_id is not null then
  select id,title,project_id into i from public.schedule_items where id=new.schedule_item_id;
  if i.project_id is distinct from new.project_id then raise exception 'Schedule item must belong to this project'; end if;
  item_title=i.title;
 end if;
 new.created_at=now();new.author_id=auth.uid(); new.author_email=auth.jwt()->>'email';
 new.context=jsonb_build_object('project_id',p.id,'project_name',p.name,'client_name',p.client_name,'schedule_item_id',new.schedule_item_id,'schedule_title',item_title);
 new.reviewed_at=null;new.review_note=null;
 return new;
end;
$$;
drop trigger if exists dashboard_comment_context on public.dashboard_comments;
create trigger dashboard_comment_context before insert on public.dashboard_comments for each row execute function public.set_dashboard_comment_context();
alter table public.dashboard_comments enable row level security;
revoke all on public.dashboard_comments from anon, authenticated;
grant select, insert on public.dashboard_comments to authenticated;
create policy comments_own_read on public.dashboard_comments for select to authenticated using (public.is_dashboard_member() and author_id=auth.uid());
create policy comments_member_insert on public.dashboard_comments for insert to authenticated with check (public.is_dashboard_member() and author_id=auth.uid() and author_email=(auth.jwt()->>'email') and reviewed_at is null and review_note is null);
create index if not exists dashboard_comments_unreviewed on public.dashboard_comments(created_at) where reviewed_at is null;
commit;
