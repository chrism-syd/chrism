begin;

-- Replace legacy whole-person archive behavior with local-unit member-record archiving.
-- Keep the old function signature so callers survive, but stop archiving the global person row.

create or replace function app.archive_person(p_person_id uuid, p_reason text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public', 'app'
as $function$
declare
  v_person public.people%rowtype;
  v_target_member_record public.member_records%rowtype;
begin
  select *
    into v_person
  from public.people
  where id = p_person_id
    and merged_into_person_id is null;

  if v_person.id is null then
    raise exception 'Person not found';
  end if;

  if not public.auth_can_manage_person(v_person.id) then
    raise exception 'Not allowed to archive this person';
  end if;

  select mr.*
    into v_target_member_record
  from public.member_records mr
  join public.v_effective_area_access v
    on v.local_unit_id = mr.local_unit_id
   and v.area_code = 'members'::public.member_area_code
   and v.is_effective = true
  where mr.legacy_people_id = p_person_id
    and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
    and v.user_id = auth.uid()
  order by mr.updated_at desc nulls last, mr.created_at desc nulls last
  limit 1;

  if v_target_member_record.id is null then
    raise exception 'No active local-unit member record is available to archive for this person';
  end if;

  perform app.archive_local_unit_member_record(
    v_target_member_record.local_unit_id,
    p_person_id,
    auth.uid(),
    p_reason
  );
end;
$function$;

commit;
