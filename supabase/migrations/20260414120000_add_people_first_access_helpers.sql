begin;

create or replace function app.user_can_access_local_person(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.local_unit_people lup
    join public.people p
      on p.id = lup.person_id
    join public.v_effective_area_access v
      on v.local_unit_id = lup.local_unit_id
     and v.area_code = 'members'::public.member_area_code
     and v.is_effective = true
    where lup.person_id = p_person_id
      and lup.ended_at is null
      and p.archived_at is null
      and p.merged_into_person_id is null
      and v.user_id = auth.uid()
  );
$function$;

create or replace function app.user_can_access_local_person_as_user(
  p_user_id uuid,
  p_person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.local_unit_people lup
    join public.people p
      on p.id = lup.person_id
    join public.v_effective_area_access v
      on v.local_unit_id = lup.local_unit_id
     and v.area_code = 'members'::public.member_area_code
     and v.is_effective = true
    where lup.person_id = p_person_id
      and lup.ended_at is null
      and p.archived_at is null
      and p.merged_into_person_id is null
      and v.user_id = p_user_id
  );
$function$;

commit;