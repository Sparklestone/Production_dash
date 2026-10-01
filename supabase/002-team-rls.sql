begin;
do $$
declare t text; p record;
begin
 foreach t in array array['clients','projects','team_members','project_updates','project_links','schedule_items','schedule_dependencies','revision_checklists','revision_checklist_items'] loop
  if to_regclass('public.'||t) is not null then
   execute format('alter table public.%I enable row level security',t);
   for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
    execute format('drop policy %I on public.%I',p.policyname,t);
   end loop;
   execute format('revoke all on public.%I from anon, authenticated',t);
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy dashboard_team_read on public.%I for select to authenticated using (public.is_dashboard_member())',t);
  end if;
 end loop;
end $$;
commit;
select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename;
