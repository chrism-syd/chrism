-- Add local-unit volunteer hour tracking.
--
-- This keeps completed-event volunteer hours calculated from person-linked RSVP attendee
-- rows, then layers manual adjustments on top as an auditable ledger.
--
-- TODO: Add volunteer recognition levels (Gold/Silver/Bronze/etc.) after reporting-year
-- totals are stable. Recognition should be derived from local-unit reporting-year totals,
-- not stored directly on people records in v1.

begin;

create table if not exists public.local_unit_reporting_year_settings (
  local_unit_id uuid primary key references public.local_units(id) on delete cascade,
  year_label text not null default 'Calendar year',
  year_start_month integer not null default 1,
  year_start_day integer not null default 1,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint local_unit_reporting_year_settings_month_check
    check (year_start_month between 1 and 12),
  constraint local_unit_reporting_year_settings_day_check
    check (year_start_day between 1 and 31)
);

create table if not exists public.local_unit_volunteer_hour_adjustments (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  event_id uuid null references public.events(id) on delete set null,
  hours_delta numeric(7, 2) not null,
  credited_on date not null default current_date,
  note text null,
  created_by_user_id uuid null references public.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  voided_at timestamp with time zone null,
  voided_by_user_id uuid null references public.users(id) on delete set null,
  void_reason text null,
  constraint local_unit_volunteer_hour_adjustments_nonzero_check
    check (hours_delta <> 0),
  constraint local_unit_volunteer_hour_adjustments_bounds_check
    check (hours_delta between -999.99 and 999.99)
);

create index if not exists local_unit_volunteer_hour_adjustments_local_unit_person_idx
  on public.local_unit_volunteer_hour_adjustments(local_unit_id, person_id, credited_on desc);

create index if not exists local_unit_volunteer_hour_adjustments_event_idx
  on public.local_unit_volunteer_hour_adjustments(event_id)
  where event_id is not null;

create index if not exists local_unit_volunteer_hour_adjustments_active_idx
  on public.local_unit_volunteer_hour_adjustments(local_unit_id, credited_on desc)
  where voided_at is null;

alter table public.local_unit_reporting_year_settings enable row level security;
alter table public.local_unit_volunteer_hour_adjustments enable row level security;

drop view if exists public.local_unit_volunteer_contribution_rollups;
drop view if exists public.local_unit_volunteer_contribution_entries;

create view public.local_unit_volunteer_contribution_entries
with (security_invoker = true)
as
with event_entries as (
  select
    'event'::text as source_type,
    concat('event:', event.id::text, ':', attendee.matched_person_id::text) as source_id,
    event.local_unit_id,
    attendee.matched_person_id as person_id,
    event.id as event_id,
    event.title as event_title,
    event.starts_at::date as credited_on,
    round(
      case
        when event.ends_at is not null and event.ends_at > event.starts_at
          then extract(epoch from (event.ends_at - event.starts_at)) / 3600.0
        else 1
      end::numeric,
      2
    ) as hours,
    null::text as note,
    event.starts_at as sort_at,
    null::uuid as adjustment_id,
    null::timestamp with time zone as voided_at,
    null::text as void_reason
  from public.events event
  join public.event_person_rsvps rsvp
    on rsvp.event_id = event.id
  join public.event_person_rsvp_attendees attendee
    on attendee.event_person_rsvp_id = rsvp.id
  where event.local_unit_id is not null
    and event.status_code = 'completed'
    and event.event_kind_code = 'standard'
    and rsvp.status_code = 'active'
    and attendee.is_volunteer = true
    and attendee.matched_person_id is not null
    and exists (
      select 1
      from public.local_unit_people lup
      where lup.local_unit_id = event.local_unit_id
        and lup.person_id = attendee.matched_person_id
    )
  group by
    event.id,
    event.local_unit_id,
    event.title,
    event.starts_at,
    event.ends_at,
    attendee.matched_person_id
),
manual_entries as (
  select
    'manual_adjustment'::text as source_type,
    concat('manual:', adjustment.id::text) as source_id,
    adjustment.local_unit_id,
    adjustment.person_id,
    adjustment.event_id,
    event.title as event_title,
    adjustment.credited_on,
    adjustment.hours_delta as hours,
    adjustment.note,
    adjustment.created_at as sort_at,
    adjustment.id as adjustment_id,
    adjustment.voided_at,
    adjustment.void_reason
  from public.local_unit_volunteer_hour_adjustments adjustment
  left join public.events event
    on event.id = adjustment.event_id
   and event.local_unit_id = adjustment.local_unit_id
  where adjustment.voided_at is null
)
select * from event_entries
union all
select * from manual_entries;

create view public.local_unit_volunteer_contribution_rollups
with (security_invoker = true)
as
select
  entry.local_unit_id,
  entry.person_id,
  count(distinct entry.event_id) filter (where entry.source_type = 'event') as volunteer_event_count,
  coalesce(round(sum(entry.hours) filter (where entry.source_type = 'event'), 2), 0::numeric) as event_hours,
  coalesce(round(sum(entry.hours) filter (where entry.source_type = 'manual_adjustment'), 2), 0::numeric) as manual_adjustment_hours,
  coalesce(round(sum(entry.hours), 2), 0::numeric) as total_hours,
  max(entry.credited_on) filter (where entry.source_type = 'event') as last_volunteered_on
from public.local_unit_volunteer_contribution_entries entry
group by entry.local_unit_id, entry.person_id;

grant select on public.local_unit_reporting_year_settings to authenticated, service_role;
grant all on public.local_unit_reporting_year_settings to service_role;

grant select on public.local_unit_volunteer_hour_adjustments to authenticated, service_role;
grant all on public.local_unit_volunteer_hour_adjustments to service_role;

grant select on public.local_unit_volunteer_contribution_entries to authenticated, service_role;
grant select on public.local_unit_volunteer_contribution_rollups to authenticated, service_role;

commit;
