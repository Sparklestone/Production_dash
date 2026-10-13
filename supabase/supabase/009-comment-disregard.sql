begin;
alter table public.dashboard_comments add column if not exists disregarded_at timestamptz;
alter table public.dashboard_comments add column if not exists undo_status text;
alter table public.dashboard_comments add column if not exists undo_note text;
create table if not exists public.dashboard_comment_changes(
 id bigint generated always as identity primary key,
 comment_id uuid not null references public.dashboard_comments(id),
 table_name text not null, row_id uuid not null,
 before_row jsonb, after_row jsonb, created_at timestamptz not null default now()
);
alter table public.dashboard_comment_changes enable row level security;
revoke all on public.dashboard_comment_changes from anon,authenticated;
grant select on public.dashboard_comment_changes to authenticated;
create policy comment_changes_own_read on public.dashboard_comment_changes for select to authenticated using (exists(select 1 from public.dashboard_comments c where c.id=comment_id and c.author_id=auth.uid()) and public.is_dashboard_member());
-- The processor must use this transaction for future comment-driven writes.
create or replace function public.apply_dashboard_comment_changes(target_comment_id uuid,changes jsonb,processing_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.dashboard_comments%rowtype; change jsonb; t text; rid uuid; before_data jsonb; after_data jsonb; patch jsonb; cols text; vals text;
begin
 if coalesce(auth.role(),'')<>'service_role' and session_user<>'postgres' then raise exception 'Private processor access required'; end if;
 select * into c from public.dashboard_comments where id=target_comment_id for update;
 if not found or c.disregarded_at is not null or c.reviewed_at is not null then raise exception 'Comment missing, disregarded or already processed'; end if;
 if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes)>100 then raise exception 'Invalid changes'; end if;
 for change in select * from jsonb_array_elements(changes) loop
  t=change->>'table';rid=(change->>'id')::uuid;patch=change->'patch';
  if t not in ('projects','schedule_items','project_updates','project_links','dashboard_questions') or rid is null or jsonb_typeof(patch) is distinct from 'object' or patch ? 'id' then raise exception 'Invalid change target'; end if;
  execute format('select to_jsonb(r) from public.%I r where id=$1 for update',t) into before_data using rid;
  if before_data is distinct from nullif(change->'expected','null'::jsonb) then raise exception 'Target changed. Refresh before processing'; end if;
  if before_data is null then
   after_data=patch||jsonb_build_object('id',rid);
   select string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') into cols,vals from jsonb_object_keys(after_data) key;
   execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r',t,cols,vals,t) using after_data;
  else
   select string_agg(format('%I=r.%I',key,key),',') into cols from jsonb_object_keys(patch) key;
   if cols is null then raise exception 'Empty change'; end if;
   execute format('update public.%I target set %s from jsonb_populate_record(null::public.%I,$1) r where target.id=$2',t,cols,t) using before_data||patch,rid;
  end if;
  execute format('select to_jsonb(r) from public.%I r where id=$1',t) into after_data using rid;
  insert into public.dashboard_comment_changes(comment_id,table_name,row_id,before_row,after_row) values(c.id,t,rid,before_data,after_data);
 end loop;
 update public.dashboard_comments set reviewed_at=now(),review_note=processing_note where id=c.id;
 return jsonb_build_object('ok',true,'count',jsonb_array_length(changes));
end;$$;
revoke all on function public.apply_dashboard_comment_changes(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.apply_dashboard_comment_changes(uuid,jsonb,text) to service_role;
-- Disregard always suppresses the direction. Restoration is atomic and field-safe.
create or replace function public.disregard_dashboard_comment(target_comment_id uuid,restore_changes boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.dashboard_comments%rowtype; ch record; current_data jsonb; k text; cols text; patch jsonb; conflict boolean:=false; n integer; result text;
begin
 if auth.uid() is null or not public.is_dashboard_member() then raise exception 'Approved access required'; end if;
 select * into c from public.dashboard_comments where id=target_comment_id and author_id=auth.uid() for update;
 if not found then raise exception 'Comment not found'; end if;
 if c.disregarded_at is not null then return jsonb_build_object('status',c.undo_status,'note',c.undo_note); end if;
 select count(*) into n from public.dashboard_comment_changes where comment_id=c.id;
 result=case when not restore_changes then 'ignored' when n=0 and c.reviewed_at is null then 'ignored' when n=0 then 'review_requested' else 'restored' end;
 if result='restored' then
  -- Run rollback in a subtransaction: a conflict rolls back ALL restoration writes.
  begin
   for ch in select * from public.dashboard_comment_changes where comment_id=c.id order by id desc loop
    execute format('select to_jsonb(r) from public.%I r where id=$1 for update',ch.table_name) into current_data using ch.row_id;
    if ch.before_row is null then
     if current_data is distinct from ch.after_row then raise exception 'Later change'; end if;
     execute format('delete from public.%I where id=$1',ch.table_name) using ch.row_id;
    else
     if current_data is null then raise exception 'Row missing'; end if;
     patch='{}'::jsonb;
     for k in select key from jsonb_object_keys(ch.after_row) key loop
      if ch.before_row->k is distinct from ch.after_row->k then
       if current_data->k is distinct from ch.after_row->k then raise exception 'Later change'; end if;
       patch=patch||jsonb_build_object(k,ch.before_row->k);
      end if;
     end loop;
     select string_agg(format('%I=r.%I',key,key),',') into cols from jsonb_object_keys(patch) key;
     if cols is not null then execute format('update public.%I target set %s from jsonb_populate_record(null::public.%I,$1) r where target.id=$2',ch.table_name,cols,ch.table_name) using current_data||patch,ch.row_id; end if;
    end if;
   end loop;
  exception when others then result='review_requested';
  end;
 end if;
 update public.dashboard_comments set disregarded_at=now(),undo_status=result,undo_note=case result when 'restored' then 'Tracked changes restored. Later edits to other fields were kept.' when 'review_requested' then 'Direction ignored. Restoration needs review because prior state is unavailable or later edits conflict. No changes were restored.' else 'Direction ignored. No card changes were restored.' end where id=c.id returning * into c;
 return jsonb_build_object('status',c.undo_status,'note',c.undo_note,'count',n);
end;$$;
revoke all on function public.disregard_dashboard_comment(uuid,boolean) from public,anon;
grant execute on function public.disregard_dashboard_comment(uuid,boolean) to authenticated;
commit;
