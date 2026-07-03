-- Restore security posture for event RSVP rollup views after recreating them
-- during event council_id retirement.

alter view public.event_council_rsvp_rollups
  set (security_invoker = true);

alter view public.event_host_summary
  set (security_invoker = true);

revoke all on table public.event_council_rsvp_rollups from anon;
revoke all on table public.event_council_rsvp_rollups from authenticated;

revoke all on table public.event_host_summary from anon;
revoke all on table public.event_host_summary from authenticated;

grant all on table public.event_council_rsvp_rollups to service_role;
grant all on table public.event_host_summary to service_role;

comment on view public.event_council_rsvp_rollups is
  'Server-side council RSVP rollup view. security_invoker enabled; direct browser-role access revoked.';

comment on view public.event_host_summary is
  'Server-side event host summary view. security_invoker enabled; direct browser-role access revoked.';
