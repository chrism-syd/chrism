-- All test records, transitions and audit entries are rolled back.
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $test$
declare
  unit_id uuid; other_unit uuid; v_council_id uuid; actor uuid; person uuid;
  category text; original_category text; cm2 uuid;
begin
  select lu.id,lu.legacy_council_id into unit_id,v_council_id
    from public.local_units lu join public.councils c on c.id=lu.legacy_council_id where c.council_number='7689';
  select id into actor from auth.users order by created_at limit 1;
  select id into other_unit from public.local_units where id<>unit_id limit 1;
  foreach category in array array['member','volunteer_only','prospect'] loop
    insert into public.people(council_id,first_name,last_name,primary_relationship_code,created_source_code,prospect_status_code,volunteer_context_code)
      values(v_council_id,'ArchiveRegression',category,category,'supreme_import',case when category='prospect' then 'new' end,case when category='volunteer_only' then 'unknown' end) returning id into person;
    insert into public.local_unit_people(local_unit_id,person_id) values(unit_id,person);
    perform public.archive_local_unit_member_record(unit_id,person,actor,'Regression test');
    if exists(select 1 from public.local_unit_people where local_unit_id=unit_id and person_id=person and ended_at is null)
      then raise exception 'Archive did not end assignment'; end if;
    if exists(select 1 from public.people where id=person and (archived_at is not null or primary_relationship_code<>category))
      then raise exception 'Global profile or category changed'; end if;
    if exists(select 1 from public.member_records where legacy_people_id=person)
      then raise exception 'Archive manufactured a member record'; end if;
    perform public.archive_local_unit_member_record(unit_id,person,actor,'Repeat');
    perform public.restore_local_unit_member_record(unit_id,person,actor);
    if not exists(select 1 from public.local_unit_people where local_unit_id=unit_id and person_id=person and ended_at is null)
      then raise exception 'Restore did not reactivate assignment'; end if;
    perform public.restore_local_unit_member_record(unit_id,person,actor);
    -- Supporting member records transition with the assignment.
    insert into public.member_records(local_unit_id,first_name,last_name,legacy_people_id,legacy_council_id)
      values(unit_id,'ArchiveRegression',category,person,v_council_id);
    insert into public.member_records(local_unit_id,first_name,last_name,legacy_people_id,legacy_council_id,lifecycle_state,archived_at)
      values(unit_id,'Historical',category,person,v_council_id,'archived','2000-01-01');
    insert into public.local_unit_people(local_unit_id,person_id,ended_at)
      values(unit_id,person,'2000-01-01');
    perform public.archive_local_unit_member_record(unit_id,person,actor,'Supporting rows');
    if exists(select 1 from public.member_records where local_unit_id=unit_id and legacy_people_id=person and archived_at is null)
      then raise exception 'Supporting row remained active'; end if;
    perform public.restore_local_unit_member_record(unit_id,person,actor);
    if (select count(*) from public.member_records where local_unit_id=unit_id and legacy_people_id=person and archived_at is null)<>1
      then raise exception 'Restore did not choose exactly one supporting row'; end if;
    if not exists(select 1 from public.member_records where local_unit_id=unit_id and legacy_people_id=person and archived_at='2000-01-01')
      then raise exception 'Historical archive was reactivated'; end if;
  end loop;
  -- Reproduce the actual reported entry, without persisting its archive.
  select id,primary_relationship_code into cm2,original_category from public.people
    where first_name='CM2' and last_name='Filter' and public.people.council_id=v_council_id;
  if cm2 is null then raise exception 'CM2 fixture not found'; end if;
  perform public.archive_local_unit_member_record(unit_id,cm2,actor,'Regression test');
  if exists(select 1 from public.local_unit_people where local_unit_id=unit_id and person_id=cm2 and ended_at is null)
    then raise exception 'CM2 remained active'; end if;
  perform public.restore_local_unit_member_record(unit_id,cm2,actor);
  if not exists(select 1 from public.people where id=cm2 and primary_relationship_code=original_category)
    then raise exception 'CM2 category changed'; end if;
  -- A person in one organization cannot be archived in an unrelated unit.
  begin
    perform public.archive_local_unit_member_record(other_unit,cm2,actor,'Wrong unit');
    raise exception 'Cross-organization archive accepted';
  exception when others then
    if sqlerrm<>'Person does not belong to this local organization' then raise; end if;
  end;
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  begin
    perform public.archive_local_unit_member_record(unit_id,cm2,actor,'Unauthorized');
    raise exception 'Unauthenticated actor accepted';
  exception when others then
    if sqlerrm<>'Not authorized to manage people in this local organization' then raise; end if;
  end;
end;
$test$;
rollback;
select 'Archive/restore regression checks passed; test changes rolled back' as result;
