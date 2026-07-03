begin;

-- Later migrations use:
--   on conflict (event_id, member_record_id, role_code) do nothing
--
-- PostgreSQL cannot use the partial unique index on these columns for that
-- conflict target, so provide a full unique index before those migrations run.

create unique index if not exists uq_event_assignments_event_member_role_conflict
  on public.event_assignments (event_id, member_record_id, role_code);

commit;
