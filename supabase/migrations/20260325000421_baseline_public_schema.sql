-- Baseline migration generated from supabase/schema.sql.
-- Created by scripts/rebaseline-supabase-migrations.sh on 2026-03-25T00:04:21Z.
-- This file intentionally mirrors the live public schema snapshot.




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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "app"."add_person_note"("p_person_id" "uuid", "p_note_type_code" "text", "p_body" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_person public.people%rowtype;
  v_note_id uuid;
begin
  select * into v_person
  from public.people
  where id = p_person_id
    and council_id = app.current_council_id();

  if v_person.id is null then
    raise exception 'Person not found in current council';
  end if;

  if not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
    raise exception 'Not allowed to add note to this person';
  end if;

  if p_note_type_code = 'admin' and not app.user_is_council_admin(v_person.council_id) then
    raise exception 'Only admins can create admin notes';
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

  perform app.write_audit_log(v_person.council_id, 'person_notes', v_note_id, 'add_person_note', jsonb_build_object('person_id', p_person_id));

  return v_note_id;
end;
$$;


ALTER FUNCTION "app"."add_person_note"("p_person_id" "uuid", "p_note_type_code" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."archive_person"("p_person_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_person public.people%rowtype;
begin
  select * into v_person
  from public.people
  where id = p_person_id
    and council_id = app.current_council_id();

  if v_person.id is null then
    raise exception 'Person not found in current council';
  end if;

  if v_person.primary_relationship_code = 'member' and not app.user_is_council_admin(v_person.council_id) then
    raise exception 'Only admins can archive members';
  end if;

  if v_person.primary_relationship_code in ('prospect', 'volunteer_only')
     and not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
    raise exception 'Not allowed to archive this person';
  end if;

  update public.people
  set archived_at = now(),
      archived_by_auth_user_id = auth.uid(),
      archive_reason = p_reason,
      updated_by_auth_user_id = auth.uid()
  where id = p_person_id;

  perform app.write_audit_log(v_person.council_id, 'people', p_person_id, 'archive_person', jsonb_build_object('reason', p_reason));
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
  select * into v_person
  from public.people
  where id = p_person_id
    and council_id = app.current_council_id();

  if v_person.id is null then
    raise exception 'Person not found in current council';
  end if;

  if v_person.primary_relationship_code <> 'member' then
    raise exception 'Assignments are limited to members in v1';
  end if;

  if not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
    raise exception 'Not allowed to assign this person';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = p_user_id
      and u.council_id = v_person.council_id
      and u.is_active = true
  ) then
    raise exception 'Assignment target user is not active in this council';
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

  perform app.write_audit_log(v_person.council_id, 'person_assignments', v_assignment_id, 'assign_person', jsonb_build_object('person_id', p_person_id, 'user_id', p_user_id));

  return v_assignment_id;
end;
$$;


ALTER FUNCTION "app"."assign_person"("p_person_id" "uuid", "p_user_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."create_prospect"("p_first_name" "text", "p_last_name" "text", "p_email" "text" DEFAULT NULL::"text", "p_cell_phone" "text" DEFAULT NULL::"text", "p_home_phone" "text" DEFAULT NULL::"text", "p_other_phone" "text" DEFAULT NULL::"text", "p_prospect_status_code" "text" DEFAULT 'new'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_council_id uuid := app.current_council_id();
  v_person_id uuid;
begin
  if v_council_id is null then
    raise exception 'No active council context for current user';
  end if;

  if not (
    app.user_is_council_admin(v_council_id)
    or app.user_has_scope(v_council_id, 'prospects')
    or app.user_has_scope(v_council_id, 'all_people')
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
    v_council_id,
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

  perform app.write_audit_log(v_council_id, 'people', v_person_id, 'create_prospect');

  return v_person_id;
end;
$$;


ALTER FUNCTION "app"."create_prospect"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_prospect_status_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."create_volunteer_only"("p_first_name" "text", "p_last_name" "text", "p_email" "text" DEFAULT NULL::"text", "p_cell_phone" "text" DEFAULT NULL::"text", "p_home_phone" "text" DEFAULT NULL::"text", "p_other_phone" "text" DEFAULT NULL::"text", "p_volunteer_context_code" "text" DEFAULT 'unknown'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_council_id uuid := app.current_council_id();
  v_person_id uuid;
begin
  if v_council_id is null then
    raise exception 'No active council context for current user';
  end if;

  if not (
    app.user_is_council_admin(v_council_id)
    or app.user_has_scope(v_council_id, 'volunteer_only')
    or app.user_has_scope(v_council_id, 'all_people')
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
    v_council_id,
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

  perform app.write_audit_log(v_council_id, 'people', v_person_id, 'create_volunteer_only');

  return v_person_id;
end;
$$;


ALTER FUNCTION "app"."create_volunteer_only"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_volunteer_context_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."current_council_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select u.council_id
  from public.users u
  where u.id = auth.uid()
    and u.is_active = true
  limit 1
$$;


ALTER FUNCTION "app"."current_council_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."end_person_assignment"("p_assignment_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_assignment public.person_assignments%rowtype;
  v_person public.people%rowtype;
begin
  select * into v_assignment
  from public.person_assignments
  where id = p_assignment_id;

  if v_assignment.id is null then
    raise exception 'Assignment not found';
  end if;

  select * into v_person
  from public.people
  where id = v_assignment.person_id
    and council_id = app.current_council_id();

  if v_person.id is null then
    raise exception 'Assignment is not in current council';
  end if;

  if not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
    raise exception 'Not allowed to end this assignment';
  end if;

  update public.person_assignments
  set ended_at = now(),
      ended_by_auth_user_id = auth.uid(),
      notes = coalesce(p_notes, notes)
  where id = p_assignment_id
    and ended_at is null;

  perform app.write_audit_log(v_person.council_id, 'person_assignments', p_assignment_id, 'end_person_assignment');
end;
$$;


ALTER FUNCTION "app"."end_person_assignment"("p_assignment_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."fraternal_year_label"("p_start_year" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select p_start_year::text || '-' || (p_start_year + 1)::text
$$;


ALTER FUNCTION "app"."fraternal_year_label"("p_start_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."fraternal_year_start"("p_date" "date") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
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
  join public.people p on p.id = omr.person_id
  where p.council_id = app.current_council_id()
    and app.user_can_access_person(p.id)
$$;


ALTER FUNCTION "app"."list_accessible_member_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."update_member_local_fields"("p_person_id" "uuid", "p_council_activity_level_code" "text", "p_council_activity_context_code" "text", "p_council_reengagement_status_code" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_person public.people%rowtype;
begin
  select * into v_person
  from public.people
  where id = p_person_id
    and council_id = app.current_council_id();

  if v_person.id is null then
    raise exception 'Person not found in current council';
  end if;

  if v_person.primary_relationship_code <> 'member' then
    raise exception 'This function only updates member local fields';
  end if;

  if not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
    raise exception 'Not allowed to update this member';
  end if;

  update public.people
  set council_activity_level_code = p_council_activity_level_code,
      council_activity_context_code = p_council_activity_context_code,
      council_reengagement_status_code = p_council_reengagement_status_code,
      updated_by_auth_user_id = auth.uid()
  where id = p_person_id;

  perform app.write_audit_log(v_person.council_id, 'people', p_person_id, 'update_member_local_fields');
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
  select * into v_person
  from public.people
  where id = p_person_id
    and council_id = app.current_council_id();

  if v_person.id is null then
    raise exception 'Person not found in current council';
  end if;

  if v_person.primary_relationship_code not in ('prospect', 'volunteer_only') then
    raise exception 'This function is only for prospects and volunteer-only records';
  end if;

  if not (app.user_is_council_admin(v_person.council_id) or app.user_can_access_person(v_person.id)) then
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

  perform app.write_audit_log(v_person.council_id, 'people', p_person_id, 'update_nonmember_contact_fields');
end;
$$;


ALTER FUNCTION "app"."update_nonmember_contact_fields"("p_person_id" "uuid", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_address_line_1" "text", "p_address_line_2" "text", "p_city" "text", "p_state_province" "text", "p_postal_code" "text", "p_country_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_can_access_person"("p_person_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with target as (
    select
      p.id,
      p.council_id,
      p.primary_relationship_code,
      p.council_activity_level_code,
      p.council_reengagement_status_code,
      omr.official_membership_status_code
    from public.people p
    left join public.official_member_records omr on omr.person_id = p.id
    where p.id = p_person_id
      and p.merged_into_person_id is null
  )
  select exists (
    select 1
    from target t
    where t.council_id = app.current_council_id()
      and (
        app.user_is_council_admin(t.council_id)
        or app.user_has_scope(t.council_id, 'all_people')
        or (t.primary_relationship_code = 'prospect' and app.user_has_scope(t.council_id, 'prospects'))
        or (t.primary_relationship_code = 'volunteer_only' and app.user_has_scope(t.council_id, 'volunteer_only'))
        or (t.primary_relationship_code = 'member' and app.user_has_scope(t.council_id, 'members_all'))
        or (t.primary_relationship_code = 'member' and t.official_membership_status_code = 'active' and app.user_has_scope(t.council_id, 'members_official_active'))
        or (t.primary_relationship_code = 'member' and t.official_membership_status_code = 'associate' and app.user_has_scope(t.council_id, 'members_official_associate'))
        or (t.primary_relationship_code = 'member' and t.council_activity_level_code = 'active' and app.user_has_scope(t.council_id, 'members_activity_active'))
        or (t.primary_relationship_code = 'member' and t.council_activity_level_code = 'occasional' and app.user_has_scope(t.council_id, 'members_activity_occasional'))
        or (t.primary_relationship_code = 'member' and t.council_activity_level_code = 'inactive' and app.user_has_scope(t.council_id, 'members_activity_inactive'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'monitoring' and app.user_has_scope(t.council_id, 'members_reengagement_monitoring'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'hardship_support' and app.user_has_scope(t.council_id, 'members_reengagement_hardship_support'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'reengagement_in_progress' and app.user_has_scope(t.council_id, 'members_reengagement_in_progress'))
        or (t.primary_relationship_code = 'member' and t.council_reengagement_status_code = 'disengaged_no_response' and app.user_has_scope(t.council_id, 'members_reengagement_disengaged_no_response'))
      )
  )
$$;


ALTER FUNCTION "app"."user_can_access_person"("p_person_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_has_scope"("p_council_id" "uuid", "p_scope_code" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_access_scopes s
    join public.users u on u.id = s.user_id
    where u.id = auth.uid()
      and u.council_id = p_council_id
      and u.is_active = true
      and s.scope_code = p_scope_code
      and s.ends_at is null
      and s.starts_at <= now()
  )
$$;


ALTER FUNCTION "app"."user_has_scope"("p_council_id" "uuid", "p_scope_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app"."user_is_council_admin"("p_council_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with active_app_user as (
    select
      u.id,
      u.person_id,
      u.council_id,
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
  target_council as (
    select c.id, c.organization_id
    from public.councils c
    where c.id = p_council_id
    limit 1
  )
  select exists (
    select 1
    from active_app_user u
    where u.is_super_admin = true
  )
  or exists (
    select 1
    from active_app_user u
    join target_council tc
      on true
    join public.organization_admin_assignments oaa
      on oaa.organization_id = tc.organization_id
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
    join public.council_admin_assignments ca
      on ca.council_id = p_council_id
    where ca.is_active = true
      and (
        ca.user_id = u.id
        or (u.person_id is not null and ca.person_id = u.person_id)
        or (
          u.email is not null
          and nullif(btrim(coalesce(ca.grantee_email, '')), '') is not null
          and lower(ca.grantee_email) = lower(u.email)
        )
      )
  )
  or exists (
    select 1
    from active_app_user u
    join public.person_officer_terms pot
      on pot.person_id = u.person_id
    where pot.council_id = p_council_id
      and pot.office_scope_code = 'council'
      and pot.office_code in ('grand_knight', 'financial_secretary')
      and (
        pot.service_end_year is null
        or pot.service_end_year >= extract(year from current_date)::int
      )
  );
$$;


ALTER FUNCTION "app"."user_is_council_admin"("p_council_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."apply_supreme_import_row"("p_council_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid" DEFAULT NULL::"uuid", "p_council_number" "text" DEFAULT NULL::"text", "p_title" "text" DEFAULT NULL::"text", "p_first_name" "text" DEFAULT NULL::"text", "p_middle_name" "text" DEFAULT NULL::"text", "p_last_name" "text" DEFAULT NULL::"text", "p_suffix" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_email_hash" "text" DEFAULT NULL::"text", "p_cell_phone" "text" DEFAULT NULL::"text", "p_cell_phone_hash" "text" DEFAULT NULL::"text", "p_address_line_1" "text" DEFAULT NULL::"text", "p_address_line_1_hash" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_city_hash" "text" DEFAULT NULL::"text", "p_state_province" "text" DEFAULT NULL::"text", "p_state_province_hash" "text" DEFAULT NULL::"text", "p_postal_code" "text" DEFAULT NULL::"text", "p_postal_code_hash" "text" DEFAULT NULL::"text", "p_birth_date" "date" DEFAULT NULL::"date", "p_birth_date_hash" "text" DEFAULT NULL::"text", "p_pii_key_version" "text" DEFAULT NULL::"text", "p_council_activity_level_code" "text" DEFAULT NULL::"text", "p_member_number" "text" DEFAULT NULL::"text", "p_first_degree_date" "date" DEFAULT NULL::"date", "p_second_degree_date" "date" DEFAULT NULL::"date", "p_third_degree_date" "date" DEFAULT NULL::"date", "p_years_in_service" integer DEFAULT NULL::integer, "p_member_type" "text" DEFAULT NULL::"text", "p_member_class" "text" DEFAULT NULL::"text", "p_assembly_number" "text" DEFAULT NULL::"text") RETURNS "jsonb"
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
begin
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then
    raise exception 'First name and last name are required.';
  end if;

  if p_council_number is not null then
    insert into public.organization_kofc_profiles (
      organization_id,
      council_number
    )
    values (
      p_organization_id,
      p_council_number
    )
    on conflict (organization_id) do update
      set council_number = coalesce(excluded.council_number, public.organization_kofc_profiles.council_number);
  end if;

  if p_member_number is not null then
    with membership_matches as (
      select distinct person_id
      from public.organization_memberships
      where organization_id = p_organization_id
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
      raise exception 'Member number % already belongs to another member record in this council.', p_member_number;
    end if;

    update public.people
    set
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
      and council_id = p_council_id
    returning id into v_person_id;

    if v_person_id is null then
      raise exception 'Member number % belongs to a person outside this council.', p_member_number;
    end if;

    v_action := 'updated';
  elsif p_import_mode = 'update_existing' and p_existing_person_id is not null then
    update public.people
    set
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
      and council_id = p_council_id
    returning id into v_person_id;

    if v_person_id is null then
      raise exception 'Could not find the matched person for update.';
    end if;

    v_action := 'updated';
  elsif p_import_mode = 'update_existing' then
    raise exception 'Missing existing person id for update_existing row.';
  elsif p_import_mode = 'create_new' then
    insert into public.people (
      council_id,
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
      p_council_id,
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
  where organization_id = p_organization_id
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
      p_organization_id,
      v_person_id,
      coalesce(p_council_activity_level_code, 'active'),
      p_member_number,
      true,
      'supreme_import',
      p_auth_user_id,
      p_auth_user_id
    );
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
    'action', v_action
  );
end;
$$;


ALTER FUNCTION "public"."apply_supreme_import_row"("p_council_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid", "p_council_number" "text", "p_title" "text", "p_first_name" "text", "p_middle_name" "text", "p_last_name" "text", "p_suffix" "text", "p_email" "text", "p_email_hash" "text", "p_cell_phone" "text", "p_cell_phone_hash" "text", "p_address_line_1" "text", "p_address_line_1_hash" "text", "p_city" "text", "p_city_hash" "text", "p_state_province" "text", "p_state_province_hash" "text", "p_postal_code" "text", "p_postal_code_hash" "text", "p_birth_date" "date", "p_birth_date_hash" "text", "p_pii_key_version" "text", "p_council_activity_level_code" "text", "p_member_number" "text", "p_first_degree_date" "date", "p_second_degree_date" "date", "p_third_degree_date" "date", "p_years_in_service" integer, "p_member_type" "text", "p_member_class" "text", "p_assembly_number" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_supreme_import_row"("p_council_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid", "p_council_number" "text", "p_title" "text", "p_first_name" "text", "p_middle_name" "text", "p_last_name" "text", "p_suffix" "text", "p_email" "text", "p_email_hash" "text", "p_cell_phone" "text", "p_cell_phone_hash" "text", "p_address_line_1" "text", "p_address_line_1_hash" "text", "p_city" "text", "p_city_hash" "text", "p_state_province" "text", "p_state_province_hash" "text", "p_postal_code" "text", "p_postal_code_hash" "text", "p_birth_date" "date", "p_birth_date_hash" "text", "p_pii_key_version" "text", "p_council_activity_level_code" "text", "p_member_number" "text", "p_first_degree_date" "date", "p_second_degree_date" "date", "p_third_degree_date" "date", "p_years_in_service" integer, "p_member_type" "text", "p_member_class" "text", "p_assembly_number" "text") IS 'Applies one Supreme import row atomically, preferring the existing membership number match inside the current organization so re-imports update instead of duplicating.';



CREATE OR REPLACE FUNCTION "public"."current_user_council_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select u.council_id
  from users u
  where u.id = auth.uid()::uuid
  limit 1;
$$;


ALTER FUNCTION "public"."current_user_council_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_rsvp_token"() RETURNS "text"
    LANGUAGE "sql"
    AS $$
  select encode(gen_random_bytes(24), 'hex');
$$;


ALTER FUNCTION "public"."generate_rsvp_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_person_contact_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


CREATE OR REPLACE FUNCTION "public"."queue_supreme_update_reminder"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


CREATE OR REPLACE FUNCTION "public"."set_person_profile_change_requests_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_person_profile_change_requests_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_belongs_to_council"("target_council_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
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
    AS $$
  select app.user_is_council_admin(target_council_id);
$$;


ALTER FUNCTION "public"."user_is_council_admin"("target_council_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


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
    "council_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid",
    "archived_at" timestamp with time zone,
    "archived_by_auth_user_id" "uuid"
);


ALTER TABLE "public"."custom_lists" OWNER TO "postgres";


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
    "council_id" "uuid" NOT NULL,
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
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_archives" OWNER TO "postgres";


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
    "council_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location_name" "text",
    "location_address" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
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
    CONSTRAINT "events_event_kind_code_check" CHECK (("event_kind_code" = ANY (ARRAY['standard'::"text", 'general_meeting'::"text", 'executive_meeting'::"text"]))),
    CONSTRAINT "events_reminder_days_before_check" CHECK ((("reminder_days_before" IS NULL) OR (("reminder_days_before" >= 0) AND ("reminder_days_before" <= 60)))),
    CONSTRAINT "events_reminder_time_check" CHECK ((("reminder_scheduled_for" IS NULL) OR ("reminder_scheduled_for" < "starts_at"))),
    CONSTRAINT "events_rsvp_deadline_check" CHECK ((("rsvp_deadline_at" IS NULL) OR ("rsvp_deadline_at" <= "starts_at"))),
    CONSTRAINT "events_time_check" CHECK (("ends_at" >= "starts_at"))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."event_council_rsvp_rollups" AS
 SELECT "e"."id" AS "event_id",
    "e"."council_id" AS "host_council_id",
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
   FROM ((("public"."events" "e"
     JOIN "public"."event_invited_councils" "ic" ON (("ic"."event_id" = "e"."id")))
     LEFT JOIN "public"."event_council_rsvps" "r" ON (("r"."event_invited_council_id" = "ic"."id")))
     LEFT JOIN "public"."event_rsvp_volunteers" "v" ON (("v"."event_council_rsvp_id" = "r"."id")))
  GROUP BY "e"."id", "e"."council_id", "ic"."id", "ic"."is_host", "ic"."invited_council_type_code", "ic"."invited_council_id", "ic"."invited_council_name", "ic"."invited_council_number", "ic"."invite_email", "r"."id", "r"."first_responded_at", "r"."last_responded_at";


ALTER VIEW "public"."event_council_rsvp_rollups" OWNER TO "postgres";


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


CREATE OR REPLACE VIEW "public"."event_host_summary" AS
 SELECT "event_id",
    "host_council_id",
    ("count"(*))::integer AS "invited_council_count",
    ("count"(*) FILTER (WHERE "has_responded"))::integer AS "responded_council_count",
    (COALESCE("sum"("volunteer_count"), (0)::bigint))::integer AS "total_volunteer_count"
   FROM "public"."event_council_rsvp_rollups"
  GROUP BY "event_id", "host_council_id";


ALTER VIEW "public"."event_host_summary" OWNER TO "postgres";


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


CREATE OR REPLACE VIEW "public"."event_person_rsvp_summary" AS
 SELECT "e"."id" AS "event_id",
    "e"."council_id" AS "host_council_id",
    ("count"(DISTINCT "pr"."id") FILTER (WHERE ("pr"."status_code" = 'active'::"text")))::integer AS "active_submission_count",
    (COALESCE("count"("a"."id") FILTER (WHERE ("pr"."status_code" = 'active'::"text")), (0)::bigint))::integer AS "total_volunteer_count",
    "max"("pr"."last_responded_at") FILTER (WHERE ("pr"."status_code" = 'active'::"text")) AS "last_responded_at"
   FROM (("public"."events" "e"
     LEFT JOIN "public"."event_person_rsvps" "pr" ON (("pr"."event_id" = "e"."id")))
     LEFT JOIN "public"."event_person_rsvp_attendees" "a" ON (("a"."event_person_rsvp_id" = "pr"."id")))
  GROUP BY "e"."id", "e"."council_id";


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


CREATE TABLE IF NOT EXISTS "public"."note_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."note_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."officer_role_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "council_id" "uuid" NOT NULL,
    "office_scope_code" "text" NOT NULL,
    "office_code" "text" NOT NULL,
    "office_rank" integer,
    "email" "text" NOT NULL,
    "login_enabled" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_auth_user_id" "uuid",
    "updated_by_auth_user_id" "uuid"
);


ALTER TABLE "public"."officer_role_emails" OWNER TO "postgres";


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
    CONSTRAINT "organization_admin_assignments_target_check" CHECK ((("person_id" IS NOT NULL) OR ("user_id" IS NOT NULL) OR (NULLIF("btrim"(COALESCE("grantee_email", ''::"text")), ''::"text") IS NOT NULL)))
);


ALTER TABLE "public"."organization_admin_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_admin_assignments" IS 'Organization-scoped admin grants. Replaces council_admin_assignments as the long-term source of truth.';



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
    "preferred_name" "text"
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
    "council_id" "uuid" NOT NULL,
    "person_id" "uuid" NOT NULL,
    "changed_by_auth_user_id" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_fields" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "old_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "new_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."person_contact_change_log" OWNER TO "postgres";


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
    "council_id" "uuid" NOT NULL,
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
    CONSTRAINT "person_officer_terms_check" CHECK ((("service_end_year" IS NULL) OR ((("service_end_year" >= 1900) AND ("service_end_year" <= 2100)) AND ("service_end_year" >= "service_start_year")))),
    CONSTRAINT "person_officer_terms_office_rank_check" CHECK ((("office_rank" IS NULL) OR ("office_rank" > 0))),
    CONSTRAINT "person_officer_terms_office_scope_code_check" CHECK (("office_scope_code" = ANY (ARRAY['council'::"text", 'district'::"text", 'state'::"text"]))),
    CONSTRAINT "person_officer_terms_service_start_year_check" CHECK ((("service_start_year" >= 1900) AND ("service_start_year" <= 2100)))
);


ALTER TABLE "public"."person_officer_terms" OWNER TO "postgres";


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
    CONSTRAINT "person_profile_change_requests_status_code_check" CHECK (("status_code" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."person_profile_change_requests" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_profiles"
    ADD CONSTRAINT "brand_profiles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."brand_profiles"
    ADD CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."designation_types"
    ADD CONSTRAINT "designation_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."distinction_types"
    ADD CONSTRAINT "distinction_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."event_archives"
    ADD CONSTRAINT "event_archives_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "event_archives_council_deleted_idx" ON "public"."event_archives" USING "btree" ("council_id", "deleted_at" DESC);



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



CREATE INDEX "events_meeting_kind_starts_idx" ON "public"."events" USING "btree" ("council_id", "event_kind_code", "starts_at");



CREATE INDEX "events_meeting_upcoming_idx" ON "public"."events" USING "btree" ("council_id", "starts_at") WHERE ("event_kind_code" = ANY (ARRAY['general_meeting'::"text", 'executive_meeting'::"text"]));



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



CREATE INDEX "idx_events_council_scope_starts_at" ON "public"."events" USING "btree" ("council_id", "scope_code", "starts_at" DESC);



CREATE INDEX "idx_events_council_starts_at" ON "public"."events" USING "btree" ("council_id", "starts_at" DESC);



CREATE INDEX "idx_events_council_status_starts_at" ON "public"."events" USING "btree" ("council_id", "status_code", "starts_at" DESC);



CREATE UNIQUE INDEX "officer_role_emails_active_email_idx" ON "public"."officer_role_emails" USING "btree" ("lower"("email")) WHERE (("is_active" = true) AND ("login_enabled" = true));



CREATE UNIQUE INDEX "officer_role_emails_active_role_key_idx" ON "public"."officer_role_emails" USING "btree" ("council_id", "office_scope_code", "office_code", COALESCE("office_rank", '-1'::integer)) WHERE ("is_active" = true);



CREATE INDEX "officer_role_emails_email_lookup_idx" ON "public"."officer_role_emails" USING "btree" ("lower"("email"));



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



CREATE INDEX "person_notes_person_created_idx" ON "public"."person_notes" USING "btree" ("person_id", "created_at" DESC);



CREATE INDEX "person_officer_terms_council_idx" ON "public"."person_officer_terms" USING "btree" ("council_id", "office_scope_code", "office_code", "service_start_year" DESC);



CREATE INDEX "person_officer_terms_current_lookup_idx" ON "public"."person_officer_terms" USING "btree" ("council_id", "service_end_year", "office_scope_code", "office_code", "service_start_year" DESC);



CREATE INDEX "person_officer_terms_person_idx" ON "public"."person_officer_terms" USING "btree" ("person_id", "service_start_year" DESC);



CREATE UNIQUE INDEX "person_profile_change_requests_one_pending_per_person_idx" ON "public"."person_profile_change_requests" USING "btree" ("person_id") WHERE ("status_code" = 'pending'::"text");



CREATE UNIQUE INDEX "person_profile_change_requests_one_pending_per_person_uidx" ON "public"."person_profile_change_requests" USING "btree" ("person_id") WHERE ("status_code" = 'pending'::"text");



CREATE INDEX "person_profile_change_requests_pending_idx" ON "public"."person_profile_change_requests" USING "btree" ("person_id", "status_code", "requested_at" DESC);



CREATE INDEX "person_profile_change_requests_person_id_idx" ON "public"."person_profile_change_requests" USING "btree" ("person_id");



CREATE INDEX "person_profile_change_requests_status_code_idx" ON "public"."person_profile_change_requests" USING "btree" ("status_code");



CREATE INDEX "supreme_update_queue_open_idx" ON "public"."supreme_update_queue" USING "btree" ("council_id", "status_code", "created_at" DESC) WHERE ("status_code" = ANY (ARRAY['pending'::"text", 'dismissed'::"text"]));



CREATE UNIQUE INDEX "uq_event_invited_councils_internal_once" ON "public"."event_invited_councils" USING "btree" ("event_id", "invited_council_id") WHERE ("invited_council_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_event_invited_councils_one_host" ON "public"."event_invited_councils" USING "btree" ("event_id") WHERE ("is_host" = true);



CREATE UNIQUE INDEX "user_access_scopes_one_active_idx" ON "public"."user_access_scopes" USING "btree" ("user_id", "scope_code") WHERE ("ends_at" IS NULL);



CREATE INDEX "user_access_scopes_user_active_idx" ON "public"."user_access_scopes" USING "btree" ("council_id", "user_id", "scope_code", "ends_at");



CREATE UNIQUE INDEX "user_admin_grants_one_active_idx" ON "public"."user_admin_grants" USING "btree" ("user_id") WHERE ("revoked_at" IS NULL);



CREATE UNIQUE INDEX "users_person_id_unique" ON "public"."users" USING "btree" ("person_id") WHERE ("person_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "brand_profiles_set_updated_at" BEFORE UPDATE ON "public"."brand_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "councils_set_updated_at" BEFORE UPDATE ON "public"."councils" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "event_person_rsvp_attendees_set_updated_at" BEFORE UPDATE ON "public"."event_person_rsvp_attendees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "event_person_rsvps_set_updated_at" BEFORE UPDATE ON "public"."event_person_rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "official_import_batches_set_updated_at" BEFORE UPDATE ON "public"."official_import_batches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "official_import_rows_set_updated_at" BEFORE UPDATE ON "public"."official_import_rows" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "official_member_records_set_updated_at" BEFORE UPDATE ON "public"."official_member_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "people_contact_change_log_trigger" AFTER UPDATE ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."log_person_contact_change"();



CREATE OR REPLACE TRIGGER "people_set_updated_at" BEFORE UPDATE ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "people_supreme_update_queue_trigger" AFTER UPDATE ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."queue_supreme_update_reminder"();



CREATE OR REPLACE TRIGGER "person_notes_set_updated_at" BEFORE UPDATE ON "public"."person_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_person_profile_change_requests_updated_at" BEFORE UPDATE ON "public"."person_profile_change_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_person_profile_change_requests_updated_at"();



CREATE OR REPLACE TRIGGER "supreme_update_queue_set_updated_at" BEFORE UPDATE ON "public"."supreme_update_queue" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "user_access_scopes_set_updated_at" BEFORE UPDATE ON "public"."user_access_scopes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "users_set_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_auth_user_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_profiles"
    ADD CONSTRAINT "brand_profiles_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brand_profiles"
    ADD CONSTRAINT "brand_profiles_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



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
    ADD CONSTRAINT "custom_lists_updated_by_auth_user_id_fkey" FOREIGN KEY ("updated_by_auth_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."event_archives"
    ADD CONSTRAINT "event_archives_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_archives"
    ADD CONSTRAINT "event_archives_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id");



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
    ADD CONSTRAINT "events_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_scope_code_fkey" FOREIGN KEY ("scope_code") REFERENCES "public"."event_scope_types"("code");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_status_code_fkey" FOREIGN KEY ("status_code") REFERENCES "public"."event_status_types"("code");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."officer_role_emails"
    ADD CONSTRAINT "officer_role_emails_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "organization_admin_assignments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_admin_assignments"
    ADD CONSTRAINT "organization_admin_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



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
    ADD CONSTRAINT "person_officer_terms_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_officer_terms"
    ADD CONSTRAINT "person_officer_terms_created_by_auth_user_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "public"."users"("id");



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



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_council_id_fkey" FOREIGN KEY ("council_id") REFERENCES "public"."councils"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE SET NULL;



ALTER TABLE "public"."access_scope_source_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."access_scope_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_admin_only" ON "public"."audit_log" FOR SELECT USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."brand_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_profiles_select_linked_to_own_council" ON "public"."brand_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organizations" "o"
     JOIN "public"."councils" "c" ON (("c"."organization_id" = "o"."id")))
  WHERE (("o"."brand_profile_id" = "brand_profiles"."id") AND ("c"."id" = "app"."current_council_id"())))));



ALTER TABLE "public"."council_activity_context_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."council_activity_level_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."council_admin_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "council_admin_assignments_delete_admin_only" ON "public"."council_admin_assignments" FOR DELETE TO "authenticated" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



CREATE POLICY "council_admin_assignments_insert_admin_only" ON "public"."council_admin_assignments" FOR INSERT TO "authenticated" WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



CREATE POLICY "council_admin_assignments_select_same_council" ON "public"."council_admin_assignments" FOR SELECT TO "authenticated" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



CREATE POLICY "council_admin_assignments_update_admin_only" ON "public"."council_admin_assignments" FOR UPDATE TO "authenticated" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."council_reengagement_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."councils" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "councils_select_own" ON "public"."councils" FOR SELECT USING (("id" = "app"."current_council_id"()));



CREATE POLICY "councils_update_admin" ON "public"."councils" FOR UPDATE USING ("app"."user_is_council_admin"("id")) WITH CHECK ("app"."user_is_council_admin"("id"));



ALTER TABLE "public"."custom_list_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_list_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."designation_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."distinction_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_archives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_council_rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_external_invitees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_external_invitees_delete_same_council" ON "public"."event_external_invitees" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_external_invitees"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_external_invitees_insert_same_council" ON "public"."event_external_invitees" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_external_invitees"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_external_invitees_select_same_council" ON "public"."event_external_invitees" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_external_invitees"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_external_invitees_update_same_council" ON "public"."event_external_invitees" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_external_invitees"."event_id") AND ("e"."council_id" = "app"."current_council_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_external_invitees"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



ALTER TABLE "public"."event_invited_council_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_invited_councils" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_invited_councils_delete_same_council" ON "public"."event_invited_councils" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invited_councils"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_invited_councils_insert_same_council" ON "public"."event_invited_councils" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invited_councils"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_invited_councils_select_same_council" ON "public"."event_invited_councils" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invited_councils"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_invited_councils_update_same_council" ON "public"."event_invited_councils" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invited_councils"."event_id") AND ("e"."council_id" = "app"."current_council_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invited_councils"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



ALTER TABLE "public"."event_message_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_message_jobs_delete_same_council" ON "public"."event_message_jobs" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_message_jobs"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_message_jobs_insert_same_council" ON "public"."event_message_jobs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_message_jobs"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_message_jobs_select_same_council" ON "public"."event_message_jobs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_message_jobs"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_message_jobs_update_same_council" ON "public"."event_message_jobs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_message_jobs"."event_id") AND ("e"."council_id" = "app"."current_council_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_message_jobs"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



ALTER TABLE "public"."event_message_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_message_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_person_rsvp_attendees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_person_rsvp_attendees_delete_same_council" ON "public"."event_person_rsvp_attendees" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."event_person_rsvps" "pr"
     JOIN "public"."events" "e" ON (("e"."id" = "pr"."event_id")))
  WHERE (("pr"."id" = "event_person_rsvp_attendees"."event_person_rsvp_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_person_rsvp_attendees_insert_same_council" ON "public"."event_person_rsvp_attendees" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."event_person_rsvps" "pr"
     JOIN "public"."events" "e" ON (("e"."id" = "pr"."event_id")))
  WHERE (("pr"."id" = "event_person_rsvp_attendees"."event_person_rsvp_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_person_rsvp_attendees_select_same_council" ON "public"."event_person_rsvp_attendees" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."event_person_rsvps" "pr"
     JOIN "public"."events" "e" ON (("e"."id" = "pr"."event_id")))
  WHERE (("pr"."id" = "event_person_rsvp_attendees"."event_person_rsvp_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_person_rsvp_attendees_update_same_council" ON "public"."event_person_rsvp_attendees" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."event_person_rsvps" "pr"
     JOIN "public"."events" "e" ON (("e"."id" = "pr"."event_id")))
  WHERE (("pr"."id" = "event_person_rsvp_attendees"."event_person_rsvp_id") AND ("e"."council_id" = "app"."current_council_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."event_person_rsvps" "pr"
     JOIN "public"."events" "e" ON (("e"."id" = "pr"."event_id")))
  WHERE (("pr"."id" = "event_person_rsvp_attendees"."event_person_rsvp_id") AND ("e"."council_id" = "app"."current_council_id"())))));



ALTER TABLE "public"."event_person_rsvps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_person_rsvps_delete_same_council" ON "public"."event_person_rsvps" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_person_rsvps"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_person_rsvps_insert_same_council" ON "public"."event_person_rsvps" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_person_rsvps"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_person_rsvps_select_same_council" ON "public"."event_person_rsvps" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_person_rsvps"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



CREATE POLICY "event_person_rsvps_update_same_council" ON "public"."event_person_rsvps" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_person_rsvps"."event_id") AND ("e"."council_id" = "app"."current_council_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_person_rsvps"."event_id") AND ("e"."council_id" = "app"."current_council_id"())))));



ALTER TABLE "public"."event_rsvp_volunteers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_scope_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_delete_same_council" ON "public"."events" FOR DELETE TO "authenticated" USING (("council_id" = "app"."current_council_id"()));



CREATE POLICY "events_insert_same_council" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (("council_id" = "app"."current_council_id"()));



CREATE POLICY "events_select_same_council" ON "public"."events" FOR SELECT TO "authenticated" USING (("council_id" = "app"."current_council_id"()));



CREATE POLICY "events_update_same_council" ON "public"."events" FOR UPDATE TO "authenticated" USING (("council_id" = "app"."current_council_id"())) WITH CHECK (("council_id" = "app"."current_council_id"()));



ALTER TABLE "public"."note_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."officer_role_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."official_import_batch_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."official_import_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "official_import_batches_admin_only" ON "public"."official_import_batches" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."official_import_review_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."official_import_row_action_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."official_import_rows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "official_import_rows_admin_only" ON "public"."official_import_rows" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."official_member_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "official_member_records_select_admin_only" ON "public"."official_member_records" FOR SELECT USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



CREATE POLICY "official_member_records_write_admin_only" ON "public"."official_member_records" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."official_membership_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_admin_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_kofc_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_membership_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_relationship_type_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_type_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_select_own_council" ON "public"."organizations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."councils" "c"
  WHERE (("c"."organization_id" = "organizations"."id") AND ("c"."id" = "app"."current_council_id"())))));



ALTER TABLE "public"."people" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "people_insert_allowed" ON "public"."people" FOR INSERT WITH CHECK (("council_id" = "app"."current_council_id"()));



CREATE POLICY "people_select_accessible" ON "public"."people" FOR SELECT USING ((("council_id" = "app"."current_council_id"()) AND ("merged_into_person_id" IS NULL) AND "app"."user_can_access_person"("id")));



CREATE POLICY "people_update_admin_only" ON "public"."people" FOR UPDATE USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."person_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_assignments_select_accessible" ON "public"."person_assignments" FOR SELECT USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_can_access_person"("person_id")));



CREATE POLICY "person_assignments_write_admin_only" ON "public"."person_assignments" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."person_contact_change_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_contact_change_log_admin_only" ON "public"."person_contact_change_log" FOR SELECT USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



CREATE POLICY "person_contact_change_log_insert_same_council" ON "public"."person_contact_change_log" FOR INSERT TO "authenticated" WITH CHECK ((("council_id" = "app"."current_council_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."people" "p"
  WHERE (("p"."id" = "person_contact_change_log"."person_id") AND ("p"."council_id" = "app"."current_council_id"()))))));



ALTER TABLE "public"."person_designations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_designations_select_accessible" ON "public"."person_designations" FOR SELECT USING ((("council_id" = "app"."current_council_id"()) AND ("app"."user_is_council_admin"("council_id") OR "app"."user_can_access_person"("person_id"))));



CREATE POLICY "person_designations_write_admin_only" ON "public"."person_designations" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."person_distinctions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_distinctions_select_accessible" ON "public"."person_distinctions" FOR SELECT USING ((("council_id" = "app"."current_council_id"()) AND ("app"."user_is_council_admin"("council_id") OR "app"."user_can_access_person"("person_id"))));



CREATE POLICY "person_distinctions_write_admin_only" ON "public"."person_distinctions" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."person_kofc_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."person_merges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_merges_admin_only" ON "public"."person_merges" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."person_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_notes_delete_admin_only" ON "public"."person_notes" FOR DELETE USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



CREATE POLICY "person_notes_insert_accessible" ON "public"."person_notes" FOR INSERT WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_can_access_person"("person_id") AND ("created_by_auth_user_id" = "auth"."uid"())));



CREATE POLICY "person_notes_select_accessible" ON "public"."person_notes" FOR SELECT USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_can_access_person"("person_id")));



CREATE POLICY "person_notes_update_creator_or_admin" ON "public"."person_notes" FOR UPDATE USING ((("council_id" = "app"."current_council_id"()) AND ("app"."user_is_council_admin"("council_id") OR (("created_by_auth_user_id" = "auth"."uid"()) AND "app"."user_can_access_person"("person_id"))))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND ("app"."user_is_council_admin"("council_id") OR (("created_by_auth_user_id" = "auth"."uid"()) AND "app"."user_can_access_person"("person_id")))));



ALTER TABLE "public"."person_officer_terms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_officer_terms_delete_admin_only" ON "public"."person_officer_terms" FOR DELETE USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



CREATE POLICY "person_officer_terms_insert_admin_only" ON "public"."person_officer_terms" FOR INSERT WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



CREATE POLICY "person_officer_terms_select_same_council" ON "public"."person_officer_terms" FOR SELECT USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_can_access_person"("person_id")));



CREATE POLICY "person_officer_terms_update_admin_only" ON "public"."person_officer_terms" FOR UPDATE USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."person_profile_change_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."person_source_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."primary_relationship_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prospect_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supreme_update_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supreme_update_queue_admin_only" ON "public"."supreme_update_queue" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."supreme_update_status_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_access_scopes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_access_scopes_select_self_or_admin" ON "public"."user_access_scopes" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))));



CREATE POLICY "user_access_scopes_write_admin_only" ON "public"."user_access_scopes" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."user_admin_grants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_admin_grants_admin_only" ON "public"."user_admin_grants" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_self_or_admin" ON "public"."users" FOR SELECT USING ((("id" = "auth"."uid"()) OR (("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))));



CREATE POLICY "users_write_admin_only" ON "public"."users" USING ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id"))) WITH CHECK ((("council_id" = "app"."current_council_id"()) AND "app"."user_is_council_admin"("council_id")));



ALTER TABLE "public"."volunteer_context_types" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "app" TO "authenticated";
GRANT USAGE ON SCHEMA "app" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "app"."add_person_note"("p_person_id" "uuid", "p_note_type_code" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."add_person_note"("p_person_id" "uuid", "p_note_type_code" "text", "p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."archive_person"("p_person_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."archive_person"("p_person_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."assign_person"("p_person_id" "uuid", "p_user_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."assign_person"("p_person_id" "uuid", "p_user_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."create_prospect"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_prospect_status_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."create_prospect"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_prospect_status_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."create_volunteer_only"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_volunteer_context_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."create_volunteer_only"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_volunteer_context_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."current_council_id"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."current_council_id"() TO "service_role";



GRANT ALL ON FUNCTION "app"."end_person_assignment"("p_assignment_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."end_person_assignment"("p_assignment_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."fraternal_year_label"("p_start_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "app"."fraternal_year_label"("p_start_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "app"."fraternal_year_start"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "app"."fraternal_year_start"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "app"."list_accessible_member_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."list_accessible_member_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "app"."update_member_local_fields"("p_person_id" "uuid", "p_council_activity_level_code" "text", "p_council_activity_context_code" "text", "p_council_reengagement_status_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."update_member_local_fields"("p_person_id" "uuid", "p_council_activity_level_code" "text", "p_council_activity_context_code" "text", "p_council_reengagement_status_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."update_nonmember_contact_fields"("p_person_id" "uuid", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_address_line_1" "text", "p_address_line_2" "text", "p_city" "text", "p_state_province" "text", "p_postal_code" "text", "p_country_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."update_nonmember_contact_fields"("p_person_id" "uuid", "p_email" "text", "p_cell_phone" "text", "p_home_phone" "text", "p_other_phone" "text", "p_address_line_1" "text", "p_address_line_2" "text", "p_city" "text", "p_state_province" "text", "p_postal_code" "text", "p_country_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_can_access_person"("p_person_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."user_can_access_person"("p_person_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_has_scope"("p_council_id" "uuid", "p_scope_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."user_has_scope"("p_council_id" "uuid", "p_scope_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "app"."user_is_council_admin"("p_council_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."user_is_council_admin"("p_council_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "app"."write_audit_log"("p_council_id" "uuid", "p_entity_table" "text", "p_entity_id" "uuid", "p_action_code" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_supreme_import_row"("p_council_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid", "p_council_number" "text", "p_title" "text", "p_first_name" "text", "p_middle_name" "text", "p_last_name" "text", "p_suffix" "text", "p_email" "text", "p_email_hash" "text", "p_cell_phone" "text", "p_cell_phone_hash" "text", "p_address_line_1" "text", "p_address_line_1_hash" "text", "p_city" "text", "p_city_hash" "text", "p_state_province" "text", "p_state_province_hash" "text", "p_postal_code" "text", "p_postal_code_hash" "text", "p_birth_date" "date", "p_birth_date_hash" "text", "p_pii_key_version" "text", "p_council_activity_level_code" "text", "p_member_number" "text", "p_first_degree_date" "date", "p_second_degree_date" "date", "p_third_degree_date" "date", "p_years_in_service" integer, "p_member_type" "text", "p_member_class" "text", "p_assembly_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_supreme_import_row"("p_council_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid", "p_council_number" "text", "p_title" "text", "p_first_name" "text", "p_middle_name" "text", "p_last_name" "text", "p_suffix" "text", "p_email" "text", "p_email_hash" "text", "p_cell_phone" "text", "p_cell_phone_hash" "text", "p_address_line_1" "text", "p_address_line_1_hash" "text", "p_city" "text", "p_city_hash" "text", "p_state_province" "text", "p_state_province_hash" "text", "p_postal_code" "text", "p_postal_code_hash" "text", "p_birth_date" "date", "p_birth_date_hash" "text", "p_pii_key_version" "text", "p_council_activity_level_code" "text", "p_member_number" "text", "p_first_degree_date" "date", "p_second_degree_date" "date", "p_third_degree_date" "date", "p_years_in_service" integer, "p_member_type" "text", "p_member_class" "text", "p_assembly_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_supreme_import_row"("p_council_id" "uuid", "p_organization_id" "uuid", "p_auth_user_id" "uuid", "p_import_mode" "text", "p_existing_person_id" "uuid", "p_council_number" "text", "p_title" "text", "p_first_name" "text", "p_middle_name" "text", "p_last_name" "text", "p_suffix" "text", "p_email" "text", "p_email_hash" "text", "p_cell_phone" "text", "p_cell_phone_hash" "text", "p_address_line_1" "text", "p_address_line_1_hash" "text", "p_city" "text", "p_city_hash" "text", "p_state_province" "text", "p_state_province_hash" "text", "p_postal_code" "text", "p_postal_code_hash" "text", "p_birth_date" "date", "p_birth_date_hash" "text", "p_pii_key_version" "text", "p_council_activity_level_code" "text", "p_member_number" "text", "p_first_degree_date" "date", "p_second_degree_date" "date", "p_third_degree_date" "date", "p_years_in_service" integer, "p_member_type" "text", "p_member_class" "text", "p_assembly_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_council_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_council_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_council_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_rsvp_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_rsvp_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_rsvp_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_person_contact_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_person_contact_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_person_contact_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_supreme_update_reminder"() TO "anon";
GRANT ALL ON FUNCTION "public"."queue_supreme_update_reminder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_supreme_update_reminder"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_person_profile_change_requests_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_person_profile_change_requests_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_person_profile_change_requests_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



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



GRANT ALL ON TABLE "public"."access_scope_source_types" TO "anon";
GRANT ALL ON TABLE "public"."access_scope_source_types" TO "authenticated";
GRANT ALL ON TABLE "public"."access_scope_source_types" TO "service_role";



GRANT ALL ON TABLE "public"."access_scope_types" TO "anon";
GRANT ALL ON TABLE "public"."access_scope_types" TO "authenticated";
GRANT ALL ON TABLE "public"."access_scope_types" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brand_profiles" TO "anon";
GRANT ALL ON TABLE "public"."brand_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_profiles" TO "service_role";



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



GRANT ALL ON TABLE "public"."designation_types" TO "anon";
GRANT ALL ON TABLE "public"."designation_types" TO "authenticated";
GRANT ALL ON TABLE "public"."designation_types" TO "service_role";



GRANT ALL ON TABLE "public"."distinction_types" TO "anon";
GRANT ALL ON TABLE "public"."distinction_types" TO "authenticated";
GRANT ALL ON TABLE "public"."distinction_types" TO "service_role";



GRANT ALL ON TABLE "public"."event_archives" TO "anon";
GRANT ALL ON TABLE "public"."event_archives" TO "authenticated";
GRANT ALL ON TABLE "public"."event_archives" TO "service_role";



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



GRANT ALL ON TABLE "public"."event_council_rsvp_rollups" TO "anon";
GRANT ALL ON TABLE "public"."event_council_rsvp_rollups" TO "authenticated";
GRANT ALL ON TABLE "public"."event_council_rsvp_rollups" TO "service_role";



GRANT ALL ON TABLE "public"."event_external_invitees" TO "anon";
GRANT ALL ON TABLE "public"."event_external_invitees" TO "authenticated";
GRANT ALL ON TABLE "public"."event_external_invitees" TO "service_role";



GRANT ALL ON TABLE "public"."event_host_summary" TO "anon";
GRANT ALL ON TABLE "public"."event_host_summary" TO "authenticated";
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



GRANT ALL ON TABLE "public"."note_types" TO "anon";
GRANT ALL ON TABLE "public"."note_types" TO "authenticated";
GRANT ALL ON TABLE "public"."note_types" TO "service_role";



GRANT ALL ON TABLE "public"."officer_role_emails" TO "anon";
GRANT ALL ON TABLE "public"."officer_role_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."officer_role_emails" TO "service_role";



GRANT ALL ON TABLE "public"."official_import_batch_status_types" TO "anon";
GRANT ALL ON TABLE "public"."official_import_batch_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."official_import_batch_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."official_import_batches" TO "anon";
GRANT ALL ON TABLE "public"."official_import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."official_import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."official_import_review_status_types" TO "anon";
GRANT ALL ON TABLE "public"."official_import_review_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."official_import_review_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."official_import_row_action_types" TO "anon";
GRANT ALL ON TABLE "public"."official_import_row_action_types" TO "authenticated";
GRANT ALL ON TABLE "public"."official_import_row_action_types" TO "service_role";



GRANT ALL ON TABLE "public"."official_import_rows" TO "anon";
GRANT ALL ON TABLE "public"."official_import_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."official_import_rows" TO "service_role";



GRANT ALL ON TABLE "public"."official_member_records" TO "anon";
GRANT ALL ON TABLE "public"."official_member_records" TO "authenticated";
GRANT ALL ON TABLE "public"."official_member_records" TO "service_role";



GRANT ALL ON TABLE "public"."official_membership_status_types" TO "anon";
GRANT ALL ON TABLE "public"."official_membership_status_types" TO "authenticated";
GRANT ALL ON TABLE "public"."official_membership_status_types" TO "service_role";



GRANT ALL ON TABLE "public"."organization_admin_assignments" TO "anon";
GRANT ALL ON TABLE "public"."organization_admin_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_admin_assignments" TO "service_role";



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



GRANT ALL ON TABLE "public"."supreme_update_queue" TO "anon";
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



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



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







