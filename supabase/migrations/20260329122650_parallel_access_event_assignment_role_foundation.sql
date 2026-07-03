begin;

-- Brings the early event_assignments foundation up to the role-aware shape
-- expected by later parallel-access migrations.

create table if not exists public.event_assignment_roles (
  code text primary key,
  label text not null,
  precedence integer not null default 100
);

insert into public.event_assignment_roles (
  code,
  label,
  precedence
)
values (
  'manager',
  'Manager',
  100
)
on conflict (code) do update
set
  label = excluded.label,
  precedence = excluded.precedence;

alter table public.event_assignments
  add column if not exists role_code text;

update public.event_assignments
set role_code = 'manager'
where role_code is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_assignments_role_code_fkey'
      and conrelid = 'public.event_assignments'::regclass
  ) then
    alter table public.event_assignments
      add constraint event_assignments_role_code_fkey
      foreign key (role_code)
      references public.event_assignment_roles(code)
      on delete restrict;
  end if;
end
$$;

create index if not exists idx_event_assignments_event_role
  on public.event_assignments (event_id, role_code);

create unique index if not exists uq_event_assignments_scope_v2
  on public.event_assignments (event_id, member_record_id, role_code)
  where event_id is not null;

commit;
