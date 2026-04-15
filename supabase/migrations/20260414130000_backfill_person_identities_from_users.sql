begin;

with eligible_users as (
  select
    u.id as user_id,
    u.person_id,
    p.first_name,
    p.last_name
  from public.users u
  join public.people p
    on p.id = u.person_id
  where u.person_id is not null
    and u.is_active = true
    and p.archived_at is null
    and p.merged_into_person_id is null
),
created_identities as (
  insert into public.person_identities (
    primary_user_id,
    display_name
  )
  select
    eu.user_id,
    nullif(trim(concat(eu.first_name, ' ', eu.last_name)), '')
  from eligible_users eu
  where not exists (
    select 1
    from public.person_identities pi
    where pi.primary_user_id = eu.user_id
  )
  returning id, primary_user_id
)
insert into public.person_identity_links (
  person_identity_id,
  person_id,
  link_source,
  confidence_code,
  notes
)
select
  pi.id,
  eu.person_id,
  'user_person_backfill',
  'confirmed',
  'Backfilled from users.person_id'
from eligible_users eu
join public.person_identities pi
  on pi.primary_user_id = eu.user_id
where not exists (
  select 1
  from public.person_identity_links pil
  where pil.person_id = eu.person_id
    and pil.ended_at is null
);

commit;