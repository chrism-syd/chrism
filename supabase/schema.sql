


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "app";


ALTER SCHEMA "app" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."area_access_level" AS ENUM (
    'read_only',
    'edit_manage',
    'manage',
    'interact'
);


ALTER TYPE "public"."area_access_level" OWNER TO "postgres";


CREATE TYPE "public"."content_relationship_kind" AS ENUM (
    'variant',
    'child',
    'related',
    'companion',
    'source'
);


ALTER TYPE "public"."content_relationship_kind" OWNER TO "postgres";


CREATE TYPE "public"."content_saint_relationship_kind" AS ENUM (
    'about',
    'to',
    'through',
    'patron'
);


ALTER TYPE "public"."content_saint_relationship_kind" OWNER TO "postgres";


CREATE TYPE "public"."event_assignment_scope_code" AS ENUM (
    'all_events',
    'event',
    'event_kind'
);


ALTER TYPE "public"."event_assignment_scope_code" OWNER TO "postgres";


CREATE TYPE "public"."grant_source_code" AS ENUM (
    'manual',
    'title_default',
    'invite_package',
    'legacy_backfill',
    'system'
);


ALTER TYPE "public"."grant_source_code" OWNER TO "postgres";


CREATE TYPE "public"."local_unit_kind" AS ENUM (
    'parish',
    'council',
    'conference',
    'ministry',
    'other'
);


ALTER TYPE "public"."local_unit_kind" OWNER TO "postgres";


CREATE TYPE "public"."local_unit_status" AS ENUM (
    'active',
    'inactive',
    'archived'
);


ALTER TYPE "public"."local_unit_status" OWNER TO "postgres";


CREATE TYPE "public"."member_area_code" AS ENUM (
    'members',
    'events',
    'custom_lists',
    'claims',
    'admins',
    'local_unit_settings'
);


ALTER TYPE "public"."member_area_code" OWNER TO "postgres";


CREATE TYPE "public"."member_record_lifecycle_state" AS ENUM (
    'active',
    'inactive',
    'archived'
);


ALTER TYPE "public"."member_record_lifecycle_state" OWNER TO "postgres";


CREATE TYPE "public"."membership_claim_status_code" AS ENUM (
    'pending',
    'approved',
    'denied',
    'withdrawn',
    'expired'
);


ALTER TYPE "public"."membership_claim_status_code" OWNER TO "postgres";


CREATE TYPE "public"."prayer_type_code" AS ENUM (
    'traditional',
    'litany',
    'novena',
    'chaplet',
    'intercession',
    'blessing',
    'collect',
    'devotion',
    'other'
);


ALTER TYPE "public"."prayer_type_code" OWNER TO "postgres";


CREATE TYPE "public"."relationship_kind" AS ENUM (
    'linked_member_record',
    'parish_self_claim'
);


ALTER TYPE "public"."relationship_kind" OWNER TO "postgres";


CREATE TYPE "public"."relationship_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."relationship_status" OWNER TO "postgres";


CREATE TYPE "public"."resource_type_code" AS ENUM (
    'custom_list',
    'event',
    'event_type',
    'all_events'
);


ALTER TYPE "public"."resource_type_code" OWNER TO "postgres";


CREATE TYPE "public"."role_kind" AS ENUM (
    'officer',
    'service'
);


ALTER TYPE "public"."role_kind" OWNER TO "postgres";


CREATE TYPE "public"."spiritual_content_kind" AS ENUM (
    'prayer',
    'daily_reading',
    'reflection',
    'saint_profile',
    'scripture_passage',
    'catechism_reference'
);


ALTER TYPE "public"."spiritual_content_kind" OWNER TO "postgres";


CREATE TYPE "public"."spiritual_scope_kind" AS ENUM (
    'global',
    'organization_family',
    'local_unit'
);


ALTER TYPE "public"."spiritual_scope_kind" OWNER TO "postgres";


CREATE TYPE "public"."spiritual_text_status_code" AS ENUM (
    'draft',
    'review',
    'approved',
    'published',
    'retired'
);


