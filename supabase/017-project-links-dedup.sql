-- Feed-side source discovery (Oct 27): a confirmed source match attaches one
-- project_links row per (project, step, url). This index makes a double-attach
-- impossible even if the feed consumer retries after a partial failure.
begin;
create unique index if not exists project_links_source_dedup
 on public.project_links (project_id, coalesce(schedule_item_id,'00000000-0000-0000-0000-000000000000'::uuid), url);
commit;
