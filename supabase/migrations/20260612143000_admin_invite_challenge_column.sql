alter table public.organization_admin_invitations
add column if not exists challenge_response_hash text;
