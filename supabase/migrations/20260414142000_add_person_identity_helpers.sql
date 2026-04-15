begin;

create or replace function app.find_person_identity_id(
  p_person_id uuid
)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select pil.person_identity_id
  from public.person_identity_links pil
  where pil.person_id = p_person_id
    and pil.ended_at is null
  limit 1;
$function$;

create or replace function app.find_person_identity_id_for_user(
  p_user_id uuid
)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select pi.id
  from public.person_identities pi
  where pi.primary_user_id = p_user_id
  limit 1;
$function$;

create or replace function app.list_active_people_for_identity(
  p_person_identity_id uuid
)
returns table (
  person_id uuid
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select pil.person_id
  from public.person_identity_links pil
  join public.people p
    on p.id = pil.person_id
  where pil.person_identity_id = p_person_identity_id
    and pil.ended_at is null
    and p.archived_at is null
    and p.merged_into_person_id is null
  order by pil.linked_at, pil.person_id;
$function$;

commit;