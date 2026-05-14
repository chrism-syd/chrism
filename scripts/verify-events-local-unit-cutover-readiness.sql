-- Read-only verifier for removing event-page council_id fallback branches.
--
-- Goal:
-- App event surfaces should scope by events.local_unit_id / event_archives.local_unit_id.
-- This verifies whether any live rows still depend on council_id-only fallback.
--
-- This script does not mutate data.

with events_missing_local_unit as (
  select
    e.id,
    e.title,
    e.council_id,
    c.name as legacy_council_name,
    c.council_number,
    e.local_unit_id,
    e.status_code,
    e.event_kind_code,
    e.starts_at,
    e.ends_at,
    lu.id as expected_local_unit_id,
    lu.display_name as expected_local_unit_name
  from public.events e
  left join public.councils c
    on c.id = e.council_id
  left join public.local_units lu
    on lu.legacy_council_id = e.council_id
  where e.local_unit_id is null
    and e.council_id is not null
), event_archives_missing_local_unit as (
  select
    ea.id,
    ea.original_event_id,
    ea.title,
    ea.council_id,
    c.name as legacy_council_name,
    c.council_number,
    ea.local_unit_id,
    ea.deleted_at,
    lu.id as expected_local_unit_id,
    lu.display_name as expected_local_unit_name
  from public.event_archives ea
  left join public.councils c
    on c.id = ea.council_id
  left join public.local_units lu
    on lu.legacy_council_id = ea.council_id
  where ea.local_unit_id is null
    and ea.council_id is not null
), events_ambiguous_bridge as (
  select
    e.id,
    e.title,
    e.council_id,
    count(lu.id) as matching_local_unit_count
  from public.events e
  join public.local_units lu
    on lu.legacy_council_id = e.council_id
  where e.local_unit_id is null
    and e.council_id is not null
  group by e.id, e.title, e.council_id
  having count(lu.id) <> 1
), event_archives_ambiguous_bridge as (
  select
    ea.id,
    ea.original_event_id,
    ea.title,
    ea.council_id,
    count(lu.id) as matching_local_unit_count
  from public.event_archives ea
  join public.local_units lu
    on lu.legacy_council_id = ea.council_id
  where ea.local_unit_id is null
    and ea.council_id is not null
  group by ea.id, ea.original_event_id, ea.title, ea.council_id
  having count(lu.id) <> 1
)
select
  (select count(*) from events_missing_local_unit) as events_missing_local_unit_count,
  (select count(*) from event_archives_missing_local_unit) as event_archives_missing_local_unit_count,
  (select count(*) from events_ambiguous_bridge) as events_ambiguous_bridge_count,
  (select count(*) from event_archives_ambiguous_bridge) as event_archives_ambiguous_bridge_count;

-- Details for rows still relying on legacy council_id fallback.

select
  'events_missing_local_unit' as source,
  e.id,
  null::uuid as original_event_id,
  e.title,
  e.council_id,
  c.name as legacy_council_name,
  c.council_number,
  e.local_unit_id,
  e.status_code,
  e.event_kind_code,
  e.starts_at,
  e.ends_at,
  null::timestamp with time zone as deleted_at,
  lu.id as expected_local_unit_id,
  lu.display_name as expected_local_unit_name
from public.events e
left join public.councils c
  on c.id = e.council_id
left join public.local_units lu
  on lu.legacy_council_id = e.council_id
where e.local_unit_id is null
  and e.council_id is not null
union all
select
  'event_archives_missing_local_unit' as source,
  ea.id,
  ea.original_event_id,
  ea.title,
  ea.council_id,
  c.name as legacy_council_name,
  c.council_number,
  ea.local_unit_id,
  ea.status_code,
  null::text as event_kind_code,
  ea.starts_at,
  ea.ends_at,
  ea.deleted_at,
  lu.id as expected_local_unit_id,
  lu.display_name as expected_local_unit_name
from public.event_archives ea
left join public.councils c
  on c.id = ea.council_id
left join public.local_units lu
  on lu.legacy_council_id = ea.council_id
where ea.local_unit_id is null
  and ea.council_id is not null
order by source, starts_at nulls last, deleted_at nulls last, title;
