-- Separate RSVP attendance from volunteer count.
--
-- A volunteer is a response, but an RSVP response is not automatically a volunteer.
-- The attendee row now carries the volunteer flag used by summaries, rosters,
-- and exports.

begin;

alter table public.event_person_rsvp_attendees
  add column if not exists is_volunteer boolean not null default false;

-- Host-added volunteer submissions are explicit volunteers.
update public.event_person_rsvp_attendees attendee
set is_volunteer = true
from public.event_person_rsvps rsvp
where attendee.event_person_rsvp_id = rsvp.id
  and rsvp.source_code = 'host_manual';

-- Old additional-person rows were labelled as volunteers by the previous UI copy.
-- Keep that historical meaning for non-primary attendees on volunteer-enabled events.
update public.event_person_rsvp_attendees attendee
set is_volunteer = true
from public.event_person_rsvps rsvp
join public.events event
  on event.id = rsvp.event_id
where attendee.event_person_rsvp_id = rsvp.id
  and rsvp.source_code in ('public_link', 'email_link')
  and event.needs_volunteers = true
  and attendee.is_primary = false;

-- Volunteer-only events had no separate RSVP intent, so a public/email primary row
-- is the volunteer.
update public.event_person_rsvp_attendees attendee
set is_volunteer = true
from public.event_person_rsvps rsvp
join public.events event
  on event.id = rsvp.event_id
where attendee.event_person_rsvp_id = rsvp.id
  and rsvp.source_code in ('public_link', 'email_link')
  and event.needs_volunteers = true
  and event.requires_rsvp = false
  and attendee.is_primary = true;

drop view if exists public.event_person_rsvp_summary;

create view public.event_person_rsvp_summary
with (security_invoker = true)
as
select
  rsvp.event_id,
  count(distinct rsvp.id) as active_submission_count,
  count(attendee.id) filter (where attendee.is_volunteer = true) as total_volunteer_count,
  max(rsvp.last_responded_at) as last_responded_at
from public.event_person_rsvps rsvp
left join public.event_person_rsvp_attendees attendee
  on attendee.event_person_rsvp_id = rsvp.id
where rsvp.status_code = 'active'
group by rsvp.event_id;

grant select on public.event_person_rsvp_summary to anon, authenticated, service_role;

commit;
