begin;

alter table public.organization_admin_invitations
  add column if not exists accepted_assignment_id uuid
  references public.organization_admin_assignments(id)
  on delete set null;

comment on column public.organization_admin_invitations.accepted_assignment_id is
  'Admin assignment created when this invitation is accepted.';

commit;