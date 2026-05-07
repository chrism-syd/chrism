-- Do not expose zero-capability rows as effective admin package access.
-- Revoked assignments can leave grouped local-unit rows where every capability
-- is false; those rows must not become app access contexts.

begin;

create or replace view public.v_effective_admin_package_access as
select
  v.user_id,
  v.person_id,
  v.local_unit_id,
  v.local_unit_name,
  bool_or(v.area_code = 'members' and v.access_level in ('edit_manage', 'manage') and v.is_effective) as can_manage_members,
  bool_or(v.area_code = 'events' and v.access_level = 'manage' and v.is_effective) as can_manage_events,
  bool_or(v.area_code = 'custom_lists' and v.access_level in ('interact', 'manage') and v.is_effective) as can_manage_custom_lists,
  bool_or(v.area_code = 'claims' and v.access_level = 'manage' and v.is_effective) as can_manage_claims,
  bool_or(v.area_code = 'admins' and v.access_level = 'manage' and v.is_effective) as can_manage_admins,
  bool_or(v.area_code = 'local_unit_settings' and v.access_level = 'manage' and v.is_effective) as can_manage_local_unit_settings
from public.v_effective_area_access v
where v.user_id is not null
group by v.user_id, v.person_id, v.local_unit_id, v.local_unit_name
having
  bool_or(v.area_code = 'members' and v.access_level in ('edit_manage', 'manage') and v.is_effective)
  or bool_or(v.area_code = 'events' and v.access_level = 'manage' and v.is_effective)
  or bool_or(v.area_code = 'custom_lists' and v.access_level in ('interact', 'manage') and v.is_effective)
  or bool_or(v.area_code = 'claims' and v.access_level = 'manage' and v.is_effective)
  or bool_or(v.area_code = 'admins' and v.access_level = 'manage' and v.is_effective)
  or bool_or(v.area_code = 'local_unit_settings' and v.access_level = 'manage' and v.is_effective);

commit;
