-- Pin search_path on functions flagged by Supabase Security Advisor.
--
-- This hardens function name resolution without changing function bodies,
-- permissions, or security-definer/invoker mode.
--
-- For public functions, keep public first because historical function bodies
-- commonly reference public tables/types/functions without schema qualification.
-- Include app for any app-schema helper references, and pg_temp last.
--
-- For app functions, keep app first, then public, then pg_temp.

begin;

do $$
declare
  v_function_names text[] := array[
    'has_area_access',
    'set_person_profile_change_requests_updated_at',
    'list_accessible_local_units_for_area',
    'sync_local_unit_id_from_legacy_council',
    'auth_can_manage_person',
    'has_resource_access',
    'has_event_management_access',
    'auth_can_manage_person_notes',
    'auth_can_manage_person_assignments',
    'ensure_parallel_member_for_user_and_local_unit',
    'list_accessible_custom_lists_for_user',
    'list_manageable_event_ids_for_user',
    'trg_sync_parallel_area_grants_from_org_admin_assignment',
    'sync_parallel_area_grants_from_org_admin_assignment',
    'ensure_member_record_for_person_local_unit',
    'auth_has_area_access',
    'auth_has_resource_access',
    'auth_has_event_management_access',
    'auth_accessible_local_units_for_area',
    'auth_accessible_custom_lists',
    'auth_manageable_event_ids',
    'parallel_grant_source_rank',
    'approve_membership_claim_request_to_admin_package',
    'reject_membership_claim_request_in_parallel',
    'ensure_parallel_membership_for_org_admin_assignment',
    'upsert_parallel_admin_package_for_member',
    'trg_sync_parallel_admin_package_from_council_admin_assignment',
    'trg_sync_parallel_admin_package_from_org_admin_assignment',
    'backfill_missing_parallel_admin_packages',
    'backfill_missing_parallel_custom_list_grants',
    'backfill_missing_parallel_event_managers',
    'log_person_contact_change',
    'queue_supreme_update_reminder',
    'ensure_user_unit_relationship_for_user_member',
    'set_updated_at',
    'sync_parallel_admin_package_from_council_admin_assignment',
    'sync_parallel_admin_package_from_org_admin_assignment',
    'revoke_parallel_admin_package_from_user',
    'grant_parallel_custom_list_access_to_user',
    'revoke_parallel_custom_list_access_from_user',
    'cleanup_parallel_invite_package_subject',
    'user_can_access_event',
    'user_can_manage_event',
    'upsert_parallel_event_assignment_for_user',
    'revoke_parallel_event_assignment_from_user',
    'grant_parallel_admin_package_to_user',
    'generate_rsvp_token',
    'current_user_council_id',
    'user_belongs_to_council',
    'user_is_council_admin'
  ];
  v_row record;
begin
  for v_row in
    select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and p.proname = any (v_function_names)
  loop
    execute format(
      'alter function %I.%I(%s) set search_path to public, app, pg_temp',
      v_row.nspname,
      v_row.proname,
      v_row.args
    );
  end loop;
end $$;

do $$
declare
  v_function_names text[] := array[
    'fraternal_year_start',
    'fraternal_year_label'
  ];
  v_row record;
begin
  for v_row in
    select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and p.prokind in ('f', 'p')
      and p.proname = any (v_function_names)
  loop
    execute format(
      'alter function %I.%I(%s) set search_path to app, public, pg_temp',
      v_row.nspname,
      v_row.proname,
      v_row.args
    );
  end loop;
end $$;

commit;
