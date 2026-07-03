-- Verifies remaining council_id-bearing schema artifacts that affect the
-- organization/local-unit migration.
--
-- This script is intentionally read-only. It does not decide that every
-- council_id is wrong. It identifies which legacy/admin/officer/import/event
-- structures are still present so each can be classified before cleanup.

with target_columns as (
  select
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable
  from information_schema.columns
  where table_schema = 'public'
    and (
      column_name in ('council_id', 'legacy_council_id', 'local_unit_id', 'organization_id')
      or table_name in (
        'council_admin_assignments',
        'organization_admin_assignments',
        'person_officer_terms',
        'officer_role_emails'
      )
    )
    and table_name not like '\_%' escape '\'
),
target_tables as (
  select
    schemaname as table_schema,
    tablename as table_name,
    obj_description(format('%I.%I', schemaname, tablename)::regclass, 'pg_class') as table_comment
  from pg_tables
  where schemaname = 'public'
    and tablename in (
      'council_admin_assignments',
      'organization_admin_assignments',
      'person_officer_terms',
      'officer_role_emails'
    )
),
target_indexes as (
  select
    schemaname as table_schema,
    tablename as table_name,
    indexname,
    indexdef
  from pg_indexes
  where schemaname = 'public'
    and (
      tablename in (
        'council_admin_assignments',
        'organization_admin_assignments',
        'person_officer_terms',
        'officer_role_emails'
      )
      or indexdef ilike '%council_id%'
    )
),
target_policies as (
  select
    schemaname as table_schema,
    tablename as table_name,
    policyname,
    cmd,
    qual,
    with_check
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'council_admin_assignments',
      'organization_admin_assignments',
      'person_officer_terms',
      'officer_role_emails'
    )
),
target_triggers as (
  select
    event_object_schema as table_schema,
    event_object_table as table_name,
    trigger_name,
    action_timing,
    event_manipulation
  from information_schema.triggers
  where event_object_schema = 'public'
    and event_object_table in (
      'council_admin_assignments',
      'organization_admin_assignments',
      'person_officer_terms',
      'officer_role_emails'
    )
)
select
  'columns' as section,
  table_schema,
  table_name,
  column_name as item,
  concat(data_type, ', nullable=', is_nullable) as details
from target_columns

union all

select
  'tables' as section,
  table_schema,
  table_name,
  table_name as item,
  coalesce(table_comment, '') as details
from target_tables

union all

select
  'indexes' as section,
  table_schema,
  table_name,
  indexname as item,
  indexdef as details
from target_indexes

union all

select
  'policies' as section,
  table_schema,
  table_name,
  policyname as item,
  concat('cmd=', cmd, ' qual=', coalesce(qual, ''), ' check=', coalesce(with_check, '')) as details
from target_policies

union all

select
  'triggers' as section,
  table_schema,
  table_name,
  trigger_name as item,
  concat(action_timing, ' ', event_manipulation) as details
from target_triggers

order by section, table_name, item;
