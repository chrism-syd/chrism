begin;

-- Replace legacy council/scope person access with local-unit/member-record based access.
-- Read access is allowed when the signed-in user has any effective member-area access
-- for an active local-unit member_record attached to the target person.

create or replace function app.user_can_access_person(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.member_records mr
    join public.v_effective_area_access v
      on v.local_unit_id = mr.local_unit_id
     and v.area_code = 'members'::public.member_area_code
     and v.is_effective = true
    where mr.legacy_people_id = p_person_id
      and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
      and v.user_id = auth.uid()
  );
$function$;

create or replace function app.user_can_access_person_as_user(p_user_id uuid, p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.member_records mr
    join public.v_effective_area_access v
      on v.local_unit_id = mr.local_unit_id
     and v.area_code = 'members'::public.member_area_code
     and v.is_effective = true
    where mr.legacy_people_id = p_person_id
      and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
      and v.user_id = p_user_id
  );
$function$;

commit;
