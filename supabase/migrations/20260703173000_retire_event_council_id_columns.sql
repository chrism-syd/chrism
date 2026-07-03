-- Retire event ownership council_id columns.
--
-- Event ownership scope is local_unit_id. Council identity remains valid for
-- inter-council invitations through event_invited_councils / event_council_rsvps.

do $$
declare
  v_events_missing integer;
  v_archives_missing integer;
  v_events_ambiguous integer;
  v_archives_ambiguous integer;
begin
  select count(*)
    into v_events_missing
  from public.events
  where local_unit_id is null;

  select count(*)
    into v_archives_missing
  from public.event_archives
  where local_unit_id is null;

  select count(*)
    into v_events_ambiguous
  from public.events e
  where e.council_id is not null
    and not exists (
      select 1
      from public.local_units lu
      where lu.id = e.local_unit_id
        and lu.legacy_council_id = e.council_id
    );

  select count(*)
    into v_archives_ambiguous
  from public.event_archives ea
  where ea.council_id is not null
    and not exists (
      select 1
      from public.local_units lu
      where lu.id = ea.local_unit_id
        and lu.legacy_council_id = ea.council_id
    );

  if v_events_missing > 0
     or v_archives_missing > 0
     or v_events_ambiguous > 0
     or v_archives_ambiguous > 0 then
    raise exception
      'Refusing to retire event council_id columns: events_missing=%, archives_missing=%, events_ambiguous=%, archives_ambiguous=%',
      v_events_missing,
      v_archives_missing,
      v_events_ambiguous,
      v_archives_ambiguous;
  end if;
end $$;

drop view if exists public.event_host_summary;
drop view if exists public.event_council_rsvp_rollups;

drop trigger if exists events_sync_local_unit_id_from_legacy_council on public.events;
drop trigger if exists events_sync_local_unit_from_council on public.events;
drop trigger if exists event_archives_sync_local_unit_id_from_legacy_council on public.event_archives;

drop function if exists public.set_event_local_unit_id_from_legacy_council();
drop function if exists public.sync_event_local_unit_from_council();
drop function if exists public.set_event_archive_local_unit_id_from_legacy_council();

drop index if exists public.events_meeting_kind_starts_idx;
drop index if exists public.events_meeting_upcoming_idx;
drop index if exists public.idx_events_council_scope_starts_at;
drop index if exists public.idx_events_council_starts_at;
drop index if exists public.idx_events_council_status_starts_at;
drop index if exists public.event_archives_council_deleted_idx;

alter table public.events
  alter column local_unit_id set not null;

alter table public.event_archives
  alter column local_unit_id set not null;

alter table public.events
  drop column if exists council_id;

alter table public.event_archives
  drop column if exists council_id;

create or replace view public.event_council_rsvp_rollups as
select
  e.id as event_id,
  host_ic.invited_council_id as host_council_id,
  ic.id as event_invited_council_id,
  ic.is_host,
  ic.invited_council_type_code,
  ic.invited_council_id,
  ic.invited_council_name,
  ic.invited_council_number,
  ic.invite_email,
  r.id as event_council_rsvp_id,
  r.id is not null as has_responded,
  r.first_responded_at,
  r.last_responded_at,
  coalesce(count(v.id), 0::bigint)::integer as volunteer_count
from public.events e
join public.event_invited_councils ic
  on ic.event_id = e.id
left join public.event_invited_councils host_ic
  on host_ic.event_id = e.id
 and host_ic.is_host = true
left join public.event_council_rsvps r
  on r.event_invited_council_id = ic.id
left join public.event_rsvp_volunteers v
  on v.event_council_rsvp_id = r.id
group by
  e.id,
  host_ic.invited_council_id,
  ic.id,
  ic.is_host,
  ic.invited_council_type_code,
  ic.invited_council_id,
  ic.invited_council_name,
  ic.invited_council_number,
  ic.invite_email,
  r.id,
  r.first_responded_at,
  r.last_responded_at;

create or replace view public.event_host_summary as
select
  event_id,
  host_council_id,
  count(*)::integer as invited_council_count,
  count(*) filter (where has_responded)::integer as responded_council_count,
  coalesce(sum(volunteer_count), 0::bigint)::integer as total_volunteer_count
from public.event_council_rsvp_rollups
group by event_id, host_council_id;

comment on column public.events.local_unit_id is
  'Required operational owner local unit for this event.';

comment on column public.event_archives.local_unit_id is
  'Required operational owner local unit for this archived event.';
