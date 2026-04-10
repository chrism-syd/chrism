begin;

create or replace function app.user_has_scope(p_council_id uuid, p_scope_code text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.user_access_scopes s
    join public.users u
      on u.id = s.user_id
    where u.id = auth.uid()
      and u.is_active = true
      and s.council_id = p_council_id
      and s.scope_code = p_scope_code
      and s.ends_at is null
      and s.starts_at <= now()
  )
$$;

commit;
