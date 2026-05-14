begin;

-- Repair any remaining active legacy council people that still do not have an
-- active local_unit_people link after the broad council-person backfill.
--
-- This handles historical duplicate/link residue by reopening one ended link
-- per local_unit_id/person_id pair when possible, then inserting rows for any
-- pairs that still have no link at all. It intentionally does not create
-- member_records.

with missing_pairs as (
  select distinct
    lu.id as local_unit_id,
    p.id as person_id
  from public.local_units lu
  join public.people p
    on p.council_id = lu.legacy_council_id
  where lu.local_unit_kind = 'council'::public.local_unit_kind
    and lu.legacy_council_id is not null
    and p.archived_at is null
    and p.merged_into_person_id is null
    and not exists (
      select 1
      from public.local_unit_people active_lup
      where active_lup.local_unit_id = lu.id
        and active_lup.person_id = p.id
        and active_lup.ended_at is null
    )
), ended_candidates as (
  select
    lup.id,
    row_number() over (
      partition by lup.local_unit_id, lup.person_id
      order by lup.updated_at desc nulls last, lup.created_at desc nulls last, lup.id
    ) as candidate_rank
  from public.local_unit_people lup
  join missing_pairs mp
    on mp.local_unit_id = lup.local_unit_id
   and mp.person_id = lup.person_id
  where lup.ended_at is not null
)
update public.local_unit_people lup
   set ended_at = null,
       updated_at = now()
from ended_candidates ec
where ec.id = lup.id
  and ec.candidate_rank = 1;

with missing_pairs as (
  select distinct
    lu.id as local_unit_id,
    p.id as person_id,
    coalesce(p.created_at, now()) as linked_at
  from public.local_units lu
  join public.people p
    on p.council_id = lu.legacy_council_id
  where lu.local_unit_kind = 'council'::public.local_unit_kind
    and lu.legacy_council_id is not null
    and p.archived_at is null
    and p.merged_into_person_id is null
    and not exists (
      select 1
      from public.local_unit_people active_lup
      where active_lup.local_unit_id = lu.id
        and active_lup.person_id = p.id
        and active_lup.ended_at is null
    )
)
insert into public.local_unit_people (
  local_unit_id,
  person_id,
  source_code,
  linked_at,
  created_at,
  updated_at
)
select
  mp.local_unit_id,
  mp.person_id,
  'legacy_council_people_repair',
  mp.linked_at,
  now(),
  now()
from missing_pairs mp
where not exists (
  select 1
  from public.local_unit_people lup
  where lup.local_unit_id = mp.local_unit_id
    and lup.person_id = mp.person_id
)
on conflict do nothing;

commit;