ALTER TYPE "public"."spiritual_text_status_code" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."add_person_note"("p_person_id" "uuid", "p_note_type_code" "text", "p_body" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_person public.people%rowtype;
  v_note_id uuid;
begin
  select *
    into v_person
  from public.people
  where id = p_person_id
    and merged_into_person_id is null;

  if v_person.id is null then
    raise exception 'Person not found';
  end if;

  if not app.user_can_access_person(v_person.id) then
    raise exception 'Not allowed to add note to this person';
  end if;

  if p_note_type_code = 'admin' and not public.auth_can_manage_person(v_person.id) then
    raise exception 'Only managers can create admin notes';
  end if;

  insert into public.person_notes (
    council_id,
    person_id,
    note_type_code,
    body,
    created_by_auth_user_id,
    updated_by_auth_user_id
  )
  values (
    v_person.council_id,
    v_person.id,
    p_note_type_code,
    p_body,
    auth.uid(),
    auth.uid()
  )
  returning id into v_note_id;

  perform app.write_audit_log(
    v_person.council_id,
    'person_notes',
    v_note_id,
    'add_person_note',
    jsonb_build_object('person_id', p_person_id)
  );

  return v_note_id;
end;
$$;


ALTER FUNCTION "app"."add_person_note"("p_person_id" "uuid", "p_note_type_code" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app'
    AS $$
  select app.archive_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    auth.uid(),
    p_reason
  );
$$;


ALTER FUNCTION "app"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app'
    AS $$
declare
  v_member_record public.member_records%rowtype;
  v_person public.people%rowtype;
  v_local_unit public.local_units%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_person
  from public.people
  where id = p_person_id;

  if not found then
    raise exception 'Person not found';
  end if;

  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if not found then
    raise exception 'Local unit not found';
  end if;

  select *
    into v_member_record
  from public.member_records
  where local_unit_id = p_local_unit_id
    and legacy_people_id = p_person_id
  limit 1;

  if not found then
    raise exception 'Local-unit member record not found';
  end if;

  update public.member_records
     set lifecycle_state = 'archived'::public.member_record_lifecycle_state,
         archived_at = coalesce(archived_at, now()),
         updated_at = now(),
         updated_by_auth_user_id = p_actor_user_id
   where id = v_member_record.id;

  update public.local_unit_people
     set ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where local_unit_id = p_local_unit_id
     and person_id = p_person_id
     and ended_at is null;

  perform app.write_audit_log(
    coalesce(v_local_unit.legacy_council_id, v_person.council_id),
    'member_records',
    v_member_record.id,
    'archive_local_unit_member_record',
    jsonb_build_object(
      'person_id', p_person_id,
      'local_unit_id', p_local_unit_id,
      'actor_user_id', p_actor_user_id,
      'reason', p_reason
    )
  );

  return v_member_record.id;
end;
$$;


ALTER FUNCTION "app"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."archive_person"("p_person_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app'
    AS $$
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
$$;


ALTER FUNCTION "app"."archive_person"("p_person_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."assign_person"("p_person_id" "uuid", "p_user_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_person public.people%rowtype;
  v_assignment_id uuid;
begin
  select *
    into v_person
  from public.people
  where id = p_person_id
    and merged_into_person_id is null;

  if v_person.id is null then
    raise exception 'Person not found';
  end if;

  if not public.auth_can_manage_person_assignments(v_person.id) then
    raise exception 'Not allowed to assign this person';
  end if;

  if not app.user_can_access_person_as_user(p_user_id, v_person.id) then
    raise exception 'Assignment target user cannot access this person';
  end if;

  insert into public.person_assignments (
    council_id,
    person_id,
    user_id,
    assigned_by_auth_user_id,
    notes
  )
  values (
    v_person.council_id,
    v_person.id,
    p_user_id,
    auth.uid(),
    p_notes
  )
  returning id into v_assignment_id;

  perform app.write_audit_log(
    v_person.council_id,
    'person_assignments',
    v_assignment_id,
    'assign_person',
    jsonb_build_object('person_id', p_person_id, 'user_id', p_user_id)
  );

  return v_assignment_id;
end;
$$;


ALTER FUNCTION "app"."assign_person"("p_person_id" "uuid", "p_user_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."create_prospect_for_local_unit"("p_local_unit_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text" DEFAULT NULL::"text", "p_cell_phone" "text" DEFAULT NULL::"text", "p_home_phone" "text" DEFAULT NULL::"text", "p_other_phone" "text" DEFAULT NULL::"text", "p_prospect_status_code" "text" DEFAULT 'new'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_local_unit public.local_units%rowtype;
  v_person_id uuid;
  v_member_record_id uuid;
begin
  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if v_local_unit.id is null then
    raise exception 'Local unit not found';
  end if;

  if v_local_unit.legacy_council_id is null then
    raise exception 'Local unit is not linked to a legacy council';
  end if;

  if not public.auth_has_area_access(
    p_local_unit_id,
    'members'::public.member_area_code,
    'edit_manage'::public.area_access_level
  ) then
    raise exception 'Not allowed to create prospects';
  end if;

  insert into public.people (
    council_id,
    first_name,
    last_name,
    primary_relationship_code,
    created_source_code,
    prospect_status_code,
    email,
    cell_phone,
    home_phone,
    other_phone,
    created_by_auth_user_id,
    updated_by_auth_user_id
  )
  values (
    v_local_unit.legacy_council_id,
    p_first_name,
    p_last_name,
    'prospect',
    'scoped_manual_prospect',
    p_prospect_status_code,
    p_email,
    p_cell_phone,
    p_home_phone,
    p_other_phone,
    auth.uid(),
    auth.uid()
  )
  returning id into v_person_id;

  begin
    v_member_record_id := public.ensure_member_record_for_person_local_unit(
      p_local_unit_id,
      v_person_id
    );

    if v_member_record_id is null then
      raise exception 'Could not link created prospect to local unit';
    end if;
  exception
    when others then
      delete from public.people
      where id = v_person_id
        and primary_relationship_code = 'prospect';
      raise;
  end;

  perform app.write_audit_log(
    v_local_unit.legacy_council_id,
    'people',
    v_person_id,
    'create_prospect',
    jsonb_build_object(
      'local_unit_id', p_local_unit_id,
      'member_record_id', v_member_record_id
    )
  );

  return v_person_id;
end;
$$;


ALTER FUNCTION "app"."create_prospect_for_local_unit"("p_local_unit_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_prospect_status_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "app"."create_prospect_for_local_unit"("p_local_unit_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_prospect_status_code" "text") IS 'Service-role-only local-unit-first prospect creation helper. Browser execution intentionally revoked; app code should prefer explicit local_unit_id ownership.';



CREATE OR REPLACE FUNCTION "app"."create_volunteer_only_for_local_unit"("p_local_unit_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text" DEFAULT NULL::"text", "p_cell_phone" "text" DEFAULT NULL::"text", "p_home_phone" "text" DEFAULT NULL::"text", "p_other_phone" "text" DEFAULT NULL::"text", "p_volunteer_context_code" "text" DEFAULT 'unknown'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_local_unit public.local_units%rowtype;
  v_person_id uuid;
  v_member_record_id uuid;
begin
  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if v_local_unit.id is null then
    raise exception 'Local unit not found';
  end if;

  if v_local_unit.legacy_council_id is null then
    raise exception 'Local unit is not linked to a legacy council';
  end if;

  if not public.auth_has_area_access(
    p_local_unit_id,
    'members'::public.member_area_code,
    'edit_manage'::public.area_access_level
  ) then
    raise exception 'Not allowed to create volunteer-only records';
  end if;

  insert into public.people (
    council_id,
    first_name,
    last_name,
    primary_relationship_code,
    created_source_code,
    volunteer_context_code,
    email,
    cell_phone,
    home_phone,
    other_phone,
    created_by_auth_user_id,
    updated_by_auth_user_id
  )
  values (
    v_local_unit.legacy_council_id,
    p_first_name,
    p_last_name,
    'volunteer_only',
    'scoped_manual_volunteer',
    p_volunteer_context_code,
    p_email,
    p_cell_phone,
    p_home_phone,
    p_other_phone,
    auth.uid(),
    auth.uid()
  )
  returning id into v_person_id;

  begin
    v_member_record_id := public.ensure_member_record_for_person_local_unit(
      p_local_unit_id,
      v_person_id
    );

    if v_member_record_id is null then
      raise exception 'Could not link created volunteer-only record to local unit';
    end if;
  exception
    when others then
      delete from public.people
      where id = v_person_id
        and primary_relationship_code = 'volunteer_only';
      raise;
  end;

  perform app.write_audit_log(
    v_local_unit.legacy_council_id,
    'people',
    v_person_id,
    'create_volunteer_only',
    jsonb_build_object(
      'local_unit_id', p_local_unit_id,
      'member_record_id', v_member_record_id
    )
  );

  return v_person_id;
end;
$$;


ALTER FUNCTION "app"."create_volunteer_only_for_local_unit"("p_local_unit_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_volunteer_context_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "app"."create_volunteer_only_for_local_unit"("p_local_unit_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_volunteer_context_code" "text") IS 'Service-role-only local-unit-first volunteer-only creation helper. Browser execution intentionally revoked; app code should prefer explicit local_unit_id ownership.';



CREATE OR REPLACE FUNCTION "app"."end_person_assignment"("p_assignment_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_assignment public.person_assignments%rowtype;
  v_person public.people%rowtype;
begin
  select *
    into v_assignment
  from public.person_assignments
  where id = p_assignment_id;

  if v_assignment.id is null then
    raise exception 'Assignment not found';
  end if;

  select *
    into v_person
  from public.people
  where id = v_assignment.person_id
    and merged_into_person_id is null;

  if v_person.id is null then
    raise exception 'Assignment person not found';
  end if;

  if not public.auth_can_manage_person_assignments(v_person.id) then
    raise exception 'Not allowed to end this assignment';
  end if;

  update public.person_assignments
  set ended_at = now(),
      ended_by_auth_user_id = auth.uid(),
      notes = coalesce(p_notes, notes)
  where id = p_assignment_id
    and ended_at is null;

  perform app.write_audit_log(
    v_person.council_id,
    'person_assignments',
    p_assignment_id,
    'end_person_assignment'
  );
end;
$$;


ALTER FUNCTION "app"."end_person_assignment"("p_assignment_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."find_person_identity_id"("p_person_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select pil.person_identity_id
  from public.person_identity_links pil
  where pil.person_id = p_person_id
    and pil.ended_at is null
  limit 1;
$$;


ALTER FUNCTION "app"."find_person_identity_id"("p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."find_person_identity_id_for_user"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select pi.id
  from public.person_identities pi
  where pi.primary_user_id = p_user_id
  limit 1;
$$;


ALTER FUNCTION "app"."find_person_identity_id_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."fraternal_year_label"("p_start_year" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'app', 'public', 'pg_temp'
    AS $$
  select p_start_year::text || '-' || (p_start_year + 1)::text
$$;


ALTER FUNCTION "app"."fraternal_year_label"("p_start_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."fraternal_year_start"("p_date" "date") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'app', 'public', 'pg_temp'
    AS $$
  select case
    when extract(month from p_date) >= 7 then extract(year from p_date)::integer
    else extract(year from p_date)::integer - 1
  end
$$;


ALTER FUNCTION "app"."fraternal_year_start"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."list_accessible_member_statuses"() RETURNS TABLE("person_id" "uuid", "official_membership_status_code" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select omr.person_id, omr.official_membership_status_code
  from public.official_member_records omr
  join public.people p
    on p.id = omr.person_id
  where app.user_can_access_person(p.id)
$$;


ALTER FUNCTION "app"."list_accessible_member_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."list_active_people_for_identity"("p_person_identity_id" "uuid") RETURNS TABLE("person_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select pil.person_id
  from public.person_identity_links pil
  join public.people p
    on p.id = pil.person_id
  where pil.person_identity_id = p_person_identity_id
    and pil.ended_at is null
    and p.archived_at is null
    and p.merged_into_person_id is null
  order by pil.linked_at, pil.person_id;
$$;


ALTER FUNCTION "app"."list_active_people_for_identity"("p_person_identity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app'
    AS $$
  select app.restore_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    auth.uid()
  );
$$;


ALTER FUNCTION "app"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app'
    AS $$
declare
  v_member_record public.member_records%rowtype;
  v_person public.people%rowtype;
  v_local_unit public.local_units%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_person
  from public.people
  where id = p_person_id;

  if not found then
    raise exception 'Person not found';
  end if;

  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if not found then
    raise exception 'Local unit not found';
  end if;

  select *
    into v_member_record
  from public.member_records
  where local_unit_id = p_local_unit_id
    and legacy_people_id = p_person_id
  limit 1;

  if not found then
    raise exception 'Local-unit member record not found';
  end if;

  update public.member_records
     set lifecycle_state = 'active'::public.member_record_lifecycle_state,
         archived_at = null,
         updated_at = now(),
         updated_by_auth_user_id = p_actor_user_id
   where id = v_member_record.id;

  update public.people
     set archived_at = null,
         updated_at = now(),
         updated_by_auth_user_id = p_actor_user_id
   where id = p_person_id
     and archived_at is not null;

  update public.local_unit_people
     set ended_at = null,
         updated_at = now()
   where local_unit_id = p_local_unit_id
     and person_id = p_person_id;

  insert into public.local_unit_people (
    local_unit_id,
    person_id,
    created_at,
    updated_at
  )
  select
    p_local_unit_id,
    p_person_id,
    now(),
    now()
  where not exists (
    select 1
    from public.local_unit_people lup
    where lup.local_unit_id = p_local_unit_id
      and lup.person_id = p_person_id
  );

  perform app.write_audit_log(
    coalesce(v_local_unit.legacy_council_id, v_person.council_id),
    'member_records',
    v_member_record.id,
    'restore_local_unit_member_record',
    jsonb_build_object(
      'person_id', p_person_id,
      'local_unit_id', p_local_unit_id,
      'actor_user_id', p_actor_user_id
    )
  );

  return v_member_record.id;
end;
$$;


ALTER FUNCTION "app"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."update_member_local_fields"("p_person_id" "uuid", "p_council_activity_level_code" "text", "p_council_activity_context_code" "text", "p_council_reengagement_status_code" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_person public.people%rowtype;
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
    raise exception 'Not allowed to update this person';
  end if;

  update public.people
  set council_activity_level_code = p_council_activity_level_code,
      council_activity_context_code = p_council_activity_context_code,
      council_reengagement_status_code = p_council_reengagement_status_code,
      updated_by_auth_user_id = auth.uid()
  where id = p_person_id;

  perform app.write_audit_log(
    v_person.council_id,
    'people',
    p_person_id,
    'update_member_local_fields'
  );
end;
$$;


ALTER FUNCTION "app"."update_member_local_fields"("p_person_id" "uuid", "p_council_activity_level_code" "text", "p_council_activity_context_code" "text", "p_council_reengagement_status_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."update_nonmember_contact_fields"("p_person_id" "uuid", "p_email" "text" DEFAULT NULL::"text", "p_cell_phone" "text" DEFAULT NULL::"text", "p_home_phone" "text" DEFAULT NULL::"text", "p_other_phone" "text" DEFAULT NULL::"text", "p_address_line_1" "text" DEFAULT NULL::"text", "p_address_line_2" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_state_province" "text" DEFAULT NULL::"text", "p_postal_code" "text" DEFAULT NULL::"text", "p_country_code" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_person public.people%rowtype;
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
    raise exception 'Not allowed to update this person';
  end if;

  update public.people
  set email = p_email,
      cell_phone = p_cell_phone,
      home_phone = p_home_phone,
      other_phone = p_other_phone,
      address_line_1 = p_address_line_1,
      address_line_2 = p_address_line_2,
      city = p_city,
      state_province = p_state_province,
      postal_code = p_postal_code,
      country_code = p_country_code,
      updated_by_auth_user_id = auth.uid()
  where id = p_person_id;

  perform app.write_audit_log(
    v_person.council_id,
    'people',
    p_person_id,
    'update_nonmember_contact_fields'
  );
end;
$$;


ALTER FUNCTION "app"."update_nonmember_contact_fields"("p_person_id" "uuid", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_address_line_1" "text", "p_address_line_2" "text", "p_city" "text", "p_state_province" "text", "p_postal_code" "text", "p_country_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_can_access_local_person"("p_person_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "app"."user_can_access_local_person"("p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_can_access_local_person_as_user"("p_user_id" "uuid", "p_person_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "app"."user_can_access_local_person_as_user"("p_user_id" "uuid", "p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_can_access_person"("p_person_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "app"."user_can_access_person"("p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_can_access_person_as_user"("p_user_id" "uuid", "p_person_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "app"."user_can_access_person_as_user"("p_user_id" "uuid", "p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_has_scope"("p_council_id" "uuid", "p_scope_code" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when p_scope_code in ('all_people', 'prospects', 'volunteer_only', 'members_all',
                          'members_official_active', 'members_official_associate',
                          'members_activity_active', 'members_activity_occasional',
                          'members_activity_inactive', 'members_reengagement_monitoring',
                          'members_reengagement_hardship_support',
                          'members_reengagement_in_progress',
                          'members_reengagement_disengaged_no_response')
      then app.user_is_council_admin(p_council_id)
    else false
  end;
$$;


ALTER FUNCTION "app"."user_has_scope"("p_council_id" "uuid", "p_scope_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_has_scope_for_user"("p_user_id" "uuid", "p_council_id" "uuid", "p_scope_code" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case
    when p_scope_code in ('all_people', 'prospects', 'volunteer_only', 'members_all',
                          'members_official_active', 'members_official_associate',
                          'members_activity_active', 'members_activity_occasional',
                          'members_activity_inactive', 'members_reengagement_monitoring',
                          'members_reengagement_hardship_support',
                          'members_reengagement_in_progress',
                          'members_reengagement_disengaged_no_response')
      then app.user_is_council_admin_for_user(p_user_id, p_council_id)
    else false
  end;
$$;


ALTER FUNCTION "app"."user_has_scope_for_user"("p_user_id" "uuid", "p_council_id" "uuid", "p_scope_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_is_council_admin"("p_council_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (
      select app.user_is_local_unit_admin(lu.id)
      from public.local_units lu
      where lu.legacy_council_id = p_council_id
      order by lu.created_at asc
      limit 1
    ),
    false
  );
$$;


ALTER FUNCTION "app"."user_is_council_admin"("p_council_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "app"."user_is_council_admin"("p_council_id" "uuid") IS 'Compatibility wrapper. Prefer app.user_is_local_unit_admin(uuid); this resolves the council to its local unit and evaluates local-unit-native admin access.';



CREATE OR REPLACE FUNCTION "app"."user_is_council_admin_for_user"("p_user_id" "uuid", "p_council_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.local_units lu
    join public.v_effective_area_access v
      on v.local_unit_id = lu.id
     and v.area_code = 'members'::public.member_area_code
     and v.is_effective = true
    where lu.legacy_council_id = p_council_id
      and v.user_id = p_user_id
      and v.access_level in ('edit_manage', 'manage')
  );
$$;


ALTER FUNCTION "app"."user_is_council_admin_for_user"("p_user_id" "uuid", "p_council_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_is_local_unit_admin"("p_local_unit_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with active_app_user as (
    select
      u.id,
      u.person_id,
      u.is_active,
      coalesce(u.is_super_admin, false) as is_super_admin,
      au.email
    from public.users u
    left join auth.users au
      on au.id = u.id
    where u.id = auth.uid()
      and u.is_active = true
    limit 1
  ),
  target_local_unit as (
    select
      lu.id,
      lu.legacy_organization_id,
      c.organization_id as legacy_council_organization_id
    from public.local_units lu
    left join public.councils c
      on c.id = lu.legacy_council_id
    where lu.id = p_local_unit_id
    limit 1
  ),
  target_organization as (
    select coalesce(legacy_organization_id, legacy_council_organization_id) as organization_id
    from target_local_unit
  )
  select exists (
    select 1
    from active_app_user u
    where u.is_super_admin = true
  )
  or exists (
    select 1
    from active_app_user u
    join target_organization org
      on org.organization_id is not null
    join public.organization_admin_assignments oaa
      on oaa.organization_id = org.organization_id
    where oaa.is_active = true
      and (
        oaa.user_id = u.id
        or (u.person_id is not null and oaa.person_id = u.person_id)
        or (
          u.email is not null
          and nullif(btrim(coalesce(oaa.grantee_email, '')), '') is not null
          and lower(oaa.grantee_email) = lower(u.email)
        )
      )
  )
  or exists (
    select 1
    from active_app_user u
    join public.person_officer_terms pot
      on pot.person_id = u.person_id
    where pot.local_unit_id = p_local_unit_id
      and pot.office_scope_code = 'council'
      and pot.office_code in ('grand_knight', 'financial_secretary')
      and (
        pot.service_end_year is null
        or pot.service_end_year >= extract(year from current_date)::int
      )
  );
$$;


ALTER FUNCTION "app"."user_is_local_unit_admin"("p_local_unit_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "app"."user_is_local_unit_admin"("p_local_unit_id" "uuid") IS 'Returns true when the signed-in user can administer the local unit through super admin status, organization admin assignment, or a current automatic officer role.';



CREATE OR REPLACE FUNCTION "app"."write_audit_log"("p_council_id" "uuid", "p_entity_table" "text", "p_entity_id" "uuid", "p_action_code" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into public.audit_log (
    council_id,
    actor_auth_user_id,
    entity_table,
    entity_id,
    action_code,
    payload
  )
  values (
    p_council_id,
    auth.uid(),
    p_entity_table,
    p_entity_id,
    p_action_code,
    coalesce(p_payload, '{}'::jsonb)
  )
$$;


ALTER FUNCTION "app"."write_audit_log"("p_council_id" "uuid", "p_entity_table" "text", "p_entity_id" "uuid", "p_action_code" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_supreme_import_row"("p_local_unit_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid" DEFAULT NULL::"uuid", "p_council_number" "text" DEFAULT NULL::"text", "p_title" "text" DEFAULT NULL::"text", "p_first_name" "text" DEFAULT NULL::"text", "p_middle_name" "text" DEFAULT NULL::"text", "p_last_name" "text" DEFAULT NULL::"text", "p_suffix" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_email_hash" "text" DEFAULT NULL::"text", "p_cell_phone" "text" DEFAULT NULL::"text", "p_cell_phone_hash" "text" DEFAULT NULL::"text", "p_address_line_1" "text" DEFAULT NULL::"text", "p_address_line_1_hash" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_city_hash" "text" DEFAULT NULL::"text", "p_state_province" "text" DEFAULT NULL::"text", "p_state_province_hash" "text" DEFAULT NULL::"text", "p_postal_code" "text" DEFAULT NULL::"text", "p_postal_code_hash" "text" DEFAULT NULL::"text", "p_birth_date" "date" DEFAULT NULL::"date", "p_birth_date_hash" "text" DEFAULT NULL::"text", "p_pii_key_version" "text" DEFAULT NULL::"text", "p_council_activity_level_code" "text" DEFAULT NULL::"text", "p_member_number" "text" DEFAULT NULL::"text", "p_first_degree_date" "date" DEFAULT NULL::"date", "p_second_degree_date" "date" DEFAULT NULL::"date", "p_third_degree_date" "date" DEFAULT NULL::"date", "p_years_in_service" integer DEFAULT NULL::integer, "p_member_type" "text" DEFAULT NULL::"text", "p_member_class" "text" DEFAULT NULL::"text", "p_assembly_number" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_person_id uuid;
  v_membership_id uuid;
  v_member_number_person_id uuid;
  v_member_number_match_count integer := 0;
  v_has_kofc_payload boolean;
  v_action text;
  v_member_record_id uuid;
  v_resolved_organization_id uuid;
begin
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then
    raise exception 'First name and last name are required.';
  end if;

  select
    coalesce(p_organization_id, lu.legacy_organization_id)
    into v_resolved_organization_id
  from public.local_units lu
  where lu.id = p_local_unit_id
    and lu.local_unit_kind = 'council'::public.local_unit_kind;

  if v_resolved_organization_id is null then
    raise exception 'Supreme import requires an organization scope.';
  end if;

  if p_council_number is not null then
    insert into public.organization_kofc_profiles (
      organization_id,
      council_number
    )
    values (
      v_resolved_organization_id,
      p_council_number
    )
    on conflict (organization_id) do update
      set council_number = coalesce(excluded.council_number, public.organization_kofc_profiles.council_number);
  end if;

  if p_member_number is not null then
    with membership_matches as (
      select distinct person_id
      from public.organization_memberships
      where organization_id = v_resolved_organization_id
        and membership_number = p_member_number
    )
    select
      count(*),
      (
        select person_id
        from membership_matches
        order by person_id::text
        limit 1
      )
      into v_member_number_match_count, v_member_number_person_id
    from membership_matches;

    if v_member_number_match_count > 1 then
      raise exception 'Member number % matches multiple people in this organization. Clean up the duplicate membership rows before importing again.', p_member_number;
    end if;
  end if;

  if v_member_number_person_id is not null then
    if p_existing_person_id is not null and p_existing_person_id <> v_member_number_person_id then
      raise exception 'Member number % already belongs to another member record in this local unit.', p_member_number;
    end if;

    update public.people
    set
      archived_at = null,
      title = coalesce(p_title, title),
      first_name = coalesce(p_first_name, first_name),
      middle_name = coalesce(p_middle_name, middle_name),
      last_name = coalesce(p_last_name, last_name),
      suffix = coalesce(p_suffix, suffix),
      email = coalesce(p_email, email),
      email_hash = case when p_email is not null then p_email_hash else email_hash end,
      cell_phone = coalesce(p_cell_phone, cell_phone),
      cell_phone_hash = case when p_cell_phone is not null then p_cell_phone_hash else cell_phone_hash end,
      address_line_1 = coalesce(p_address_line_1, address_line_1),
      address_line_1_hash = case when p_address_line_1 is not null then p_address_line_1_hash else address_line_1_hash end,
      city = coalesce(p_city, city),
      city_hash = case when p_city is not null then p_city_hash else city_hash end,
      state_province = coalesce(p_state_province, state_province),
      state_province_hash = case when p_state_province is not null then p_state_province_hash else state_province_hash end,
      postal_code = coalesce(p_postal_code, postal_code),
      postal_code_hash = case when p_postal_code is not null then p_postal_code_hash else postal_code_hash end,
      birth_date = coalesce(p_birth_date, birth_date),
      birth_date_hash = case when p_birth_date is not null then p_birth_date_hash else birth_date_hash end,
      pii_key_version = coalesce(p_pii_key_version, pii_key_version),
      council_activity_level_code = coalesce(p_council_activity_level_code, council_activity_level_code),
      primary_relationship_code = 'member',
      updated_by_auth_user_id = p_auth_user_id
    where id = v_member_number_person_id
      and exists (
        select 1
        from public.member_records mr
        where mr.local_unit_id = p_local_unit_id
          and mr.legacy_people_id = v_member_number_person_id
      )
    returning id into v_person_id;

    if v_person_id is null then
      raise exception 'Member number % belongs to a person outside this local unit.', p_member_number;
    end if;

    v_action := 'updated';
  elsif p_import_mode = 'update_existing' and p_existing_person_id is not null then
    update public.people
    set
      archived_at = null,
      title = coalesce(p_title, title),
      first_name = coalesce(p_first_name, first_name),
      middle_name = coalesce(p_middle_name, middle_name),
      last_name = coalesce(p_last_name, last_name),
      suffix = coalesce(p_suffix, suffix),
      email = coalesce(p_email, email),
      email_hash = case when p_email is not null then p_email_hash else email_hash end,
      cell_phone = coalesce(p_cell_phone, cell_phone),
      cell_phone_hash = case when p_cell_phone is not null then p_cell_phone_hash else cell_phone_hash end,
      address_line_1 = coalesce(p_address_line_1, address_line_1),
      address_line_1_hash = case when p_address_line_1 is not null then p_address_line_1_hash else address_line_1_hash end,
      city = coalesce(p_city, city),
      city_hash = case when p_city is not null then p_city_hash else city_hash end,
      state_province = coalesce(p_state_province, state_province),
      state_province_hash = case when p_state_province is not null then p_state_province_hash else state_province_hash end,
      postal_code = coalesce(p_postal_code, postal_code),
      postal_code_hash = case when p_postal_code is not null then p_postal_code_hash else postal_code_hash end,
      birth_date = coalesce(p_birth_date, birth_date),
      birth_date_hash = case when p_birth_date is not null then p_birth_date_hash else birth_date_hash end,
      pii_key_version = coalesce(p_pii_key_version, pii_key_version),
      council_activity_level_code = coalesce(p_council_activity_level_code, council_activity_level_code),
      primary_relationship_code = 'member',
      updated_by_auth_user_id = p_auth_user_id
    where id = p_existing_person_id
      and exists (
        select 1
        from public.member_records mr
        where mr.local_unit_id = p_local_unit_id
          and mr.legacy_people_id = p_existing_person_id
      )
    returning id into v_person_id;

    if v_person_id is null then
      raise exception 'Could not find the matched person for update.';
    end if;

    v_action := 'updated';
  elsif p_import_mode = 'update_existing' then
    raise exception 'Missing existing person id for update_existing row.';
  elsif p_import_mode = 'create_new' then
    insert into public.people (
      title,
      first_name,
      middle_name,
      last_name,
      suffix,
      email,
      email_hash,
      cell_phone,
      cell_phone_hash,
      address_line_1,
      address_line_1_hash,
      city,
      city_hash,
      state_province,
      state_province_hash,
      postal_code,
      postal_code_hash,
      birth_date,
      birth_date_hash,
      pii_key_version,
      council_activity_level_code,
      created_source_code,
      is_provisional_member,
      created_by_auth_user_id,
      updated_by_auth_user_id,
      primary_relationship_code
    )
    values (
      p_title,
      p_first_name,
      p_middle_name,
      p_last_name,
      p_suffix,
      p_email,
      p_email_hash,
      p_cell_phone,
      p_cell_phone_hash,
      p_address_line_1,
      p_address_line_1_hash,
      p_city,
      p_city_hash,
      p_state_province,
      p_state_province_hash,
      p_postal_code,
      p_postal_code_hash,
      p_birth_date,
      p_birth_date_hash,
      p_pii_key_version,
      coalesce(p_council_activity_level_code, 'active'),
      'supreme_import',
      false,
      p_auth_user_id,
      p_auth_user_id,
      'member'
    )
    returning id into v_person_id;

    v_action := 'created';
  else
    raise exception 'Unsupported import mode: %', p_import_mode;
  end if;

  select id
    into v_membership_id
  from public.organization_memberships
  where organization_id = v_resolved_organization_id
    and person_id = v_person_id
  limit 1;

  if v_membership_id is not null then
    update public.organization_memberships
    set
      membership_status_code = coalesce(p_council_activity_level_code, membership_status_code),
      membership_number = coalesce(p_member_number, membership_number),
      is_primary_membership = true,
      source_code = 'supreme_import',
      updated_by_auth_user_id = p_auth_user_id
    where id = v_membership_id;
  else
    insert into public.organization_memberships (
      organization_id,
      person_id,
      membership_status_code,
      membership_number,
      is_primary_membership,
      source_code,
      created_by_auth_user_id,
      updated_by_auth_user_id
    )
    values (
      v_resolved_organization_id,
      v_person_id,
      coalesce(p_council_activity_level_code, 'active'),
      p_member_number,
      true,
      'supreme_import',
      p_auth_user_id,
      p_auth_user_id
    );
  end if;

  v_member_record_id := public.ensure_member_record_for_person_local_unit(p_local_unit_id, v_person_id);

  if v_member_record_id is not null then
    update public.member_records
       set member_number = coalesce(p_member_number, member_number),
           lifecycle_state = 'active'::public.member_record_lifecycle_state,
           archived_at = null,
           updated_at = now(),
           updated_by_auth_user_id = p_auth_user_id
     where id = v_member_record_id;
  end if;

  v_has_kofc_payload :=
    p_first_degree_date is not null
    or p_second_degree_date is not null
    or p_third_degree_date is not null
    or p_years_in_service is not null
    or p_member_type is not null
    or p_member_class is not null
    or p_assembly_number is not null;

  if v_has_kofc_payload then
    insert into public.person_kofc_profiles (
      person_id,
      first_degree_date,
      second_degree_date,
      third_degree_date,
      years_in_service,
      member_type,
      member_class,
      assembly_number
    )
    values (
      v_person_id,
      p_first_degree_date,
      p_second_degree_date,
      p_third_degree_date,
      p_years_in_service,
      p_member_type,
      p_member_class,
      p_assembly_number
    )
    on conflict (person_id) do update
      set
        first_degree_date = coalesce(excluded.first_degree_date, public.person_kofc_profiles.first_degree_date),
        second_degree_date = coalesce(excluded.second_degree_date, public.person_kofc_profiles.second_degree_date),
        third_degree_date = coalesce(excluded.third_degree_date, public.person_kofc_profiles.third_degree_date),
        years_in_service = coalesce(excluded.years_in_service, public.person_kofc_profiles.years_in_service),
        member_type = coalesce(excluded.member_type, public.person_kofc_profiles.member_type),
        member_class = coalesce(excluded.member_class, public.person_kofc_profiles.member_class),
        assembly_number = coalesce(excluded.assembly_number, public.person_kofc_profiles.assembly_number);
  end if;

  return jsonb_build_object(
    'person_id', v_person_id,
    'member_record_id', v_member_record_id,
    'action', v_action
  );
end;
$$;


ALTER FUNCTION "public"."apply_supreme_import_row"("p_local_unit_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid", "p_council_number" "text", "p_title" "text", "p_first_name" "text", "p_middle_name" "text", "p_last_name" "text", "p_suffix" "text", "p_email" "text", "p_email_hash" "text", "p_cell_phone" "text", "p_cell_phone_hash" "text", "p_address_line_1" "text", "p_address_line_1_hash" "text", "p_city" "text", "p_city_hash" "text", "p_state_province" "text", "p_state_province_hash" "text", "p_postal_code" "text", "p_postal_code_hash" "text", "p_birth_date" "date", "p_birth_date_hash" "text", "p_pii_key_version" "text", "p_council_activity_level_code" "text", "p_member_number" "text", "p_first_degree_date" "date", "p_second_degree_date" "date", "p_third_degree_date" "date", "p_years_in_service" integer, "p_member_type" "text", "p_member_class" "text", "p_assembly_number" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_supreme_import_row"("p_local_unit_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid", "p_council_number" "text", "p_title" "text", "p_first_name" "text", "p_middle_name" "text", "p_last_name" "text", "p_suffix" "text", "p_email" "text", "p_email_hash" "text", "p_cell_phone" "text", "p_cell_phone_hash" "text", "p_address_line_1" "text", "p_address_line_1_hash" "text", "p_city" "text", "p_city_hash" "text", "p_state_province" "text", "p_state_province_hash" "text", "p_postal_code" "text", "p_postal_code_hash" "text", "p_birth_date" "date", "p_birth_date_hash" "text", "p_pii_key_version" "text", "p_council_activity_level_code" "text", "p_member_number" "text", "p_first_degree_date" "date", "p_second_degree_date" "date", "p_third_degree_date" "date", "p_years_in_service" integer, "p_member_type" "text", "p_member_class" "text", "p_assembly_number" "text") IS 'Applies one Supreme import row atomically using explicit local_unit_id as operational scope.';



CREATE OR REPLACE FUNCTION "public"."approve_membership_claim_request_to_admin_package"("p_actor_user_id" "uuid", "p_claim_request_id" "uuid", "p_target_user_id" "uuid", "p_source_code" "public"."grant_source_code" DEFAULT 'manual'::"public"."grant_source_code") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_claim public.membership_claim_requests%rowtype;
  v_member_record_id uuid;
begin
  select *
    into v_claim
  from public.membership_claim_requests
  where id = p_claim_request_id;

  if not found then
    raise exception 'Membership claim request % not found', p_claim_request_id;
  end if;

  if v_claim.local_unit_id is null then
    raise exception 'Membership claim request % is missing local_unit_id', p_claim_request_id;
  end if;

  select x.member_record_id
    into v_member_record_id
  from public.ensure_parallel_member_for_user_and_local_unit(p_target_user_id, v_claim.local_unit_id) x;

  perform public.upsert_parallel_admin_package_for_member(
    v_claim.local_unit_id,
    v_member_record_id,
    p_source_code,
    true,
    coalesce(v_claim.created_at, now()),
    now()
  );

  update public.membership_claim_requests
     set status_code = 'approved'::public.membership_claim_status_code,
         reviewed_by_auth_user_id = p_actor_user_id,
         reviewed_at = now(),
         reviewer_notes = coalesce(reviewer_notes, 'Approved into parallel admin package')
   where id = p_claim_request_id;

  return v_member_record_id;
end;
$$;


ALTER FUNCTION "public"."approve_membership_claim_request_to_admin_package"("p_actor_user_id" "uuid", "p_claim_request_id" "uuid", "p_target_user_id" "uuid", "p_source_code" "public"."grant_source_code") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app'
    AS $$
  select public.archive_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    auth.uid(),
    p_reason
  );
$$;


ALTER FUNCTION "public"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_reason" "text") IS 'Server-side member lifecycle helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';



CREATE OR REPLACE FUNCTION "public"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app'
    AS $$
  select app.archive_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    p_actor_user_id,
    p_reason
  );
$$;


ALTER FUNCTION "public"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text") IS 'Server-side member lifecycle helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';



CREATE OR REPLACE FUNCTION "public"."auth_accessible_custom_lists"() RETURNS TABLE("custom_list_id" "uuid", "local_unit_id" "uuid")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select *
  from public.list_accessible_custom_lists_for_user(auth.uid())
  where auth.uid() is not null;
$$;


ALTER FUNCTION "public"."auth_accessible_custom_lists"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auth_accessible_custom_lists"() IS 'Auth-aware wrapper for listing custom lists available to the signed-in user.';



CREATE OR REPLACE FUNCTION "public"."auth_accessible_local_units_for_area"("p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") RETURNS TABLE("local_unit_id" "uuid", "local_unit_name" "text", "area_code" "public"."member_area_code", "access_level" "public"."area_access_level")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select *
  from public.list_accessible_local_units_for_area(
    auth.uid(),
    p_area_code,
    p_min_access_level
  )
  where auth.uid() is not null;
$$;


ALTER FUNCTION "public"."auth_accessible_local_units_for_area"("p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auth_accessible_local_units_for_area"("p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") IS 'Auth-aware wrapper for listing accessible local units by area.';



CREATE OR REPLACE FUNCTION "public"."auth_can_manage_person"("p_person_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select coalesce(auth.uid() is not null, false)
    and exists (
      select 1
      from public.member_records mr
      where mr.legacy_people_id = p_person_id
        and mr.lifecycle_state <> 'archived'::public.member_record_lifecycle_state
        and public.has_area_access(
          auth.uid(),
          mr.local_unit_id,
          'members'::public.member_area_code,
          'edit_manage'::public.area_access_level
        )
    );
$$;


ALTER FUNCTION "public"."auth_can_manage_person"("p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_can_manage_person_assignments"("p_person_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select public.auth_can_manage_person(p_person_id);
$$;


ALTER FUNCTION "public"."auth_can_manage_person_assignments"("p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_can_manage_person_notes"("p_person_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select public.auth_can_manage_person(p_person_id);
$$;


ALTER FUNCTION "public"."auth_can_manage_person_notes"("p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_has_area_access"("p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select coalesce(auth.uid() is not null, false)
    and public.has_area_access(
      auth.uid(),
      p_local_unit_id,
      p_area_code,
      p_min_access_level
    );
$$;


ALTER FUNCTION "public"."auth_has_area_access"("p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auth_has_area_access"("p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") IS 'Auth-aware wrapper around has_area_access for future RLS and server-side checks.';



CREATE OR REPLACE FUNCTION "public"."auth_has_event_management_access"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select coalesce(auth.uid() is not null, false)
    and exists (
      select 1
      from public.events e
      where e.id = p_event_id
        and e.local_unit_id is not null
        and public.has_event_management_access(
          auth.uid(),
          e.local_unit_id,
          e.id
        )
    );
$$;


ALTER FUNCTION "public"."auth_has_event_management_access"("p_event_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auth_has_event_management_access"("p_event_id" "uuid") IS 'Compatibility wrapper for event-id-only event management access checks.';



CREATE OR REPLACE FUNCTION "public"."auth_has_event_management_access"("p_local_unit_id" "uuid", "p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select coalesce(auth.uid() is not null, false)
    and public.has_event_management_access(
      auth.uid(),
      p_local_unit_id,
      p_event_id
    );
$$;


ALTER FUNCTION "public"."auth_has_event_management_access"("p_local_unit_id" "uuid", "p_event_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auth_has_event_management_access"("p_local_unit_id" "uuid", "p_event_id" "uuid") IS 'Auth-aware wrapper around has_event_management_access for future RLS and server-side checks.';



CREATE OR REPLACE FUNCTION "public"."auth_has_resource_access"("p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select coalesce(auth.uid() is not null, false)
    and public.has_resource_access(
      auth.uid(),
      p_local_unit_id,
      p_resource_type,
      p_resource_key,
      p_min_access_level
    );
$$;


ALTER FUNCTION "public"."auth_has_resource_access"("p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auth_has_resource_access"("p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") IS 'Auth-aware wrapper around has_resource_access for future RLS and server-side checks.';



CREATE OR REPLACE FUNCTION "public"."auth_manageable_event_ids"("p_local_unit_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("event_id" "uuid", "local_unit_id" "uuid")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select *
  from public.list_manageable_event_ids_for_user(auth.uid(), p_local_unit_id)
  where auth.uid() is not null;
$$;


ALTER FUNCTION "public"."auth_manageable_event_ids"("p_local_unit_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auth_manageable_event_ids"("p_local_unit_id" "uuid") IS 'Auth-aware wrapper for listing manageable events for the signed-in user.';



CREATE OR REPLACE FUNCTION "public"."backfill_missing_parallel_admin_packages"("p_actor_user_id" "uuid", "p_source_code" "public"."grant_source_code" DEFAULT 'legacy_backfill'::"public"."grant_source_code") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select
      u.id as target_user_id,
      lu.id as local_unit_id
    from public.organization_admin_assignments oaa
    join public.local_units lu
      on lu.legacy_organization_id = oaa.organization_id
    join public.users u
      on u.person_id = oaa.person_id
    left join public.user_unit_relationships uur
      on uur.user_id = u.id
     and uur.local_unit_id = lu.id
     and uur.status = 'active'::public.relationship_status
    left join public.area_access_grants aag
      on aag.local_unit_id = lu.id
     and aag.member_record_id = uur.member_record_id
     and aag.area_code = 'admins'::public.member_area_code
     and aag.access_level = 'manage'::public.area_access_level
     and aag.revoked_at is null
    where aag.id is null
  loop
    perform public.grant_parallel_admin_package_to_user(
      p_actor_user_id,
      r.target_user_id,
      r.local_unit_id,
      p_source_code,
      'Backfilled from legacy org admin gap helper'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."backfill_missing_parallel_admin_packages"("p_actor_user_id" "uuid", "p_source_code" "public"."grant_source_code") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_missing_parallel_custom_list_grants"("p_actor_user_id" "uuid", "p_source_code" "public"."grant_source_code" DEFAULT 'legacy_backfill'::"public"."grant_source_code") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select
      u.id as target_user_id,
      cla.custom_list_id
    from public.custom_list_access cla
    join public.users u
      on u.person_id = cla.person_id
    left join public.custom_lists cl
      on cl.id = cla.custom_list_id
    left join public.user_unit_relationships uur
      on uur.user_id = u.id
     and uur.local_unit_id = cl.local_unit_id
     and uur.status = 'active'::public.relationship_status
    left join public.resource_access_grants rag
      on rag.local_unit_id = cl.local_unit_id
     and rag.member_record_id = uur.member_record_id
     and rag.resource_type = 'custom_list'::public.resource_type_code
     and rag.resource_key = cl.id::text
     and rag.revoked_at is null
    where rag.id is null
  loop
    perform public.grant_parallel_custom_list_access_to_user(
      p_actor_user_id,
      r.target_user_id,
      r.custom_list_id,
      'interact'::public.area_access_level,
      p_source_code
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."backfill_missing_parallel_custom_list_grants"("p_actor_user_id" "uuid", "p_source_code" "public"."grant_source_code") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_missing_parallel_event_managers"("p_actor_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select e.id as event_id
    from public.events e
    left join public.v_effective_event_management_access v
      on v.event_id = e.id
    where v.event_id is null
      and e.local_unit_id is not null
  loop
    perform public.upsert_parallel_event_assignment_for_user(
      p_actor_user_id,
      p_actor_user_id,
      r.event_id,
      'manager',
      'Backfilled from missing parallel event manager helper'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."backfill_missing_parallel_event_managers"("p_actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_parallel_invite_package_subject"("p_target_user_id" "uuid", "p_local_unit_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_local_unit public.local_units%rowtype;
  v_member_record public.member_records%rowtype;
  v_person_id uuid;
  v_has_active_area_access boolean := false;
  v_has_active_resource_access boolean := false;
  v_has_event_assignments boolean := false;
  v_has_active_admin_assignment boolean := false;
  v_has_org_membership boolean := false;
begin
  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if not found then
    return;
  end if;

  select mr.*
    into v_member_record
  from public.member_records mr
  join public.user_unit_relationships uur
    on uur.member_record_id = mr.id
   and uur.local_unit_id = mr.local_unit_id
  where uur.user_id = p_target_user_id
    and uur.local_unit_id = p_local_unit_id
  order by case when uur.status = 'active'::public.relationship_status then 0 else 1 end,
           uur.created_at
  limit 1;

  if not found then
    return;
  end if;

  v_person_id := v_member_record.legacy_people_id;

  select exists(
    select 1
    from public.area_access_grants aag
    where aag.local_unit_id = p_local_unit_id
      and aag.member_record_id = v_member_record.id
      and aag.revoked_at is null
  )
    into v_has_active_area_access;

  if v_has_active_area_access then
    return;
  end if;

  select exists(
    select 1
    from public.resource_access_grants rag
    where rag.local_unit_id = p_local_unit_id
      and rag.member_record_id = v_member_record.id
      and rag.revoked_at is null
  )
    into v_has_active_resource_access;

  if v_has_active_resource_access then
    return;
  end if;

  select exists(
    select 1
    from public.event_assignments ea
    where ea.local_unit_id = p_local_unit_id
      and ea.member_record_id = v_member_record.id
  )
    into v_has_event_assignments;

  if v_has_event_assignments then
    return;
  end if;

  select exists(
    select 1
    from public.organization_admin_assignments oaa
    where oaa.organization_id = v_local_unit.legacy_organization_id
      and oaa.is_active = true
      and (
        oaa.user_id = p_target_user_id
        or (v_person_id is not null and oaa.person_id = v_person_id)
      )
  )
    into v_has_active_admin_assignment;

  if v_has_active_admin_assignment then
    return;
  end if;

  select exists(
    select 1
    from public.organization_memberships om
    where om.organization_id = v_local_unit.legacy_organization_id
      and om.person_id = v_person_id
  )
    into v_has_org_membership;

  if v_has_org_membership then
    return;
  end if;

  update public.user_unit_relationships
     set status = 'inactive'::public.relationship_status,
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where user_id = p_target_user_id
     and local_unit_id = p_local_unit_id
     and member_record_id = v_member_record.id;

  update public.member_records
     set lifecycle_state = 'archived'::public.member_record_lifecycle_state,
         archived_at = coalesce(archived_at, now()),
         updated_at = now()
   where id = v_member_record.id
     and local_unit_id = p_local_unit_id;
end;
$$;


ALTER FUNCTION "public"."cleanup_parallel_invite_package_subject"("p_target_user_id" "uuid", "p_local_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_council_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select u.council_id
  from users u
  where u.id = auth.uid()::uuid
  limit 1;
$$;


ALTER FUNCTION "public"."current_user_council_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_local_unit_external_links_active_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_active_count integer;
begin
  if new.is_active then
    select count(*)
    into v_active_count
    from public.local_unit_external_links
    where local_unit_id = new.local_unit_id
      and is_active = true
      and id <> new.id;

    if v_active_count >= 3 then
      raise exception 'A local unit can have at most 3 active public external links.';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_local_unit_external_links_active_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_local_unit_public_gallery_images_active_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_active_count integer;
begin
  if new.is_active then
    select count(*)
    into v_active_count
    from public.local_unit_public_gallery_images
    where local_unit_id = new.local_unit_id
      and is_active = true
      and id <> new.id;

    if v_active_count >= 12 then
      raise exception 'A local unit can have at most 12 active public gallery images.';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_local_unit_public_gallery_images_active_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_member_record_for_person_local_unit"("p_local_unit_id" "uuid", "p_person_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_member_record_id uuid;
  v_person public.people%rowtype;
begin
  select mr.id
    into v_member_record_id
  from public.member_records mr
  where mr.local_unit_id = p_local_unit_id
    and mr.legacy_people_id = p_person_id
  limit 1;

  if v_member_record_id is null then
    select *
      into v_person
    from public.people
    where id = p_person_id;

    if not found then
      return null;
    end if;

    insert into public.member_records (
      local_unit_id,
      member_number,
      first_name,
      middle_name,
      last_name,
      suffix,
      preferred_display_name,
      email,
      phone,
      address_line_1,
      address_line_2,
      city,
      province_state,
      postal_code,
      country_code,
      lifecycle_state,
      archived_at,
      legacy_people_id,
      legacy_council_id,
      created_at,
      updated_at,
      created_by_auth_user_id,
      updated_by_auth_user_id
    )
    values (
      p_local_unit_id,
      null,
      v_person.first_name,
      v_person.middle_name,
      v_person.last_name,
      v_person.suffix,
      coalesce(nullif(btrim(v_person.directory_display_name_override), ''), nullif(btrim(v_person.nickname), '')),
      v_person.email,
      coalesce(nullif(btrim(v_person.cell_phone), ''), nullif(btrim(v_person.home_phone), ''), nullif(btrim(v_person.other_phone), '')),
      v_person.address_line_1,
      v_person.address_line_2,
      v_person.city,
      v_person.state_province,
      v_person.postal_code,
      v_person.country_code,
      case
        when v_person.archived_at is not null then 'archived'::public.member_record_lifecycle_state
        else 'active'::public.member_record_lifecycle_state
      end,
      v_person.archived_at,
      v_person.id,
      v_person.council_id,
      coalesce(v_person.created_at, now()),
      coalesce(v_person.updated_at, now()),
      v_person.created_by_auth_user_id,
      v_person.updated_by_auth_user_id
    )
    returning id into v_member_record_id;
  end if;

  update public.local_unit_people
     set ended_at = null,
         updated_at = now()
   where local_unit_id = p_local_unit_id
     and person_id = p_person_id;

  insert into public.local_unit_people (
    local_unit_id,
    person_id,
    created_at,
    updated_at
  )
  select
    p_local_unit_id,
    p_person_id,
    now(),
    now()
  where not exists (
    select 1
    from public.local_unit_people lup
    where lup.local_unit_id = p_local_unit_id
      and lup.person_id = p_person_id
  );

  return v_member_record_id;
end;
$$;


ALTER FUNCTION "public"."ensure_member_record_for_person_local_unit"("p_local_unit_id" "uuid", "p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_parallel_member_for_user_and_local_unit"("p_user_id" "uuid", "p_local_unit_id" "uuid") RETURNS TABLE("member_record_id" "uuid", "user_unit_relationship_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_user public.users%rowtype;
  v_local_unit public.local_units%rowtype;
  v_member_record_id uuid;
  v_user_unit_relationship_id uuid;
begin
  select *
    into v_user
  from public.users
  where id = p_user_id;

  if not found then
    raise exception 'User % not found in public.users', p_user_id;
  end if;

  if v_user.person_id is null then
    raise exception 'User % is not linked to a person record', p_user_id;
  end if;

  select *
    into v_local_unit
  from public.local_units
  where id = p_local_unit_id;

  if not found then
    raise exception 'Local unit % not found', p_local_unit_id;
  end if;

  select mr.id
    into v_member_record_id
  from public.member_records mr
  where mr.local_unit_id = p_local_unit_id
    and mr.legacy_people_id = v_user.person_id
  limit 1;

  if v_member_record_id is null then
    insert into public.member_records (
      local_unit_id,
      member_number,
      first_name,
      middle_name,
      last_name,
      suffix,
      preferred_display_name,
      email,
      phone,
      address_line_1,
      address_line_2,
      city,
      province_state,
      postal_code,
      country_code,
      lifecycle_state,
      archived_at,
      legacy_people_id,
      legacy_council_id,
      created_at,
      updated_at,
      created_by_auth_user_id,
      updated_by_auth_user_id
    )
    select
      p_local_unit_id,
      null,
      p.first_name,
      p.middle_name,
      p.last_name,
      p.suffix,
      coalesce(nullif(btrim(p.directory_display_name_override), ''), nullif(btrim(p.nickname), '')),
      p.email,
      coalesce(nullif(btrim(p.cell_phone), ''), nullif(btrim(p.home_phone), ''), nullif(btrim(p.other_phone), '')),
      p.address_line_1,
      p.address_line_2,
      p.city,
      p.state_province,
      p.postal_code,
      p.country_code,
      case when p.archived_at is not null then 'archived'::public.member_record_lifecycle_state else 'active'::public.member_record_lifecycle_state end,
      p.archived_at,
      p.id,
      coalesce(p.council_id, v_local_unit.legacy_council_id),
      coalesce(p.created_at, now()),
      coalesce(p.updated_at, now()),
      p.created_by_auth_user_id,
      p.updated_by_auth_user_id
    from public.people p
    where p.id = v_user.person_id
    returning id into v_member_record_id;
  end if;

  select uur.id
    into v_user_unit_relationship_id
  from public.user_unit_relationships uur
  where uur.user_id = p_user_id
    and uur.local_unit_id = p_local_unit_id
  order by case when uur.status = 'active'::public.relationship_status then 0 else 1 end, uur.created_at
  limit 1;

  if v_user_unit_relationship_id is null then
    insert into public.user_unit_relationships (
      user_id,
      local_unit_id,
      relationship_kind,
      status,
      member_record_id,
      is_primary_parish,
      activated_at,
      ended_at,
      created_at,
      updated_at,
      created_by_auth_user_id,
      updated_by_auth_user_id
    )
    values (
      p_user_id,
      p_local_unit_id,
      'linked_member_record'::public.relationship_kind,
      'active'::public.relationship_status,
      v_member_record_id,
      false,
      now(),
      null,
      now(),
      now(),
      null,
      null
    )
    returning id into v_user_unit_relationship_id;
  else
    update public.user_unit_relationships
       set member_record_id = v_member_record_id,
           status = 'active'::public.relationship_status,
           ended_at = null,
           activated_at = coalesce(activated_at, now()),
           updated_at = now()
     where id = v_user_unit_relationship_id;
  end if;

  member_record_id := v_member_record_id;
  user_unit_relationship_id := v_user_unit_relationship_id;
  return next;
end;
$$;


ALTER FUNCTION "public"."ensure_parallel_member_for_user_and_local_unit"("p_user_id" "uuid", "p_local_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_parallel_membership_for_org_admin_assignment"("p_assignment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
begin
  -- Intentionally no-op.
  --
  -- Organization-scoped admin assignments must no longer synthesize
  -- member_records / user_unit_relationships for external admins.
  -- Direct admin access is now derived from the real admin assignment path
  -- in application permissions, while true local-member mappings can still
  -- be reused by the downstream grant sync if they already exist.
  return;
end;
$$;


ALTER FUNCTION "public"."ensure_parallel_membership_for_org_admin_assignment"("p_assignment_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ensure_parallel_membership_for_org_admin_assignment"("p_assignment_id" "uuid") IS 'No-op bridge retained for compatibility. Organization admin assignments must not synthesize member_records or user_unit_relationships for external admins.';



CREATE OR REPLACE FUNCTION "public"."ensure_user_unit_relationship_for_user_member"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_member_record_id" "uuid", "p_is_active" boolean DEFAULT true) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_relationship_id uuid;
begin
  select uur.id
    into v_relationship_id
  from public.user_unit_relationships uur
  where uur.user_id = p_user_id
    and uur.local_unit_id = p_local_unit_id
  order by case when uur.status = 'active'::public.relationship_status then 1 else 2 end,
           uur.created_at
  limit 1;

  if v_relationship_id is not null then
    update public.user_unit_relationships
       set member_record_id = coalesce(member_record_id, p_member_record_id),
           relationship_kind = 'linked_member_record'::public.relationship_kind,
           status = case when p_is_active then 'active'::public.relationship_status else status end,
           activated_at = case when p_is_active and activated_at is null then now() else activated_at end,
           updated_at = now()
     where id = v_relationship_id;
    return v_relationship_id;
  end if;

  insert into public.user_unit_relationships (
    user_id,
    local_unit_id,
    relationship_kind,
    status,
    member_record_id,
    is_primary_parish,
    activated_at,
    ended_at,
    created_at,
    updated_at,
    created_by_auth_user_id,
    updated_by_auth_user_id
  )
  values (
    p_user_id,
    p_local_unit_id,
    'linked_member_record'::public.relationship_kind,
    case when p_is_active then 'active'::public.relationship_status else 'inactive'::public.relationship_status end,
    p_member_record_id,
    false,
    case when p_is_active then now() else null end,
    case when p_is_active then null else now() end,
    now(),
    now(),
    null,
    null
  )
  returning id into v_relationship_id;

  return v_relationship_id;
end;
$$;


ALTER FUNCTION "public"."ensure_user_unit_relationship_for_user_member"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_member_record_id" "uuid", "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_rsvp_token"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select encode(gen_random_bytes(24), 'hex');
$$;


ALTER FUNCTION "public"."generate_rsvp_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_parallel_admin_package_to_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_local_unit_id" "uuid", "p_source_code" "public"."grant_source_code" DEFAULT 'manual'::"public"."grant_source_code", "p_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_member_record_id uuid;
begin
  select x.member_record_id
    into v_member_record_id
  from public.ensure_parallel_member_for_user_and_local_unit(p_target_user_id, p_local_unit_id) x;

  perform public.upsert_parallel_admin_package_for_member(
    p_local_unit_id,
    v_member_record_id,
    p_source_code,
    true,
    now(),
    now()
  );

  insert into public.migration_review_queue (
    source_table,
    source_row_id,
    review_type,
    notes,
    payload
  )
  values (
    'parallel_access',
    gen_random_uuid(),
    'admin_package_write',
    coalesce(p_note, 'Parallel admin package granted directly.'),
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'target_user_id', p_target_user_id,
      'local_unit_id', p_local_unit_id,
      'member_record_id', v_member_record_id,
      'source_code', p_source_code
    )
  );

  return v_member_record_id;
end;
$$;


ALTER FUNCTION "public"."grant_parallel_admin_package_to_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_local_unit_id" "uuid", "p_source_code" "public"."grant_source_code", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_parallel_custom_list_access_to_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_custom_list_id" "uuid", "p_access_level" "public"."area_access_level" DEFAULT 'interact'::"public"."area_access_level", "p_source_code" "public"."grant_source_code" DEFAULT 'manual'::"public"."grant_source_code") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_local_unit_id uuid;
  v_member_record_id uuid;
begin
  select cl.local_unit_id into v_local_unit_id
  from public.custom_lists cl
  where cl.id = p_custom_list_id;

  if v_local_unit_id is null then
    raise exception 'Custom list % not found or missing local_unit_id', p_custom_list_id;
  end if;

  select x.member_record_id
    into v_member_record_id
  from public.ensure_parallel_member_for_user_and_local_unit(p_target_user_id, v_local_unit_id) x;

  insert into public.resource_access_grants (
    local_unit_id,
    member_record_id,
    resource_type,
    resource_key,
    access_level,
    source_code,
    granted_at,
    expires_at,
    revoked_at,
    created_at,
    updated_at,
    created_by_auth_user_id,
    updated_by_auth_user_id
  )
  values (
    v_local_unit_id,
    v_member_record_id,
    'custom_list'::public.resource_type_code,
    p_custom_list_id::text,
    p_access_level,
    p_source_code,
    now(),
    null,
    null,
    now(),
    now(),
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict (local_unit_id, member_record_id, resource_type, resource_key, access_level, source_code)
    where revoked_at is null
  do update
     set updated_at = now(),
         revoked_at = null;

  return v_member_record_id;
end;
$$;


ALTER FUNCTION "public"."grant_parallel_custom_list_access_to_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_custom_list_id" "uuid", "p_access_level" "public"."area_access_level", "p_source_code" "public"."grant_source_code") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_area_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.v_effective_area_access v
    where v.user_id = p_user_id
      and v.local_unit_id = p_local_unit_id
      and v.area_code = p_area_code
      and v.is_effective = true
      and (
        v.access_level = p_min_access_level
        or p_min_access_level = 'read_only'
        or (
          p_min_access_level = 'edit_manage'
          and v.access_level in ('edit_manage', 'manage')
        )
        or (
          p_min_access_level = 'manage'
          and v.access_level = 'manage'
        )
        or (
          p_min_access_level = 'interact'
          and v.access_level in ('interact', 'edit_manage', 'manage')
        )
      )
  );
$$;


ALTER FUNCTION "public"."has_area_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_event_management_access"("p_user_id" "uuid", "p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.v_effective_event_management_access v
    where v.user_id = p_user_id
      and v.event_id = p_event_id
      and v.is_effective = true
  );
$$;


ALTER FUNCTION "public"."has_event_management_access"("p_user_id" "uuid", "p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_event_management_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  with target_event as (
    select e.id, e.local_unit_id, e.event_kind_code
    from public.events e
    where e.id = p_event_id
      and e.local_unit_id = p_local_unit_id
  )
  select
    public.has_area_access(
      p_user_id,
      p_local_unit_id,
      'events'::public.member_area_code,
      'manage'::public.area_access_level
    )
    or exists (
      select 1
      from target_event e
      join public.user_unit_relationships uur
        on uur.user_id = p_user_id
       and uur.local_unit_id = e.local_unit_id
       and uur.status = 'active'::public.relationship_status
       and uur.member_record_id is not null
      join public.event_assignments ea
        on ea.local_unit_id = e.local_unit_id
       and ea.member_record_id = uur.member_record_id
      where ea.assignment_scope = 'all_events'
         or (ea.assignment_scope = 'event' and ea.event_id = e.id)
         or (ea.assignment_scope = 'event_kind' and ea.legacy_event_kind_code = e.event_kind_code)
    );
$$;


ALTER FUNCTION "public"."has_event_management_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_resource_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.v_effective_resource_access v
    where v.user_id = p_user_id
      and v.local_unit_id = p_local_unit_id
      and v.resource_type = p_resource_type
      and v.resource_key = p_resource_key
      and v.is_effective = true
      and (
        v.access_level = p_min_access_level
        or (p_min_access_level = 'read_only')
        or (p_min_access_level = 'edit_manage' and v.access_level in ('edit_manage', 'manage'))
        or (p_min_access_level = 'manage' and v.access_level = 'manage')
        or (p_min_access_level = 'interact' and v.access_level in ('interact', 'edit_manage', 'manage'))
      )
  );
$$;


ALTER FUNCTION "public"."has_resource_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_accessible_custom_lists_for_user"("p_user_id" "uuid") RETURNS TABLE("custom_list_id" "uuid", "local_unit_id" "uuid")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $_$
  with area_scoped_lists as (
    select
      cl.id as custom_list_id,
      cl.local_unit_id
    from public.custom_lists cl
    where cl.local_unit_id is not null
      and cl.archived_at is null
      and public.has_area_access(
        p_user_id,
        cl.local_unit_id,
        'custom_lists'::public.member_area_code,
        'interact'::public.area_access_level
      )
  ),
  direct_resource_lists as (
    select
      vera.resource_key::uuid as custom_list_id,
      vera.local_unit_id
    from public.v_effective_resource_access vera
    where vera.user_id = p_user_id
      and vera.resource_type = 'custom_list'::public.resource_type_code
      and vera.is_effective = true
      and vera.resource_key ~* '^[0-9a-f-]{36}$'
  )
  select distinct
    combined.custom_list_id,
    combined.local_unit_id
  from (
    select * from area_scoped_lists
    union all
    select * from direct_resource_lists
  ) as combined;
$_$;


ALTER FUNCTION "public"."list_accessible_custom_lists_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_accessible_local_units_for_area"("p_user_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") RETURNS TABLE("local_unit_id" "uuid", "local_unit_name" "text", "area_code" "public"."member_area_code", "access_level" "public"."area_access_level")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select distinct
    v.local_unit_id,
    v.local_unit_name,
    v.area_code,
    v.access_level
  from public.v_effective_area_access v
  where v.user_id = p_user_id
    and v.area_code = p_area_code
    and v.is_effective = true
    and (
      v.access_level = p_min_access_level
      or p_min_access_level = 'read_only'
      or (
        p_min_access_level = 'edit_manage'
        and v.access_level in ('edit_manage', 'manage')
      )
      or (
        p_min_access_level = 'manage'
        and v.access_level = 'manage'
      )
      or (
        p_min_access_level = 'interact'
        and v.access_level in ('interact', 'edit_manage', 'manage')
      )
    )
  order by v.local_unit_name;
$$;


ALTER FUNCTION "public"."list_accessible_local_units_for_area"("p_user_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_manageable_event_ids_for_user"("p_user_id" "uuid") RETURNS TABLE("event_id" "uuid")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select distinct v.event_id
  from public.v_effective_event_management_access v
  where v.user_id = p_user_id
    and v.is_effective = true
  order by v.event_id;
$$;


ALTER FUNCTION "public"."list_manageable_event_ids_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_manageable_event_ids_for_user"("p_user_id" "uuid", "p_local_unit_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("event_id" "uuid", "local_unit_id" "uuid")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select distinct
    e.id as event_id,
    e.local_unit_id
  from public.events e
  where e.local_unit_id is not null
    and (p_local_unit_id is null or e.local_unit_id = p_local_unit_id)
    and (
      public.has_area_access(
        p_user_id,
        e.local_unit_id,
        'events'::public.member_area_code,
        'manage'::public.area_access_level
      )
      or public.has_event_management_access(
        p_user_id,
        e.local_unit_id,
        e.id
      )
    )
  order by e.local_unit_id, e.id;
$$;


ALTER FUNCTION "public"."list_manageable_event_ids_for_user"("p_user_id" "uuid", "p_local_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_super_admin_preview_local_units"() RETURNS TABLE("local_unit_id" "uuid", "display_name" "text", "official_name" "text", "legacy_council_id" "uuid", "legacy_organization_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    lu.id as local_unit_id,
    lu.display_name,
    lu.official_name,
    lu.legacy_council_id,
    lu.legacy_organization_id
  from public.local_units lu
  join public.users u
    on u.id = auth.uid()
   and u.is_super_admin = true
   and u.is_active = true
  where lu.status <> 'archived'::public.local_unit_status
  order by lu.display_name, lu.official_name, lu.id;
$$;


ALTER FUNCTION "public"."list_super_admin_preview_local_units"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."list_super_admin_preview_local_units"() IS 'Server-side super-admin helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';



CREATE OR REPLACE FUNCTION "public"."log_person_contact_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  changed jsonb := '{}'::jsonb;
  oldv jsonb := '{}'::jsonb;
  newv jsonb := '{}'::jsonb;
begin
  if row(new.email, new.cell_phone, new.home_phone, new.other_phone, new.address_line_1, new.address_line_2, new.city, new.state_province, new.postal_code, new.country_code)
     is distinct from
     row(old.email, old.cell_phone, old.home_phone, old.other_phone, old.address_line_1, old.address_line_2, old.city, old.state_province, old.postal_code, old.country_code) then

    if new.email is distinct from old.email then
      changed := changed || jsonb_build_object('email', true);
      oldv := oldv || jsonb_build_object('email', old.email);
      newv := newv || jsonb_build_object('email', new.email);
    end if;
    if new.cell_phone is distinct from old.cell_phone then
      changed := changed || jsonb_build_object('cell_phone', true);
      oldv := oldv || jsonb_build_object('cell_phone', old.cell_phone);
      newv := newv || jsonb_build_object('cell_phone', new.cell_phone);
    end if;
    if new.home_phone is distinct from old.home_phone then
      changed := changed || jsonb_build_object('home_phone', true);
      oldv := oldv || jsonb_build_object('home_phone', old.home_phone);
      newv := newv || jsonb_build_object('home_phone', new.home_phone);
    end if;
    if new.other_phone is distinct from old.other_phone then
      changed := changed || jsonb_build_object('other_phone', true);
      oldv := oldv || jsonb_build_object('other_phone', old.other_phone);
      newv := newv || jsonb_build_object('other_phone', new.other_phone);
    end if;
    if new.address_line_1 is distinct from old.address_line_1 then
      changed := changed || jsonb_build_object('address_line_1', true);
      oldv := oldv || jsonb_build_object('address_line_1', old.address_line_1);
      newv := newv || jsonb_build_object('address_line_1', new.address_line_1);
    end if;
    if new.address_line_2 is distinct from old.address_line_2 then
      changed := changed || jsonb_build_object('address_line_2', true);
      oldv := oldv || jsonb_build_object('address_line_2', old.address_line_2);
      newv := newv || jsonb_build_object('address_line_2', new.address_line_2);
    end if;
    if new.city is distinct from old.city then
      changed := changed || jsonb_build_object('city', true);
      oldv := oldv || jsonb_build_object('city', old.city);
      newv := newv || jsonb_build_object('city', new.city);
    end if;
    if new.state_province is distinct from old.state_province then
      changed := changed || jsonb_build_object('state_province', true);
      oldv := oldv || jsonb_build_object('state_province', old.state_province);
      newv := newv || jsonb_build_object('state_province', new.state_province);
    end if;
    if new.postal_code is distinct from old.postal_code then
      changed := changed || jsonb_build_object('postal_code', true);
      oldv := oldv || jsonb_build_object('postal_code', old.postal_code);
      newv := newv || jsonb_build_object('postal_code', new.postal_code);
    end if;
    if new.country_code is distinct from old.country_code then
      changed := changed || jsonb_build_object('country_code', true);
      oldv := oldv || jsonb_build_object('country_code', old.country_code);
      newv := newv || jsonb_build_object('country_code', new.country_code);
    end if;

    insert into public.person_contact_change_log (
      council_id,
      person_id,
      changed_by_auth_user_id,
      changed_fields,
      old_values,
      new_values
    )
    values (
      new.council_id,
      new.id,
      auth.uid(),
      changed,
      oldv,
      newv
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."log_person_contact_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parallel_grant_source_rank"("p_source" "public"."grant_source_code") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select case p_source
    when 'manual' then 10
    when 'system' then 20
    when 'invite_package' then 30
    when 'title_default' then 40
    when 'legacy_backfill' then 90
    else 100
  end
$$;


ALTER FUNCTION "public"."parallel_grant_source_rank"("p_source" "public"."grant_source_code") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_supreme_update_reminder"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  changed_fields text[] := array[]::text[];
  summary jsonb := '{}'::jsonb;
begin
  if not app.user_is_council_admin(new.council_id) then
    return new;
  end if;

  if new.title is distinct from old.title then
    changed_fields := array_append(changed_fields, 'title');
  end if;
  if new.first_name is distinct from old.first_name then
    changed_fields := array_append(changed_fields, 'first_name');
  end if;
  if new.middle_name is distinct from old.middle_name then
    changed_fields := array_append(changed_fields, 'middle_name');
  end if;
  if new.last_name is distinct from old.last_name then
    changed_fields := array_append(changed_fields, 'last_name');
  end if;
  if new.suffix is distinct from old.suffix then
    changed_fields := array_append(changed_fields, 'suffix');
  end if;
  if new.email is distinct from old.email then
    changed_fields := array_append(changed_fields, 'email');
  end if;
  if new.cell_phone is distinct from old.cell_phone then
    changed_fields := array_append(changed_fields, 'cell_phone');
  end if;
  if new.home_phone is distinct from old.home_phone then
    changed_fields := array_append(changed_fields, 'home_phone');
  end if;
  if new.other_phone is distinct from old.other_phone then
    changed_fields := array_append(changed_fields, 'other_phone');
  end if;
  if new.address_line_1 is distinct from old.address_line_1 then
    changed_fields := array_append(changed_fields, 'address_line_1');
  end if;
  if new.address_line_2 is distinct from old.address_line_2 then
    changed_fields := array_append(changed_fields, 'address_line_2');
  end if;
  if new.city is distinct from old.city then
    changed_fields := array_append(changed_fields, 'city');
  end if;
  if new.state_province is distinct from old.state_province then
    changed_fields := array_append(changed_fields, 'state_province');
  end if;
  if new.postal_code is distinct from old.postal_code then
    changed_fields := array_append(changed_fields, 'postal_code');
  end if;
  if new.country_code is distinct from old.country_code then
    changed_fields := array_append(changed_fields, 'country_code');
  end if;

  if array_length(changed_fields, 1) is not null then
    summary := jsonb_build_object(
      'before', jsonb_build_object(
        'title', old.title,
        'first_name', old.first_name,
        'middle_name', old.middle_name,
        'last_name', old.last_name,
        'suffix', old.suffix,
        'email', old.email,
        'cell_phone', old.cell_phone,
        'home_phone', old.home_phone,
        'other_phone', old.other_phone,
        'address_line_1', old.address_line_1,
        'address_line_2', old.address_line_2,
        'city', old.city,
        'state_province', old.state_province,
        'postal_code', old.postal_code,
        'country_code', old.country_code
      ),
      'after', jsonb_build_object(
        'title', new.title,
        'first_name', new.first_name,
        'middle_name', new.middle_name,
        'last_name', new.last_name,
        'suffix', new.suffix,
        'email', new.email,
        'cell_phone', new.cell_phone,
        'home_phone', new.home_phone,
        'other_phone', new.other_phone,
        'address_line_1', new.address_line_1,
        'address_line_2', new.address_line_2,
        'city', new.city,
        'state_province', new.state_province,
        'postal_code', new.postal_code,
        'country_code', new.country_code
      )
    );

    insert into public.supreme_update_queue (
      council_id,
      person_id,
      created_by_auth_user_id,
      changed_fields,
      change_summary,
      status_code
    )
    values (
      new.council_id,
      new.id,
      auth.uid(),
      to_jsonb(changed_fields),
      summary,
      'pending'
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."queue_supreme_update_reminder"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_membership_claim_request_in_parallel"("p_actor_user_id" "uuid", "p_claim_request_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_claim public.membership_claim_requests%rowtype;
begin
  select *
    into v_claim
  from public.membership_claim_requests
  where id = p_claim_request_id;

  if not found then
    raise exception 'Membership claim request % not found', p_claim_request_id;
  end if;

  update public.membership_claim_requests
     set status_code = 'denied'::public.membership_claim_status_code,
         reviewed_by_auth_user_id = p_actor_user_id,
         reviewed_at = now(),
         reviewer_notes = coalesce(p_note, reviewer_notes, 'Rejected')
   where id = p_claim_request_id;

  return p_claim_request_id;
end;
$$;


ALTER FUNCTION "public"."reject_membership_claim_request_in_parallel"("p_actor_user_id" "uuid", "p_claim_request_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app'
    AS $$
  select public.restore_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    auth.uid()
  );
$$;


ALTER FUNCTION "public"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid") IS 'Server-side member lifecycle helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';



CREATE OR REPLACE FUNCTION "public"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'app'
    AS $$
  select app.restore_local_unit_member_record(
    p_local_unit_id,
    p_person_id,
    p_actor_user_id
  );
$$;


ALTER FUNCTION "public"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid") IS 'Server-side member lifecycle helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';



CREATE OR REPLACE FUNCTION "public"."revoke_parallel_admin_package_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_local_unit_id" "uuid", "p_source_code" "public"."grant_source_code" DEFAULT 'manual'::"public"."grant_source_code", "p_note" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_count integer;
begin
  update public.area_access_grants aag
     set revoked_at = coalesce(aag.revoked_at, now()),
         updated_at = now()
   where aag.local_unit_id = p_local_unit_id
     and aag.source_code = p_source_code
     and aag.revoked_at is null
     and exists (
       select 1
       from public.user_unit_relationships uur
       where uur.user_id = p_target_user_id
         and uur.local_unit_id = p_local_unit_id
         and uur.member_record_id = aag.member_record_id
     );

  get diagnostics v_count = row_count;

  if p_source_code = 'invite_package'::public.grant_source_code then
    perform public.cleanup_parallel_invite_package_subject(
      p_target_user_id,
      p_local_unit_id
    );
  end if;

  insert into public.migration_review_queue (
    source_table,
    source_row_id,
    review_type,
    notes,
    payload
  )
  values (
    'parallel_access',
    gen_random_uuid(),
    'admin_package_revoke',
    coalesce(p_note, 'Parallel admin package revoked directly.'),
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'target_user_id', p_target_user_id,
      'local_unit_id', p_local_unit_id,
      'source_code', p_source_code,
      'revoked_rows', v_count
    )
  );

  return v_count;
end;
$$;


ALTER FUNCTION "public"."revoke_parallel_admin_package_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_local_unit_id" "uuid", "p_source_code" "public"."grant_source_code", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_parallel_custom_list_access_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_custom_list_id" "uuid", "p_source_code" "public"."grant_source_code" DEFAULT 'manual'::"public"."grant_source_code") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_count integer;
begin
  update public.resource_access_grants rag
     set revoked_at = coalesce(rag.revoked_at, now()),
         updated_at = now(),
         updated_by_auth_user_id = p_actor_user_id
   where rag.resource_type = 'custom_list'::public.resource_type_code
     and rag.resource_key = p_custom_list_id::text
     and rag.source_code = p_source_code
     and rag.revoked_at is null
     and exists (
       select 1
       from public.user_unit_relationships uur
       where uur.user_id = p_target_user_id
         and uur.local_unit_id = rag.local_unit_id
         and uur.member_record_id = rag.member_record_id
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."revoke_parallel_custom_list_access_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_custom_list_id" "uuid", "p_source_code" "public"."grant_source_code") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_parallel_event_assignment_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_event_id" "uuid", "p_role_code" "text" DEFAULT 'manager'::"text") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_count integer;
begin
  delete from public.event_assignments ea
   where ea.event_id = p_event_id
     and coalesce(ea.role_code, 'manager') = p_role_code
     and exists (
       select 1
       from public.user_unit_relationships uur
       where uur.user_id = p_target_user_id
         and uur.local_unit_id = ea.local_unit_id
         and uur.member_record_id = ea.member_record_id
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."revoke_parallel_event_assignment_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_event_id" "uuid", "p_role_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."rls_auto_enable"() IS 'Internal RLS/bootstrap helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';



CREATE OR REPLACE FUNCTION "public"."set_person_profile_change_requests_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_person_profile_change_requests_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_local_unit_id_from_legacy_council"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
begin
  if new.local_unit_id is null and new.council_id is not null then
    select lu.id into new.local_unit_id
    from public.local_units lu
    where lu.legacy_council_id = new.council_id
    limit 1;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_local_unit_id_from_legacy_council"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_organization_admin_assignment_from_council_admin_assignmen"("p_council_assignment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_assignment public.council_admin_assignments%rowtype;
  v_organization_id uuid;
  v_existing_id uuid;
  v_normalized_email text;
begin
  select *
    into v_assignment
  from public.council_admin_assignments
  where id = p_council_assignment_id
  limit 1;

  if not found or coalesce(v_assignment.is_active, false) = false then
    return;
  end if;

  select organization_id
    into v_organization_id
  from public.councils
  where id = v_assignment.council_id
  limit 1;

  if v_organization_id is null then
    return;
  end if;

  v_normalized_email := nullif(lower(btrim(coalesce(v_assignment.grantee_email, ''))), '');

  if v_assignment.person_id is not null then
    select id
      into v_existing_id
    from public.organization_admin_assignments
    where organization_id = v_organization_id
      and is_active = true
      and person_id = v_assignment.person_id
    limit 1;
  end if;

  if v_existing_id is null and v_assignment.user_id is not null then
    select id
      into v_existing_id
    from public.organization_admin_assignments
    where organization_id = v_organization_id
      and is_active = true
      and user_id = v_assignment.user_id
    limit 1;
  end if;

  if v_existing_id is null and v_normalized_email is not null then
    select id
      into v_existing_id
    from public.organization_admin_assignments
    where organization_id = v_organization_id
      and is_active = true
      and nullif(lower(btrim(coalesce(grantee_email, ''))), '') = v_normalized_email
    limit 1;
  end if;

  if v_existing_id is not null then
    update public.organization_admin_assignments
    set
      person_id = coalesce(public.organization_admin_assignments.person_id, v_assignment.person_id),
      user_id = coalesce(public.organization_admin_assignments.user_id, v_assignment.user_id),
      grantee_email = coalesce(nullif(btrim(public.organization_admin_assignments.grantee_email), ''), v_normalized_email),
      is_active = true,
      updated_at = now(),
      updated_by_user_id = coalesce(v_assignment.updated_by_user_id, public.organization_admin_assignments.updated_by_user_id)
    where id = v_existing_id;
  else
    insert into public.organization_admin_assignments (
      organization_id,
      person_id,
      user_id,
      grantee_email,
      is_active,
      created_at,
      updated_at,
      created_by_user_id,
      updated_by_user_id
    )
    values (
      v_organization_id,
      v_assignment.person_id,
      v_assignment.user_id,
      v_normalized_email,
      true,
      coalesce(v_assignment.created_at, now()),
      now(),
      v_assignment.created_by_user_id,
      coalesce(v_assignment.updated_by_user_id, v_assignment.created_by_user_id)
    );
  end if;
end;
$$;


ALTER FUNCTION "public"."sync_organization_admin_assignment_from_council_admin_assignmen"("p_council_assignment_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_organization_admin_assignment_from_council_admin_assignmen"("p_council_assignment_id" "uuid") IS 'Internal legacy organization-admin sync helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';



CREATE OR REPLACE FUNCTION "public"."sync_parallel_admin_package_from_council_admin_assignment"("p_assignment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_row public.council_admin_assignments%rowtype;
  v_local_unit_id uuid;
  v_member_record_id uuid;
begin
  select * into v_row
  from public.council_admin_assignments
  where id = p_assignment_id;

  if not found or v_row.person_id is null then
    return;
  end if;

  select lu.id
    into v_local_unit_id
  from public.local_units lu
  where lu.legacy_council_id = v_row.council_id
  limit 1;

  if v_local_unit_id is null then
    return;
  end if;

  v_member_record_id := public.ensure_member_record_for_person_local_unit(v_local_unit_id, v_row.person_id);

  if v_row.user_id is not null and v_member_record_id is not null then
    perform public.ensure_user_unit_relationship_for_user_member(
      v_row.user_id,
      v_local_unit_id,
      v_member_record_id,
      coalesce(v_row.is_active, false)
    );
  end if;

  if v_member_record_id is not null then
    perform public.upsert_parallel_admin_package_for_member(
      v_local_unit_id,
      v_member_record_id,
      'system'::public.grant_source_code,
      coalesce(v_row.is_active, false),
      v_row.created_at,
      v_row.updated_at
    );
  end if;
end;
$$;


ALTER FUNCTION "public"."sync_parallel_admin_package_from_council_admin_assignment"("p_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_parallel_admin_package_from_org_admin_assignment"("p_assignment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_row public.organization_admin_assignments%rowtype;
  v_local_unit_id uuid;
  v_member_record_id uuid;
begin
  select * into v_row
  from public.organization_admin_assignments
  where id = p_assignment_id;

  if not found or v_row.person_id is null then
    return;
  end if;

  -- External organization admins must not synthesize member_records or
  -- user_unit_relationships. Only reuse a true local-member mapping if one
  -- already exists inside the organization.
  select lu.id, mr.id
    into v_local_unit_id, v_member_record_id
  from public.local_units lu
  join public.member_records mr
    on mr.legacy_people_id = v_row.person_id
   and mr.local_unit_id = lu.id
  where lu.legacy_organization_id = v_row.organization_id
  order by case when lu.local_unit_kind = 'council'::public.local_unit_kind then 1 else 2 end,
           lu.created_at
  limit 1;

  if v_local_unit_id is null or v_member_record_id is null then
    return;
  end if;

  perform public.upsert_parallel_admin_package_for_member(
    v_local_unit_id,
    v_member_record_id,
    'system'::public.grant_source_code,
    coalesce(v_row.is_active, false),
    coalesce(v_row.created_at, now()),
    coalesce(v_row.updated_at, v_row.created_at, now())
  );
end;
$$;


ALTER FUNCTION "public"."sync_parallel_admin_package_from_org_admin_assignment"("p_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_parallel_area_grants_from_org_admin_assignment"("p_assignment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_assignment public.organization_admin_assignments%rowtype;
  v_local_unit record;
  v_member_record_id uuid;
  v_area_code public.member_area_code;
  v_access_level public.area_access_level;
  v_area_codes public.member_area_code[] := array[
    'members'::public.member_area_code,
    'events'::public.member_area_code,
    'custom_lists'::public.member_area_code,
    'claims'::public.member_area_code,
    'admins'::public.member_area_code,
    'local_unit_settings'::public.member_area_code
  ];
begin
  select *
  into v_assignment
  from public.organization_admin_assignments
  where id = p_assignment_id;

  if not found then
    return;
  end if;

  for v_local_unit in
    select id
    from public.local_units
    where legacy_organization_id = v_assignment.organization_id
  loop
    v_member_record_id := null;

    if v_assignment.person_id is not null then
      select mr.id
      into v_member_record_id
      from public.member_records mr
      where mr.local_unit_id = v_local_unit.id
        and mr.legacy_people_id = v_assignment.person_id
      order by mr.created_at asc
      limit 1;
    elsif v_assignment.user_id is not null then
      select uur.member_record_id
      into v_member_record_id
      from public.user_unit_relationships uur
      where uur.user_id = v_assignment.user_id
        and uur.local_unit_id = v_local_unit.id
        and uur.member_record_id is not null
      order by case when uur.status = 'active' then 0 else 1 end, uur.created_at asc
      limit 1;
    end if;

    if v_member_record_id is null then
      continue;
    end if;

    foreach v_area_code in array v_area_codes
    loop
      v_access_level := case
        when v_area_code = 'members' then 'edit_manage'::public.area_access_level
        when v_area_code = 'custom_lists' then 'manage'::public.area_access_level
        else 'manage'::public.area_access_level
      end;

      if v_assignment.is_active then
        insert into public.area_access_grants (
          local_unit_id,
          member_record_id,
          area_code,
          access_level,
          source_code,
          granted_at,
          expires_at,
          revoked_at,
          created_at,
          updated_at,
          created_by_auth_user_id,
          updated_by_auth_user_id
        )
        values (
          v_local_unit.id,
          v_member_record_id,
          v_area_code,
          v_access_level,
          'system'::public.grant_source_code,
          coalesce(v_assignment.created_at, now()),
          null,
          null,
          coalesce(v_assignment.created_at, now()),
          coalesce(v_assignment.updated_at, now()),
          v_assignment.created_by_user_id,
          v_assignment.updated_by_user_id
        )
        on conflict (local_unit_id, member_record_id, area_code, access_level, source_code)
        where revoked_at is null
        do update set
          revoked_at = null,
          updated_at = excluded.updated_at,
          updated_by_auth_user_id = excluded.updated_by_auth_user_id;
      else
        update public.area_access_grants
        set revoked_at = coalesce(v_assignment.revoked_at, v_assignment.updated_at, now()),
            updated_at = coalesce(v_assignment.updated_at, now()),
            updated_by_auth_user_id = v_assignment.updated_by_user_id
        where local_unit_id = v_local_unit.id
          and member_record_id = v_member_record_id
          and area_code = v_area_code
          and access_level = v_access_level
          and source_code = 'system'::public.grant_source_code
          and revoked_at is null;
      end if;
    end loop;
  end loop;
end;
$$;


ALTER FUNCTION "public"."sync_parallel_area_grants_from_org_admin_assignment"("p_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_unit_relationship_status_from_member_record"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.lifecycle_state is not distinct from new.lifecycle_state then
    return new;
  end if;

  if new.lifecycle_state = 'archived'::member_record_lifecycle_state then
    update public.user_unit_relationships
    set status = 'inactive'::relationship_status,
        updated_at = now()
    where member_record_id = new.id
      and local_unit_id = new.local_unit_id
      and status = 'active'::relationship_status;
  elsif old.lifecycle_state = 'archived'::member_record_lifecycle_state
     and new.lifecycle_state <> 'archived'::member_record_lifecycle_state then
    update public.user_unit_relationships
    set status = 'active'::relationship_status,
        updated_at = now()
    where member_record_id = new.id
      and local_unit_id = new.local_unit_id
      and relationship_kind = 'linked_member_record'::relationship_kind
      and status = 'inactive'::relationship_status;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_user_unit_relationship_status_from_member_record"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_user_unit_relationship_status_from_member_record"() IS 'Internal member relationship sync trigger/helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';



CREATE OR REPLACE FUNCTION "public"."trg_sync_org_admin_from_council_admin_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.sync_organization_admin_assignment_from_council_admin_assignment(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_sync_org_admin_from_council_admin_assignment"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trg_sync_org_admin_from_council_admin_assignment"() IS 'Internal trigger helper. Direct anon/authenticated RPC execution revoked during MVP security hardening.';



CREATE OR REPLACE FUNCTION "public"."trg_sync_parallel_admin_package_from_council_admin_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
begin
  perform public.sync_parallel_admin_package_from_council_admin_assignment(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_sync_parallel_admin_package_from_council_admin_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_parallel_admin_package_from_org_admin_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
begin
  perform public.sync_parallel_admin_package_from_org_admin_assignment(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_sync_parallel_admin_package_from_org_admin_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_parallel_area_grants_from_org_admin_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
begin
  perform public.sync_parallel_area_grants_from_org_admin_assignment(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_sync_parallel_area_grants_from_org_admin_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_parallel_admin_package_for_member"("p_local_unit_id" "uuid", "p_member_record_id" "uuid", "p_source_code" "public"."grant_source_code", "p_is_active" boolean, "p_created_at" timestamp with time zone DEFAULT "now"(), "p_updated_at" timestamp with time zone DEFAULT "now"()) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_revoked_at timestamptz;
begin
  v_revoked_at := case when p_is_active then null else coalesce(p_updated_at, now()) end;

  insert into public.area_access_grants (
    local_unit_id,
    member_record_id,
    area_code,
    access_level,
    source_code,
    granted_at,
    expires_at,
    revoked_at,
    created_at,
    updated_at,
    created_by_auth_user_id,
    updated_by_auth_user_id
  )
  select
    p_local_unit_id,
    p_member_record_id,
    x.area_code,
    x.access_level,
    p_source_code,
    coalesce(p_created_at, now()),
    null,
    v_revoked_at,
    coalesce(p_created_at, now()),
    coalesce(p_updated_at, now()),
    null,
    null
  from (
    values
      ('members'::public.member_area_code, 'edit_manage'::public.area_access_level),
      ('events'::public.member_area_code, 'manage'::public.area_access_level),
      ('custom_lists'::public.member_area_code, 'manage'::public.area_access_level),
      ('claims'::public.member_area_code, 'manage'::public.area_access_level),
      ('admins'::public.member_area_code, 'manage'::public.area_access_level),
      ('local_unit_settings'::public.member_area_code, 'manage'::public.area_access_level)
  ) as x(area_code, access_level)
  on conflict (local_unit_id, member_record_id, area_code, access_level, source_code)
    where revoked_at is null
  do update
    set revoked_at = excluded.revoked_at,
        updated_at = excluded.updated_at;
end;
$$;


ALTER FUNCTION "public"."upsert_parallel_admin_package_for_member"("p_local_unit_id" "uuid", "p_member_record_id" "uuid", "p_source_code" "public"."grant_source_code", "p_is_active" boolean, "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_parallel_event_assignment_for_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_event_id" "uuid", "p_role_code" "text" DEFAULT 'manager'::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
declare
  v_event public.events%rowtype;
  v_member_record_id uuid;
begin
  select *
    into v_event
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Event % not found', p_event_id;
  end if;

  if v_event.local_unit_id is null then
    raise exception 'Event % is missing local_unit_id', p_event_id;
  end if;

  select x.member_record_id
    into v_member_record_id
  from public.ensure_parallel_member_for_user_and_local_unit(p_target_user_id, v_event.local_unit_id) x;

  insert into public.event_assignments (
    local_unit_id,
    member_record_id,
    assignment_scope,
    event_id,
    legacy_event_kind_code,
    notes,
    created_at,
    updated_at,
    created_by_auth_user_id,
    updated_by_auth_user_id,
    role_code
  )
  values (
    v_event.local_unit_id,
    v_member_record_id,
    'event'::public.event_assignment_scope_code,
    p_event_id,
    null,
    p_note,
    now(),
    now(),
    p_actor_user_id,
    p_actor_user_id,
    p_role_code
  )
  on conflict do nothing;

  return v_member_record_id;
end;
$$;


ALTER FUNCTION "public"."upsert_parallel_event_assignment_for_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_event_id" "uuid", "p_role_code" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_belongs_to_council"("target_council_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select exists (
    select 1
    from users u
    where u.id = auth.uid()::uuid
      and u.council_id = target_council_id
  );
$$;


ALTER FUNCTION "public"."user_belongs_to_council"("target_council_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_access_event"("event_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select exists (
    select 1
    from events e
    join users u on u.id = auth.uid()::uuid
    where e.id = event_uuid
      and u.council_id = e.council_id
  );
$$;


ALTER FUNCTION "public"."user_can_access_event"("event_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_manage_event"("event_uuid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select exists (
    select 1
    from events e
    where e.id = event_uuid
      and user_is_council_admin(e.council_id)
  );
$$;


ALTER FUNCTION "public"."user_can_manage_event"("event_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_council_admin"("target_council_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'app', 'pg_temp'
    AS $$
  select app.user_is_council_admin(target_council_id);
$$;


ALTER FUNCTION "public"."user_is_council_admin"("target_council_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."_archive_council_admin_assignments" (
    "id" "uuid",
    "council_id" "uuid",
    "user_id" "uuid",
    "person_id" "uuid",
    "grantee_email" "text",
    "is_active" boolean,
    "notes" "text",
    "created_by_user_id" "uuid",
    "updated_by_user_id" "uuid",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."_archive_council_admin_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_archive_custom_list_access" (
    "id" "uuid",
    "custom_list_id" "uuid",
    "person_id" "uuid",
    "user_id" "uuid",
    "grantee_email" "text",
    "granted_at" timestamp with time zone,
    "granted_by_auth_user_id" "uuid",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."_archive_custom_list_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_archive_organization_admin_assignments" (
    "id" "uuid",
    "organization_id" "uuid",
    "person_id" "uuid",
    "user_id" "uuid",
    "grantee_email" "text",
    "is_active" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "created_by_user_id" "uuid",
    "updated_by_user_id" "uuid",
    "source_code" "text",
    "organization_claim_request_id" "uuid",
    "grant_notes" "text",
    "revoked_at" timestamp with time zone,
    "revoked_by_user_id" "uuid",
    "revoked_notes" "text"
);


ALTER TABLE "public"."_archive_organization_admin_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."access_scope_source_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."access_scope_source_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."access_scope_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."access_scope_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."area_access_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "member_record_id" "uuid" NOT NULL,
    "area_code" "public"."member_area_code" NOT NULL,
    "access_level" "public"."area_access_level" NOT NULL,
    "source_code" "public"."grant_source_code" DEFAULT 'manual'::"public"."grant_source_code" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid"
);


ALTER TABLE "public"."area_access_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" bigint NOT NULL,
    "council_id" "uuid",
    "actor_auth_user_id" "uuid",
    "entity_table" "text" NOT NULL,
    "entity_id" "uuid",
    "action_code" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_log_id_seq" OWNED BY "public"."audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."brand_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "logo_storage_bucket" "text" DEFAULT 'organization-assets'::"text" NOT NULL,
    "logo_storage_path" "text",
    "logo_alt_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid"
);


ALTER TABLE "public"."brand_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catechism_references" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "reference_code" "text" NOT NULL,
    "title" "text",
    "summary" "text",
    "body_excerpt" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."catechism_references" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catechism_topics" (
    "catechism_reference_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "relevance_score" smallint,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "catechism_topics_relevance_score_check" CHECK ((("relevance_score" >= 1) AND ("relevance_score" <= 5)))
);


ALTER TABLE "public"."catechism_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."council_activity_context_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."council_activity_context_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."council_activity_level_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."council_activity_level_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."council_admin_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "person_id" "uuid",
    "grantee_email" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_by_user_id" "uuid",
    "updated_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "council_admin_assignments_target_check" CHECK ((("user_id" IS NOT NULL) OR ("person_id" IS NOT NULL) OR ("grantee_email" IS NOT NULL)))
);


ALTER TABLE "public"."council_admin_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."council_admin_assignments" IS 'LEGACY COMPATIBILITY TABLE. Authority decisions should use area_access_grants / v_effective_area_access. Transitional sync input only.';



CREATE TABLE IF NOT EXISTS "public"."council_reengagement_status_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."council_reengagement_status_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."councils" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_number" "text" NOT NULL,
    "name" "text" NOT NULL,
    "timezone" "text" DEFAULT 'America/Toronto'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."councils" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_list_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "custom_list_id" "uuid" NOT NULL,
    "person_id" "uuid",
    "user_id" "uuid",
    "grantee_email" "text",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "granted_by_auth_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "custom_list_access_one_target" CHECK ((("person_id" IS NOT NULL) OR ("user_id" IS NOT NULL) OR ("grantee_email" IS NOT NULL)))
);


ALTER TABLE "public"."custom_list_access" OWNER TO "postgres";


COMMENT ON TABLE "public"."custom_list_access" IS 'LEGACY COMPATIBILITY TABLE. Resource decisions should use resource_access_grants / v_effective_resource_access. Transitional sync input only.';



CREATE TABLE IF NOT EXISTS "public"."custom_list_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "custom_list_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "added_by_auth_user_id" "uuid",
    "claimed_by_person_id" "uuid",
    "claimed_at" timestamp with time zone,
    "last_contact_at" timestamp with time zone,
    "last_contact_by_person_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."custom_list_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    "archived_at" timestamp with time zone,
    "archived_by_auth_user_id" "uuid",
    "local_unit_id" "uuid" NOT NULL,
    CONSTRAINT "custom_lists_council_id_must_be_null" CHECK (("council_id" IS NULL))
);


ALTER TABLE "public"."custom_lists" OWNER TO "postgres";


COMMENT ON COLUMN "public"."custom_lists"."council_id" IS 'Deprecated compatibility column. Must remain null; local_unit_id is canonical custom-list owner.';



CREATE TABLE IF NOT EXISTS "public"."daily_reading_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reading_date" "date" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "scripture_passage_id" "uuid",
    "spiritual_content_item_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."daily_reading_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."designation_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."designation_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."distinction_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."distinction_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_archives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_event_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "location_name" "text",
    "location_address" "text",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "status_code" "text",
    "scope_code" "text",
    "event_kind_code" "text",
    "requires_rsvp" boolean DEFAULT false NOT NULL,
    "rsvp_deadline_at" timestamp with time zone,
    "reminder_enabled" boolean DEFAULT false NOT NULL,
    "reminder_scheduled_for" timestamp with time zone,
    "reminder_days_before" integer,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "needs_volunteers" boolean DEFAULT false NOT NULL,
    "volunteer_deadline_at" timestamp with time zone
);


ALTER TABLE "public"."event_archives" OWNER TO "postgres";


COMMENT ON COLUMN "public"."event_archives"."local_unit_id" IS 'Required operational owner local unit for this archived event.';



CREATE TABLE IF NOT EXISTS "public"."event_assignment_roles" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "precedence" integer DEFAULT 100 NOT NULL
);


ALTER TABLE "public"."event_assignment_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "member_record_id" "uuid" NOT NULL,
    "assignment_scope" "public"."event_assignment_scope_code" NOT NULL,
    "event_id" "uuid",
    "legacy_event_kind_code" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    "role_code" "text",
    CONSTRAINT "event_assignments_scope_target_check" CHECK (((("assignment_scope" = 'all_events'::"public"."event_assignment_scope_code") AND ("event_id" IS NULL) AND ("legacy_event_kind_code" IS NULL)) OR (("assignment_scope" = 'event'::"public"."event_assignment_scope_code") AND ("event_id" IS NOT NULL) AND ("legacy_event_kind_code" IS NULL)) OR (("assignment_scope" = 'event_kind'::"public"."event_assignment_scope_code") AND ("event_id" IS NULL) AND ("legacy_event_kind_code" IS NOT NULL) AND ("btrim"("legacy_event_kind_code") <> ''::"text"))))
);


ALTER TABLE "public"."event_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_council_rsvps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "event_invited_council_id" "uuid" NOT NULL,
    "responding_council_name" "text" NOT NULL,
    "responding_council_number" "text",
    "responding_contact_name" "text",
    "responding_contact_email" "text",
    "responding_contact_phone" "text",
    "response_notes" "text",
    "first_responded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_responded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_council_rsvps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_invited_councils" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "invited_council_type_code" "text" NOT NULL,
    "invited_council_id" "uuid",
    "invited_council_name" "text" NOT NULL,
    "invited_council_number" "text",
    "invite_email" "text",
    "invite_contact_name" "text",
    "is_host" boolean DEFAULT false NOT NULL,
    "rsvp_link_token" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_invited_councils" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_rsvp_volunteers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "event_council_rsvp_id" "uuid" NOT NULL,
    "volunteer_name" "text" NOT NULL,
    "volunteer_email" "text",
    "volunteer_phone" "text",
    "volunteer_notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_rsvp_volunteers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location_name" "text",
    "location_address" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "display_timezone" "text" DEFAULT 'America/Toronto'::"text" NOT NULL,
    "status_code" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "scope_code" "text" DEFAULT 'home_council_only'::"text" NOT NULL,
    "requires_rsvp" boolean DEFAULT false NOT NULL,
    "rsvp_deadline_at" timestamp with time zone,
    "reminder_enabled" boolean DEFAULT false NOT NULL,
    "reminder_scheduled_for" timestamp with time zone,
    "created_by_user_id" "uuid" NOT NULL,
    "updated_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_kind_code" "text" DEFAULT 'standard'::"text" NOT NULL,
    "reminder_days_before" integer,
    "local_unit_id" "uuid" NOT NULL,
    "needs_volunteers" boolean DEFAULT false NOT NULL,
    "volunteer_deadline_at" timestamp with time zone,
    CONSTRAINT "events_event_kind_code_check" CHECK (("event_kind_code" = ANY (ARRAY['standard'::"text", 'general_meeting'::"text", 'executive_meeting'::"text"]))),
    CONSTRAINT "events_reminder_days_before_check" CHECK ((("reminder_days_before" IS NULL) OR (("reminder_days_before" >= 0) AND ("reminder_days_before" <= 60)))),
    CONSTRAINT "events_reminder_time_check" CHECK ((("reminder_scheduled_for" IS NULL) OR ("reminder_scheduled_for" < "starts_at"))),
    CONSTRAINT "events_rsvp_deadline_check" CHECK ((("rsvp_deadline_at" IS NULL) OR ("rsvp_deadline_at" <= "starts_at"))),
    CONSTRAINT "events_time_check" CHECK ((("ends_at" IS NULL) OR ("ends_at" >= "starts_at"))),
    CONSTRAINT "events_volunteer_deadline_check" CHECK ((("volunteer_deadline_at" IS NULL) OR ("volunteer_deadline_at" <= "starts_at")))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."local_unit_id" IS 'Required operational owner local unit for this event.';



CREATE OR REPLACE VIEW "public"."event_council_rsvp_rollups" WITH ("security_invoker"='true') AS
 SELECT "e"."id" AS "event_id",
    "host_ic"."invited_council_id" AS "host_council_id",
    "ic"."id" AS "event_invited_council_id",
    "ic"."is_host",
    "ic"."invited_council_type_code",
    "ic"."invited_council_id",
    "ic"."invited_council_name",
    "ic"."invited_council_number",
    "ic"."invite_email",
    "r"."id" AS "event_council_rsvp_id",
    ("r"."id" IS NOT NULL) AS "has_responded",
    "r"."first_responded_at",
    "r"."last_responded_at",
    (COALESCE("count"("v"."id"), (0)::bigint))::integer AS "volunteer_count"
   FROM (((("public"."events" "e"
     JOIN "public"."event_invited_councils" "ic" ON (("ic"."event_id" = "e"."id")))
     LEFT JOIN "public"."event_invited_councils" "host_ic" ON ((("host_ic"."event_id" = "e"."id") AND ("host_ic"."is_host" = true))))
     LEFT JOIN "public"."event_council_rsvps" "r" ON (("r"."event_invited_council_id" = "ic"."id")))
     LEFT JOIN "public"."event_rsvp_volunteers" "v" ON (("v"."event_council_rsvp_id" = "r"."id")))
  GROUP BY "e"."id", "host_ic"."invited_council_id", "ic"."id", "ic"."is_host", "ic"."invited_council_type_code", "ic"."invited_council_id", "ic"."invited_council_name", "ic"."invited_council_number", "ic"."invite_email", "r"."id", "r"."first_responded_at", "r"."last_responded_at";


ALTER VIEW "public"."event_council_rsvp_rollups" OWNER TO "postgres";


COMMENT ON VIEW "public"."event_council_rsvp_rollups" IS 'Server-side council RSVP rollup view. security_invoker enabled; direct browser-role access revoked.';



CREATE TABLE IF NOT EXISTS "public"."event_external_invitees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "invitee_name" "text" NOT NULL,
    "invitee_email" "text",
    "invitee_phone" "text",
    "invitee_role_label" "text",
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by_user_id" "uuid",
    "updated_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_external_invitees_sort_order_check" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."event_external_invitees" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."event_host_summary" WITH ("security_invoker"='true') AS
 SELECT "event_id",
    "host_council_id",
    ("count"(*))::integer AS "invited_council_count",
    ("count"(*) FILTER (WHERE "has_responded"))::integer AS "responded_council_count",
    (COALESCE("sum"("volunteer_count"), (0)::bigint))::integer AS "total_volunteer_count"
   FROM "public"."event_council_rsvp_rollups"
  GROUP BY "event_id", "host_council_id";


ALTER VIEW "public"."event_host_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."event_host_summary" IS 'Server-side event host summary view. security_invoker enabled; direct browser-role access revoked.';



CREATE TABLE IF NOT EXISTS "public"."event_invited_council_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."event_invited_council_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_message_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "event_invited_council_id" "uuid" NOT NULL,
    "message_type_code" "text" NOT NULL,
    "status_code" "text" DEFAULT 'pending'::"text" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "recipient_name" "text",
    "subject" "text" NOT NULL,
    "body_text" "text" NOT NULL,
    "body_html" "text",
    "payload_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "provider_message_id" "text",
    "error_text" "text",
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_message_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_message_status_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."event_message_status_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_message_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."event_message_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_person_rsvp_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_person_rsvp_id" "uuid" NOT NULL,
    "matched_person_id" "uuid",
    "attendee_name" "text" NOT NULL,
    "attendee_email" "text",
    "attendee_phone" "text",
    "uses_primary_contact" boolean DEFAULT false NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_volunteer" boolean DEFAULT false NOT NULL,
    CONSTRAINT "event_person_rsvp_attendees_sort_order_check" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."event_person_rsvp_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_person_rsvps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "matched_person_id" "uuid",
    "claimed_by_user_id" "uuid",
    "primary_name" "text" NOT NULL,
    "primary_email" "text",
    "primary_phone" "text",
    "response_notes" "text",
    "source_code" "text" DEFAULT 'public_link'::"text" NOT NULL,
    "status_code" "text" DEFAULT 'active'::"text" NOT NULL,
    "first_responded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_responded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claimed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_person_rsvps_source_code_check" CHECK (("source_code" = ANY (ARRAY['host_manual'::"text", 'email_link'::"text", 'public_link'::"text"]))),
    CONSTRAINT "event_person_rsvps_status_code_check" CHECK (("status_code" = ANY (ARRAY['active'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."event_person_rsvps" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."event_person_rsvp_summary" WITH ("security_invoker"='true') AS
 SELECT "rsvp"."event_id",
    "count"(DISTINCT "rsvp"."id") AS "active_submission_count",
    "count"("attendee"."id") FILTER (WHERE ("attendee"."is_volunteer" = true)) AS "total_volunteer_count",
    "max"("rsvp"."last_responded_at") AS "last_responded_at"
   FROM ("public"."event_person_rsvps" "rsvp"
     LEFT JOIN "public"."event_person_rsvp_attendees" "attendee" ON (("attendee"."event_person_rsvp_id" = "rsvp"."id")))
  WHERE ("rsvp"."status_code" = 'active'::"text")
  GROUP BY "rsvp"."event_id";


ALTER VIEW "public"."event_person_rsvp_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_scope_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."event_scope_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_status_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."event_status_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legacy_fossil_resolutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_table" "text" NOT NULL,
    "source_row_id" "uuid" NOT NULL,
    "resolution_code" "text" DEFAULT 'ignored_residue'::"text" NOT NULL,
    "notes" "text",
    "resolved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_by_auth_user_id" "uuid",
    CONSTRAINT "legacy_fossil_resolutions_resolution_not_blank" CHECK (("btrim"("resolution_code") <> ''::"text")),
    CONSTRAINT "legacy_fossil_resolutions_source_not_blank" CHECK (("btrim"("source_table") <> ''::"text"))
);


ALTER TABLE "public"."legacy_fossil_resolutions" OWNER TO "postgres";


COMMENT ON TABLE "public"."legacy_fossil_resolutions" IS 'Retained audit table for resolved legacy fossil decisions. The super-admin data hygiene dashboard and diagnostic views were retired after MVP stabilization.';



CREATE TABLE IF NOT EXISTS "public"."local_role_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "role_kind" "public"."role_kind" NOT NULL,
    "code" "text",
    "label" "text" NOT NULL,
    "precedence" integer DEFAULT 100 NOT NULL,
    "is_single_seat" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "source_template_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    CONSTRAINT "local_role_definitions_code_not_blank" CHECK ((("code" IS NULL) OR ("btrim"("code") <> ''::"text"))),
    CONSTRAINT "local_role_definitions_label_not_blank" CHECK (("btrim"("label") <> ''::"text"))
);


ALTER TABLE "public"."local_role_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_unit_external_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "url" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    CONSTRAINT "local_unit_external_links_label_not_blank" CHECK (("length"("btrim"("label")) > 0)),
    CONSTRAINT "local_unit_external_links_sort_order_nonnegative" CHECK (("sort_order" >= 0)),
    CONSTRAINT "local_unit_external_links_url_not_blank" CHECK (("length"("btrim"("url")) > 0))
);


ALTER TABLE "public"."local_unit_external_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_unit_message_routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "route_key" "text" NOT NULL,
    "recipient_person_id" "uuid",
    "recipient_email" "text",
    "recipient_label" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    CONSTRAINT "local_unit_message_routes_recipient_present" CHECK ((("recipient_person_id" IS NOT NULL) OR ("length"("btrim"(COALESCE("recipient_email", ''::"text"))) > 0))),
    CONSTRAINT "local_unit_message_routes_route_key_not_blank" CHECK (("length"("btrim"("route_key")) > 0))
);


ALTER TABLE "public"."local_unit_message_routes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_unit_people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "source_code" "text" DEFAULT 'member_record_backfill'::"text" NOT NULL,
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "linked_by_auth_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid"
);


ALTER TABLE "public"."local_unit_people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_unit_public_contact_message_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "route_key" "text" DEFAULT 'public_contact'::"text" NOT NULL,
    "inquiry_type_code" "text" NOT NULL,
    "status_code" "text" DEFAULT 'pending'::"text" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "recipient_label" "text",
    "reply_to_email" "text" NOT NULL,
    "submitter_name" "text" NOT NULL,
    "submitter_phone" "text",
    "subject" "text" NOT NULL,
    "body_text" "text" NOT NULL,
    "payload_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scheduled_for" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "failure_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cleared_at" timestamp with time zone,
    "cleared_by_auth_user_id" "uuid",
    CONSTRAINT "local_unit_public_contact_message_jobs_inquiry_type_valid" CHECK (("inquiry_type_code" = ANY (ARRAY['volunteer'::"text", 'membership'::"text", 'general_question'::"text", 'help_request'::"text", 'other'::"text"]))),
    CONSTRAINT "local_unit_public_contact_message_jobs_recipient_email_not_blan" CHECK (("length"("btrim"("recipient_email")) > 0)),
    CONSTRAINT "local_unit_public_contact_message_jobs_reply_to_email_not_blank" CHECK (("length"("btrim"("reply_to_email")) > 0)),
    CONSTRAINT "local_unit_public_contact_message_jobs_status_valid" CHECK (("status_code" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "local_unit_public_contact_message_jobs_submitter_name_not_blank" CHECK (("length"("btrim"("submitter_name")) > 0))
);


ALTER TABLE "public"."local_unit_public_contact_message_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_unit_public_gallery_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "storage_bucket" "text" DEFAULT 'local-unit-public-gallery'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "title" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    CONSTRAINT "local_unit_public_gallery_images_sort_order_nonnegative" CHECK (("sort_order" >= 0)),
    CONSTRAINT "local_unit_public_gallery_images_storage_path_not_blank" CHECK (("length"("btrim"("storage_path")) > 0)),
    CONSTRAINT "local_unit_public_gallery_images_title_not_blank" CHECK ((("title" IS NULL) OR ("length"("btrim"("title")) > 0)))
);


ALTER TABLE "public"."local_unit_public_gallery_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_unit_reporting_year_settings" (
    "local_unit_id" "uuid" NOT NULL,
    "year_label" "text" DEFAULT 'Calendar year'::"text" NOT NULL,
    "year_start_month" integer DEFAULT 1 NOT NULL,
    "year_start_day" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "local_unit_reporting_year_settings_day_check" CHECK ((("year_start_day" >= 1) AND ("year_start_day" <= 31))),
    CONSTRAINT "local_unit_reporting_year_settings_month_check" CHECK ((("year_start_month" >= 1) AND ("year_start_month" <= 12)))
);


ALTER TABLE "public"."local_unit_reporting_year_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_unit_volunteer_hour_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "hours_delta" numeric(7,2) NOT NULL,
    "credited_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "note" "text",
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by_user_id" "uuid",
    "void_reason" "text",
    CONSTRAINT "local_unit_volunteer_hour_adjustments_bounds_check" CHECK ((("hours_delta" >= '-999.99'::numeric) AND ("hours_delta" <= 999.99))),
    CONSTRAINT "local_unit_volunteer_hour_adjustments_nonzero_check" CHECK (("hours_delta" <> (0)::numeric))
);


ALTER TABLE "public"."local_unit_volunteer_hour_adjustments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."local_unit_volunteer_contribution_entries" WITH ("security_invoker"='true') AS
 WITH "event_entries" AS (
         SELECT 'event'::"text" AS "source_type",
            "concat"('event:', ("event"."id")::"text", ':', ("attendee"."matched_person_id")::"text") AS "source_id",
            "event"."local_unit_id",
            "attendee"."matched_person_id" AS "person_id",
            "event"."id" AS "event_id",
            "event"."title" AS "event_title",
            ("event"."starts_at")::"date" AS "credited_on",
            "round"(
                CASE
                    WHEN (("event"."ends_at" IS NOT NULL) AND ("event"."ends_at" > "event"."starts_at")) THEN (EXTRACT(epoch FROM ("event"."ends_at" - "event"."starts_at")) / 3600.0)
                    ELSE (1)::numeric
                END, 2) AS "hours",
            NULL::"text" AS "note",
            "event"."starts_at" AS "sort_at",
            NULL::"uuid" AS "adjustment_id",
            NULL::timestamp with time zone AS "voided_at",
            NULL::"text" AS "void_reason"
           FROM (("public"."events" "event"
             JOIN "public"."event_person_rsvps" "rsvp" ON (("rsvp"."event_id" = "event"."id")))
             JOIN "public"."event_person_rsvp_attendees" "attendee" ON (("attendee"."event_person_rsvp_id" = "rsvp"."id")))
          WHERE (("event"."local_unit_id" IS NOT NULL) AND ("event"."status_code" = 'completed'::"text") AND ("event"."event_kind_code" = 'standard'::"text") AND ("rsvp"."status_code" = 'active'::"text") AND ("attendee"."is_volunteer" = true) AND ("attendee"."matched_person_id" IS NOT NULL) AND (EXISTS ( SELECT 1
                   FROM "public"."local_unit_people" "lup"
                  WHERE (("lup"."local_unit_id" = "event"."local_unit_id") AND ("lup"."person_id" = "attendee"."matched_person_id")))))
          GROUP BY "event"."id", "event"."local_unit_id", "event"."title", "event"."starts_at", "event"."ends_at", "attendee"."matched_person_id"
        ), "manual_entries" AS (
         SELECT 'manual_adjustment'::"text" AS "source_type",
            "concat"('manual:', ("adjustment"."id")::"text") AS "source_id",
            "adjustment"."local_unit_id",
            "adjustment"."person_id",
            "adjustment"."event_id",
            "event"."title" AS "event_title",
            "adjustment"."credited_on",
            "adjustment"."hours_delta" AS "hours",
            "adjustment"."note",
            "adjustment"."created_at" AS "sort_at",
            "adjustment"."id" AS "adjustment_id",
            "adjustment"."voided_at",
            "adjustment"."void_reason"
           FROM ("public"."local_unit_volunteer_hour_adjustments" "adjustment"
             LEFT JOIN "public"."events" "event" ON ((("event"."id" = "adjustment"."event_id") AND ("event"."local_unit_id" = "adjustment"."local_unit_id"))))
          WHERE ("adjustment"."voided_at" IS NULL)
        )
 SELECT "event_entries"."source_type",
    "event_entries"."source_id",
    "event_entries"."local_unit_id",
    "event_entries"."person_id",
    "event_entries"."event_id",
    "event_entries"."event_title",
    "event_entries"."credited_on",
    "event_entries"."hours",
    "event_entries"."note",
    "event_entries"."sort_at",
    "event_entries"."adjustment_id",
    "event_entries"."voided_at",
    "event_entries"."void_reason"
   FROM "event_entries"
UNION ALL
 SELECT "manual_entries"."source_type",
    "manual_entries"."source_id",
    "manual_entries"."local_unit_id",
    "manual_entries"."person_id",
    "manual_entries"."event_id",
    "manual_entries"."event_title",
    "manual_entries"."credited_on",
    "manual_entries"."hours",
    "manual_entries"."note",
    "manual_entries"."sort_at",
    "manual_entries"."adjustment_id",
    "manual_entries"."voided_at",
    "manual_entries"."void_reason"
   FROM "manual_entries";


ALTER VIEW "public"."local_unit_volunteer_contribution_entries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."local_unit_volunteer_contribution_rollups" WITH ("security_invoker"='true') AS
 SELECT "local_unit_id",
    "person_id",
    "count"(DISTINCT "event_id") FILTER (WHERE ("source_type" = 'event'::"text")) AS "volunteer_event_count",
    COALESCE("round"("sum"("hours") FILTER (WHERE ("source_type" = 'event'::"text")), 2), (0)::numeric) AS "event_hours",
    COALESCE("round"("sum"("hours") FILTER (WHERE ("source_type" = 'manual_adjustment'::"text")), 2), (0)::numeric) AS "manual_adjustment_hours",
    COALESCE("round"("sum"("hours"), 2), (0)::numeric) AS "total_hours",
    "max"("credited_on") FILTER (WHERE ("source_type" = 'event'::"text")) AS "last_volunteered_on"
   FROM "public"."local_unit_volunteer_contribution_entries" "entry"
  GROUP BY "local_unit_id", "person_id";


ALTER VIEW "public"."local_unit_volunteer_contribution_rollups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."local_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_family_id" "uuid" NOT NULL,
    "official_name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "local_unit_kind" "public"."local_unit_kind" NOT NULL,
    "status" "public"."local_unit_status" DEFAULT 'active'::"public"."local_unit_status" NOT NULL,
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "timezone" "text",
    "city" "text",
    "province_state" "text",
    "postal_code" "text",
    "country_code" "text",
    "legacy_council_id" "uuid",
    "legacy_organization_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    "public_email" "text",
    "public_location_name" "text",
    "public_address_line1" "text",
    "public_address_line2" "text",
    "public_city" "text",
    "public_region" "text",
    "public_postal_code" "text",
    "public_country" "text",
    "public_location_url" "text",
    CONSTRAINT "local_units_display_name_not_blank" CHECK (("btrim"("display_name") <> ''::"text")),
    CONSTRAINT "local_units_official_name_not_blank" CHECK (("btrim"("official_name") <> ''::"text")),
    CONSTRAINT "local_units_public_address_line1_not_blank" CHECK ((("public_address_line1" IS NULL) OR ("length"("btrim"("public_address_line1")) > 0))),
    CONSTRAINT "local_units_public_address_line2_not_blank" CHECK ((("public_address_line2" IS NULL) OR ("length"("btrim"("public_address_line2")) > 0))),
    CONSTRAINT "local_units_public_city_not_blank" CHECK ((("public_city" IS NULL) OR ("length"("btrim"("public_city")) > 0))),
    CONSTRAINT "local_units_public_country_not_blank" CHECK ((("public_country" IS NULL) OR ("length"("btrim"("public_country")) > 0))),
    CONSTRAINT "local_units_public_email_not_blank" CHECK ((("public_email" IS NULL) OR ("length"("btrim"("public_email")) > 0))),
    CONSTRAINT "local_units_public_location_name_not_blank" CHECK ((("public_location_name" IS NULL) OR ("length"("btrim"("public_location_name")) > 0))),
    CONSTRAINT "local_units_public_location_url_http" CHECK ((("public_location_url" IS NULL) OR ("public_location_url" ~* '^https?://'::"text"))),
    CONSTRAINT "local_units_public_postal_code_not_blank" CHECK ((("public_postal_code" IS NULL) OR ("length"("btrim"("public_postal_code")) > 0))),
    CONSTRAINT "local_units_public_region_not_blank" CHECK ((("public_region" IS NULL) OR ("length"("btrim"("public_region")) > 0))),
    CONSTRAINT "local_units_visibility_not_blank" CHECK (("btrim"("visibility") <> ''::"text"))
);


ALTER TABLE "public"."local_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "member_number" "text",
    "first_name" "text" NOT NULL,
    "middle_name" "text",
    "last_name" "text" NOT NULL,
    "suffix" "text",
    "preferred_display_name" "text",
    "email" "text",
    "phone" "text",
    "address_line_1" "text",
    "address_line_2" "text",
    "city" "text",
    "province_state" "text",
    "postal_code" "text",
    "country_code" "text",
    "lifecycle_state" "public"."member_record_lifecycle_state" DEFAULT 'active'::"public"."member_record_lifecycle_state" NOT NULL,
    "archived_at" timestamp with time zone,
    "legacy_people_id" "uuid",
    "legacy_council_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    CONSTRAINT "member_records_first_name_not_blank" CHECK (("btrim"("first_name") <> ''::"text")),
    CONSTRAINT "member_records_last_name_not_blank" CHECK (("btrim"("last_name") <> ''::"text")),
    CONSTRAINT "member_records_member_number_not_blank" CHECK ((("member_number" IS NULL) OR ("btrim"("member_number") <> ''::"text")))
);


ALTER TABLE "public"."member_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membership_claim_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "requester_user_id" "uuid",
    "requester_name" "text" NOT NULL,
    "requester_email" "text" NOT NULL,
    "requester_phone" "text",
    "member_number" "text",
    "status_code" "public"."membership_claim_status_code" DEFAULT 'pending'::"public"."membership_claim_status_code" NOT NULL,
    "reviewer_notes" "text",
    "reviewed_by_auth_user_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "membership_claim_requests_member_number_not_blank" CHECK ((("member_number" IS NULL) OR ("btrim"("member_number") <> ''::"text"))),
    CONSTRAINT "membership_claim_requests_requester_email_not_blank" CHECK (("btrim"("requester_email") <> ''::"text")),
    CONSTRAINT "membership_claim_requests_requester_name_not_blank" CHECK (("btrim"("requester_name") <> ''::"text"))
);


ALTER TABLE "public"."membership_claim_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."migration_review_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_table" "text" NOT NULL,
    "source_row_id" "uuid" NOT NULL,
    "review_type" "text" NOT NULL,
    "notes" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by_auth_user_id" "uuid",
    CONSTRAINT "migration_review_queue_review_type_not_blank" CHECK (("btrim"("review_type") <> ''::"text")),
    CONSTRAINT "migration_review_queue_source_table_not_blank" CHECK (("btrim"("source_table") <> ''::"text"))
);


ALTER TABLE "public"."migration_review_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."note_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."note_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."officer_role_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "office_scope_code" "text" NOT NULL,
    "office_code" "text" NOT NULL,
    "office_rank" integer,
    "email" "text" NOT NULL,
    "login_enabled" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    "local_unit_id" "uuid" NOT NULL
);


ALTER TABLE "public"."officer_role_emails" OWNER TO "postgres";


COMMENT ON TABLE "public"."officer_role_emails" IS 'Officer role login email mapping scoped by local_unit_id.';



CREATE TABLE IF NOT EXISTS "public"."official_import_batch_status_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."official_import_batch_status_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."official_import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "uploaded_by_auth_user_id" "uuid",
    "source_filename" "text",
    "storage_object_path" "text",
    "file_sha256" "text",
    "batch_status_code" "text" NOT NULL,
    "row_count" integer DEFAULT 0 NOT NULL,
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "retention_until" timestamp with time zone DEFAULT ("now"() + '3 years'::interval) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."official_import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."official_import_review_status_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."official_import_review_status_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."official_import_row_action_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."official_import_row_action_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."official_import_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "council_id" "uuid" NOT NULL,
    "row_number" integer,
    "member_number" "text",
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "matched_person_id" "uuid",
    "matched_official_member_record_id" "uuid",
    "proposed_action_code" "text" NOT NULL,
    "review_status_code" "text" NOT NULL,
    "proposed_changes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "missing_from_import" boolean DEFAULT false NOT NULL,
    "reviewed_by_auth_user_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "applied_at" timestamp with time zone,
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."official_import_rows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."official_member_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "member_number" "text",
    "official_membership_status_code" "text" NOT NULL,
    "raw_member_type" "text",
    "raw_member_class" "text",
    "raw_status_text" "text",
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_imported_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid"
);


ALTER TABLE "public"."official_member_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."official_membership_status_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."official_membership_status_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_admin_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "person_id" "uuid",
    "user_id" "uuid",
    "grantee_email" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_user_id" "uuid",
    "updated_by_user_id" "uuid",
    "source_code" "text" DEFAULT 'manual_assignment'::"text" NOT NULL,
    "organization_claim_request_id" "uuid",
    "grant_notes" "text",
    "revoked_at" timestamp with time zone,
    "revoked_by_user_id" "uuid",
    "revoked_notes" "text",
    CONSTRAINT "organization_admin_assignments_source_code_check" CHECK (("source_code" = ANY (ARRAY['manual_assignment'::"text", 'approved_claim'::"text", 'admin_invitation'::"text"]))),
    CONSTRAINT "organization_admin_assignments_target_check" CHECK ((("person_id" IS NOT NULL) OR ("user_id" IS NOT NULL) OR (NULLIF("btrim"(COALESCE("grantee_email", ''::"text")), ''::"text") IS NOT NULL)))
);


ALTER TABLE "public"."organization_admin_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_admin_assignments" IS 'LEGACY COMPATIBILITY TABLE. Authority decisions should use area_access_grants / v_effective_area_access. Transitional sync input only.';



COMMENT ON COLUMN "public"."organization_admin_assignments"."source_code" IS 'How this admin grant was created: manual assignment, approved claim, or accepted admin invitation.';



COMMENT ON COLUMN "public"."organization_admin_assignments"."organization_claim_request_id" IS 'Claim request that produced this admin grant, when source_code = approved_claim.';



COMMENT ON COLUMN "public"."organization_admin_assignments"."grant_notes" IS 'Optional onboarding or handoff notes kept with this admin grant.';



COMMENT ON COLUMN "public"."organization_admin_assignments"."revoked_at" IS 'Timestamp when this admin grant was manually revoked.';



COMMENT ON COLUMN "public"."organization_admin_assignments"."revoked_notes" IS 'Optional notes recorded when this admin grant was manually revoked.';



CREATE TABLE IF NOT EXISTS "public"."organization_admin_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "council_id" "uuid",
    "invited_by_auth_user_id" "uuid",
    "invitee_email" "text" NOT NULL,
    "invitee_name" "text",
    "status_code" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "selector" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_by_auth_user_id" "uuid",
    "accepted_at" timestamp with time zone,
    "revoked_by_auth_user_id" "uuid",
    "revoked_at" timestamp with time zone,
    "revoked_notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_by_auth_user_id" "uuid",
    "accepted_assignment_id" "uuid",
    "challenge_response_hash" "text",
    CONSTRAINT "organization_admin_invitations_status_code_check" CHECK (("status_code" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."organization_admin_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_admin_invitations" IS 'Secure invitation records for intentional organization-admin onboarding.';



COMMENT ON COLUMN "public"."organization_admin_invitations"."accepted_assignment_id" IS 'Admin assignment created when this invitation is accepted.';



CREATE TABLE IF NOT EXISTS "public"."organization_claim_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "council_id" "uuid",
    "requested_by_auth_user_id" "uuid",
    "requested_by_person_id" "uuid",
    "requester_email" "text",
    "claimant_official_name" "text",
    "claimant_preferred_name" "text",
    "requester_phone" "text",
    "request_notes" "text",
    "status_code" "text" DEFAULT 'pending'::"text" NOT NULL,
    "review_notes" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by_auth_user_id" "uuid",
    "approved_assignment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_user_id" "uuid",
    "updated_by_user_id" "uuid",
    "requester_name" "text",
    "requested_council_number" "text",
    "requested_council_name" "text",
    "requested_city" "text",
    "initiated_via_code" "text" DEFAULT 'signed_in_member'::"text" NOT NULL,
    "requester_notice_dismissed_at" timestamp with time zone,
    "requester_notice_dismissed_by_auth_user_id" "uuid",
    CONSTRAINT "organization_claim_requests_status_code_check" CHECK (("status_code" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."organization_claim_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_claim_requests" IS 'Pending and reviewed organization admin claim requests awaiting manual verification.';



COMMENT ON COLUMN "public"."organization_claim_requests"."claimant_official_name" IS 'Snapshot of the official name on file when the claim was submitted.';



COMMENT ON COLUMN "public"."organization_claim_requests"."claimant_preferred_name" IS 'Snapshot of the preferred display name when the claim was submitted.';



COMMENT ON COLUMN "public"."organization_claim_requests"."status_code" IS 'Claim workflow status. Expected values are pending, approved, rejected, or cancelled.';



COMMENT ON COLUMN "public"."organization_claim_requests"."review_notes" IS 'Manual verification notes captured during super-admin review.';



COMMENT ON COLUMN "public"."organization_claim_requests"."requester_name" IS 'Display name snapshot captured when the claim was submitted.';



COMMENT ON COLUMN "public"."organization_claim_requests"."initiated_via_code" IS 'Entry point used to submit the claim request, such as signed_in_member or public_request.';



CREATE TABLE IF NOT EXISTS "public"."organization_families" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "terminology_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "legacy_organization_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    CONSTRAINT "organization_families_code_not_blank" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "organization_families_display_name_not_blank" CHECK (("btrim"("display_name") <> ''::"text"))
);


ALTER TABLE "public"."organization_families" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_kofc_profiles" (
    "organization_id" "uuid" NOT NULL,
    "council_number" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_kofc_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_membership_status_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."organization_membership_status_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "membership_status_code" "text" NOT NULL,
    "is_primary_membership" boolean DEFAULT false NOT NULL,
    "source_code" "text" DEFAULT 'legacy_backfill'::"text" NOT NULL,
    "joined_at" "date",
    "ended_at" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    "membership_number" "text"
);


ALTER TABLE "public"."organization_memberships" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organization_memberships"."membership_number" IS 'Canonical Knights of Columbus membership number imported from Supreme and stored on the membership record.';



CREATE TABLE IF NOT EXISTS "public"."organization_relationship_type_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."organization_relationship_type_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_organization_id" "uuid" NOT NULL,
    "to_organization_id" "uuid" NOT NULL,
    "relationship_type_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    CONSTRAINT "organization_relationships_not_self" CHECK (("from_organization_id" <> "to_organization_id"))
);


ALTER TABLE "public"."organization_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_type_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."organization_type_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "display_name" "text" NOT NULL,
    "organization_type_code" "text" NOT NULL,
    "logo_storage_bucket" "text" DEFAULT 'organization-assets'::"text" NOT NULL,
    "logo_storage_path" "text",
    "logo_alt_text" "text",
    "primary_color_hex" "text",
    "secondary_color_hex" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    "brand_profile_id" "uuid" NOT NULL,
    "preferred_name" "text",
    "org_type_code" "text",
    "public_page_enabled" boolean DEFAULT true NOT NULL,
    "public_description" "text",
    "public_contact_form_enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organizations"."preferred_name" IS 'Optional shorter or commonly used organization name for UI display. Falls back to display_name when null.';



CREATE TABLE IF NOT EXISTS "public"."people" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid",
    "title" "text",
    "first_name" "text" NOT NULL,
    "middle_name" "text",
    "last_name" "text" NOT NULL,
    "suffix" "text",
    "name_prefix" "text",
    "nickname" "text",
    "directory_display_name_override" "text",
    "primary_relationship_code" "text" NOT NULL,
    "created_source_code" "text" NOT NULL,
    "is_provisional_member" boolean DEFAULT false NOT NULL,
    "council_activity_level_code" "text",
    "council_activity_context_code" "text",
    "council_reengagement_status_code" "text",
    "prospect_status_code" "text",
    "volunteer_context_code" "text",
    "email" "text",
    "cell_phone" "text",
    "home_phone" "text",
    "other_phone" "text",
    "address_line_1" "text",
    "address_line_2" "text",
    "city" "text",
    "state_province" "text",
    "postal_code" "text",
    "country_code" "text",
    "merged_into_person_id" "uuid",
    "archived_at" timestamp with time zone,
    "archived_by_auth_user_id" "uuid",
    "archive_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    "birth_date" "date",
    "pii_key_version" "text",
    "email_hash" "text",
    "cell_phone_hash" "text",
    "home_phone_hash" "text",
    "other_phone_hash" "text",
    "address_line_1_hash" "text",
    "address_line_2_hash" "text",
    "city_hash" "text",
    "state_province_hash" "text",
    "postal_code_hash" "text",
    "country_code_hash" "text",
    "birth_date_hash" "text",
    CONSTRAINT "people_archive_merge_check" CHECK (("id" <> "merged_into_person_id")),
    CONSTRAINT "people_contact_required_for_non_import" CHECK ((("created_source_code" = 'supreme_import'::"text") OR (COALESCE(NULLIF("btrim"("email"), ''::"text"), NULLIF("btrim"("cell_phone"), ''::"text"), NULLIF("btrim"("home_phone"), ''::"text"), NULLIF("btrim"("other_phone"), ''::"text")) IS NOT NULL))),
    CONSTRAINT "people_prospect_fields_check" CHECK (((("primary_relationship_code" = 'prospect'::"text") AND ("prospect_status_code" IS NOT NULL) AND ("volunteer_context_code" IS NULL)) OR (("primary_relationship_code" = 'volunteer_only'::"text") AND ("volunteer_context_code" IS NOT NULL) AND ("prospect_status_code" IS NULL)) OR (("primary_relationship_code" = 'member'::"text") AND ("prospect_status_code" IS NULL) AND ("volunteer_context_code" IS NULL))))
);


ALTER TABLE "public"."people" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_by_auth_user_id" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_by_auth_user_id" "uuid",
    "ended_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "person_assignments_date_order" CHECK ((("ended_at" IS NULL) OR ("ended_at" >= "assigned_at")))
);


ALTER TABLE "public"."person_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_contact_change_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid",
    "person_id" "uuid" NOT NULL,
    "changed_by_auth_user_id" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_fields" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "old_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "new_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."person_contact_change_log" OWNER TO "postgres";


COMMENT ON COLUMN "public"."person_contact_change_log"."council_id" IS 'Nullable for profile/contact changes made by organization-scoped external admins who do not belong to a local council.';



CREATE TABLE IF NOT EXISTS "public"."person_designations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "designation_code" "text" NOT NULL,
    "fraternal_year" integer NOT NULL,
    "appointed_on" "date",
    "vacated_on" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    CONSTRAINT "person_designations_fraternal_year_check" CHECK (("fraternal_year" >= 2000))
);


ALTER TABLE "public"."person_designations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_distinctions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "distinction_code" "text" NOT NULL,
    "awarded_on" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid"
);


ALTER TABLE "public"."person_distinctions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "primary_user_id" "uuid",
    "display_name" "text",
    "normalized_email_hash" "text",
    "normalized_phone_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid"
);


ALTER TABLE "public"."person_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_identity_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person_identity_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "link_source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "confidence_code" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid"
);


ALTER TABLE "public"."person_identity_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_kofc_profiles" (
    "person_id" "uuid" NOT NULL,
    "first_degree_date" "date",
    "second_degree_date" "date",
    "third_degree_date" "date",
    "years_in_service" integer,
    "member_type" "text",
    "member_class" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assembly_number" "text"
);


ALTER TABLE "public"."person_kofc_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."person_kofc_profiles"."assembly_number" IS 'Knights of Columbus assembly number for members who belong to a 4th degree assembly.';



CREATE TABLE IF NOT EXISTS "public"."person_merges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "source_person_id" "uuid" NOT NULL,
    "target_person_id" "uuid" NOT NULL,
    "merged_by_auth_user_id" "uuid" NOT NULL,
    "merged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "field_resolution" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    CONSTRAINT "person_merges_no_self_merge" CHECK (("source_person_id" <> "target_person_id"))
);


ALTER TABLE "public"."person_merges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "note_type_code" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid"
);


ALTER TABLE "public"."person_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_officer_terms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person_id" "uuid" NOT NULL,
    "office_scope_code" "text" NOT NULL,
    "office_code" "text" NOT NULL,
    "office_label" "text" NOT NULL,
    "office_rank" integer,
    "service_start_year" integer NOT NULL,
    "service_end_year" integer,
    "notes" "text",
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "manual_end_effective_date" "date",
    "ended_by_auth_user_id" "uuid",
    "end_reason" "text",
    "local_unit_id" "uuid" NOT NULL,
    CONSTRAINT "person_officer_terms_check" CHECK ((("service_end_year" IS NULL) OR (("service_end_year" >= 1900) AND ("service_end_year" <= 2100) AND ("service_end_year" >= "service_start_year")))),
    CONSTRAINT "person_officer_terms_office_rank_check" CHECK ((("office_rank" IS NULL) OR ("office_rank" > 0))),
    CONSTRAINT "person_officer_terms_office_scope_code_check" CHECK (("office_scope_code" = ANY (ARRAY['council'::"text", 'district'::"text", 'state'::"text"]))),
    CONSTRAINT "person_officer_terms_service_start_year_check" CHECK ((("service_start_year" >= 1900) AND ("service_start_year" <= 2100)))
);


ALTER TABLE "public"."person_officer_terms" OWNER TO "postgres";


COMMENT ON TABLE "public"."person_officer_terms" IS 'Officer service terms scoped by local_unit_id. Knights council identity is resolved through local_units compatibility data where needed.';



CREATE TABLE IF NOT EXISTS "public"."person_profile_change_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person_id" "uuid" NOT NULL,
    "requested_by_auth_user_id" "uuid" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status_code" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by_auth_user_id" "uuid",
    "review_notes" "text",
    "proposed_email" "text",
    "proposed_cell_phone" "text",
    "proposed_home_phone" "text",
    "proposed_preferred_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pii_key_version" "text",
    "proposed_email_hash" "text",
    "proposed_cell_phone_hash" "text",
    "proposed_home_phone_hash" "text",
    "email_change_requested" boolean DEFAULT false NOT NULL,
    "cell_phone_change_requested" boolean DEFAULT false NOT NULL,
    "home_phone_change_requested" boolean DEFAULT false NOT NULL,
    "decision_notice_cleared_at" timestamp with time zone,
    "proposed_first_name" "text",
    "proposed_last_name" "text",
    CONSTRAINT "person_profile_change_requests_status_code_check" CHECK (("status_code" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."person_profile_change_requests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."person_profile_change_requests"."proposed_first_name" IS 'Requested first name change submitted by the linked user for admin review.';



COMMENT ON COLUMN "public"."person_profile_change_requests"."proposed_last_name" IS 'Requested last name change submitted by the linked user for admin review.';



CREATE TABLE IF NOT EXISTS "public"."person_source_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."person_source_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."primary_relationship_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."primary_relationship_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prospect_status_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."prospect_status_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_registration_intakes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "normalized_email" "text" NOT NULL,
    "phone" "text",
    "consent_version" "text" NOT NULL,
    "consent_text" "text" NOT NULL,
    "consent_accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_verification_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "matched_person_id" "uuid",
    "matched_at" timestamp with time zone,
    "admin_review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "public_registration_intakes_admin_review_status_check" CHECK (("admin_review_status" = ANY (ARRAY['pending'::"text", 'matched'::"text", 'needs_review'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "public_registration_intakes_email_verification_status_check" CHECK (("email_verification_status" = ANY (ARRAY['pending'::"text", 'verified'::"text"])))
);


ALTER TABLE "public"."public_registration_intakes" OWNER TO "postgres";


COMMENT ON TABLE "public"."public_registration_intakes" IS 'Public registration intake records collected before email verification and admin/member matching. Written only through server-side service role actions.';



COMMENT ON COLUMN "public"."public_registration_intakes"."consent_text" IS 'Exact registration consent text accepted by the registrant at submission time.';



CREATE TABLE IF NOT EXISTS "public"."resource_access_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "member_record_id" "uuid" NOT NULL,
    "resource_type" "public"."resource_type_code" NOT NULL,
    "resource_key" "text" NOT NULL,
    "access_level" "public"."area_access_level" NOT NULL,
    "source_code" "public"."grant_source_code" DEFAULT 'manual'::"public"."grant_source_code" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    CONSTRAINT "resource_access_grants_resource_key_not_blank" CHECK (("btrim"("resource_key") <> ''::"text"))
);


ALTER TABLE "public"."resource_access_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_record_id" "uuid" NOT NULL,
    "local_role_definition_id" "uuid" NOT NULL,
    "start_year" integer,
    "end_year" integer,
    "active_override" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    CONSTRAINT "role_assignments_year_order" CHECK ((("start_year" IS NULL) OR ("end_year" IS NULL) OR ("end_year" >= "start_year")))
);


ALTER TABLE "public"."role_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saint_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "saint_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."saint_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saint_topics" (
    "saint_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "relevance_score" smallint,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "saint_topics_relevance_score_check" CHECK ((("relevance_score" >= 1) AND ("relevance_score" <= 5)))
);


ALTER TABLE "public"."saint_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "canonical_name" "text" NOT NULL,
    "common_name" "text",
    "short_bio" "text",
    "feast_month" smallint,
    "feast_day" smallint,
    "era_label" "text",
    "canonization_status" "text",
    "patron_summary" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "saints_feast_day_check" CHECK ((("feast_day" >= 1) AND ("feast_day" <= 31))),
    CONSTRAINT "saints_feast_month_check" CHECK ((("feast_month" >= 1) AND ("feast_month" <= 12)))
);


ALTER TABLE "public"."saints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scripture_passages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "book" "text" NOT NULL,
    "chapter_start" integer,
    "verse_start" integer,
    "chapter_end" integer,
    "verse_end" integer,
    "reference_label" "text" NOT NULL,
    "summary" "text",
    "text_excerpt" "text",
    "translation_code" "text" DEFAULT 'NRSVCE'::"text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."scripture_passages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scripture_topics" (
    "scripture_passage_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "relevance_score" smallint,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "scripture_topics_relevance_score_check" CHECK ((("relevance_score" >= 1) AND ("relevance_score" <= 5)))
);


ALTER TABLE "public"."scripture_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spiritual_content_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content_kind" "public"."spiritual_content_kind" NOT NULL,
    "prayer_type" "public"."prayer_type_code",
    "summary" "text",
    "body_markdown" "text",
    "body_html" "text",
    "language_code" "text" DEFAULT 'en'::"text" NOT NULL,
    "territory_code" "text",
    "record_type" "text" DEFAULT 'standalone'::"text" NOT NULL,
    "authority_level" "text",
    "source_label" "text",
    "source_url" "text",
    "text_status" "public"."spiritual_text_status_code" DEFAULT 'draft'::"public"."spiritual_text_status_code" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."spiritual_content_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spiritual_content_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_content_item_id" "uuid" NOT NULL,
    "child_content_item_id" "uuid" NOT NULL,
    "relationship_kind" "public"."content_relationship_kind" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "spiritual_content_relationships_not_self_ck" CHECK (("parent_content_item_id" <> "child_content_item_id"))
);


ALTER TABLE "public"."spiritual_content_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spiritual_content_saints" (
    "spiritual_content_item_id" "uuid" NOT NULL,
    "saint_id" "uuid" NOT NULL,
    "relationship_kind" "public"."content_saint_relationship_kind" DEFAULT 'about'::"public"."content_saint_relationship_kind" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."spiritual_content_saints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spiritual_content_scopes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "spiritual_content_item_id" "uuid" NOT NULL,
    "scope_kind" "public"."spiritual_scope_kind" NOT NULL,
    "organization_family_id" "uuid",
    "local_unit_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "spiritual_content_scopes_scope_ck" CHECK (((("scope_kind" = 'global'::"public"."spiritual_scope_kind") AND ("organization_family_id" IS NULL) AND ("local_unit_id" IS NULL)) OR (("scope_kind" = 'organization_family'::"public"."spiritual_scope_kind") AND ("organization_family_id" IS NOT NULL) AND ("local_unit_id" IS NULL)) OR (("scope_kind" = 'local_unit'::"public"."spiritual_scope_kind") AND ("organization_family_id" IS NULL) AND ("local_unit_id" IS NOT NULL))))
);


ALTER TABLE "public"."spiritual_content_scopes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spiritual_content_topics" (
    "spiritual_content_item_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "relevance_score" smallint,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "spiritual_content_topics_relevance_score_check" CHECK ((("relevance_score" >= 1) AND ("relevance_score" <= 5)))
);


ALTER TABLE "public"."spiritual_content_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spiritual_topic_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."spiritual_topic_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spiritual_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "topic_group" "text",
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."spiritual_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supreme_update_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "created_by_auth_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "change_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status_code" "text" NOT NULL,
    "dismissed_reason" "text",
    "cleared_by_auth_user_id" "uuid",
    "cleared_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supreme_update_queue_cleared_check" CHECK ((("status_code" <> 'cleared'::"text") OR ("cleared_at" IS NOT NULL)))
);


ALTER TABLE "public"."supreme_update_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supreme_update_status_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."supreme_update_status_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_access_scopes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "scope_code" "text" NOT NULL,
    "source_type_code" "text" NOT NULL,
    "source_designation_code" "text",
    "granted_by_auth_user_id" "uuid",
    "confirmed_at" timestamp with time zone,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_access_scopes_date_order" CHECK ((("ends_at" IS NULL) OR ("ends_at" >= "starts_at"))),
    CONSTRAINT "user_access_scopes_designation_source_check" CHECK (((("source_type_code" = 'designation_default_confirmed'::"text") AND ("source_designation_code" IS NOT NULL)) OR ("source_type_code" <> 'designation_default_confirmed'::"text")))
);


ALTER TABLE "public"."user_access_scopes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_admin_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "granted_by_auth_user_id" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_by_auth_user_id" "uuid",
    "revoked_at" timestamp with time zone,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_admin_grants_revocation_order" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at")))
);


ALTER TABLE "public"."user_admin_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_saved_saints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "saint_id" "uuid" NOT NULL,
    "saved_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_saved_saints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_saved_spiritual_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "spiritual_content_item_id" "uuid" NOT NULL,
    "saved_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_saved_spiritual_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_spiritual_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_code" "text" NOT NULL,
    "spiritual_content_item_id" "uuid",
    "daily_reading_entry_id" "uuid",
    "payload_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "user_spiritual_activity_target_ck" CHECK ((("spiritual_content_item_id" IS NOT NULL) OR ("daily_reading_entry_id" IS NOT NULL)))
);


ALTER TABLE "public"."user_spiritual_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_unit_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "local_unit_id" "uuid" NOT NULL,
    "relationship_kind" "public"."relationship_kind" NOT NULL,
    "status" "public"."relationship_status" DEFAULT 'active'::"public"."relationship_status" NOT NULL,
    "member_record_id" "uuid",
    "is_primary_parish" boolean DEFAULT false NOT NULL,
    "activated_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    CONSTRAINT "user_unit_relationships_member_record_required_for_link" CHECK (((("relationship_kind" = 'linked_member_record'::"public"."relationship_kind") AND ("member_record_id" IS NOT NULL)) OR ("relationship_kind" = 'parish_self_claim'::"public"."relationship_kind")))
);


ALTER TABLE "public"."user_unit_relationships" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_unit_relationships" IS 'Includes legacy linked-member relationships. Active links to archived member_records should be treated as stale residue and cleaned up for org-admin-only subjects.';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "council_id" "uuid",
    "person_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_super_admin" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."is_super_admin" IS 'Global platform-level access flag for super-admin testing and support workflows.';



CREATE OR REPLACE VIEW "public"."v_effective_area_access" AS
 WITH "ranked" AS (
         SELECT "aag"."id" AS "area_access_grant_id",
            "aag"."local_unit_id",
            "lu"."display_name" AS "local_unit_name",
            "aag"."member_record_id",
            "mr"."legacy_people_id" AS "person_id",
            "uur"."user_id",
            "aag"."area_code",
            "aag"."access_level",
            "aag"."source_code",
            "aag"."granted_at",
            "aag"."expires_at",
            "aag"."revoked_at",
                CASE
                    WHEN ("aag"."source_code" = 'manual'::"public"."grant_source_code") THEN 500
                    WHEN ("aag"."source_code" = 'system'::"public"."grant_source_code") THEN 400
                    WHEN ("aag"."source_code" = 'invite_package'::"public"."grant_source_code") THEN 300
                    WHEN ("aag"."source_code" = 'title_default'::"public"."grant_source_code") THEN 200
                    WHEN ("aag"."source_code" = 'legacy_backfill'::"public"."grant_source_code") THEN 100
                    ELSE 0
                END AS "precedence_score",
                CASE
                    WHEN ("aag"."revoked_at" IS NOT NULL) THEN false
                    WHEN (("aag"."expires_at" IS NOT NULL) AND ("aag"."expires_at" < "now"())) THEN false
                    WHEN ("mr"."lifecycle_state" = 'archived'::"public"."member_record_lifecycle_state") THEN false
                    ELSE true
                END AS "is_effective"
           FROM ((("public"."area_access_grants" "aag"
             JOIN "public"."local_units" "lu" ON (("lu"."id" = "aag"."local_unit_id")))
             JOIN "public"."member_records" "mr" ON (("mr"."id" = "aag"."member_record_id")))
             JOIN "public"."user_unit_relationships" "uur" ON ((("uur"."member_record_id" = "mr"."id") AND ("uur"."local_unit_id" = "aag"."local_unit_id") AND ("uur"."status" = 'active'::"public"."relationship_status"))))
          WHERE ("uur"."user_id" IS NOT NULL)
        UNION ALL
         SELECT "oaa"."id" AS "area_access_grant_id",
            "lu"."id" AS "local_unit_id",
            "lu"."display_name" AS "local_unit_name",
            NULL::"uuid" AS "member_record_id",
            "oaa"."person_id",
            "oaa"."user_id",
            "area_codes"."area_code",
            'manage'::"public"."area_access_level" AS "access_level",
            'manual'::"public"."grant_source_code" AS "source_code",
            COALESCE("oaa"."created_at", "oaa"."updated_at", "now"()) AS "granted_at",
            NULL::timestamp with time zone AS "expires_at",
            "oaa"."revoked_at",
            500 AS "precedence_score",
                CASE
                    WHEN ("oaa"."is_active" IS NOT TRUE) THEN false
                    WHEN ("oaa"."revoked_at" IS NOT NULL) THEN false
                    WHEN ("oaa"."user_id" IS NULL) THEN false
                    ELSE true
                END AS "is_effective"
           FROM (("public"."organization_admin_assignments" "oaa"
             JOIN "public"."local_units" "lu" ON (("lu"."legacy_organization_id" = "oaa"."organization_id")))
             CROSS JOIN ( VALUES ('members'::"public"."member_area_code"), ('events'::"public"."member_area_code"), ('custom_lists'::"public"."member_area_code"), ('admins'::"public"."member_area_code"), ('local_unit_settings'::"public"."member_area_code")) "area_codes"("area_code"))
          WHERE ("oaa"."user_id" IS NOT NULL)
        UNION ALL
         SELECT "pot"."id" AS "area_access_grant_id",
            "pot"."local_unit_id",
            "lu"."display_name" AS "local_unit_name",
            "mr"."id" AS "member_record_id",
            "pot"."person_id",
            "uur"."user_id",
            "area_codes"."area_code",
            'manage'::"public"."area_access_level" AS "access_level",
            'title_default'::"public"."grant_source_code" AS "source_code",
            COALESCE("pot"."created_at", "now"()) AS "granted_at",
            NULL::timestamp with time zone AS "expires_at",
            NULL::timestamp with time zone AS "revoked_at",
            200 AS "precedence_score",
                CASE
                    WHEN ("mr"."lifecycle_state" = 'archived'::"public"."member_record_lifecycle_state") THEN false
                    WHEN ("pot"."office_scope_code" <> 'council'::"text") THEN false
                    WHEN ("pot"."office_code" <> ALL (ARRAY['grand_knight'::"text", 'financial_secretary'::"text"])) THEN false
                    WHEN (("pot"."service_end_year" IS NOT NULL) AND ("pot"."service_end_year" < (EXTRACT(year FROM CURRENT_DATE))::integer)) THEN false
                    ELSE true
                END AS "is_effective"
           FROM (((("public"."person_officer_terms" "pot"
             JOIN "public"."local_units" "lu" ON (("lu"."id" = "pot"."local_unit_id")))
             JOIN "public"."member_records" "mr" ON ((("mr"."local_unit_id" = "pot"."local_unit_id") AND ("mr"."legacy_people_id" = "pot"."person_id") AND ("mr"."archived_at" IS NULL))))
             JOIN "public"."user_unit_relationships" "uur" ON ((("uur"."member_record_id" = "mr"."id") AND ("uur"."local_unit_id" = "pot"."local_unit_id") AND ("uur"."status" = 'active'::"public"."relationship_status"))))
             CROSS JOIN ( VALUES ('members'::"public"."member_area_code"), ('events'::"public"."member_area_code"), ('custom_lists'::"public"."member_area_code"), ('admins'::"public"."member_area_code"), ('local_unit_settings'::"public"."member_area_code")) "area_codes"("area_code"))
          WHERE ("uur"."user_id" IS NOT NULL)
        UNION ALL
         SELECT "ore"."id" AS "area_access_grant_id",
            "pot"."local_unit_id",
            "lu"."display_name" AS "local_unit_name",
            "mr"."id" AS "member_record_id",
            "pot"."person_id",
            "au"."id" AS "user_id",
            "area_codes"."area_code",
            'manage'::"public"."area_access_level" AS "access_level",
            'title_default'::"public"."grant_source_code" AS "source_code",
            COALESCE("ore"."created_at", "pot"."created_at", "now"()) AS "granted_at",
            NULL::timestamp with time zone AS "expires_at",
            NULL::timestamp with time zone AS "revoked_at",
            200 AS "precedence_score",
                CASE
                    WHEN ("ore"."is_active" IS NOT TRUE) THEN false
                    WHEN ("ore"."login_enabled" IS NOT TRUE) THEN false
                    WHEN ("mr"."lifecycle_state" = 'archived'::"public"."member_record_lifecycle_state") THEN false
                    WHEN ("pot"."office_scope_code" <> 'council'::"text") THEN false
                    WHEN ("pot"."office_code" <> ALL (ARRAY['grand_knight'::"text", 'financial_secretary'::"text"])) THEN false
                    WHEN (("pot"."service_end_year" IS NOT NULL) AND ("pot"."service_end_year" < (EXTRACT(year FROM CURRENT_DATE))::integer)) THEN false
                    ELSE true
                END AS "is_effective"
           FROM ((((("public"."officer_role_emails" "ore"
             JOIN "auth"."users" "au" ON (("lower"(("au"."email")::"text") = "lower"("ore"."email"))))
             JOIN "public"."person_officer_terms" "pot" ON ((("pot"."local_unit_id" = "ore"."local_unit_id") AND ("pot"."office_scope_code" = "ore"."office_scope_code") AND ("pot"."office_code" = "ore"."office_code") AND (COALESCE("pot"."office_rank", '-1'::integer) = COALESCE("ore"."office_rank", '-1'::integer)))))
             JOIN "public"."local_units" "lu" ON (("lu"."id" = "pot"."local_unit_id")))
             JOIN "public"."member_records" "mr" ON ((("mr"."local_unit_id" = "pot"."local_unit_id") AND ("mr"."legacy_people_id" = "pot"."person_id") AND ("mr"."archived_at" IS NULL))))
             CROSS JOIN ( VALUES ('members'::"public"."member_area_code"), ('events'::"public"."member_area_code"), ('custom_lists'::"public"."member_area_code"), ('admins'::"public"."member_area_code"), ('local_unit_settings'::"public"."member_area_code")) "area_codes"("area_code"))
        )
 SELECT DISTINCT ON ("user_id", "local_unit_id", "area_code", "access_level") "area_access_grant_id",
    "local_unit_id",
    "local_unit_name",
    "member_record_id",
    "person_id",
    "user_id",
    "area_code",
    "access_level",
    "source_code",
    "granted_at",
    "expires_at",
    "revoked_at",
    "is_effective"
   FROM "ranked"
  ORDER BY "user_id", "local_unit_id", "area_code", "access_level", "precedence_score" DESC, "granted_at" DESC, "area_access_grant_id" DESC;


ALTER VIEW "public"."v_effective_area_access" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_effective_area_access" IS 'Server-side effective area access view. security_invoker enabled; direct browser-role access revoked.';



CREATE OR REPLACE VIEW "public"."v_effective_admin_package_access" WITH ("security_invoker"='true') AS
 SELECT "user_id",
    "person_id",
    "local_unit_id",
    "local_unit_name",
    "bool_or"((("area_code" = 'members'::"public"."member_area_code") AND ("access_level" = ANY (ARRAY['edit_manage'::"public"."area_access_level", 'manage'::"public"."area_access_level"])) AND "is_effective")) AS "can_manage_members",
    "bool_or"((("area_code" = 'events'::"public"."member_area_code") AND ("access_level" = 'manage'::"public"."area_access_level") AND "is_effective")) AS "can_manage_events",
    "bool_or"((("area_code" = 'custom_lists'::"public"."member_area_code") AND ("access_level" = ANY (ARRAY['interact'::"public"."area_access_level", 'manage'::"public"."area_access_level"])) AND "is_effective")) AS "can_manage_custom_lists",
    "bool_or"((("area_code" = 'claims'::"public"."member_area_code") AND ("access_level" = 'manage'::"public"."area_access_level") AND "is_effective")) AS "can_manage_claims",
    "bool_or"((("area_code" = 'admins'::"public"."member_area_code") AND ("access_level" = 'manage'::"public"."area_access_level") AND "is_effective")) AS "can_manage_admins",
    "bool_or"((("area_code" = 'local_unit_settings'::"public"."member_area_code") AND ("access_level" = 'manage'::"public"."area_access_level") AND "is_effective")) AS "can_manage_local_unit_settings"
   FROM "public"."v_effective_area_access" "v"
  WHERE ("user_id" IS NOT NULL)
  GROUP BY "user_id", "person_id", "local_unit_id", "local_unit_name"
 HAVING ("bool_or"((("area_code" = 'members'::"public"."member_area_code") AND ("access_level" = ANY (ARRAY['edit_manage'::"public"."area_access_level", 'manage'::"public"."area_access_level"])) AND "is_effective")) OR "bool_or"((("area_code" = 'events'::"public"."member_area_code") AND ("access_level" = 'manage'::"public"."area_access_level") AND "is_effective")) OR "bool_or"((("area_code" = 'custom_lists'::"public"."member_area_code") AND ("access_level" = ANY (ARRAY['interact'::"public"."area_access_level", 'manage'::"public"."area_access_level"])) AND "is_effective")) OR "bool_or"((("area_code" = 'claims'::"public"."member_area_code") AND ("access_level" = 'manage'::"public"."area_access_level") AND "is_effective")) OR "bool_or"((("area_code" = 'admins'::"public"."member_area_code") AND ("access_level" = 'manage'::"public"."area_access_level") AND "is_effective")) OR "bool_or"((("area_code" = 'local_unit_settings'::"public"."member_area_code") AND ("access_level" = 'manage'::"public"."area_access_level") AND "is_effective")));


ALTER VIEW "public"."v_effective_admin_package_access" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_effective_admin_package_access" IS 'Server-side effective admin package access view. security_invoker enabled; direct browser-role access revoked.';



CREATE OR REPLACE VIEW "public"."v_effective_event_management_access" WITH ("security_invoker"='true') AS
 SELECT DISTINCT "ea"."local_unit_id",
    "lu"."display_name" AS "local_unit_name",
    "e"."id" AS "event_id",
    "ea"."member_record_id",
    "mr"."legacy_people_id" AS "person_id",
    "uur"."user_id",
    COALESCE("ea"."role_code", 'manager'::"text") AS "role_code",
    true AS "is_effective"
   FROM (((("public"."event_assignments" "ea"
     JOIN "public"."local_units" "lu" ON (("lu"."id" = "ea"."local_unit_id")))
     JOIN "public"."member_records" "mr" ON (("mr"."id" = "ea"."member_record_id")))
     JOIN "public"."user_unit_relationships" "uur" ON ((("uur"."member_record_id" = "ea"."member_record_id") AND ("uur"."local_unit_id" = "ea"."local_unit_id") AND ("uur"."status" = 'active'::"public"."relationship_status"))))
     JOIN "public"."events" "e" ON ((("e"."local_unit_id" = "ea"."local_unit_id") AND (("ea"."assignment_scope" = 'all_events'::"public"."event_assignment_scope_code") OR (("ea"."assignment_scope" = 'event'::"public"."event_assignment_scope_code") AND ("ea"."event_id" = "e"."id"))))))
  WHERE (("mr"."lifecycle_state" <> 'archived'::"public"."member_record_lifecycle_state") AND ("uur"."user_id" IS NOT NULL))
UNION
 SELECT "v"."local_unit_id",
    "v"."local_unit_name",
    "e"."id" AS "event_id",
    "v"."member_record_id",
    "v"."person_id",
    "v"."user_id",
    'manager'::"text" AS "role_code",
    true AS "is_effective"
   FROM ("public"."v_effective_area_access" "v"
     JOIN "public"."events" "e" ON (("e"."local_unit_id" = "v"."local_unit_id")))
  WHERE (("v"."area_code" = 'events'::"public"."member_area_code") AND ("v"."access_level" = 'manage'::"public"."area_access_level") AND ("v"."is_effective" = true) AND ("v"."user_id" IS NOT NULL));


ALTER VIEW "public"."v_effective_event_management_access" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_effective_event_management_access" IS 'Server-side effective event management access view. security_invoker enabled; direct browser-role access revoked.';



CREATE OR REPLACE VIEW "public"."v_effective_resource_access" WITH ("security_invoker"='true') AS
 WITH "ranked" AS (
         SELECT "rag"."id" AS "resource_access_grant_id",
            "rag"."local_unit_id",
            "lu"."display_name" AS "local_unit_name",
            "rag"."member_record_id",
            "mr"."legacy_people_id" AS "person_id",
            "uur"."user_id",
            "rag"."resource_type",
            "rag"."resource_key",
            "rag"."access_level",
            "rag"."source_code",
            "rag"."granted_at",
            "rag"."expires_at",
            "rag"."revoked_at",
                CASE
                    WHEN ("rag"."revoked_at" IS NOT NULL) THEN false
                    WHEN (("rag"."expires_at" IS NOT NULL) AND ("rag"."expires_at" < "now"())) THEN false
                    WHEN ("mr"."lifecycle_state" = 'archived'::"public"."member_record_lifecycle_state") THEN false
                    ELSE true
                END AS "is_effective",
            "row_number"() OVER (PARTITION BY "rag"."local_unit_id", "rag"."member_record_id", "rag"."resource_type", "rag"."resource_key", "rag"."access_level" ORDER BY ("public"."parallel_grant_source_rank"("rag"."source_code")), "rag"."granted_at" DESC NULLS LAST, "rag"."created_at" DESC) AS "source_rank"
           FROM ((("public"."resource_access_grants" "rag"
             JOIN "public"."local_units" "lu" ON (("lu"."id" = "rag"."local_unit_id")))
             JOIN "public"."member_records" "mr" ON (("mr"."id" = "rag"."member_record_id")))
             LEFT JOIN "public"."user_unit_relationships" "uur" ON ((("uur"."member_record_id" = "mr"."id") AND ("uur"."local_unit_id" = "rag"."local_unit_id") AND ("uur"."status" = 'active'::"public"."relationship_status"))))
        )
 SELECT "resource_access_grant_id",
    "local_unit_id",
    "local_unit_name",
    "member_record_id",
    "person_id",
    "user_id",
    "resource_type",
    "resource_key",
    "access_level",
    "source_code",
    "granted_at",
    "expires_at",
    "revoked_at",
    "is_effective"
   FROM "ranked"
  WHERE ("source_rank" = 1);


ALTER VIEW "public"."v_effective_resource_access" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_effective_resource_access" IS 'Server-side effective resource access view. security_invoker enabled; direct browser-role access revoked.';



CREATE TABLE IF NOT EXISTS "public"."volunteer_context_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."volunteer_context_types" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."access_scope_source_types"
    ADD CONSTRAINT "access_scope_source_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."access_scope_types"
    ADD CONSTRAINT "access_scope_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."area_access_grants"
    ADD CONSTRAINT "area_access_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_profiles"
    ADD CONSTRAINT "brand_profiles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."brand_profiles"
    ADD CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catechism_references"
    ADD CONSTRAINT "catechism_references_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catechism_references"
    ADD CONSTRAINT "catechism_references_reference_code_key" UNIQUE ("reference_code");



ALTER TABLE ONLY "public"."catechism_references"
    ADD CONSTRAINT "catechism_references_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."catechism_topics"
    ADD CONSTRAINT "catechism_topics_pkey" PRIMARY KEY ("catechism_reference_id", "topic_id");



ALTER TABLE ONLY "public"."council_activity_context_types"
    ADD CONSTRAINT "council_activity_context_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."council_activity_level_types"
    ADD CONSTRAINT "council_activity_level_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."council_admin_assignments"
    ADD CONSTRAINT "council_admin_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."council_reengagement_status_types"
    ADD CONSTRAINT "council_reengagement_status_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."councils"
    ADD CONSTRAINT "councils_council_number_key" UNIQUE ("council_number");



ALTER TABLE ONLY "public"."councils"
    ADD CONSTRAINT "councils_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_list_access"
    ADD CONSTRAINT "custom_list_access_email_unique" UNIQUE ("custom_list_id", "grantee_email");



ALTER TABLE ONLY "public"."custom_list_access"
    ADD CONSTRAINT "custom_list_access_person_unique" UNIQUE ("custom_list_id", "person_id");



ALTER TABLE ONLY "public"."custom_list_access"
    ADD CONSTRAINT "custom_list_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_list_access"
    ADD CONSTRAINT "custom_list_access_user_unique" UNIQUE ("custom_list_id", "user_id");



ALTER TABLE ONLY "public"."custom_list_members"
    ADD CONSTRAINT "custom_list_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_list_members"
    ADD CONSTRAINT "custom_list_members_unique_person" UNIQUE ("custom_list_id", "person_id");



ALTER TABLE ONLY "public"."custom_lists"
    ADD CONSTRAINT "custom_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_reading_entries"
    ADD CONSTRAINT "daily_reading_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_reading_entries"
    ADD CONSTRAINT "daily_reading_entries_reading_date_key" UNIQUE ("reading_date");



ALTER TABLE ONLY "public"."designation_types"
    ADD CONSTRAINT "designation_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."distinction_types"
    ADD CONSTRAINT "distinction_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."event_archives"
    ADD CONSTRAINT "event_archives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_assignment_roles"
    ADD CONSTRAINT "event_assignment_roles_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_council_rsvps"
    ADD CONSTRAINT "event_council_rsvps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_external_invitees"
    ADD CONSTRAINT "event_external_invitees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_invited_council_types"
    ADD CONSTRAINT "event_invited_council_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."event_invited_councils"
    ADD CONSTRAINT "event_invited_councils_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_invited_councils"
    ADD CONSTRAINT "event_invited_councils_rsvp_link_token_key" UNIQUE ("rsvp_link_token");



ALTER TABLE ONLY "public"."event_message_jobs"
    ADD CONSTRAINT "event_message_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_message_status_types"
    ADD CONSTRAINT "event_message_status_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."event_message_types"
    ADD CONSTRAINT "event_message_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."event_person_rsvp_attendees"
    ADD CONSTRAINT "event_person_rsvp_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_person_rsvps"
    ADD CONSTRAINT "event_person_rsvps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_rsvp_volunteers"
    ADD CONSTRAINT "event_rsvp_volunteers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_scope_types"
    ADD CONSTRAINT "event_scope_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."event_status_types"
    ADD CONSTRAINT "event_status_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legacy_fossil_resolutions"
    ADD CONSTRAINT "legacy_fossil_resolutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legacy_fossil_resolutions"
    ADD CONSTRAINT "legacy_fossil_resolutions_unique_source" UNIQUE ("source_table", "source_row_id");



ALTER TABLE ONLY "public"."local_role_definitions"
    ADD CONSTRAINT "local_role_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_unit_external_links"
    ADD CONSTRAINT "local_unit_external_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_unit_message_routes"
    ADD CONSTRAINT "local_unit_message_routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_unit_people"
    ADD CONSTRAINT "local_unit_people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_unit_public_contact_message_jobs"
    ADD CONSTRAINT "local_unit_public_contact_message_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_unit_public_gallery_images"
    ADD CONSTRAINT "local_unit_public_gallery_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_unit_public_gallery_images"
    ADD CONSTRAINT "local_unit_public_gallery_images_storage_path_unique" UNIQUE ("storage_bucket", "storage_path");



ALTER TABLE ONLY "public"."local_unit_reporting_year_settings"
    ADD CONSTRAINT "local_unit_reporting_year_settings_pkey" PRIMARY KEY ("local_unit_id");



ALTER TABLE ONLY "public"."local_unit_volunteer_hour_adjustments"
    ADD CONSTRAINT "local_unit_volunteer_hour_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_units"
    ADD CONSTRAINT "local_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_records"
    ADD CONSTRAINT "member_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membership_claim_requests"
    ADD CONSTRAINT "membership_claim_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."migration_review_queue"
    ADD CONSTRAINT "migration_review_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."note_types"
    ADD CONSTRAINT "note_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."officer_role_emails"
    ADD CONSTRAINT "officer_role_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."official_import_batch_status_types"
    ADD CONSTRAINT "official_import_batch_status_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."official_import_batches"
    ADD CONSTRAINT "official_import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."official_import_review_status_types"
    ADD CONSTRAINT "official_import_review_status_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."official_import_row_action_types"
    ADD CONSTRAINT "official_import_row_action_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."official_import_rows"
    ADD CONSTRAINT "official_import_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."official_import_rows"
    ADD CONSTRAINT "official_import_rows_rownum_unique" UNIQUE ("batch_id", "row_number");



ALTER TABLE ONLY "public"."official_member_records"
    ADD CONSTRAINT "official_member_records_person_unique" UNIQUE ("person_id");



ALTER TABLE ONLY "public"."official_member_records"
    ADD CONSTRAINT "official_member_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."official_membership_status_types"
    ADD CONSTRAINT "official_membership_status_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_selector_key" UNIQUE ("selector");



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."organization_claim_requests"
    ADD CONSTRAINT "organization_claim_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_families"
    ADD CONSTRAINT "organization_families_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."organization_families"
    ADD CONSTRAINT "organization_families_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_kofc_profiles"
    ADD CONSTRAINT "organization_kofc_profiles_council_number_key" UNIQUE ("council_number");



ALTER TABLE ONLY "public"."organization_kofc_profiles"
    ADD CONSTRAINT "organization_kofc_profiles_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."organization_membership_status_types"
    ADD CONSTRAINT "organization_membership_status_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_unique" UNIQUE ("organization_id", "person_id");



ALTER TABLE ONLY "public"."organization_relationship_type_types"
    ADD CONSTRAINT "organization_relationship_type_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."organization_relationships"
    ADD CONSTRAINT "organization_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_relationships"
    ADD CONSTRAINT "organization_relationships_unique" UNIQUE ("from_organization_id", "to_organization_id", "relationship_type_code");



ALTER TABLE ONLY "public"."organization_type_types"
    ADD CONSTRAINT "organization_type_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_assignments"
    ADD CONSTRAINT "person_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_contact_change_log"
    ADD CONSTRAINT "person_contact_change_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_designations"
    ADD CONSTRAINT "person_designations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_designations"
    ADD CONSTRAINT "person_designations_unique_slot" UNIQUE ("council_id", "fraternal_year", "designation_code");



ALTER TABLE ONLY "public"."person_distinctions"
    ADD CONSTRAINT "person_distinctions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_distinctions"
    ADD CONSTRAINT "person_distinctions_unique_person_distinction" UNIQUE ("person_id", "distinction_code");



ALTER TABLE ONLY "public"."person_identities"
    ADD CONSTRAINT "person_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_identity_links"
    ADD CONSTRAINT "person_identity_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_kofc_profiles"
    ADD CONSTRAINT "person_kofc_profiles_pkey" PRIMARY KEY ("person_id");



ALTER TABLE ONLY "public"."person_merges"
    ADD CONSTRAINT "person_merges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_merges"
    ADD CONSTRAINT "person_merges_source_unique" UNIQUE ("source_person_id");



ALTER TABLE ONLY "public"."person_notes"
    ADD CONSTRAINT "person_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_officer_terms"
    ADD CONSTRAINT "person_officer_terms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_profile_change_requests"
    ADD CONSTRAINT "person_profile_change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_source_types"
    ADD CONSTRAINT "person_source_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."primary_relationship_types"
    ADD CONSTRAINT "primary_relationship_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."prospect_status_types"
    ADD CONSTRAINT "prospect_status_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."public_registration_intakes"
    ADD CONSTRAINT "public_registration_intakes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_access_grants"
    ADD CONSTRAINT "resource_access_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_assignments"
    ADD CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saint_aliases"
    ADD CONSTRAINT "saint_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saint_aliases"
    ADD CONSTRAINT "saint_aliases_saint_id_alias_key" UNIQUE ("saint_id", "alias");



ALTER TABLE ONLY "public"."saint_topics"
    ADD CONSTRAINT "saint_topics_pkey" PRIMARY KEY ("saint_id", "topic_id");



ALTER TABLE ONLY "public"."saints"
    ADD CONSTRAINT "saints_canonical_name_key" UNIQUE ("canonical_name");



ALTER TABLE ONLY "public"."saints"
    ADD CONSTRAINT "saints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saints"
    ADD CONSTRAINT "saints_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."scripture_passages"
    ADD CONSTRAINT "scripture_passages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scripture_passages"
    ADD CONSTRAINT "scripture_passages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."scripture_topics"
    ADD CONSTRAINT "scripture_topics_pkey" PRIMARY KEY ("scripture_passage_id", "topic_id");



ALTER TABLE ONLY "public"."spiritual_content_items"
    ADD CONSTRAINT "spiritual_content_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spiritual_content_items"
    ADD CONSTRAINT "spiritual_content_items_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."spiritual_content_relationships"
    ADD CONSTRAINT "spiritual_content_relationshi_parent_content_item_id_child__key" UNIQUE ("parent_content_item_id", "child_content_item_id", "relationship_kind");



ALTER TABLE ONLY "public"."spiritual_content_relationships"
    ADD CONSTRAINT "spiritual_content_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spiritual_content_saints"
    ADD CONSTRAINT "spiritual_content_saints_pkey" PRIMARY KEY ("spiritual_content_item_id", "saint_id", "relationship_kind");



ALTER TABLE ONLY "public"."spiritual_content_scopes"
    ADD CONSTRAINT "spiritual_content_scopes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spiritual_content_scopes"
    ADD CONSTRAINT "spiritual_content_scopes_spiritual_content_item_id_scope_ki_key" UNIQUE ("spiritual_content_item_id", "scope_kind", "organization_family_id", "local_unit_id");



ALTER TABLE ONLY "public"."spiritual_content_topics"
    ADD CONSTRAINT "spiritual_content_topics_pkey" PRIMARY KEY ("spiritual_content_item_id", "topic_id");



ALTER TABLE ONLY "public"."spiritual_topic_aliases"
    ADD CONSTRAINT "spiritual_topic_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spiritual_topic_aliases"
    ADD CONSTRAINT "spiritual_topic_aliases_topic_id_alias_key" UNIQUE ("topic_id", "alias");



ALTER TABLE ONLY "public"."spiritual_topics"
    ADD CONSTRAINT "spiritual_topics_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."spiritual_topics"
    ADD CONSTRAINT "spiritual_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spiritual_topics"
    ADD CONSTRAINT "spiritual_topics_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."supreme_update_queue"
    ADD CONSTRAINT "supreme_update_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supreme_update_status_types"
    ADD CONSTRAINT "supreme_update_status_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."event_council_rsvps"
    ADD CONSTRAINT "uq_event_council_rsvps_one_per_invite" UNIQUE ("event_invited_council_id");



ALTER TABLE ONLY "public"."user_access_scopes"
    ADD CONSTRAINT "user_access_scopes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_admin_grants"
    ADD CONSTRAINT "user_admin_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_saved_saints"
    ADD CONSTRAINT "user_saved_saints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_saved_saints"
    ADD CONSTRAINT "user_saved_saints_user_id_saint_id_key" UNIQUE ("user_id", "saint_id");



ALTER TABLE ONLY "public"."user_saved_spiritual_items"
    ADD CONSTRAINT "user_saved_spiritual_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_saved_spiritual_items"
    ADD CONSTRAINT "user_saved_spiritual_items_user_id_spiritual_content_item_i_key" UNIQUE ("user_id", "spiritual_content_item_id");



ALTER TABLE ONLY "public"."user_spiritual_activity"
    ADD CONSTRAINT "user_spiritual_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_unit_relationships"
    ADD CONSTRAINT "user_unit_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."volunteer_context_types"
    ADD CONSTRAINT "volunteer_context_types_pkey" PRIMARY KEY ("code");



CREATE INDEX "audit_log_council_created_idx" ON "public"."audit_log" USING "btree" ("council_id", "created_at" DESC);



CREATE INDEX "audit_log_entity_idx" ON "public"."audit_log" USING "btree" ("entity_table", "entity_id", "created_at" DESC);



CREATE UNIQUE INDEX "council_admin_assignments_council_email_uidx" ON "public"."council_admin_assignments" USING "btree" ("council_id", "lower"("grantee_email")) WHERE ("grantee_email" IS NOT NULL);



CREATE UNIQUE INDEX "council_admin_assignments_council_person_uidx" ON "public"."council_admin_assignments" USING "btree" ("council_id", "person_id") WHERE ("person_id" IS NOT NULL);



CREATE UNIQUE INDEX "council_admin_assignments_council_user_uidx" ON "public"."council_admin_assignments" USING "btree" ("council_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "custom_list_access_email_idx" ON "public"."custom_list_access" USING "btree" ("grantee_email");



CREATE INDEX "custom_list_access_list_idx" ON "public"."custom_list_access" USING "btree" ("custom_list_id", "granted_at" DESC);



CREATE INDEX "custom_list_access_person_idx" ON "public"."custom_list_access" USING "btree" ("person_id");



CREATE INDEX "custom_list_access_user_idx" ON "public"."custom_list_access" USING "btree" ("user_id");



CREATE INDEX "custom_list_members_claimed_idx" ON "public"."custom_list_members" USING "btree" ("custom_list_id", "claimed_by_person_id", "claimed_at" DESC);



CREATE INDEX "custom_list_members_list_idx" ON "public"."custom_list_members" USING "btree" ("custom_list_id", "person_id");



CREATE INDEX "custom_lists_council_active_idx" ON "public"."custom_lists" USING "btree" ("council_id", "archived_at", "updated_at" DESC);



CREATE INDEX "event_external_invitees_email_idx" ON "public"."event_external_invitees" USING "btree" ("lower"("invitee_email")) WHERE ("invitee_email" IS NOT NULL);



CREATE INDEX "event_external_invitees_event_idx" ON "public"."event_external_invitees" USING "btree" ("event_id", "sort_order", "created_at");



CREATE INDEX "event_person_rsvp_attendees_email_idx" ON "public"."event_person_rsvp_attendees" USING "btree" ("lower"("attendee_email")) WHERE ("attendee_email" IS NOT NULL);



CREATE INDEX "event_person_rsvp_attendees_event_person_rsvp_id_idx" ON "public"."event_person_rsvp_attendees" USING "btree" ("event_person_rsvp_id");



CREATE INDEX "event_person_rsvp_attendees_matched_person_id_idx" ON "public"."event_person_rsvp_attendees" USING "btree" ("matched_person_id");



CREATE UNIQUE INDEX "event_person_rsvp_attendees_one_primary_uidx" ON "public"."event_person_rsvp_attendees" USING "btree" ("event_person_rsvp_id") WHERE ("is_primary" = true);



CREATE INDEX "event_person_rsvps_active_event_email_idx" ON "public"."event_person_rsvps" USING "btree" ("event_id", "lower"("primary_email")) WHERE (("status_code" = 'active'::"text") AND ("primary_email" IS NOT NULL));



CREATE INDEX "event_person_rsvps_claimed_by_user_id_idx" ON "public"."event_person_rsvps" USING "btree" ("claimed_by_user_id");



CREATE INDEX "event_person_rsvps_claimed_by_user_idx" ON "public"."event_person_rsvps" USING "btree" ("claimed_by_user_id", "last_responded_at" DESC) WHERE ("claimed_by_user_id" IS NOT NULL);



CREATE UNIQUE INDEX "event_person_rsvps_event_email_active_uidx" ON "public"."event_person_rsvps" USING "btree" ("event_id", "lower"("primary_email")) WHERE ("status_code" = 'active'::"text");



CREATE INDEX "event_person_rsvps_event_id_idx" ON "public"."event_person_rsvps" USING "btree" ("event_id");



CREATE INDEX "event_person_rsvps_matched_person_id_idx" ON "public"."event_person_rsvps" USING "btree" ("matched_person_id");



CREATE INDEX "idx_area_access_grants_member_scope" ON "public"."area_access_grants" USING "btree" ("member_record_id", "local_unit_id", "area_code") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_custom_lists_local_unit_archived_at" ON "public"."custom_lists" USING "btree" ("local_unit_id", "archived_at") WHERE ("local_unit_id" IS NOT NULL);



CREATE INDEX "idx_custom_lists_local_unit_id" ON "public"."custom_lists" USING "btree" ("local_unit_id");



CREATE INDEX "idx_event_archives_local_unit_deleted_at" ON "public"."event_archives" USING "btree" ("local_unit_id", "deleted_at" DESC) WHERE ("local_unit_id" IS NOT NULL);



CREATE INDEX "idx_event_archives_local_unit_id" ON "public"."event_archives" USING "btree" ("local_unit_id");



CREATE INDEX "idx_event_assignments_event_id" ON "public"."event_assignments" USING "btree" ("event_id") WHERE ("event_id" IS NOT NULL);



CREATE INDEX "idx_event_assignments_event_kind" ON "public"."event_assignments" USING "btree" ("local_unit_id", "legacy_event_kind_code") WHERE ("legacy_event_kind_code" IS NOT NULL);



CREATE INDEX "idx_event_assignments_event_role" ON "public"."event_assignments" USING "btree" ("event_id", "role_code");



CREATE INDEX "idx_event_assignments_local_unit_member" ON "public"."event_assignments" USING "btree" ("local_unit_id", "member_record_id");



CREATE INDEX "idx_event_assignments_local_unit_member_record" ON "public"."event_assignments" USING "btree" ("local_unit_id", "member_record_id");



CREATE INDEX "idx_event_council_rsvps_event" ON "public"."event_council_rsvps" USING "btree" ("event_id");



CREATE INDEX "idx_event_council_rsvps_last_responded" ON "public"."event_council_rsvps" USING "btree" ("last_responded_at" DESC);



CREATE INDEX "idx_event_invited_councils_email" ON "public"."event_invited_councils" USING "btree" ("invite_email");



CREATE INDEX "idx_event_invited_councils_event_host" ON "public"."event_invited_councils" USING "btree" ("event_id", "is_host");



CREATE INDEX "idx_event_invited_councils_event_sort" ON "public"."event_invited_councils" USING "btree" ("event_id", "sort_order");



CREATE INDEX "idx_event_message_jobs_event" ON "public"."event_message_jobs" USING "btree" ("event_id");



CREATE INDEX "idx_event_message_jobs_invite" ON "public"."event_message_jobs" USING "btree" ("event_invited_council_id");



CREATE INDEX "idx_event_message_jobs_status_schedule" ON "public"."event_message_jobs" USING "btree" ("status_code", "scheduled_for");



CREATE INDEX "idx_event_rsvp_volunteers_event" ON "public"."event_rsvp_volunteers" USING "btree" ("event_id");



CREATE INDEX "idx_event_rsvp_volunteers_rsvp_sort" ON "public"."event_rsvp_volunteers" USING "btree" ("event_council_rsvp_id", "sort_order");



CREATE INDEX "idx_events_local_unit_id" ON "public"."events" USING "btree" ("local_unit_id");



CREATE INDEX "idx_events_local_unit_starts_at" ON "public"."events" USING "btree" ("local_unit_id", "starts_at" DESC) WHERE ("local_unit_id" IS NOT NULL);



CREATE INDEX "idx_legacy_fossil_resolutions_resolved_at" ON "public"."legacy_fossil_resolutions" USING "btree" ("resolved_at" DESC);



CREATE INDEX "idx_local_role_definitions_local_unit_kind_active" ON "public"."local_role_definitions" USING "btree" ("local_unit_id", "role_kind", "is_active");



CREATE INDEX "idx_local_units_kind" ON "public"."local_units" USING "btree" ("local_unit_kind");



CREATE INDEX "idx_local_units_legacy_council_id" ON "public"."local_units" USING "btree" ("legacy_council_id");



CREATE INDEX "idx_local_units_legacy_organization_id" ON "public"."local_units" USING "btree" ("legacy_organization_id");



CREATE INDEX "idx_local_units_organization_family_id" ON "public"."local_units" USING "btree" ("organization_family_id");



CREATE INDEX "idx_local_units_status" ON "public"."local_units" USING "btree" ("status");



CREATE INDEX "idx_member_records_legacy_council_id" ON "public"."member_records" USING "btree" ("legacy_council_id");



CREATE INDEX "idx_member_records_legacy_people_id" ON "public"."member_records" USING "btree" ("legacy_people_id");



CREATE INDEX "idx_member_records_lifecycle_state" ON "public"."member_records" USING "btree" ("lifecycle_state");



CREATE INDEX "idx_member_records_local_unit_email" ON "public"."member_records" USING "btree" ("local_unit_id", "lower"("email")) WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_member_records_local_unit_id" ON "public"."member_records" USING "btree" ("local_unit_id");



CREATE INDEX "idx_member_records_local_unit_phone" ON "public"."member_records" USING "btree" ("local_unit_id", "phone") WHERE ("phone" IS NOT NULL);



CREATE INDEX "idx_membership_claim_requests_local_unit_status" ON "public"."membership_claim_requests" USING "btree" ("local_unit_id", "status_code");



CREATE INDEX "idx_membership_claim_requests_requester_user_id" ON "public"."membership_claim_requests" USING "btree" ("requester_user_id");



CREATE INDEX "idx_migration_review_queue_source" ON "public"."migration_review_queue" USING "btree" ("source_table", "source_row_id");



CREATE INDEX "idx_migration_review_queue_unresolved" ON "public"."migration_review_queue" USING "btree" ("resolved_at") WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_organization_families_legacy_organization_id" ON "public"."organization_families" USING "btree" ("legacy_organization_id");



CREATE INDEX "idx_resource_access_grants_member_scope" ON "public"."resource_access_grants" USING "btree" ("member_record_id", "local_unit_id", "resource_type") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_role_assignments_local_role_definition_id" ON "public"."role_assignments" USING "btree" ("local_role_definition_id");



CREATE INDEX "idx_role_assignments_member_record_id" ON "public"."role_assignments" USING "btree" ("member_record_id");



CREATE INDEX "idx_user_unit_relationships_local_unit_id" ON "public"."user_unit_relationships" USING "btree" ("local_unit_id");



CREATE INDEX "idx_user_unit_relationships_member_record_id" ON "public"."user_unit_relationships" USING "btree" ("member_record_id");



CREATE INDEX "local_unit_external_links_active_sort_idx" ON "public"."local_unit_external_links" USING "btree" ("local_unit_id", "sort_order", "created_at") WHERE ("is_active" = true);



CREATE INDEX "local_unit_external_links_local_unit_id_idx" ON "public"."local_unit_external_links" USING "btree" ("local_unit_id");



CREATE UNIQUE INDEX "local_unit_message_routes_active_route_unique_idx" ON "public"."local_unit_message_routes" USING "btree" ("local_unit_id", "route_key") WHERE ("is_active" = true);



CREATE INDEX "local_unit_message_routes_local_unit_id_idx" ON "public"."local_unit_message_routes" USING "btree" ("local_unit_id");



CREATE UNIQUE INDEX "local_unit_people_active_unique_idx" ON "public"."local_unit_people" USING "btree" ("local_unit_id", "person_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "local_unit_people_local_unit_id_idx" ON "public"."local_unit_people" USING "btree" ("local_unit_id");



CREATE INDEX "local_unit_people_person_id_idx" ON "public"."local_unit_people" USING "btree" ("person_id");



CREATE INDEX "local_unit_public_contact_message_jobs_clearance_idx" ON "public"."local_unit_public_contact_message_jobs" USING "btree" ("local_unit_id", "cleared_at", "created_at" DESC);



CREATE INDEX "local_unit_public_contact_message_jobs_local_unit_id_idx" ON "public"."local_unit_public_contact_message_jobs" USING "btree" ("local_unit_id");



CREATE INDEX "local_unit_public_contact_message_jobs_pending_idx" ON "public"."local_unit_public_contact_message_jobs" USING "btree" ("scheduled_for", "created_at") WHERE ("status_code" = 'pending'::"text");



CREATE INDEX "local_unit_public_gallery_images_active_sort_idx" ON "public"."local_unit_public_gallery_images" USING "btree" ("local_unit_id", "sort_order", "created_at") WHERE ("is_active" = true);



CREATE INDEX "local_unit_public_gallery_images_local_unit_id_idx" ON "public"."local_unit_public_gallery_images" USING "btree" ("local_unit_id");



CREATE INDEX "local_unit_volunteer_hour_adjustments_active_idx" ON "public"."local_unit_volunteer_hour_adjustments" USING "btree" ("local_unit_id", "credited_on" DESC) WHERE ("voided_at" IS NULL);



CREATE INDEX "local_unit_volunteer_hour_adjustments_event_idx" ON "public"."local_unit_volunteer_hour_adjustments" USING "btree" ("event_id") WHERE ("event_id" IS NOT NULL);



CREATE INDEX "local_unit_volunteer_hour_adjustments_local_unit_person_idx" ON "public"."local_unit_volunteer_hour_adjustments" USING "btree" ("local_unit_id", "person_id", "credited_on" DESC);



CREATE UNIQUE INDEX "officer_role_emails_active_email_idx" ON "public"."officer_role_emails" USING "btree" ("lower"("email")) WHERE (("is_active" = true) AND ("login_enabled" = true));



CREATE UNIQUE INDEX "officer_role_emails_active_local_unit_role_key_idx" ON "public"."officer_role_emails" USING "btree" ("local_unit_id", "office_scope_code", "office_code", COALESCE("office_rank", '-1'::integer)) WHERE ("is_active" = true);



CREATE INDEX "officer_role_emails_email_lookup_idx" ON "public"."officer_role_emails" USING "btree" ("lower"("email"));



CREATE INDEX "officer_role_emails_local_unit_email_lookup_idx" ON "public"."officer_role_emails" USING "btree" ("local_unit_id", "lower"("email")) WHERE (("is_active" = true) AND ("login_enabled" = true));



CREATE INDEX "officer_role_emails_local_unit_id_idx" ON "public"."officer_role_emails" USING "btree" ("local_unit_id");



CREATE INDEX "officer_role_emails_local_unit_office_idx" ON "public"."officer_role_emails" USING "btree" ("local_unit_id", "office_scope_code", "office_code", "office_rank") WHERE ("is_active" = true);



CREATE INDEX "official_import_batches_council_status_idx" ON "public"."official_import_batches" USING "btree" ("council_id", "batch_status_code", "imported_at" DESC);



CREATE INDEX "official_import_rows_batch_review_idx" ON "public"."official_import_rows" USING "btree" ("batch_id", "review_status_code", "proposed_action_code");



CREATE INDEX "official_import_rows_member_number_idx" ON "public"."official_import_rows" USING "btree" ("council_id", "member_number") WHERE ("member_number" IS NOT NULL);



CREATE INDEX "official_member_records_council_status_idx" ON "public"."official_member_records" USING "btree" ("council_id", "official_membership_status_code");



CREATE UNIQUE INDEX "official_member_records_member_number_unique" ON "public"."official_member_records" USING "btree" ("member_number") WHERE ("member_number" IS NOT NULL);



CREATE UNIQUE INDEX "organization_admin_assignments_org_email_uidx" ON "public"."organization_admin_assignments" USING "btree" ("organization_id", "lower"("grantee_email")) WHERE (("is_active" = true) AND (NULLIF("btrim"(COALESCE("grantee_email", ''::"text")), ''::"text") IS NOT NULL));



CREATE INDEX "organization_admin_assignments_org_idx" ON "public"."organization_admin_assignments" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "organization_admin_assignments_org_person_uidx" ON "public"."organization_admin_assignments" USING "btree" ("organization_id", "person_id") WHERE (("is_active" = true) AND ("person_id" IS NOT NULL));



CREATE UNIQUE INDEX "organization_admin_assignments_org_user_uidx" ON "public"."organization_admin_assignments" USING "btree" ("organization_id", "user_id") WHERE (("is_active" = true) AND ("user_id" IS NOT NULL));



CREATE INDEX "organization_admin_assignments_person_idx" ON "public"."organization_admin_assignments" USING "btree" ("person_id") WHERE ("person_id" IS NOT NULL);



CREATE INDEX "organization_admin_assignments_user_idx" ON "public"."organization_admin_assignments" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "organization_admin_invitations_email_status_idx" ON "public"."organization_admin_invitations" USING "btree" ("invitee_email", "status_code", "created_at" DESC);



CREATE UNIQUE INDEX "organization_admin_invitations_one_pending_per_email_uidx" ON "public"."organization_admin_invitations" USING "btree" ("organization_id", "lower"("invitee_email")) WHERE ("status_code" = 'pending'::"text");



CREATE INDEX "organization_admin_invitations_org_status_idx" ON "public"."organization_admin_invitations" USING "btree" ("organization_id", "status_code", "created_at" DESC);



CREATE INDEX "organization_claim_requests_council_idx" ON "public"."organization_claim_requests" USING "btree" ("council_id");



CREATE INDEX "organization_claim_requests_org_idx" ON "public"."organization_claim_requests" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "organization_claim_requests_pending_org_user_uidx" ON "public"."organization_claim_requests" USING "btree" ("organization_id", "requested_by_auth_user_id") WHERE (("status_code" = 'pending'::"text") AND ("requested_by_auth_user_id" IS NOT NULL) AND ("organization_id" IS NOT NULL));



CREATE INDEX "organization_claim_requests_status_created_idx" ON "public"."organization_claim_requests" USING "btree" ("status_code", "created_at" DESC);



CREATE UNIQUE INDEX "organization_memberships_org_membership_number_uidx" ON "public"."organization_memberships" USING "btree" ("organization_id", "membership_number") WHERE ("membership_number" IS NOT NULL);



COMMENT ON INDEX "public"."organization_memberships_org_membership_number_uidx" IS 'Prevents the same membership number from being assigned to multiple people within one organization.';



CREATE UNIQUE INDEX "organization_memberships_org_person_primary_uidx" ON "public"."organization_memberships" USING "btree" ("organization_id", "person_id") WHERE ("is_primary_membership" IS TRUE);



COMMENT ON INDEX "public"."organization_memberships_org_person_primary_uidx" IS 'Belt-and-suspenders guard so a person cannot have multiple primary memberships within the same organization.';



CREATE UNIQUE INDEX "organization_memberships_org_person_uidx" ON "public"."organization_memberships" USING "btree" ("organization_id", "person_id");



COMMENT ON INDEX "public"."organization_memberships_org_person_uidx" IS 'Prevents duplicate membership rows for the same organization/person pair.';



CREATE INDEX "organization_memberships_organization_id_idx" ON "public"."organization_memberships" USING "btree" ("organization_id");



CREATE INDEX "organization_memberships_person_id_idx" ON "public"."organization_memberships" USING "btree" ("person_id");



CREATE INDEX "organization_relationships_from_org_idx" ON "public"."organization_relationships" USING "btree" ("from_organization_id");



CREATE INDEX "organization_relationships_to_org_idx" ON "public"."organization_relationships" USING "btree" ("to_organization_id");



CREATE INDEX "organizations_preferred_name_idx" ON "public"."organizations" USING "btree" ("preferred_name");



CREATE INDEX "people_active_member_lookup_idx" ON "public"."people" USING "btree" ("council_id", "primary_relationship_code", "archived_at", "merged_into_person_id");



CREATE INDEX "people_activity_idx" ON "public"."people" USING "btree" ("council_id", "council_activity_level_code") WHERE (("archived_at" IS NULL) AND ("merged_into_person_id" IS NULL));



CREATE INDEX "people_birth_date_hash_idx" ON "public"."people" USING "btree" ("birth_date_hash");



CREATE INDEX "people_cell_phone_hash_idx" ON "public"."people" USING "btree" ("cell_phone_hash");



CREATE INDEX "people_council_active_idx" ON "public"."people" USING "btree" ("council_id", "primary_relationship_code") WHERE (("archived_at" IS NULL) AND ("merged_into_person_id" IS NULL));



CREATE INDEX "people_council_birth_date_idx" ON "public"."people" USING "btree" ("council_id", "birth_date") WHERE (("birth_date" IS NOT NULL) AND ("archived_at" IS NULL) AND ("merged_into_person_id" IS NULL));



CREATE INDEX "people_council_cell_phone_idx" ON "public"."people" USING "btree" ("council_id", "cell_phone") WHERE ("cell_phone" IS NOT NULL);



CREATE INDEX "people_council_email_idx" ON "public"."people" USING "btree" ("council_id", "email") WHERE ("email" IS NOT NULL);



CREATE INDEX "people_council_name_idx" ON "public"."people" USING "btree" ("council_id", "last_name", "first_name") WHERE (("archived_at" IS NULL) AND ("merged_into_person_id" IS NULL));



CREATE INDEX "people_email_hash_idx" ON "public"."people" USING "btree" ("email_hash");



CREATE INDEX "people_prospect_idx" ON "public"."people" USING "btree" ("council_id", "prospect_status_code") WHERE (("primary_relationship_code" = 'prospect'::"text") AND ("archived_at" IS NULL) AND ("merged_into_person_id" IS NULL));



CREATE INDEX "people_reengagement_idx" ON "public"."people" USING "btree" ("council_id", "council_reengagement_status_code") WHERE (("archived_at" IS NULL) AND ("merged_into_person_id" IS NULL));



CREATE INDEX "people_volunteer_idx" ON "public"."people" USING "btree" ("council_id", "volunteer_context_code") WHERE (("primary_relationship_code" = 'volunteer_only'::"text") AND ("archived_at" IS NULL) AND ("merged_into_person_id" IS NULL));



CREATE UNIQUE INDEX "person_assignments_one_active_idx" ON "public"."person_assignments" USING "btree" ("person_id", "user_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "person_designations_person_idx" ON "public"."person_designations" USING "btree" ("council_id", "person_id", "fraternal_year");



CREATE INDEX "person_distinctions_person_idx" ON "public"."person_distinctions" USING "btree" ("council_id", "person_id");



CREATE INDEX "person_identities_email_hash_idx" ON "public"."person_identities" USING "btree" ("normalized_email_hash");



CREATE INDEX "person_identities_phone_hash_idx" ON "public"."person_identities" USING "btree" ("normalized_phone_hash");



CREATE INDEX "person_identities_primary_user_id_idx" ON "public"."person_identities" USING "btree" ("primary_user_id");



CREATE UNIQUE INDEX "person_identity_links_active_person_unique_idx" ON "public"."person_identity_links" USING "btree" ("person_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "person_identity_links_identity_id_idx" ON "public"."person_identity_links" USING "btree" ("person_identity_id");



CREATE INDEX "person_identity_links_person_id_idx" ON "public"."person_identity_links" USING "btree" ("person_id");



CREATE INDEX "person_notes_person_created_idx" ON "public"."person_notes" USING "btree" ("person_id", "created_at" DESC);



CREATE INDEX "person_officer_terms_local_unit_current_lookup_idx" ON "public"."person_officer_terms" USING "btree" ("local_unit_id", "service_end_year", "office_scope_code", "office_code", "service_start_year" DESC);



CREATE INDEX "person_officer_terms_local_unit_id_idx" ON "public"."person_officer_terms" USING "btree" ("local_unit_id");



CREATE INDEX "person_officer_terms_local_unit_office_idx" ON "public"."person_officer_terms" USING "btree" ("local_unit_id", "office_scope_code", "office_code", "office_rank");



CREATE INDEX "person_officer_terms_local_unit_person_idx" ON "public"."person_officer_terms" USING "btree" ("local_unit_id", "person_id");



CREATE INDEX "person_officer_terms_manual_end_effective_date_idx" ON "public"."person_officer_terms" USING "btree" ("manual_end_effective_date");



CREATE INDEX "person_officer_terms_person_idx" ON "public"."person_officer_terms" USING "btree" ("person_id", "service_start_year" DESC);



CREATE UNIQUE INDEX "person_profile_change_requests_one_pending_per_person_idx" ON "public"."person_profile_change_requests" USING "btree" ("person_id") WHERE ("status_code" = 'pending'::"text");



CREATE UNIQUE INDEX "person_profile_change_requests_one_pending_per_person_uidx" ON "public"."person_profile_change_requests" USING "btree" ("person_id") WHERE ("status_code" = 'pending'::"text");



CREATE INDEX "person_profile_change_requests_pending_idx" ON "public"."person_profile_change_requests" USING "btree" ("person_id", "status_code", "requested_at" DESC);



CREATE INDEX "person_profile_change_requests_person_id_idx" ON "public"."person_profile_change_requests" USING "btree" ("person_id");



CREATE INDEX "person_profile_change_requests_status_code_idx" ON "public"."person_profile_change_requests" USING "btree" ("status_code");



CREATE INDEX "public_registration_intakes_matched_person_id_idx" ON "public"."public_registration_intakes" USING "btree" ("matched_person_id");



CREATE UNIQUE INDEX "public_registration_intakes_normalized_email_key" ON "public"."public_registration_intakes" USING "btree" ("normalized_email");



CREATE UNIQUE INDEX "saint_aliases_alias_lower_uidx" ON "public"."saint_aliases" USING "btree" ("lower"("alias"));



CREATE INDEX "spiritual_content_items_kind_published_idx" ON "public"."spiritual_content_items" USING "btree" ("content_kind", "is_published", "is_active", "sort_order");



CREATE INDEX "spiritual_content_scopes_family_idx" ON "public"."spiritual_content_scopes" USING "btree" ("organization_family_id") WHERE ("organization_family_id" IS NOT NULL);



CREATE INDEX "spiritual_content_scopes_local_unit_idx" ON "public"."spiritual_content_scopes" USING "btree" ("local_unit_id") WHERE ("local_unit_id" IS NOT NULL);



CREATE UNIQUE INDEX "spiritual_topic_aliases_alias_lower_uidx" ON "public"."spiritual_topic_aliases" USING "btree" ("lower"("alias"));



CREATE INDEX "supreme_update_queue_open_idx" ON "public"."supreme_update_queue" USING "btree" ("council_id", "status_code", "created_at" DESC) WHERE ("status_code" = ANY (ARRAY['pending'::"text", 'dismissed'::"text"]));



CREATE UNIQUE INDEX "uq_area_access_grants_active_scope" ON "public"."area_access_grants" USING "btree" ("local_unit_id", "member_record_id", "area_code", "access_level", "source_code") WHERE ("revoked_at" IS NULL);



CREATE UNIQUE INDEX "uq_event_assignments_all_events" ON "public"."event_assignments" USING "btree" ("local_unit_id", "member_record_id", "assignment_scope") WHERE ("assignment_scope" = 'all_events'::"public"."event_assignment_scope_code");



CREATE UNIQUE INDEX "uq_event_assignments_event_kind" ON "public"."event_assignments" USING "btree" ("local_unit_id", "member_record_id", "legacy_event_kind_code") WHERE (("assignment_scope" = 'event_kind'::"public"."event_assignment_scope_code") AND ("legacy_event_kind_code" IS NOT NULL));



CREATE UNIQUE INDEX "uq_event_assignments_event_member_role_conflict" ON "public"."event_assignments" USING "btree" ("event_id", "member_record_id", "role_code");



CREATE UNIQUE INDEX "uq_event_assignments_scope_v2" ON "public"."event_assignments" USING "btree" ("event_id", "member_record_id", "role_code") WHERE ("event_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_event_assignments_specific_event" ON "public"."event_assignments" USING "btree" ("local_unit_id", "member_record_id", "event_id") WHERE (("assignment_scope" = 'event'::"public"."event_assignment_scope_code") AND ("event_id" IS NOT NULL));



CREATE UNIQUE INDEX "uq_event_invited_councils_internal_once" ON "public"."event_invited_councils" USING "btree" ("event_id", "invited_council_id") WHERE ("invited_council_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_event_invited_councils_one_host" ON "public"."event_invited_councils" USING "btree" ("event_id") WHERE ("is_host" = true);



CREATE UNIQUE INDEX "uq_local_role_definitions_code_per_unit" ON "public"."local_role_definitions" USING "btree" ("local_unit_id", "role_kind", "lower"("code")) WHERE ("code" IS NOT NULL);



CREATE UNIQUE INDEX "uq_member_records_local_unit_member_number" ON "public"."member_records" USING "btree" ("local_unit_id", "lower"("member_number")) WHERE ("member_number" IS NOT NULL);



CREATE UNIQUE INDEX "uq_resource_access_grants_active_scope" ON "public"."resource_access_grants" USING "btree" ("local_unit_id", "member_record_id", "resource_type", "resource_key", "access_level", "source_code") WHERE ("revoked_at" IS NULL);



CREATE UNIQUE INDEX "uq_user_unit_relationships_active_member_record" ON "public"."user_unit_relationships" USING "btree" ("member_record_id") WHERE (("member_record_id" IS NOT NULL) AND ("status" = 'active'::"public"."relationship_status"));



CREATE UNIQUE INDEX "uq_user_unit_relationships_active_user_local_unit" ON "public"."user_unit_relationships" USING "btree" ("user_id", "local_unit_id") WHERE ("status" = 'active'::"public"."relationship_status");



CREATE UNIQUE INDEX "uq_user_unit_relationships_primary_parish" ON "public"."user_unit_relationships" USING "btree" ("user_id") WHERE (("is_primary_parish" = true) AND ("status" = 'active'::"public"."relationship_status"));



CREATE UNIQUE INDEX "user_access_scopes_one_active_idx" ON "public"."user_access_scopes" USING "btree" ("user_id", "scope_code") WHERE ("ends_at" IS NULL);



CREATE INDEX "user_access_scopes_user_active_idx" ON "public"."user_access_scopes" USING "btree" ("council_id", "user_id", "scope_code", "ends_at");



CREATE UNIQUE INDEX "user_admin_grants_one_active_idx" ON "public"."user_admin_grants" USING "btree" ("user_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "user_saved_saints_user_saved_idx" ON "public"."user_saved_saints" USING "btree" ("user_id", "saved_at" DESC);



CREATE INDEX "user_spiritual_activity_user_created_idx" ON "public"."user_spiritual_activity" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "users_person_id_unique" ON "public"."users" USING "btree" ("person_id") WHERE ("person_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_member_records_one_active_local_unit_per_legacy_person" ON "public"."member_records" USING "btree" ("legacy_people_id") WHERE (("archived_at" IS NULL) AND ("legacy_people_id" IS NOT NULL));



CREATE OR REPLACE TRIGGER "area_access_grants_set_updated_at" BEFORE UPDATE ON "public"."area_access_grants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "brand_profiles_set_updated_at" BEFORE UPDATE ON "public"."brand_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "council_admin_assignments_sync_org_admin" AFTER INSERT OR UPDATE ON "public"."council_admin_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_org_admin_from_council_admin_assignment"();



CREATE OR REPLACE TRIGGER "council_admin_assignments_sync_parallel_admin_package" AFTER INSERT OR UPDATE ON "public"."council_admin_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_parallel_admin_package_from_council_admin_assignment"();



COMMENT ON TRIGGER "council_admin_assignments_sync_parallel_admin_package" ON "public"."council_admin_assignments" IS 'DEPRECATED COMPATIBILITY BRIDGE. Legacy writes should be blocked; retained only for emergency/manual admin use.';



CREATE OR REPLACE TRIGGER "councils_set_updated_at" BEFORE UPDATE ON "public"."councils" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "custom_lists_sync_local_unit_id_from_legacy_council" BEFORE INSERT OR UPDATE OF "council_id", "local_unit_id" ON "public"."custom_lists" FOR EACH ROW EXECUTE FUNCTION "public"."sync_local_unit_id_from_legacy_council"();



CREATE OR REPLACE TRIGGER "event_assignments_set_updated_at" BEFORE UPDATE ON "public"."event_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "event_person_rsvp_attendees_set_updated_at" BEFORE UPDATE ON "public"."event_person_rsvp_attendees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "event_person_rsvps_set_updated_at" BEFORE UPDATE ON "public"."event_person_rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "local_role_definitions_set_updated_at" BEFORE UPDATE ON "public"."local_role_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "local_unit_external_links_active_limit" BEFORE INSERT OR UPDATE OF "local_unit_id", "is_active" ON "public"."local_unit_external_links" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_local_unit_external_links_active_limit"();



CREATE OR REPLACE TRIGGER "local_unit_external_links_set_updated_at" BEFORE UPDATE ON "public"."local_unit_external_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "local_unit_message_routes_set_updated_at" BEFORE UPDATE ON "public"."local_unit_message_routes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "local_unit_people_set_updated_at" BEFORE UPDATE ON "public"."local_unit_people" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "local_unit_public_contact_message_jobs_set_updated_at" BEFORE UPDATE ON "public"."local_unit_public_contact_message_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "local_unit_public_gallery_images_active_limit" BEFORE INSERT OR UPDATE OF "local_unit_id", "is_active" ON "public"."local_unit_public_gallery_images" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_local_unit_public_gallery_images_active_limit"();



CREATE OR REPLACE TRIGGER "local_unit_public_gallery_images_set_updated_at" BEFORE UPDATE ON "public"."local_unit_public_gallery_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "local_units_set_updated_at" BEFORE UPDATE ON "public"."local_units" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "member_records_set_updated_at" BEFORE UPDATE ON "public"."member_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "member_records_sync_user_relationship_status" AFTER UPDATE OF "lifecycle_state" ON "public"."member_records" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_unit_relationship_status_from_member_record"();



CREATE OR REPLACE TRIGGER "membership_claim_requests_set_updated_at" BEFORE UPDATE ON "public"."membership_claim_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "official_import_batches_set_updated_at" BEFORE UPDATE ON "public"."official_import_batches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "official_import_rows_set_updated_at" BEFORE UPDATE ON "public"."official_import_rows" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "official_member_records_set_updated_at" BEFORE UPDATE ON "public"."official_member_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "organization_admin_assignments_sync_parallel_admin_package" AFTER INSERT OR UPDATE ON "public"."organization_admin_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_parallel_admin_package_from_org_admin_assignment"();



CREATE OR REPLACE TRIGGER "organization_admin_assignments_sync_parallel_area_grants" AFTER INSERT OR UPDATE ON "public"."organization_admin_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_parallel_area_grants_from_org_admin_assignment"();



CREATE OR REPLACE TRIGGER "organization_families_set_updated_at" BEFORE UPDATE ON "public"."organization_families" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "people_contact_change_log_trigger" AFTER UPDATE ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."log_person_contact_change"();



CREATE OR REPLACE TRIGGER "people_set_updated_at" BEFORE UPDATE ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "people_supreme_update_queue_trigger" AFTER UPDATE ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."queue_supreme_update_reminder"();



CREATE OR REPLACE TRIGGER "person_identities_set_updated_at" BEFORE UPDATE ON "public"."person_identities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "person_identity_links_set_updated_at" BEFORE UPDATE ON "public"."person_identity_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "person_notes_set_updated_at" BEFORE UPDATE ON "public"."person_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "resource_access_grants_set_updated_at" BEFORE UPDATE ON "public"."resource_access_grants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "role_assignments_set_updated_at" BEFORE UPDATE ON "public"."role_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_organization_admin_invitations_updated_at" BEFORE UPDATE ON "public"."organization_admin_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_person_profile_change_requests_updated_at" BEFORE UPDATE ON "public"."person_profile_change_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_person_profile_change_requests_updated_at"();



CREATE OR REPLACE TRIGGER "supreme_update_queue_set_updated_at" BEFORE UPDATE ON "public"."supreme_update_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "user_access_scopes_set_updated_at" BEFORE UPDATE ON "public"."user_access_scopes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "user_unit_relationships_set_updated_at" BEFORE UPDATE ON "public"."user_unit_relationships" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "users_set_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."area_access_grants"
    ADD CONSTRAINT "area_access_grants_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."area_access_grants"
    ADD CONSTRAINT "area_access_grants_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."area_access_grants"
    ADD CONSTRAINT "area_access_grants_member_record_id_fkey" FOREIGN KEY ("member_record_id") REFERENCES "public"."member_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."area_access_grants"
    ADD CONSTRAINT "area_access_grants_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_auth_user_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_profiles"
    ADD CONSTRAINT "brand_profiles_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_profiles"
    ADD CONSTRAINT "brand_profiles_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."catechism_topics"
    ADD CONSTRAINT "catechism_topics_catechism_reference_id_fkey" FOREIGN KEY ("catechism_reference_id") REFERENCES "public"."catechism_references"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catechism_topics"
    ADD CONSTRAINT "catechism_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."spiritual_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."council_admin_assignments"
    ADD CONSTRAINT "council_admin_assignments_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."council_admin_assignments"
    ADD CONSTRAINT "council_admin_assignments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."council_admin_assignments"
    ADD CONSTRAINT "council_admin_assignments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."council_admin_assignments"
    ADD CONSTRAINT "council_admin_assignments_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."council_admin_assignments"
    ADD CONSTRAINT "council_admin_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."councils"
    ADD CONSTRAINT "councils_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."custom_list_access"
    ADD CONSTRAINT "custom_list_access_custom_list_id_fkey" FOREIGN KEY ("custom_list_id") REFERENCES "public"."custom_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_list_access"
    ADD CONSTRAINT "custom_list_access_granted_by_auth_user_id_fkey" FOREIGN KEY ("granted_by_auth_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."custom_list_access"
    ADD CONSTRAINT "custom_list_access_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_list_access"
    ADD CONSTRAINT "custom_list_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_list_members"
    ADD CONSTRAINT "custom_list_members_added_by_auth_user_id_fkey" FOREIGN KEY ("added_by_auth_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."custom_list_members"
    ADD CONSTRAINT "custom_list_members_claimed_by_person_id_fkey" FOREIGN KEY ("claimed_by_person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_list_members"
    ADD CONSTRAINT "custom_list_members_custom_list_id_fkey" FOREIGN KEY ("custom_list_id") REFERENCES "public"."custom_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_list_members"
    ADD CONSTRAINT "custom_list_members_last_contact_by_person_id_fkey" FOREIGN KEY ("last_contact_by_person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_list_members"
    ADD CONSTRAINT "custom_list_members_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_lists"
    ADD CONSTRAINT "custom_lists_archived_by_auth_user_id_fkey" FOREIGN KEY ("archived_by_auth_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."custom_lists"
    ADD CONSTRAINT "custom_lists_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_lists"
    ADD CONSTRAINT "custom_lists_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."custom_lists"
    ADD CONSTRAINT "custom_lists_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."custom_lists"
    ADD CONSTRAINT "custom_lists_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_reading_entries"
    ADD CONSTRAINT "daily_reading_entries_scripture_passage_id_fkey" FOREIGN KEY ("scripture_passage_id") REFERENCES "public"."scripture_passages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_reading_entries"
    ADD CONSTRAINT "daily_reading_entries_spiritual_content_item_id_fkey" FOREIGN KEY ("spiritual_content_item_id") REFERENCES "public"."spiritual_content_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_archives"
    ADD CONSTRAINT "event_archives_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."event_archives"
    ADD CONSTRAINT "event_archives_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_member_record_id_fkey" FOREIGN KEY ("member_record_id") REFERENCES "public"."member_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "public"."event_assignment_roles"("code") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_council_rsvps"
    ADD CONSTRAINT "event_council_rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_council_rsvps"
    ADD CONSTRAINT "event_council_rsvps_event_invited_council_id_fkey" FOREIGN KEY ("event_invited_council_id") REFERENCES "public"."event_invited_councils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_external_invitees"
    ADD CONSTRAINT "event_external_invitees_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."event_external_invitees"
    ADD CONSTRAINT "event_external_invitees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_external_invitees"
    ADD CONSTRAINT "event_external_invitees_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."event_invited_councils"
    ADD CONSTRAINT "event_invited_councils_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_invited_councils"
    ADD CONSTRAINT "event_invited_councils_invited_council_id_fkey" FOREIGN KEY ("invited_council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."event_invited_councils"
    ADD CONSTRAINT "event_invited_councils_invited_council_type_code_fkey" FOREIGN KEY ("invited_council_type_code") REFERENCES "public"."event_invited_council_types"("code");



ALTER TABLE ONLY "public"."event_message_jobs"
    ADD CONSTRAINT "event_message_jobs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_message_jobs"
    ADD CONSTRAINT "event_message_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_message_jobs"
    ADD CONSTRAINT "event_message_jobs_event_invited_council_id_fkey" FOREIGN KEY ("event_invited_council_id") REFERENCES "public"."event_invited_councils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_message_jobs"
    ADD CONSTRAINT "event_message_jobs_message_type_code_fkey" FOREIGN KEY ("message_type_code") REFERENCES "public"."event_message_types"("code");



ALTER TABLE ONLY "public"."event_message_jobs"
    ADD CONSTRAINT "event_message_jobs_status_code_fkey" FOREIGN KEY ("status_code") REFERENCES "public"."event_message_status_types"("code");



ALTER TABLE ONLY "public"."event_person_rsvp_attendees"
    ADD CONSTRAINT "event_person_rsvp_attendees_event_person_rsvp_id_fkey" FOREIGN KEY ("event_person_rsvp_id") REFERENCES "public"."event_person_rsvps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_person_rsvp_attendees"
    ADD CONSTRAINT "event_person_rsvp_attendees_matched_person_id_fkey" FOREIGN KEY ("matched_person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_person_rsvps"
    ADD CONSTRAINT "event_person_rsvps_claimed_by_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_person_rsvps"
    ADD CONSTRAINT "event_person_rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_person_rsvps"
    ADD CONSTRAINT "event_person_rsvps_matched_person_id_fkey" FOREIGN KEY ("matched_person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_rsvp_volunteers"
    ADD CONSTRAINT "event_rsvp_volunteers_event_council_rsvp_id_fkey" FOREIGN KEY ("event_council_rsvp_id") REFERENCES "public"."event_council_rsvps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_rsvp_volunteers"
    ADD CONSTRAINT "event_rsvp_volunteers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_scope_code_fkey" FOREIGN KEY ("scope_code") REFERENCES "public"."event_scope_types"("code");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_status_code_fkey" FOREIGN KEY ("status_code") REFERENCES "public"."event_status_types"("code");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."legacy_fossil_resolutions"
    ADD CONSTRAINT "legacy_fossil_resolutions_resolved_by_auth_user_id_fkey" FOREIGN KEY ("resolved_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_role_definitions"
    ADD CONSTRAINT "local_role_definitions_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_role_definitions"
    ADD CONSTRAINT "local_role_definitions_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_role_definitions"
    ADD CONSTRAINT "local_role_definitions_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_unit_external_links"
    ADD CONSTRAINT "local_unit_external_links_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_unit_message_routes"
    ADD CONSTRAINT "local_unit_message_routes_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_unit_message_routes"
    ADD CONSTRAINT "local_unit_message_routes_recipient_person_id_fkey" FOREIGN KEY ("recipient_person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_unit_people"
    ADD CONSTRAINT "local_unit_people_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_unit_people"
    ADD CONSTRAINT "local_unit_people_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_unit_public_contact_message_jobs"
    ADD CONSTRAINT "local_unit_public_contact_message__cleared_by_auth_user_id_fkey" FOREIGN KEY ("cleared_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_unit_public_contact_message_jobs"
    ADD CONSTRAINT "local_unit_public_contact_message_jobs_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_unit_public_gallery_images"
    ADD CONSTRAINT "local_unit_public_gallery_images_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_unit_reporting_year_settings"
    ADD CONSTRAINT "local_unit_reporting_year_settings_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_unit_volunteer_hour_adjustments"
    ADD CONSTRAINT "local_unit_volunteer_hour_adjustments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_unit_volunteer_hour_adjustments"
    ADD CONSTRAINT "local_unit_volunteer_hour_adjustments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_unit_volunteer_hour_adjustments"
    ADD CONSTRAINT "local_unit_volunteer_hour_adjustments_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_unit_volunteer_hour_adjustments"
    ADD CONSTRAINT "local_unit_volunteer_hour_adjustments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."local_unit_volunteer_hour_adjustments"
    ADD CONSTRAINT "local_unit_volunteer_hour_adjustments_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_units"
    ADD CONSTRAINT "local_units_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_units"
    ADD CONSTRAINT "local_units_legacy_council_id_fkey" FOREIGN KEY ("legacy_council_id") REFERENCES "public"."councils"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_units"
    ADD CONSTRAINT "local_units_legacy_organization_id_fkey" FOREIGN KEY ("legacy_organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."local_units"
    ADD CONSTRAINT "local_units_organization_family_id_fkey" FOREIGN KEY ("organization_family_id") REFERENCES "public"."organization_families"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."local_units"
    ADD CONSTRAINT "local_units_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_records"
    ADD CONSTRAINT "member_records_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_records"
    ADD CONSTRAINT "member_records_legacy_council_id_fkey" FOREIGN KEY ("legacy_council_id") REFERENCES "public"."councils"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_records"
    ADD CONSTRAINT "member_records_legacy_people_id_fkey" FOREIGN KEY ("legacy_people_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_records"
    ADD CONSTRAINT "member_records_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."member_records"
    ADD CONSTRAINT "member_records_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."membership_claim_requests"
    ADD CONSTRAINT "membership_claim_requests_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."membership_claim_requests"
    ADD CONSTRAINT "membership_claim_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."membership_claim_requests"
    ADD CONSTRAINT "membership_claim_requests_reviewed_by_auth_user_id_fkey" FOREIGN KEY ("reviewed_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."migration_review_queue"
    ADD CONSTRAINT "migration_review_queue_resolved_by_auth_user_id_fkey" FOREIGN KEY ("resolved_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."officer_role_emails"
    ADD CONSTRAINT "officer_role_emails_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."official_import_batches"
    ADD CONSTRAINT "official_import_batches_batch_status_code_fkey" FOREIGN KEY ("batch_status_code") REFERENCES "public"."official_import_batch_status_types"("code");



ALTER TABLE ONLY "public"."official_import_batches"
    ADD CONSTRAINT "official_import_batches_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."official_import_batches"
    ADD CONSTRAINT "official_import_batches_uploaded_by_auth_user_id_fkey" FOREIGN KEY ("uploaded_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."official_import_rows"
    ADD CONSTRAINT "official_import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."official_import_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."official_import_rows"
    ADD CONSTRAINT "official_import_rows_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."official_import_rows"
    ADD CONSTRAINT "official_import_rows_matched_official_member_record_id_fkey" FOREIGN KEY ("matched_official_member_record_id") REFERENCES "public"."official_member_records"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."official_import_rows"
    ADD CONSTRAINT "official_import_rows_matched_person_id_fkey" FOREIGN KEY ("matched_person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."official_import_rows"
    ADD CONSTRAINT "official_import_rows_proposed_action_code_fkey" FOREIGN KEY ("proposed_action_code") REFERENCES "public"."official_import_row_action_types"("code");



ALTER TABLE ONLY "public"."official_import_rows"
    ADD CONSTRAINT "official_import_rows_review_status_code_fkey" FOREIGN KEY ("review_status_code") REFERENCES "public"."official_import_review_status_types"("code");



ALTER TABLE ONLY "public"."official_import_rows"
    ADD CONSTRAINT "official_import_rows_reviewed_by_auth_user_id_fkey" FOREIGN KEY ("reviewed_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."official_member_records"
    ADD CONSTRAINT "official_member_records_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."official_member_records"
    ADD CONSTRAINT "official_member_records_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."official_member_records"
    ADD CONSTRAINT "official_member_records_official_membership_status_code_fkey" FOREIGN KEY ("official_membership_status_code") REFERENCES "public"."official_membership_status_types"("code");



ALTER TABLE ONLY "public"."official_member_records"
    ADD CONSTRAINT "official_member_records_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."official_member_records"
    ADD CONSTRAINT "official_member_records_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignment_organization_claim_request_i_fkey" FOREIGN KEY ("organization_claim_request_id") REFERENCES "public"."organization_claim_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_accepted_assignment_id_fkey" FOREIGN KEY ("accepted_assignment_id") REFERENCES "public"."organization_admin_assignments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_accepted_by_auth_user_id_fkey" FOREIGN KEY ("accepted_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_invited_by_auth_user_id_fkey" FOREIGN KEY ("invited_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_revoked_by_auth_user_id_fkey" FOREIGN KEY ("revoked_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_invitations"
    ADD CONSTRAINT "organization_admin_invitations_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_claim_requests"
    ADD CONSTRAINT "organization_claim_requests_approved_assignment_id_fkey" FOREIGN KEY ("approved_assignment_id") REFERENCES "public"."organization_admin_assignments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_claim_requests"
    ADD CONSTRAINT "organization_claim_requests_claimant_person_id_fkey" FOREIGN KEY ("requested_by_person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_claim_requests"
    ADD CONSTRAINT "organization_claim_requests_claimant_user_id_fkey" FOREIGN KEY ("requested_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_claim_requests"
    ADD CONSTRAINT "organization_claim_requests_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_claim_requests"
    ADD CONSTRAINT "organization_claim_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_claim_requests"
    ADD CONSTRAINT "organization_claim_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_claim_requests"
    ADD CONSTRAINT "organization_claim_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_claim_requests"
    ADD CONSTRAINT "organization_claim_requests_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_families"
    ADD CONSTRAINT "organization_families_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_families"
    ADD CONSTRAINT "organization_families_legacy_organization_id_fkey" FOREIGN KEY ("legacy_organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_families"
    ADD CONSTRAINT "organization_families_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_kofc_profiles"
    ADD CONSTRAINT "organization_kofc_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_membership_status_code_fkey" FOREIGN KEY ("membership_status_code") REFERENCES "public"."organization_membership_status_types"("code");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_relationships"
    ADD CONSTRAINT "organization_relationships_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_relationships"
    ADD CONSTRAINT "organization_relationships_from_organization_id_fkey" FOREIGN KEY ("from_organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_relationships"
    ADD CONSTRAINT "organization_relationships_relationship_type_code_fkey" FOREIGN KEY ("relationship_type_code") REFERENCES "public"."organization_relationship_type_types"("code");



ALTER TABLE ONLY "public"."organization_relationships"
    ADD CONSTRAINT "organization_relationships_to_organization_id_fkey" FOREIGN KEY ("to_organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_relationships"
    ADD CONSTRAINT "organization_relationships_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_organization_type_code_fkey" FOREIGN KEY ("organization_type_code") REFERENCES "public"."organization_type_types"("code");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_archived_by_auth_user_id_fkey" FOREIGN KEY ("archived_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_council_activity_context_code_fkey" FOREIGN KEY ("council_activity_context_code") REFERENCES "public"."council_activity_context_types"("code");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_council_activity_level_code_fkey" FOREIGN KEY ("council_activity_level_code") REFERENCES "public"."council_activity_level_types"("code");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_council_reengagement_status_code_fkey" FOREIGN KEY ("council_reengagement_status_code") REFERENCES "public"."council_reengagement_status_types"("code");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_created_source_code_fkey" FOREIGN KEY ("created_source_code") REFERENCES "public"."person_source_types"("code");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_merged_into_person_id_fkey" FOREIGN KEY ("merged_into_person_id") REFERENCES "public"."people"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_primary_relationship_code_fkey" FOREIGN KEY ("primary_relationship_code") REFERENCES "public"."primary_relationship_types"("code");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_prospect_status_code_fkey" FOREIGN KEY ("prospect_status_code") REFERENCES "public"."prospect_status_types"("code");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_volunteer_context_code_fkey" FOREIGN KEY ("volunteer_context_code") REFERENCES "public"."volunteer_context_types"("code");



ALTER TABLE ONLY "public"."person_assignments"
    ADD CONSTRAINT "person_assignments_assigned_by_auth_user_id_fkey" FOREIGN KEY ("assigned_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."person_assignments"
    ADD CONSTRAINT "person_assignments_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."person_assignments"
    ADD CONSTRAINT "person_assignments_ended_by_auth_user_id_fkey" FOREIGN KEY ("ended_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."person_assignments"
    ADD CONSTRAINT "person_assignments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_assignments"
    ADD CONSTRAINT "person_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_contact_change_log"
    ADD CONSTRAINT "person_contact_change_log_changed_by_auth_user_id_fkey" FOREIGN KEY ("changed_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."person_contact_change_log"
    ADD CONSTRAINT "person_contact_change_log_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."person_contact_change_log"
    ADD CONSTRAINT "person_contact_change_log_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_designations"
    ADD CONSTRAINT "person_designations_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."person_designations"
    ADD CONSTRAINT "person_designations_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."person_designations"
    ADD CONSTRAINT "person_designations_designation_code_fkey" FOREIGN KEY ("designation_code") REFERENCES "public"."designation_types"("code");



ALTER TABLE ONLY "public"."person_designations"
    ADD CONSTRAINT "person_designations_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_distinctions"
    ADD CONSTRAINT "person_distinctions_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."person_distinctions"
    ADD CONSTRAINT "person_distinctions_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."person_distinctions"
    ADD CONSTRAINT "person_distinctions_distinction_code_fkey" FOREIGN KEY ("distinction_code") REFERENCES "public"."distinction_types"("code");



ALTER TABLE ONLY "public"."person_distinctions"
    ADD CONSTRAINT "person_distinctions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_identities"
    ADD CONSTRAINT "person_identities_primary_user_id_fkey" FOREIGN KEY ("primary_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."person_identity_links"
    ADD CONSTRAINT "person_identity_links_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_identity_links"
    ADD CONSTRAINT "person_identity_links_person_identity_id_fkey" FOREIGN KEY ("person_identity_id") REFERENCES "public"."person_identities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_kofc_profiles"
    ADD CONSTRAINT "person_kofc_profiles_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_merges"
    ADD CONSTRAINT "person_merges_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."person_merges"
    ADD CONSTRAINT "person_merges_merged_by_auth_user_id_fkey" FOREIGN KEY ("merged_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."person_merges"
    ADD CONSTRAINT "person_merges_source_person_id_fkey" FOREIGN KEY ("source_person_id") REFERENCES "public"."people"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."person_merges"
    ADD CONSTRAINT "person_merges_target_person_id_fkey" FOREIGN KEY ("target_person_id") REFERENCES "public"."people"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."person_notes"
    ADD CONSTRAINT "person_notes_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."person_notes"
    ADD CONSTRAINT "person_notes_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."person_notes"
    ADD CONSTRAINT "person_notes_note_type_code_fkey" FOREIGN KEY ("note_type_code") REFERENCES "public"."note_types"("code");



ALTER TABLE ONLY "public"."person_notes"
    ADD CONSTRAINT "person_notes_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_notes"
    ADD CONSTRAINT "person_notes_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."person_officer_terms"
    ADD CONSTRAINT "person_officer_terms_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."person_officer_terms"
    ADD CONSTRAINT "person_officer_terms_ended_by_auth_user_id_fkey" FOREIGN KEY ("ended_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."person_officer_terms"
    ADD CONSTRAINT "person_officer_terms_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."person_officer_terms"
    ADD CONSTRAINT "person_officer_terms_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_officer_terms"
    ADD CONSTRAINT "person_officer_terms_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."person_profile_change_requests"
    ADD CONSTRAINT "person_profile_change_requests_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_profile_change_requests"
    ADD CONSTRAINT "person_profile_change_requests_requested_by_auth_user_id_fkey" FOREIGN KEY ("requested_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_profile_change_requests"
    ADD CONSTRAINT "person_profile_change_requests_reviewed_by_auth_user_id_fkey" FOREIGN KEY ("reviewed_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."public_registration_intakes"
    ADD CONSTRAINT "public_registration_intakes_matched_person_id_fkey" FOREIGN KEY ("matched_person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."resource_access_grants"
    ADD CONSTRAINT "resource_access_grants_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."resource_access_grants"
    ADD CONSTRAINT "resource_access_grants_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_access_grants"
    ADD CONSTRAINT "resource_access_grants_member_record_id_fkey" FOREIGN KEY ("member_record_id") REFERENCES "public"."member_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_access_grants"
    ADD CONSTRAINT "resource_access_grants_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_assignments"
    ADD CONSTRAINT "role_assignments_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_assignments"
    ADD CONSTRAINT "role_assignments_local_role_definition_id_fkey" FOREIGN KEY ("local_role_definition_id") REFERENCES "public"."local_role_definitions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."role_assignments"
    ADD CONSTRAINT "role_assignments_member_record_id_fkey" FOREIGN KEY ("member_record_id") REFERENCES "public"."member_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_assignments"
    ADD CONSTRAINT "role_assignments_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."saint_aliases"
    ADD CONSTRAINT "saint_aliases_saint_id_fkey" FOREIGN KEY ("saint_id") REFERENCES "public"."saints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saint_topics"
    ADD CONSTRAINT "saint_topics_saint_id_fkey" FOREIGN KEY ("saint_id") REFERENCES "public"."saints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saint_topics"
    ADD CONSTRAINT "saint_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."spiritual_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scripture_topics"
    ADD CONSTRAINT "scripture_topics_scripture_passage_id_fkey" FOREIGN KEY ("scripture_passage_id") REFERENCES "public"."scripture_passages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scripture_topics"
    ADD CONSTRAINT "scripture_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."spiritual_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_content_relationships"
    ADD CONSTRAINT "spiritual_content_relationships_child_content_item_id_fkey" FOREIGN KEY ("child_content_item_id") REFERENCES "public"."spiritual_content_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_content_relationships"
    ADD CONSTRAINT "spiritual_content_relationships_parent_content_item_id_fkey" FOREIGN KEY ("parent_content_item_id") REFERENCES "public"."spiritual_content_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_content_saints"
    ADD CONSTRAINT "spiritual_content_saints_saint_id_fkey" FOREIGN KEY ("saint_id") REFERENCES "public"."saints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_content_saints"
    ADD CONSTRAINT "spiritual_content_saints_spiritual_content_item_id_fkey" FOREIGN KEY ("spiritual_content_item_id") REFERENCES "public"."spiritual_content_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_content_scopes"
    ADD CONSTRAINT "spiritual_content_scopes_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_content_scopes"
    ADD CONSTRAINT "spiritual_content_scopes_organization_family_id_fkey" FOREIGN KEY ("organization_family_id") REFERENCES "public"."organization_families"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_content_scopes"
    ADD CONSTRAINT "spiritual_content_scopes_spiritual_content_item_id_fkey" FOREIGN KEY ("spiritual_content_item_id") REFERENCES "public"."spiritual_content_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_content_topics"
    ADD CONSTRAINT "spiritual_content_topics_spiritual_content_item_id_fkey" FOREIGN KEY ("spiritual_content_item_id") REFERENCES "public"."spiritual_content_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_content_topics"
    ADD CONSTRAINT "spiritual_content_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."spiritual_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_topic_aliases"
    ADD CONSTRAINT "spiritual_topic_aliases_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."spiritual_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supreme_update_queue"
    ADD CONSTRAINT "supreme_update_queue_cleared_by_auth_user_id_fkey" FOREIGN KEY ("cleared_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supreme_update_queue"
    ADD CONSTRAINT "supreme_update_queue_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supreme_update_queue"
    ADD CONSTRAINT "supreme_update_queue_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supreme_update_queue"
    ADD CONSTRAINT "supreme_update_queue_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supreme_update_queue"
    ADD CONSTRAINT "supreme_update_queue_status_code_fkey" FOREIGN KEY ("status_code") REFERENCES "public"."supreme_update_status_types"("code");



ALTER TABLE ONLY "public"."user_access_scopes"
    ADD CONSTRAINT "user_access_scopes_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_access_scopes"
    ADD CONSTRAINT "user_access_scopes_granted_by_auth_user_id_fkey" FOREIGN KEY ("granted_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_access_scopes"
    ADD CONSTRAINT "user_access_scopes_scope_code_fkey" FOREIGN KEY ("scope_code") REFERENCES "public"."access_scope_types"("code");



ALTER TABLE ONLY "public"."user_access_scopes"
    ADD CONSTRAINT "user_access_scopes_source_designation_code_fkey" FOREIGN KEY ("source_designation_code") REFERENCES "public"."designation_types"("code");



ALTER TABLE ONLY "public"."user_access_scopes"
    ADD CONSTRAINT "user_access_scopes_source_type_code_fkey" FOREIGN KEY ("source_type_code") REFERENCES "public"."access_scope_source_types"("code");



ALTER TABLE ONLY "public"."user_access_scopes"
    ADD CONSTRAINT "user_access_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_admin_grants"
    ADD CONSTRAINT "user_admin_grants_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_admin_grants"
    ADD CONSTRAINT "user_admin_grants_granted_by_auth_user_id_fkey" FOREIGN KEY ("granted_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_admin_grants"
    ADD CONSTRAINT "user_admin_grants_revoked_by_auth_user_id_fkey" FOREIGN KEY ("revoked_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_admin_grants"
    ADD CONSTRAINT "user_admin_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_saints"
    ADD CONSTRAINT "user_saved_saints_saint_id_fkey" FOREIGN KEY ("saint_id") REFERENCES "public"."saints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_saints"
    ADD CONSTRAINT "user_saved_saints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_spiritual_items"
    ADD CONSTRAINT "user_saved_spiritual_items_spiritual_content_item_id_fkey" FOREIGN KEY ("spiritual_content_item_id") REFERENCES "public"."spiritual_content_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_spiritual_items"
    ADD CONSTRAINT "user_saved_spiritual_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_spiritual_activity"
    ADD CONSTRAINT "user_spiritual_activity_daily_reading_entry_id_fkey" FOREIGN KEY ("daily_reading_entry_id") REFERENCES "public"."daily_reading_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_spiritual_activity"
    ADD CONSTRAINT "user_spiritual_activity_spiritual_content_item_id_fkey" FOREIGN KEY ("spiritual_content_item_id") REFERENCES "public"."spiritual_content_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_spiritual_activity"
    ADD CONSTRAINT "user_spiritual_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_unit_relationships"
    ADD CONSTRAINT "user_unit_relationships_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_unit_relationships"
    ADD CONSTRAINT "user_unit_relationships_local_unit_id_fkey" FOREIGN KEY ("local_unit_id") REFERENCES "public"."local_units"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_unit_relationships"
    ADD CONSTRAINT "user_unit_relationships_member_record_id_fkey" FOREIGN KEY ("member_record_id") REFERENCES "public"."member_records"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_unit_relationships"
    ADD CONSTRAINT "user_unit_relationships_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_unit_relationships"
    ADD CONSTRAINT "user_unit_relationships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE "public"."access_scope_source_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."access_scope_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."area_access_grants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "area_access_grants_parallel_insert" ON "public"."area_access_grants" FOR INSERT TO "authenticated" WITH CHECK ("public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level"));



CREATE POLICY "area_access_grants_parallel_select" ON "public"."area_access_grants" FOR SELECT TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR (EXISTS ( SELECT 1
   FROM "public"."user_unit_relationships" "uur"
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("uur"."member_record_id" = "area_access_grants"."member_record_id") AND ("uur"."local_unit_id" = "area_access_grants"."local_unit_id") AND ("uur"."status" = 'active'::"public"."relationship_status"))))));



CREATE POLICY "area_access_grants_parallel_update" ON "public"."area_access_grants" FOR UPDATE TO "authenticated" USING ("public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level")) WITH CHECK ("public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level"));



CREATE POLICY "area_access_grants_select_admin_or_self" ON "public"."area_access_grants" FOR SELECT TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR (EXISTS ( SELECT 1
   FROM "public"."user_unit_relationships" "uur"
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("uur"."member_record_id" = "area_access_grants"."member_record_id") AND ("uur"."local_unit_id" = "area_access_grants"."local_unit_id"))))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_select_manageable_local_unit" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "audit_log"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."brand_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_profiles_select_accessible_local_unit" ON "public"."brand_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."organizations" "o"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_organization_id" = "o"."id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("o"."brand_profile_id" = "brand_profiles"."id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true)))));



ALTER TABLE "public"."catechism_references" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catechism_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."council_activity_context_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."council_activity_level_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."council_admin_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "council_admin_assignments_delete_admin_only" ON "public"."council_admin_assignments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."local_units" "lu"
  WHERE (("lu"."legacy_council_id" = "council_admin_assignments"."council_id") AND "public"."auth_has_area_access"("lu"."id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level")))));



CREATE POLICY "council_admin_assignments_insert_admin_only" ON "public"."council_admin_assignments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."local_units" "lu"
  WHERE (("lu"."legacy_council_id" = "council_admin_assignments"."council_id") AND "public"."auth_has_area_access"("lu"."id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level")))));



CREATE POLICY "council_admin_assignments_legacy_delete_block" ON "public"."council_admin_assignments" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "council_admin_assignments_legacy_insert_block" ON "public"."council_admin_assignments" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "council_admin_assignments_legacy_read" ON "public"."council_admin_assignments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "council_admin_assignments_legacy_update_block" ON "public"."council_admin_assignments" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "council_admin_assignments_select_same_council" ON "public"."council_admin_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."local_units" "lu"
  WHERE (("lu"."legacy_council_id" = "council_admin_assignments"."council_id") AND "public"."auth_has_area_access"("lu"."id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level")))));



CREATE POLICY "council_admin_assignments_update_admin_only" ON "public"."council_admin_assignments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."local_units" "lu"
  WHERE (("lu"."legacy_council_id" = "council_admin_assignments"."council_id") AND "public"."auth_has_area_access"("lu"."id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."local_units" "lu"
  WHERE (("lu"."legacy_council_id" = "council_admin_assignments"."council_id") AND "public"."auth_has_area_access"("lu"."id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."council_reengagement_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."councils" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "councils_select_accessible_local_unit" ON "public"."councils" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "councils"."id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true)))));



CREATE POLICY "councils_update_admin" ON "public"."councils" FOR UPDATE USING ("app"."user_is_council_admin"("id")) WITH CHECK ("app"."user_is_council_admin"("id"));



ALTER TABLE "public"."custom_list_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "custom_list_access_legacy_delete_block" ON "public"."custom_list_access" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "custom_list_access_legacy_insert_block" ON "public"."custom_list_access" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "custom_list_access_legacy_read" ON "public"."custom_list_access" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "custom_list_access_legacy_update_block" ON "public"."custom_list_access" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."custom_list_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_lists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "custom_lists_parallel_delete" ON "public"."custom_lists" FOR DELETE TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'custom_lists'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR "public"."auth_has_resource_access"("local_unit_id", 'custom_list'::"public"."resource_type_code", ("id")::"text", 'manage'::"public"."area_access_level")));



CREATE POLICY "custom_lists_parallel_insert" ON "public"."custom_lists" FOR INSERT TO "authenticated" WITH CHECK ("public"."auth_has_area_access"("local_unit_id", 'custom_lists'::"public"."member_area_code", 'manage'::"public"."area_access_level"));



CREATE POLICY "custom_lists_parallel_select" ON "public"."custom_lists" FOR SELECT TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'custom_lists'::"public"."member_area_code", 'interact'::"public"."area_access_level") OR "public"."auth_has_resource_access"("local_unit_id", 'custom_list'::"public"."resource_type_code", ("id")::"text", 'interact'::"public"."area_access_level")));



CREATE POLICY "custom_lists_parallel_update" ON "public"."custom_lists" FOR UPDATE TO "authenticated" USING ("public"."auth_has_area_access"("local_unit_id", 'custom_lists'::"public"."member_area_code", 'manage'::"public"."area_access_level")) WITH CHECK ("public"."auth_has_area_access"("local_unit_id", 'custom_lists'::"public"."member_area_code", 'manage'::"public"."area_access_level"));



ALTER TABLE "public"."designation_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."distinction_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_archives" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_archives_delete_event_managers" ON "public"."event_archives" FOR DELETE TO "authenticated" USING ((("local_unit_id" IS NOT NULL) AND "public"."auth_has_area_access"("local_unit_id", 'events'::"public"."member_area_code", 'manage'::"public"."area_access_level")));



CREATE POLICY "event_archives_select_event_managers" ON "public"."event_archives" FOR SELECT TO "authenticated" USING ((("local_unit_id" IS NOT NULL) AND "public"."auth_has_area_access"("local_unit_id", 'events'::"public"."member_area_code", 'manage'::"public"."area_access_level")));



ALTER TABLE "public"."event_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_assignments_parallel_select" ON "public"."event_assignments" FOR SELECT TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'events'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR "public"."auth_has_event_management_access"(COALESCE("event_id", '00000000-0000-0000-0000-000000000000'::"uuid")) OR (EXISTS ( SELECT 1
   FROM "public"."user_unit_relationships" "uur"
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("uur"."member_record_id" = "event_assignments"."member_record_id") AND ("uur"."local_unit_id" = "event_assignments"."local_unit_id") AND ("uur"."status" = 'active'::"public"."relationship_status"))))));



CREATE POLICY "event_assignments_select_event_managers_or_self" ON "public"."event_assignments" FOR SELECT TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'events'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR (EXISTS ( SELECT 1
   FROM "public"."user_unit_relationships" "uur"
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("uur"."member_record_id" = "event_assignments"."member_record_id") AND ("uur"."local_unit_id" = "event_assignments"."local_unit_id"))))));



ALTER TABLE "public"."event_council_rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_external_invitees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_external_invitees_delete_manageable_event" ON "public"."event_external_invitees" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_external_invitees"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_external_invitees_insert_manageable_event" ON "public"."event_external_invitees" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_external_invitees"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_external_invitees_select_manageable_event" ON "public"."event_external_invitees" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_external_invitees"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_external_invitees_update_manageable_event" ON "public"."event_external_invitees" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_external_invitees"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_external_invitees"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



ALTER TABLE "public"."event_invited_council_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_invited_councils" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_invited_councils_delete_manageable_event" ON "public"."event_invited_councils" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invited_councils"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_invited_councils_insert_manageable_event" ON "public"."event_invited_councils" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invited_councils"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_invited_councils_select_manageable_event" ON "public"."event_invited_councils" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invited_councils"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_invited_councils_update_manageable_event" ON "public"."event_invited_councils" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invited_councils"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invited_councils"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



ALTER TABLE "public"."event_message_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_message_jobs_delete_manageable_event" ON "public"."event_message_jobs" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_message_jobs"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_message_jobs_insert_manageable_event" ON "public"."event_message_jobs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_message_jobs"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_message_jobs_select_manageable_event" ON "public"."event_message_jobs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_message_jobs"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_message_jobs_update_manageable_event" ON "public"."event_message_jobs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_message_jobs"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_message_jobs"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



ALTER TABLE "public"."event_message_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_message_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_person_rsvp_attendees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_person_rsvp_attendees_delete_manageable_event" ON "public"."event_person_rsvp_attendees" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."event_person_rsvps" "pr"
     JOIN "public"."events" "e" ON (("e"."id" = "pr"."event_id")))
  WHERE (("pr"."id" = "event_person_rsvp_attendees"."event_person_rsvp_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_person_rsvp_attendees_insert_manageable_event" ON "public"."event_person_rsvp_attendees" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."event_person_rsvps" "pr"
     JOIN "public"."events" "e" ON (("e"."id" = "pr"."event_id")))
  WHERE (("pr"."id" = "event_person_rsvp_attendees"."event_person_rsvp_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_person_rsvp_attendees_select_manageable_event" ON "public"."event_person_rsvp_attendees" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."event_person_rsvps" "pr"
     JOIN "public"."events" "e" ON (("e"."id" = "pr"."event_id")))
  WHERE (("pr"."id" = "event_person_rsvp_attendees"."event_person_rsvp_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_person_rsvp_attendees_update_manageable_event" ON "public"."event_person_rsvp_attendees" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."event_person_rsvps" "pr"
     JOIN "public"."events" "e" ON (("e"."id" = "pr"."event_id")))
  WHERE (("pr"."id" = "event_person_rsvp_attendees"."event_person_rsvp_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."event_person_rsvps" "pr"
     JOIN "public"."events" "e" ON (("e"."id" = "pr"."event_id")))
  WHERE (("pr"."id" = "event_person_rsvp_attendees"."event_person_rsvp_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



ALTER TABLE "public"."event_person_rsvps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_person_rsvps_delete_manageable_event" ON "public"."event_person_rsvps" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_person_rsvps"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_person_rsvps_insert_manageable_event" ON "public"."event_person_rsvps" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_person_rsvps"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_person_rsvps_select_manageable_event" ON "public"."event_person_rsvps" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_person_rsvps"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



CREATE POLICY "event_person_rsvps_update_manageable_event" ON "public"."event_person_rsvps" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_person_rsvps"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_person_rsvps"."event_id") AND "public"."has_event_management_access"("auth"."uid"(), "e"."id")))));



ALTER TABLE "public"."event_rsvp_volunteers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_scope_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_delete_manageable" ON "public"."events" FOR DELETE TO "authenticated" USING ("public"."has_event_management_access"("auth"."uid"(), "id"));



CREATE POLICY "events_insert_manageable_local_unit" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK ((("local_unit_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."v_effective_area_access" "access"
  WHERE (("access"."user_id" = "auth"."uid"()) AND ("access"."local_unit_id" = "events"."local_unit_id") AND ("access"."area_code" = 'events'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level") AND ("access"."is_effective" = true))))));



CREATE POLICY "events_parallel_insert" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK ("public"."auth_has_area_access"("local_unit_id", 'events'::"public"."member_area_code", 'manage'::"public"."area_access_level"));



CREATE POLICY "events_parallel_select" ON "public"."events" FOR SELECT TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'events'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR "public"."auth_has_event_management_access"("id")));



CREATE POLICY "events_parallel_update" ON "public"."events" FOR UPDATE TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'events'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR "public"."auth_has_event_management_access"("id"))) WITH CHECK (("public"."auth_has_area_access"("local_unit_id", 'events'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR "public"."auth_has_event_management_access"("id")));



CREATE POLICY "events_select_manageable" ON "public"."events" FOR SELECT TO "authenticated" USING ("public"."has_event_management_access"("auth"."uid"(), "id"));



CREATE POLICY "events_update_manageable" ON "public"."events" FOR UPDATE TO "authenticated" USING ("public"."has_event_management_access"("auth"."uid"(), "id")) WITH CHECK ((("local_unit_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."v_effective_area_access" "access"
  WHERE (("access"."user_id" = "auth"."uid"()) AND ("access"."local_unit_id" = "events"."local_unit_id") AND ("access"."area_code" = 'events'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level") AND ("access"."is_effective" = true))))));



ALTER TABLE "public"."local_role_definitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "local_role_definitions_select_members_or_self" ON "public"."local_role_definitions" FOR SELECT TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'members'::"public"."member_area_code", 'read_only'::"public"."area_access_level") OR (EXISTS ( SELECT 1
   FROM "public"."user_unit_relationships" "uur"
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("uur"."local_unit_id" = "local_role_definitions"."local_unit_id"))))));



ALTER TABLE "public"."local_unit_reporting_year_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."local_unit_volunteer_hour_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."local_units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "local_units_select_related" ON "public"."local_units" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_unit_relationships" "uur"
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("uur"."local_unit_id" = "local_units"."id")))));



ALTER TABLE "public"."member_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_records_parallel_select" ON "public"."member_records" FOR SELECT TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'members'::"public"."member_area_code", 'edit_manage'::"public"."area_access_level") OR (EXISTS ( SELECT 1
   FROM "public"."user_unit_relationships" "uur"
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("uur"."member_record_id" = "member_records"."id") AND ("uur"."local_unit_id" = "member_records"."local_unit_id") AND ("uur"."status" = 'active'::"public"."relationship_status"))))));



CREATE POLICY "member_records_select_admin_or_self" ON "public"."member_records" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_unit_relationships" "uur"
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("uur"."member_record_id" = "member_records"."id")))) OR "public"."auth_has_area_access"("local_unit_id", 'members'::"public"."member_area_code", 'read_only'::"public"."area_access_level")));



ALTER TABLE "public"."membership_claim_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membership_claim_requests_select_claims_or_requester" ON "public"."membership_claim_requests" FOR SELECT TO "authenticated" USING ((("requester_user_id" = "auth"."uid"()) OR "public"."auth_has_area_access"("local_unit_id", 'claims'::"public"."member_area_code", 'manage'::"public"."area_access_level")));



ALTER TABLE "public"."note_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."officer_role_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."official_import_batch_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."official_import_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "official_import_batches_manageable_local_unit" ON "public"."official_import_batches" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "official_import_batches"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "official_import_batches"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."official_import_review_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."official_import_row_action_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."official_import_rows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "official_import_rows_manageable_local_unit" ON "public"."official_import_rows" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "official_import_rows"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "official_import_rows"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."official_member_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "official_member_records_select_manageable_local_unit" ON "public"."official_member_records" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "official_member_records"."person_id") AND ("p"."council_id" = "official_member_records"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



CREATE POLICY "official_member_records_write_manageable_local_unit" ON "public"."official_member_records" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "official_member_records"."person_id") AND ("p"."council_id" = "official_member_records"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "official_member_records"."person_id") AND ("p"."council_id" = "official_member_records"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."official_membership_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_admin_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_admin_assignments_legacy_delete_block" ON "public"."organization_admin_assignments" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "organization_admin_assignments_legacy_insert_block" ON "public"."organization_admin_assignments" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "organization_admin_assignments_legacy_read" ON "public"."organization_admin_assignments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "organization_admin_assignments_legacy_update_block" ON "public"."organization_admin_assignments" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."organization_kofc_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_membership_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_relationship_type_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_type_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_select_accessible_local_unit" ON "public"."organizations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_organization_id" = "organizations"."id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true)))));



ALTER TABLE "public"."people" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "people_insert_allowed" ON "public"."people" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."v_effective_area_access" "v"
  WHERE (("v"."user_id" = "auth"."uid"()) AND ("v"."area_code" = 'members'::"public"."member_area_code") AND ("v"."is_effective" = true) AND ("v"."access_level" = ANY (ARRAY['edit_manage'::"public"."area_access_level", 'manage'::"public"."area_access_level"]))))));



CREATE POLICY "people_select_accessible" ON "public"."people" FOR SELECT TO "authenticated" USING ((("merged_into_person_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."member_records" "mr"
     JOIN "public"."v_effective_area_access" "v" ON ((("v"."local_unit_id" = "mr"."local_unit_id") AND ("v"."area_code" = 'members'::"public"."member_area_code") AND ("v"."is_effective" = true))))
  WHERE (("mr"."legacy_people_id" = "people"."id") AND ("mr"."lifecycle_state" <> 'archived'::"public"."member_record_lifecycle_state") AND ("v"."user_id" = "auth"."uid"()))))));



CREATE POLICY "people_update_admin_only" ON "public"."people" FOR UPDATE TO "authenticated" USING ("public"."auth_can_manage_person"("id")) WITH CHECK ("public"."auth_can_manage_person"("id"));



ALTER TABLE "public"."person_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_assignments_select_accessible" ON "public"."person_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."member_records" "mr"
     JOIN "public"."v_effective_area_access" "v" ON ((("v"."local_unit_id" = "mr"."local_unit_id") AND ("v"."area_code" = 'members'::"public"."member_area_code") AND ("v"."is_effective" = true))))
  WHERE (("mr"."legacy_people_id" = "person_assignments"."person_id") AND ("mr"."lifecycle_state" <> 'archived'::"public"."member_record_lifecycle_state") AND ("v"."user_id" = "auth"."uid"())))));



CREATE POLICY "person_assignments_write_admin_only" ON "public"."person_assignments" TO "authenticated" USING ("public"."auth_can_manage_person_assignments"("person_id")) WITH CHECK ("public"."auth_can_manage_person_assignments"("person_id"));



ALTER TABLE "public"."person_contact_change_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_contact_change_log_insert_accessible_local_unit" ON "public"."person_contact_change_log" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "person_contact_change_log"."person_id") AND ("p"."council_id" = "person_contact_change_log"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("app"."user_can_access_person"("person_contact_change_log"."person_id") OR (("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = ANY (ARRAY['edit_manage'::"public"."area_access_level", 'manage'::"public"."area_access_level"]))))))));



CREATE POLICY "person_contact_change_log_select_manageable_local_unit" ON "public"."person_contact_change_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "person_contact_change_log"."person_id") AND ("p"."council_id" = "person_contact_change_log"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."person_designations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_designations_select_accessible_local_unit" ON "public"."person_designations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "person_designations"."person_id") AND ("p"."council_id" = "person_designations"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("app"."user_can_access_person"("person_designations"."person_id") OR (("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = ANY (ARRAY['read_only'::"public"."area_access_level", 'edit_manage'::"public"."area_access_level", 'manage'::"public"."area_access_level"]))))))));



CREATE POLICY "person_designations_write_manageable_local_unit" ON "public"."person_designations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "person_designations"."person_id") AND ("p"."council_id" = "person_designations"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "person_designations"."person_id") AND ("p"."council_id" = "person_designations"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."person_distinctions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_distinctions_select_accessible_local_unit" ON "public"."person_distinctions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "person_distinctions"."person_id") AND ("p"."council_id" = "person_distinctions"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("app"."user_can_access_person"("person_distinctions"."person_id") OR (("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = ANY (ARRAY['read_only'::"public"."area_access_level", 'edit_manage'::"public"."area_access_level", 'manage'::"public"."area_access_level"]))))))));



CREATE POLICY "person_distinctions_write_manageable_local_unit" ON "public"."person_distinctions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "person_distinctions"."person_id") AND ("p"."council_id" = "person_distinctions"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "person_distinctions"."person_id") AND ("p"."council_id" = "person_distinctions"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."person_kofc_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."person_merges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_merges_manageable_local_unit" ON "public"."person_merges" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "person_merges"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
     JOIN "public"."people" "source_person" ON (("source_person"."id" = "person_merges"."source_person_id")))
     JOIN "public"."people" "target_person" ON (("target_person"."id" = "person_merges"."target_person_id")))
  WHERE (("lu"."legacy_council_id" = "person_merges"."council_id") AND ("source_person"."council_id" = "person_merges"."council_id") AND ("target_person"."council_id" = "person_merges"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."person_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_notes_delete_admin_only" ON "public"."person_notes" FOR DELETE TO "authenticated" USING ("public"."auth_can_manage_person_notes"("person_id"));



CREATE POLICY "person_notes_insert_accessible" ON "public"."person_notes" FOR INSERT TO "authenticated" WITH CHECK ((("created_by_auth_user_id" = "auth"."uid"()) AND "app"."user_can_access_person"("person_id")));



CREATE POLICY "person_notes_select_accessible" ON "public"."person_notes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."member_records" "mr"
     JOIN "public"."v_effective_area_access" "v" ON ((("v"."local_unit_id" = "mr"."local_unit_id") AND ("v"."area_code" = 'members'::"public"."member_area_code") AND ("v"."is_effective" = true))))
  WHERE (("mr"."legacy_people_id" = "person_notes"."person_id") AND ("mr"."lifecycle_state" <> 'archived'::"public"."member_record_lifecycle_state") AND ("v"."user_id" = "auth"."uid"())))));



CREATE POLICY "person_notes_update_creator_or_admin" ON "public"."person_notes" FOR UPDATE TO "authenticated" USING (((("created_by_auth_user_id" = "auth"."uid"()) AND "app"."user_can_access_person"("person_id")) OR "public"."auth_can_manage_person_notes"("person_id"))) WITH CHECK (((("created_by_auth_user_id" = "auth"."uid"()) AND "app"."user_can_access_person"("person_id")) OR "public"."auth_can_manage_person_notes"("person_id")));



ALTER TABLE "public"."person_officer_terms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_officer_terms_delete_manageable_local_unit" ON "public"."person_officer_terms" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."v_effective_area_access" "access"
  WHERE (("access"."local_unit_id" = "person_officer_terms"."local_unit_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



CREATE POLICY "person_officer_terms_insert_manageable_local_unit" ON "public"."person_officer_terms" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."v_effective_area_access" "access"
  WHERE (("access"."local_unit_id" = "person_officer_terms"."local_unit_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



CREATE POLICY "person_officer_terms_select_accessible_local_unit" ON "public"."person_officer_terms" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."v_effective_area_access" "access"
  WHERE (("access"."local_unit_id" = "person_officer_terms"."local_unit_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("app"."user_can_access_person"("person_officer_terms"."person_id") OR (("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))))));



CREATE POLICY "person_officer_terms_update_manageable_local_unit" ON "public"."person_officer_terms" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."v_effective_area_access" "access"
  WHERE (("access"."local_unit_id" = "person_officer_terms"."local_unit_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."v_effective_area_access" "access"
  WHERE (("access"."local_unit_id" = "person_officer_terms"."local_unit_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."person_profile_change_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."person_source_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."primary_relationship_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prospect_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_registration_intakes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read catechism references" ON "public"."catechism_references" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read catechism topics" ON "public"."catechism_topics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read published spiritual content items" ON "public"."spiritual_content_items" FOR SELECT TO "authenticated" USING (("is_published" = true));



CREATE POLICY "read saint aliases" ON "public"."saint_aliases" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read saint topics" ON "public"."saint_topics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read saints" ON "public"."saints" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read scripture passages" ON "public"."scripture_passages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read scripture topics" ON "public"."scripture_topics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read spiritual content relationships" ON "public"."spiritual_content_relationships" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read spiritual content scopes" ON "public"."spiritual_content_scopes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read spiritual content topics" ON "public"."spiritual_content_topics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read spiritual topic aliases" ON "public"."spiritual_topic_aliases" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read spiritual topics" ON "public"."spiritual_topics" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."resource_access_grants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resource_access_grants_parallel_insert" ON "public"."resource_access_grants" FOR INSERT TO "authenticated" WITH CHECK (("public"."auth_has_area_access"("local_unit_id", 'custom_lists'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR "public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level")));



CREATE POLICY "resource_access_grants_parallel_select" ON "public"."resource_access_grants" FOR SELECT TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'custom_lists'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR "public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR (EXISTS ( SELECT 1
   FROM "public"."user_unit_relationships" "uur"
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("uur"."member_record_id" = "resource_access_grants"."member_record_id") AND ("uur"."local_unit_id" = "resource_access_grants"."local_unit_id") AND ("uur"."status" = 'active'::"public"."relationship_status"))))));



CREATE POLICY "resource_access_grants_parallel_update" ON "public"."resource_access_grants" FOR UPDATE TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'custom_lists'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR "public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level"))) WITH CHECK (("public"."auth_has_area_access"("local_unit_id", 'custom_lists'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR "public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level")));



CREATE POLICY "resource_access_grants_select_admin_or_self" ON "public"."resource_access_grants" FOR SELECT TO "authenticated" USING (("public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level") OR (EXISTS ( SELECT 1
   FROM "public"."user_unit_relationships" "uur"
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("uur"."member_record_id" = "resource_access_grants"."member_record_id") AND ("uur"."local_unit_id" = "resource_access_grants"."local_unit_id"))))));



ALTER TABLE "public"."role_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role_assignments_select_members_or_self" ON "public"."role_assignments" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."member_records" "mr"
     JOIN "public"."user_unit_relationships" "uur" ON (("uur"."member_record_id" = "mr"."id")))
  WHERE (("uur"."user_id" = "auth"."uid"()) AND ("mr"."id" = "role_assignments"."member_record_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."member_records" "mr"
  WHERE (("mr"."id" = "role_assignments"."member_record_id") AND "public"."auth_has_area_access"("mr"."local_unit_id", 'members'::"public"."member_area_code", 'read_only'::"public"."area_access_level"))))));



ALTER TABLE "public"."saint_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saint_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scripture_passages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scripture_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spiritual_content_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spiritual_content_relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spiritual_content_scopes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spiritual_content_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spiritual_topic_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spiritual_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supreme_update_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supreme_update_queue_manageable_local_unit" ON "public"."supreme_update_queue" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "supreme_update_queue"."person_id") AND ("p"."council_id" = "supreme_update_queue"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."people" "p"
     JOIN "public"."local_units" "lu" ON (("lu"."legacy_council_id" = "p"."council_id")))
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("p"."id" = "supreme_update_queue"."person_id") AND ("p"."council_id" = "supreme_update_queue"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."supreme_update_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_access_scopes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_access_scopes_select_self_or_manageable_local_unit" ON "public"."user_access_scopes" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "user_access_scopes"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))));



CREATE POLICY "user_access_scopes_write_manageable_local_unit" ON "public"."user_access_scopes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "user_access_scopes"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "user_access_scopes"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."user_admin_grants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_admin_grants_manageable_local_unit" ON "public"."user_admin_grants" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "user_admin_grants"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "user_admin_grants"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."user_unit_relationships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_unit_relationships_parallel_select" ON "public"."user_unit_relationships" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."auth_has_area_access"("local_unit_id", 'members'::"public"."member_area_code", 'edit_manage'::"public"."area_access_level") OR "public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level")));



CREATE POLICY "user_unit_relationships_select_self_or_admin" ON "public"."user_unit_relationships" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."auth_has_area_access"("local_unit_id", 'admins'::"public"."member_area_code", 'manage'::"public"."area_access_level")));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_self_or_manageable_local_unit" ON "public"."users" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "users"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))));



CREATE POLICY "users_write_manageable_local_unit" ON "public"."users" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "users"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."local_units" "lu"
     JOIN "public"."v_effective_area_access" "access" ON (("access"."local_unit_id" = "lu"."id")))
  WHERE (("lu"."legacy_council_id" = "users"."council_id") AND ("access"."user_id" = "auth"."uid"()) AND ("access"."is_effective" = true) AND ("access"."area_code" = 'members'::"public"."member_area_code") AND ("access"."access_level" = 'manage'::"public"."area_access_level")))));



ALTER TABLE "public"."volunteer_context_types" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "app" TO "authenticated";
GRANT USAGE ON SCHEMA "app" TO "service_role";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";









GRANT ALL ON FUNCTION "app"."add_person_note"("p_person_id" "uuid", "p_note_type_code" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."add_person_note"("p_person_id" "uuid", "p_note_type_code" "text", "p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."archive_person"("p_person_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."archive_person"("p_person_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."assign_person"("p_person_id" "uuid", "p_user_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."assign_person"("p_person_id" "uuid", "p_user_id" "uuid", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "app"."create_prospect_for_local_unit"("p_local_unit_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_prospect_status_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."create_prospect_for_local_unit"("p_local_unit_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_prospect_status_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "app"."create_volunteer_only_for_local_unit"("p_local_unit_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_volunteer_context_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."create_volunteer_only_for_local_unit"("p_local_unit_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_volunteer_context_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."end_person_assignment"("p_assignment_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."end_person_assignment"("p_assignment_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."find_person_identity_id"("p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."find_person_identity_id_for_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."fraternal_year_label"("p_start_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "app"."fraternal_year_label"("p_start_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "app"."fraternal_year_start"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "app"."fraternal_year_start"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "app"."list_accessible_member_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."list_accessible_member_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "app"."list_active_people_for_identity"("p_person_identity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."update_member_local_fields"("p_person_id" "uuid", "p_council_activity_level_code" "text", "p_council_activity_context_code" "text", "p_council_reengagement_status_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."update_member_local_fields"("p_person_id" "uuid", "p_council_activity_level_code" "text", "p_council_activity_context_code" "text", "p_council_reengagement_status_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."update_nonmember_contact_fields"("p_person_id" "uuid", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_address_line_1" "text", "p_address_line_2" "text", "p_city" "text", "p_state_province" "text", "p_postal_code" "text", "p_country_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."update_nonmember_contact_fields"("p_person_id" "uuid", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_address_line_1" "text", "p_address_line_2" "text", "p_city" "text", "p_state_province" "text", "p_postal_code" "text", "p_country_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_can_access_local_person"("p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_can_access_local_person_as_user"("p_user_id" "uuid", "p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_can_access_person"("p_person_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."user_can_access_person"("p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_can_access_person_as_user"("p_user_id" "uuid", "p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_has_scope"("p_council_id" "uuid", "p_scope_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."user_has_scope"("p_council_id" "uuid", "p_scope_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_has_scope_for_user"("p_user_id" "uuid", "p_council_id" "uuid", "p_scope_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_is_council_admin"("p_council_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."user_is_council_admin"("p_council_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_is_council_admin_for_user"("p_user_id" "uuid", "p_council_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_is_local_unit_admin"("p_local_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."write_audit_log"("p_council_id" "uuid", "p_entity_table" "text", "p_entity_id" "uuid", "p_action_code" "text", "p_payload" "jsonb") TO "service_role";






















































































































































































































































REVOKE ALL ON FUNCTION "public"."apply_supreme_import_row"("p_local_unit_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid", "p_council_number" "text", "p_title" "text", "p_first_name" "text", "p_middle_name" "text", "p_last_name" "text", "p_suffix" "text", "p_email" "text", "p_email_hash" "text", "p_cell_phone" "text", "p_cell_phone_hash" "text", "p_address_line_1" "text", "p_address_line_1_hash" "text", "p_city" "text", "p_city_hash" "text", "p_state_province" "text", "p_state_province_hash" "text", "p_postal_code" "text", "p_postal_code_hash" "text", "p_birth_date" "date", "p_birth_date_hash" "text", "p_pii_key_version" "text", "p_council_activity_level_code" "text", "p_member_number" "text", "p_first_degree_date" "date", "p_second_degree_date" "date", "p_third_degree_date" "date", "p_years_in_service" integer, "p_member_type" "text", "p_member_class" "text", "p_assembly_number" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_supreme_import_row"("p_local_unit_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid", "p_council_number" "text", "p_title" "text", "p_first_name" "text", "p_middle_name" "text", "p_last_name" "text", "p_suffix" "text", "p_email" "text", "p_email_hash" "text", "p_cell_phone" "text", "p_cell_phone_hash" "text", "p_address_line_1" "text", "p_address_line_1_hash" "text", "p_city" "text", "p_city_hash" "text", "p_state_province" "text", "p_state_province_hash" "text", "p_postal_code" "text", "p_postal_code_hash" "text", "p_birth_date" "date", "p_birth_date_hash" "text", "p_pii_key_version" "text", "p_council_activity_level_code" "text", "p_member_number" "text", "p_first_degree_date" "date", "p_second_degree_date" "date", "p_third_degree_date" "date", "p_years_in_service" integer, "p_member_type" "text", "p_member_class" "text", "p_assembly_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_membership_claim_request_to_admin_package"("p_actor_user_id" "uuid", "p_claim_request_id" "uuid", "p_target_user_id" "uuid", "p_source_code" "public"."grant_source_code") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_membership_claim_request_to_admin_package"("p_actor_user_id" "uuid", "p_claim_request_id" "uuid", "p_target_user_id" "uuid", "p_source_code" "public"."grant_source_code") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_membership_claim_request_to_admin_package"("p_actor_user_id" "uuid", "p_claim_request_id" "uuid", "p_target_user_id" "uuid", "p_source_code" "public"."grant_source_code") TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_accessible_custom_lists"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_accessible_custom_lists"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_accessible_custom_lists"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_accessible_local_units_for_area"("p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_accessible_local_units_for_area"("p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_accessible_local_units_for_area"("p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_can_manage_person"("p_person_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_can_manage_person"("p_person_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_can_manage_person"("p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_can_manage_person_assignments"("p_person_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_can_manage_person_assignments"("p_person_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_can_manage_person_assignments"("p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_can_manage_person_notes"("p_person_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_can_manage_person_notes"("p_person_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_can_manage_person_notes"("p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_has_area_access"("p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_has_area_access"("p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_has_area_access"("p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_has_event_management_access"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_has_event_management_access"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_has_event_management_access"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_has_event_management_access"("p_local_unit_id" "uuid", "p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_has_event_management_access"("p_local_unit_id" "uuid", "p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_has_event_management_access"("p_local_unit_id" "uuid", "p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_has_resource_access"("p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_has_resource_access"("p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_has_resource_access"("p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_manageable_event_ids"("p_local_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_manageable_event_ids"("p_local_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_manageable_event_ids"("p_local_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_missing_parallel_admin_packages"("p_actor_user_id" "uuid", "p_source_code" "public"."grant_source_code") TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_missing_parallel_admin_packages"("p_actor_user_id" "uuid", "p_source_code" "public"."grant_source_code") TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_missing_parallel_admin_packages"("p_actor_user_id" "uuid", "p_source_code" "public"."grant_source_code") TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_missing_parallel_custom_list_grants"("p_actor_user_id" "uuid", "p_source_code" "public"."grant_source_code") TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_missing_parallel_custom_list_grants"("p_actor_user_id" "uuid", "p_source_code" "public"."grant_source_code") TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_missing_parallel_custom_list_grants"("p_actor_user_id" "uuid", "p_source_code" "public"."grant_source_code") TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_missing_parallel_event_managers"("p_actor_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_missing_parallel_event_managers"("p_actor_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_missing_parallel_event_managers"("p_actor_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_parallel_invite_package_subject"("p_target_user_id" "uuid", "p_local_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_parallel_invite_package_subject"("p_target_user_id" "uuid", "p_local_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_parallel_invite_package_subject"("p_target_user_id" "uuid", "p_local_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_council_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_council_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_council_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_local_unit_external_links_active_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_local_unit_external_links_active_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_local_unit_external_links_active_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_local_unit_public_gallery_images_active_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_local_unit_public_gallery_images_active_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_local_unit_public_gallery_images_active_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_member_record_for_person_local_unit"("p_local_unit_id" "uuid", "p_person_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_member_record_for_person_local_unit"("p_local_unit_id" "uuid", "p_person_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_member_record_for_person_local_unit"("p_local_unit_id" "uuid", "p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_parallel_member_for_user_and_local_unit"("p_user_id" "uuid", "p_local_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_parallel_member_for_user_and_local_unit"("p_user_id" "uuid", "p_local_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_parallel_member_for_user_and_local_unit"("p_user_id" "uuid", "p_local_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_parallel_membership_for_org_admin_assignment"("p_assignment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_parallel_membership_for_org_admin_assignment"("p_assignment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_parallel_membership_for_org_admin_assignment"("p_assignment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_user_unit_relationship_for_user_member"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_member_record_id" "uuid", "p_is_active" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_user_unit_relationship_for_user_member"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_member_record_id" "uuid", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_user_unit_relationship_for_user_member"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_member_record_id" "uuid", "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_rsvp_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_rsvp_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_rsvp_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_parallel_admin_package_to_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_local_unit_id" "uuid", "p_source_code" "public"."grant_source_code", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_parallel_admin_package_to_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_local_unit_id" "uuid", "p_source_code" "public"."grant_source_code", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_parallel_admin_package_to_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_local_unit_id" "uuid", "p_source_code" "public"."grant_source_code", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_parallel_custom_list_access_to_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_custom_list_id" "uuid", "p_access_level" "public"."area_access_level", "p_source_code" "public"."grant_source_code") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_parallel_custom_list_access_to_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_custom_list_id" "uuid", "p_access_level" "public"."area_access_level", "p_source_code" "public"."grant_source_code") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_parallel_custom_list_access_to_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_custom_list_id" "uuid", "p_access_level" "public"."area_access_level", "p_source_code" "public"."grant_source_code") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_area_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "anon";
GRANT ALL ON FUNCTION "public"."has_area_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_area_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_event_management_access"("p_user_id" "uuid", "p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_event_management_access"("p_user_id" "uuid", "p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_event_management_access"("p_user_id" "uuid", "p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_event_management_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_event_management_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_event_management_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_resource_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") TO "anon";
GRANT ALL ON FUNCTION "public"."has_resource_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_resource_access"("p_user_id" "uuid", "p_local_unit_id" "uuid", "p_resource_type" "public"."resource_type_code", "p_resource_key" "text", "p_min_access_level" "public"."area_access_level") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_accessible_custom_lists_for_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_accessible_custom_lists_for_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_accessible_custom_lists_for_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_accessible_local_units_for_area"("p_user_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "anon";
GRANT ALL ON FUNCTION "public"."list_accessible_local_units_for_area"("p_user_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_accessible_local_units_for_area"("p_user_id" "uuid", "p_area_code" "public"."member_area_code", "p_min_access_level" "public"."area_access_level") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_manageable_event_ids_for_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_manageable_event_ids_for_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_manageable_event_ids_for_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_manageable_event_ids_for_user"("p_user_id" "uuid", "p_local_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_manageable_event_ids_for_user"("p_user_id" "uuid", "p_local_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_manageable_event_ids_for_user"("p_user_id" "uuid", "p_local_unit_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_super_admin_preview_local_units"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_super_admin_preview_local_units"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_person_contact_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_person_contact_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_person_contact_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."parallel_grant_source_rank"("p_source" "public"."grant_source_code") TO "anon";
GRANT ALL ON FUNCTION "public"."parallel_grant_source_rank"("p_source" "public"."grant_source_code") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parallel_grant_source_rank"("p_source" "public"."grant_source_code") TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_supreme_update_reminder"() TO "anon";
GRANT ALL ON FUNCTION "public"."queue_supreme_update_reminder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_supreme_update_reminder"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_membership_claim_request_in_parallel"("p_actor_user_id" "uuid", "p_claim_request_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_membership_claim_request_in_parallel"("p_actor_user_id" "uuid", "p_claim_request_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_membership_claim_request_in_parallel"("p_actor_user_id" "uuid", "p_claim_request_id" "uuid", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_local_unit_member_record"("p_local_unit_id" "uuid", "p_person_id" "uuid", "p_actor_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_parallel_admin_package_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_local_unit_id" "uuid", "p_source_code" "public"."grant_source_code", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_parallel_admin_package_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_local_unit_id" "uuid", "p_source_code" "public"."grant_source_code", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_parallel_admin_package_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_local_unit_id" "uuid", "p_source_code" "public"."grant_source_code", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_parallel_custom_list_access_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_custom_list_id" "uuid", "p_source_code" "public"."grant_source_code") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_parallel_custom_list_access_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_custom_list_id" "uuid", "p_source_code" "public"."grant_source_code") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_parallel_custom_list_access_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_custom_list_id" "uuid", "p_source_code" "public"."grant_source_code") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_parallel_event_assignment_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_event_id" "uuid", "p_role_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_parallel_event_assignment_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_event_id" "uuid", "p_role_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_parallel_event_assignment_from_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_event_id" "uuid", "p_role_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_person_profile_change_requests_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_person_profile_change_requests_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_person_profile_change_requests_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_local_unit_id_from_legacy_council"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_local_unit_id_from_legacy_council"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_local_unit_id_from_legacy_council"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_organization_admin_assignment_from_council_admin_assignmen"("p_council_assignment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_organization_admin_assignment_from_council_admin_assignmen"("p_council_assignment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_parallel_admin_package_from_council_admin_assignment"("p_assignment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_parallel_admin_package_from_council_admin_assignment"("p_assignment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_parallel_admin_package_from_council_admin_assignment"("p_assignment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_parallel_admin_package_from_org_admin_assignment"("p_assignment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_parallel_admin_package_from_org_admin_assignment"("p_assignment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_parallel_admin_package_from_org_admin_assignment"("p_assignment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_parallel_area_grants_from_org_admin_assignment"("p_assignment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_parallel_area_grants_from_org_admin_assignment"("p_assignment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_parallel_area_grants_from_org_admin_assignment"("p_assignment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_user_unit_relationship_status_from_member_record"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_user_unit_relationship_status_from_member_record"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_sync_org_admin_from_council_admin_assignment"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_sync_org_admin_from_council_admin_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_sync_parallel_admin_package_from_council_admin_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_sync_parallel_admin_package_from_council_admin_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_sync_parallel_admin_package_from_council_admin_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_sync_parallel_admin_package_from_org_admin_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_sync_parallel_admin_package_from_org_admin_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_sync_parallel_admin_package_from_org_admin_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_sync_parallel_area_grants_from_org_admin_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_sync_parallel_area_grants_from_org_admin_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_sync_parallel_area_grants_from_org_admin_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_parallel_admin_package_for_member"("p_local_unit_id" "uuid", "p_member_record_id" "uuid", "p_source_code" "public"."grant_source_code", "p_is_active" boolean, "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_parallel_admin_package_for_member"("p_local_unit_id" "uuid", "p_member_record_id" "uuid", "p_source_code" "public"."grant_source_code", "p_is_active" boolean, "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_parallel_admin_package_for_member"("p_local_unit_id" "uuid", "p_member_record_id" "uuid", "p_source_code" "public"."grant_source_code", "p_is_active" boolean, "p_created_at" timestamp with time zone, "p_updated_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_parallel_event_assignment_for_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_event_id" "uuid", "p_role_code" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_parallel_event_assignment_for_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_event_id" "uuid", "p_role_code" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_parallel_event_assignment_for_user"("p_actor_user_id" "uuid", "p_target_user_id" "uuid", "p_event_id" "uuid", "p_role_code" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_belongs_to_council"("target_council_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_belongs_to_council"("target_council_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_belongs_to_council"("target_council_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_access_event"("event_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_access_event"("event_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_access_event"("event_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_manage_event"("event_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_manage_event"("event_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_manage_event"("event_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_council_admin"("target_council_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_council_admin"("target_council_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_council_admin"("target_council_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."_archive_council_admin_assignments" TO "anon";
GRANT ALL ON TABLE "public"."_archive_council_admin_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."_archive_council_admin_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."_archive_custom_list_access" TO "anon";
GRANT ALL ON TABLE "public"."_archive_custom_list_access" TO "authenticated";
GRANT ALL ON TABLE "public"."_archive_custom_list_access" TO "service_role";



GRANT ALL ON TABLE "public"."_archive_organization_admin_assignments" TO "anon";
GRANT ALL ON TABLE "public"."_archive_organization_admin_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."_archive_organization_admin_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."access_scope_source_types" TO "anon";
GRANT ALL ON TABLE "public"."access_scope_source_types" TO "authenticated";
GRANT ALL ON TABLE "public"."access_scope_source_types" TO "service_role";



GRANT ALL ON TABLE "public"."access_scope_types" TO "anon";
GRANT ALL ON TABLE "public"."access_scope_types" TO "authenticated";
GRANT ALL ON TABLE "public"."access_scope_types" TO "service_role";



GRANT ALL ON TABLE "public"."area_access_grants" TO "anon";
GRANT ALL ON TABLE "public"."area_access_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."area_access_grants" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brand_profiles" TO "anon";
GRANT ALL ON TABLE "public"."brand_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."catechism_references" TO "anon";
GRANT ALL ON TABLE "public"."catechism_references" TO "authenticated";
GRANT ALL ON TABLE "public"."catechism_references" TO "service_role";



GRANT ALL ON TABLE "public"."catechism_topics" TO "anon";
GRANT ALL ON TABLE "public"."catechism_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."catechism_topics" TO "service_role";



GRANT ALL ON TABLE "public"."council_activity_context_types" TO "anon";
GRANT ALL ON TABLE "public"."council_activity_context_types" TO "authenticated";
GRANT ALL ON TABLE "public"."council_activity_context_types" TO "service_role";



GRANT ALL ON TABLE "public"."council_activity_level_types" TO "anon";
GRANT ALL ON TABLE "public"."council_activity_level_types" TO "authenticated";
GRANT ALL ON TABLE "public"."council_activity_level_types" TO "service_role";



GRANT ALL ON TABLE "public"."council_admin_assignments" TO "anon";
GRANT ALL ON TABLE "public"."council_admin_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."council_admin_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."council_reengagement_status_types" TO "anon";
GRANT ALL ON TABLE "public"."council_reengagement_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."council_reengagement_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."councils" TO "anon";
GRANT ALL ON TABLE "public"."councils" TO "authenticated";
GRANT ALL ON TABLE "public"."councils" TO "service_role";



GRANT ALL ON TABLE "public"."custom_list_access" TO "anon";
GRANT ALL ON TABLE "public"."custom_list_access" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_list_access" TO "service_role";



GRANT ALL ON TABLE "public"."custom_list_members" TO "anon";
GRANT ALL ON TABLE "public"."custom_list_members" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_list_members" TO "service_role";



GRANT ALL ON TABLE "public"."custom_lists" TO "anon";
GRANT ALL ON TABLE "public"."custom_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_lists" TO "service_role";



GRANT ALL ON TABLE "public"."daily_reading_entries" TO "anon";
GRANT ALL ON TABLE "public"."daily_reading_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_reading_entries" TO "service_role";



GRANT ALL ON TABLE "public"."designation_types" TO "anon";
GRANT ALL ON TABLE "public"."designation_types" TO "authenticated";
GRANT ALL ON TABLE "public"."designation_types" TO "service_role";



GRANT ALL ON TABLE "public"."distinction_types" TO "anon";
GRANT ALL ON TABLE "public"."distinction_types" TO "authenticated";
GRANT ALL ON TABLE "public"."distinction_types" TO "service_role";



GRANT ALL ON TABLE "public"."event_archives" TO "anon";
GRANT ALL ON TABLE "public"."event_archives" TO "authenticated";
GRANT ALL ON TABLE "public"."event_archives" TO "service_role";



GRANT ALL ON TABLE "public"."event_assignment_roles" TO "anon";
GRANT ALL ON TABLE "public"."event_assignment_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."event_assignment_roles" TO "service_role";



GRANT ALL ON TABLE "public"."event_assignments" TO "anon";
GRANT ALL ON TABLE "public"."event_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."event_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."event_council_rsvps" TO "anon";
GRANT ALL ON TABLE "public"."event_council_rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."event_council_rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."event_invited_councils" TO "anon";
GRANT ALL ON TABLE "public"."event_invited_councils" TO "authenticated";
GRANT ALL ON TABLE "public"."event_invited_councils" TO "service_role";



GRANT ALL ON TABLE "public"."event_rsvp_volunteers" TO "anon";
GRANT ALL ON TABLE "public"."event_rsvp_volunteers" TO "authenticated";
GRANT ALL ON TABLE "public"."event_rsvp_volunteers" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."event_council_rsvp_rollups" TO "service_role";



GRANT ALL ON TABLE "public"."event_external_invitees" TO "anon";
GRANT ALL ON TABLE "public"."event_external_invitees" TO "authenticated";
GRANT ALL ON TABLE "public"."event_external_invitees" TO "service_role";



GRANT ALL ON TABLE "public"."event_host_summary" TO "service_role";



GRANT ALL ON TABLE "public"."event_invited_council_types" TO "anon";
GRANT ALL ON TABLE "public"."event_invited_council_types" TO "authenticated";
GRANT ALL ON TABLE "public"."event_invited_council_types" TO "service_role";



GRANT ALL ON TABLE "public"."event_message_jobs" TO "anon";
GRANT ALL ON TABLE "public"."event_message_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."event_message_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."event_message_status_types" TO "anon";
GRANT ALL ON TABLE "public"."event_message_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."event_message_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."event_message_types" TO "anon";
GRANT ALL ON TABLE "public"."event_message_types" TO "authenticated";
GRANT ALL ON TABLE "public"."event_message_types" TO "service_role";



GRANT ALL ON TABLE "public"."event_person_rsvp_attendees" TO "anon";
GRANT ALL ON TABLE "public"."event_person_rsvp_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."event_person_rsvp_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."event_person_rsvps" TO "anon";
GRANT ALL ON TABLE "public"."event_person_rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."event_person_rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."event_person_rsvp_summary" TO "anon";
GRANT ALL ON TABLE "public"."event_person_rsvp_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."event_person_rsvp_summary" TO "service_role";



GRANT ALL ON TABLE "public"."event_scope_types" TO "anon";
GRANT ALL ON TABLE "public"."event_scope_types" TO "authenticated";
GRANT ALL ON TABLE "public"."event_scope_types" TO "service_role";



GRANT ALL ON TABLE "public"."event_status_types" TO "anon";
GRANT ALL ON TABLE "public"."event_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."event_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."legacy_fossil_resolutions" TO "service_role";



GRANT ALL ON TABLE "public"."local_role_definitions" TO "anon";
GRANT ALL ON TABLE "public"."local_role_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."local_role_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."local_unit_external_links" TO "anon";
GRANT ALL ON TABLE "public"."local_unit_external_links" TO "authenticated";
GRANT ALL ON TABLE "public"."local_unit_external_links" TO "service_role";



GRANT ALL ON TABLE "public"."local_unit_message_routes" TO "anon";
GRANT ALL ON TABLE "public"."local_unit_message_routes" TO "authenticated";
GRANT ALL ON TABLE "public"."local_unit_message_routes" TO "service_role";



GRANT ALL ON TABLE "public"."local_unit_people" TO "anon";
GRANT ALL ON TABLE "public"."local_unit_people" TO "authenticated";
GRANT ALL ON TABLE "public"."local_unit_people" TO "service_role";



GRANT ALL ON TABLE "public"."local_unit_public_contact_message_jobs" TO "anon";
GRANT ALL ON TABLE "public"."local_unit_public_contact_message_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."local_unit_public_contact_message_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."local_unit_public_gallery_images" TO "anon";
GRANT ALL ON TABLE "public"."local_unit_public_gallery_images" TO "authenticated";
GRANT ALL ON TABLE "public"."local_unit_public_gallery_images" TO "service_role";



GRANT ALL ON TABLE "public"."local_unit_reporting_year_settings" TO "anon";
GRANT ALL ON TABLE "public"."local_unit_reporting_year_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."local_unit_reporting_year_settings" TO "service_role";



GRANT ALL ON TABLE "public"."local_unit_volunteer_hour_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."local_unit_volunteer_hour_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."local_unit_volunteer_hour_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."local_unit_volunteer_contribution_entries" TO "anon";
GRANT ALL ON TABLE "public"."local_unit_volunteer_contribution_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."local_unit_volunteer_contribution_entries" TO "service_role";



GRANT ALL ON TABLE "public"."local_unit_volunteer_contribution_rollups" TO "anon";
GRANT ALL ON TABLE "public"."local_unit_volunteer_contribution_rollups" TO "authenticated";
GRANT ALL ON TABLE "public"."local_unit_volunteer_contribution_rollups" TO "service_role";



GRANT ALL ON TABLE "public"."local_units" TO "anon";
GRANT ALL ON TABLE "public"."local_units" TO "authenticated";
GRANT ALL ON TABLE "public"."local_units" TO "service_role";



GRANT ALL ON TABLE "public"."member_records" TO "anon";
GRANT ALL ON TABLE "public"."member_records" TO "authenticated";
GRANT ALL ON TABLE "public"."member_records" TO "service_role";



GRANT ALL ON TABLE "public"."membership_claim_requests" TO "anon";
GRANT ALL ON TABLE "public"."membership_claim_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."membership_claim_requests" TO "service_role";



GRANT ALL ON TABLE "public"."migration_review_queue" TO "anon";
GRANT ALL ON TABLE "public"."migration_review_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."migration_review_queue" TO "service_role";



GRANT ALL ON TABLE "public"."note_types" TO "anon";
GRANT ALL ON TABLE "public"."note_types" TO "authenticated";
GRANT ALL ON TABLE "public"."note_types" TO "service_role";



GRANT ALL ON TABLE "public"."officer_role_emails" TO "anon";
GRANT ALL ON TABLE "public"."officer_role_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."officer_role_emails" TO "service_role";



GRANT ALL ON TABLE "public"."official_import_batch_status_types" TO "anon";
GRANT ALL ON TABLE "public"."official_import_batch_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."official_import_batch_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."official_import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."official_import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."official_import_review_status_types" TO "anon";
GRANT ALL ON TABLE "public"."official_import_review_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."official_import_review_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."official_import_row_action_types" TO "anon";
GRANT ALL ON TABLE "public"."official_import_row_action_types" TO "authenticated";
GRANT ALL ON TABLE "public"."official_import_row_action_types" TO "service_role";



GRANT ALL ON TABLE "public"."official_import_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."official_import_rows" TO "service_role";



GRANT ALL ON TABLE "public"."official_member_records" TO "authenticated";
GRANT ALL ON TABLE "public"."official_member_records" TO "service_role";



GRANT ALL ON TABLE "public"."official_membership_status_types" TO "anon";
GRANT ALL ON TABLE "public"."official_membership_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."official_membership_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."organization_admin_assignments" TO "anon";
GRANT ALL ON TABLE "public"."organization_admin_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_admin_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."organization_admin_invitations" TO "anon";
GRANT ALL ON TABLE "public"."organization_admin_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_admin_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."organization_claim_requests" TO "anon";
GRANT ALL ON TABLE "public"."organization_claim_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_claim_requests" TO "service_role";



GRANT ALL ON TABLE "public"."organization_families" TO "anon";
GRANT ALL ON TABLE "public"."organization_families" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_families" TO "service_role";



GRANT ALL ON TABLE "public"."organization_kofc_profiles" TO "anon";
GRANT ALL ON TABLE "public"."organization_kofc_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_kofc_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."organization_membership_status_types" TO "anon";
GRANT ALL ON TABLE "public"."organization_membership_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_membership_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."organization_memberships" TO "anon";
GRANT ALL ON TABLE "public"."organization_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."organization_relationship_type_types" TO "anon";
GRANT ALL ON TABLE "public"."organization_relationship_type_types" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_relationship_type_types" TO "service_role";



GRANT ALL ON TABLE "public"."organization_relationships" TO "anon";
GRANT ALL ON TABLE "public"."organization_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."organization_type_types" TO "anon";
GRANT ALL ON TABLE "public"."organization_type_types" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_type_types" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."people" TO "anon";
GRANT ALL ON TABLE "public"."people" TO "authenticated";
GRANT ALL ON TABLE "public"."people" TO "service_role";



GRANT ALL ON TABLE "public"."person_assignments" TO "anon";
GRANT ALL ON TABLE "public"."person_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."person_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."person_contact_change_log" TO "anon";
GRANT ALL ON TABLE "public"."person_contact_change_log" TO "authenticated";
GRANT ALL ON TABLE "public"."person_contact_change_log" TO "service_role";



GRANT ALL ON TABLE "public"."person_designations" TO "anon";
GRANT ALL ON TABLE "public"."person_designations" TO "authenticated";
GRANT ALL ON TABLE "public"."person_designations" TO "service_role";



GRANT ALL ON TABLE "public"."person_distinctions" TO "anon";
GRANT ALL ON TABLE "public"."person_distinctions" TO "authenticated";
GRANT ALL ON TABLE "public"."person_distinctions" TO "service_role";



GRANT ALL ON TABLE "public"."person_identities" TO "anon";
GRANT ALL ON TABLE "public"."person_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."person_identities" TO "service_role";



GRANT ALL ON TABLE "public"."person_identity_links" TO "anon";
GRANT ALL ON TABLE "public"."person_identity_links" TO "authenticated";
GRANT ALL ON TABLE "public"."person_identity_links" TO "service_role";



GRANT ALL ON TABLE "public"."person_kofc_profiles" TO "anon";
GRANT ALL ON TABLE "public"."person_kofc_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."person_kofc_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."person_merges" TO "anon";
GRANT ALL ON TABLE "public"."person_merges" TO "authenticated";
GRANT ALL ON TABLE "public"."person_merges" TO "service_role";



GRANT ALL ON TABLE "public"."person_notes" TO "anon";
GRANT ALL ON TABLE "public"."person_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."person_notes" TO "service_role";



GRANT ALL ON TABLE "public"."person_officer_terms" TO "anon";
GRANT ALL ON TABLE "public"."person_officer_terms" TO "authenticated";
GRANT ALL ON TABLE "public"."person_officer_terms" TO "service_role";



GRANT ALL ON TABLE "public"."person_profile_change_requests" TO "anon";
GRANT ALL ON TABLE "public"."person_profile_change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."person_profile_change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."person_source_types" TO "anon";
GRANT ALL ON TABLE "public"."person_source_types" TO "authenticated";
GRANT ALL ON TABLE "public"."person_source_types" TO "service_role";



GRANT ALL ON TABLE "public"."primary_relationship_types" TO "anon";
GRANT ALL ON TABLE "public"."primary_relationship_types" TO "authenticated";
GRANT ALL ON TABLE "public"."primary_relationship_types" TO "service_role";



GRANT ALL ON TABLE "public"."prospect_status_types" TO "anon";
GRANT ALL ON TABLE "public"."prospect_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."prospect_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."public_registration_intakes" TO "service_role";



GRANT ALL ON TABLE "public"."resource_access_grants" TO "anon";
GRANT ALL ON TABLE "public"."resource_access_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."resource_access_grants" TO "service_role";



GRANT ALL ON TABLE "public"."role_assignments" TO "anon";
GRANT ALL ON TABLE "public"."role_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."role_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."saint_aliases" TO "anon";
GRANT ALL ON TABLE "public"."saint_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."saint_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."saint_topics" TO "anon";
GRANT ALL ON TABLE "public"."saint_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."saint_topics" TO "service_role";



GRANT ALL ON TABLE "public"."saints" TO "anon";
GRANT ALL ON TABLE "public"."saints" TO "authenticated";
GRANT ALL ON TABLE "public"."saints" TO "service_role";



GRANT ALL ON TABLE "public"."scripture_passages" TO "anon";
GRANT ALL ON TABLE "public"."scripture_passages" TO "authenticated";
GRANT ALL ON TABLE "public"."scripture_passages" TO "service_role";



GRANT ALL ON TABLE "public"."scripture_topics" TO "anon";
GRANT ALL ON TABLE "public"."scripture_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."scripture_topics" TO "service_role";



GRANT ALL ON TABLE "public"."spiritual_content_items" TO "anon";
GRANT ALL ON TABLE "public"."spiritual_content_items" TO "authenticated";
GRANT ALL ON TABLE "public"."spiritual_content_items" TO "service_role";



GRANT ALL ON TABLE "public"."spiritual_content_relationships" TO "anon";
GRANT ALL ON TABLE "public"."spiritual_content_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."spiritual_content_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."spiritual_content_saints" TO "anon";
GRANT ALL ON TABLE "public"."spiritual_content_saints" TO "authenticated";
GRANT ALL ON TABLE "public"."spiritual_content_saints" TO "service_role";



GRANT ALL ON TABLE "public"."spiritual_content_scopes" TO "anon";
GRANT ALL ON TABLE "public"."spiritual_content_scopes" TO "authenticated";
GRANT ALL ON TABLE "public"."spiritual_content_scopes" TO "service_role";



GRANT ALL ON TABLE "public"."spiritual_content_topics" TO "anon";
GRANT ALL ON TABLE "public"."spiritual_content_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."spiritual_content_topics" TO "service_role";



GRANT ALL ON TABLE "public"."spiritual_topic_aliases" TO "anon";
GRANT ALL ON TABLE "public"."spiritual_topic_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."spiritual_topic_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."spiritual_topics" TO "anon";
GRANT ALL ON TABLE "public"."spiritual_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."spiritual_topics" TO "service_role";



GRANT ALL ON TABLE "public"."supreme_update_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."supreme_update_queue" TO "service_role";



GRANT ALL ON TABLE "public"."supreme_update_status_types" TO "anon";
GRANT ALL ON TABLE "public"."supreme_update_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."supreme_update_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."user_access_scopes" TO "anon";
GRANT ALL ON TABLE "public"."user_access_scopes" TO "authenticated";
GRANT ALL ON TABLE "public"."user_access_scopes" TO "service_role";



GRANT ALL ON TABLE "public"."user_admin_grants" TO "anon";
GRANT ALL ON TABLE "public"."user_admin_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."user_admin_grants" TO "service_role";



GRANT ALL ON TABLE "public"."user_saved_saints" TO "anon";
GRANT ALL ON TABLE "public"."user_saved_saints" TO "authenticated";
GRANT ALL ON TABLE "public"."user_saved_saints" TO "service_role";



GRANT ALL ON TABLE "public"."user_saved_spiritual_items" TO "anon";
GRANT ALL ON TABLE "public"."user_saved_spiritual_items" TO "authenticated";
GRANT ALL ON TABLE "public"."user_saved_spiritual_items" TO "service_role";



GRANT ALL ON TABLE "public"."user_spiritual_activity" TO "anon";
GRANT ALL ON TABLE "public"."user_spiritual_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."user_spiritual_activity" TO "service_role";



GRANT ALL ON TABLE "public"."user_unit_relationships" TO "anon";
GRANT ALL ON TABLE "public"."user_unit_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."user_unit_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."v_effective_area_access" TO "service_role";



GRANT ALL ON TABLE "public"."v_effective_admin_package_access" TO "service_role";



GRANT ALL ON TABLE "public"."v_effective_event_management_access" TO "service_role";



GRANT ALL ON TABLE "public"."v_effective_resource_access" TO "service_role";



GRANT ALL ON TABLE "public"."volunteer_context_types" TO "anon";
GRANT ALL ON TABLE "public"."volunteer_context_types" TO "authenticated";
GRANT ALL ON TABLE "public"."volunteer_context_types" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "app" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "app" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "app" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































