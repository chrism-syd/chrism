begin;

do $$
declare
  v_remaining_dependencies integer;
begin
  select count(*)
    into v_remaining_dependencies
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where p.prokind = 'f'
    and n.nspname in ('app', 'public')
    and pg_get_functiondef(p.oid) ilike '%app.current_council_id%'
    and not (
      n.nspname = 'app'
      and p.proname in (
        'current_council_id',
        'create_prospect',
        'create_volunteer_only'
      )
    );

  if v_remaining_dependencies <> 0 then
    raise exception
      'Refusing to drop app.current_council_id(): found % unexpected function dependencies',
      v_remaining_dependencies;
  end if;
end;
$$;

drop function if exists app.create_prospect(
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

drop function if exists app.create_volunteer_only(
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

drop function if exists app.current_council_id();

comment on function app.create_prospect_for_local_unit(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) is
'Service-role-only local-unit-first prospect creation helper. Browser execution intentionally revoked; app code should prefer explicit local_unit_id ownership.';

comment on function app.create_volunteer_only_for_local_unit(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) is
'Service-role-only local-unit-first volunteer-only creation helper. Browser execution intentionally revoked; app code should prefer explicit local_unit_id ownership.';

commit;
