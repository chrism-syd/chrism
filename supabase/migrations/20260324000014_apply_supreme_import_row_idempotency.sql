begin;

create or replace function public.apply_supreme_import_row(
  p_council_id uuid,
  p_organization_id uuid,
  p_auth_user_id uuid,
  p_import_mode text,
  p_existing_person_id uuid default null,
  p_council_number text default null,
  p_title text default null,
  p_first_name text default null,
  p_middle_name text default null,
  p_last_name text default null,
  p_suffix text default null,
  p_email text default null,
  p_email_hash text default null,
  p_cell_phone text default null,
  p_cell_phone_hash text default null,
  p_address_line_1 text default null,
  p_address_line_1_hash text default null,
  p_city text default null,
  p_city_hash text default null,
  p_state_province text default null,
  p_state_province_hash text default null,
  p_postal_code text default null,
  p_postal_code_hash text default null,
  p_birth_date date default null,
  p_birth_date_hash text default null,
  p_pii_key_version text default null,
  p_council_activity_level_code text default null,
  p_member_number text default null,
  p_first_degree_date date default null,
  p_second_degree_date date default null,
  p_third_degree_date date default null,
  p_years_in_service integer default null,
  p_member_type text default null,
  p_member_class text default null,
  p_assembly_number text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
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
    select count(distinct person_id), min(person_id)
      into v_member_number_match_count, v_member_number_person_id
    from public.organization_memberships
    where organization_id = p_organization_id
      and membership_number = p_member_number;

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

comment on function public.apply_supreme_import_row(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  date,
  date,
  date,
  integer,
  text,
  text,
  text
) is 'Applies one Supreme import row atomically, preferring the existing membership number match inside the current organization so re-imports update instead of duplicating.';

commit;
