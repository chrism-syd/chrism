begin;

update public.people p
set
  archived_at = null,
  archived_by_auth_user_id = null,
  archive_reason = null,
  updated_at = now()
where p.id in (
  select distinct mr.legacy_people_id
  from public.member_records mr
  where mr.lifecycle_state = 'active'
    and mr.legacy_people_id is not null
)
and p.archived_at is not null;

commit;