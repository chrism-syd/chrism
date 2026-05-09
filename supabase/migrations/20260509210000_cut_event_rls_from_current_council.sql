-- Cut event RLS policies off app.current_council_id().
--
-- local_unit_id is the operational event scope truth.
-- council_id remains legacy/public/routing compatibility only.
--
-- Existing event rows are authorized through public.has_event_management_access(),
-- which is backed by v_effective_event_management_access and local-unit area access.
--
-- Inserts/updated event payloads must target a local unit where the caller has
-- events/manage access. Server/service-role flows remain unaffected.

begin;

drop policy if exists events_select_same_council on public.events;
drop policy if exists events_insert_same_council on public.events;
drop policy if exists events_update_same_council on public.events;
drop policy if exists events_delete_same_council on public.events;

create policy events_select_manageable
on public.events
for select
to authenticated
using (
  public.has_event_management_access(auth.uid(), id)
);

create policy events_insert_manageable_local_unit
on public.events
for insert
to authenticated
with check (
  local_unit_id is not null
  and exists (
    select 1
    from public.v_effective_area_access access
    where access.user_id = auth.uid()
      and access.local_unit_id = events.local_unit_id
      and access.area_code = 'events'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
      and access.is_effective = true
  )
);

create policy events_update_manageable
on public.events
for update
to authenticated
using (
  public.has_event_management_access(auth.uid(), id)
)
with check (
  local_unit_id is not null
  and exists (
    select 1
    from public.v_effective_area_access access
    where access.user_id = auth.uid()
      and access.local_unit_id = events.local_unit_id
      and access.area_code = 'events'::public.member_area_code
      and access.access_level = 'manage'::public.area_access_level
      and access.is_effective = true
  )
);

create policy events_delete_manageable
on public.events
for delete
to authenticated
using (
  public.has_event_management_access(auth.uid(), id)
);

drop policy if exists event_external_invitees_select_same_council on public.event_external_invitees;
drop policy if exists event_external_invitees_insert_same_council on public.event_external_invitees;
drop policy if exists event_external_invitees_update_same_council on public.event_external_invitees;
drop policy if exists event_external_invitees_delete_same_council on public.event_external_invitees;

create policy event_external_invitees_select_manageable_event
on public.event_external_invitees
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_external_invitees.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_external_invitees_insert_manageable_event
on public.event_external_invitees
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_external_invitees.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_external_invitees_update_manageable_event
on public.event_external_invitees
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_external_invitees.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_external_invitees.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_external_invitees_delete_manageable_event
on public.event_external_invitees
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_external_invitees.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

drop policy if exists event_invited_councils_select_same_council on public.event_invited_councils;
drop policy if exists event_invited_councils_insert_same_council on public.event_invited_councils;
drop policy if exists event_invited_councils_update_same_council on public.event_invited_councils;
drop policy if exists event_invited_councils_delete_same_council on public.event_invited_councils;

create policy event_invited_councils_select_manageable_event
on public.event_invited_councils
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_invited_councils.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_invited_councils_insert_manageable_event
on public.event_invited_councils
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_invited_councils.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_invited_councils_update_manageable_event
on public.event_invited_councils
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_invited_councils.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_invited_councils.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_invited_councils_delete_manageable_event
on public.event_invited_councils
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_invited_councils.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

drop policy if exists event_message_jobs_select_same_council on public.event_message_jobs;
drop policy if exists event_message_jobs_insert_same_council on public.event_message_jobs;
drop policy if exists event_message_jobs_update_same_council on public.event_message_jobs;
drop policy if exists event_message_jobs_delete_same_council on public.event_message_jobs;

create policy event_message_jobs_select_manageable_event
on public.event_message_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_message_jobs.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_message_jobs_insert_manageable_event
on public.event_message_jobs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_message_jobs.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_message_jobs_update_manageable_event
on public.event_message_jobs
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_message_jobs.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_message_jobs.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_message_jobs_delete_manageable_event
on public.event_message_jobs
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_message_jobs.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

drop policy if exists event_person_rsvps_select_same_council on public.event_person_rsvps;
drop policy if exists event_person_rsvps_insert_same_council on public.event_person_rsvps;
drop policy if exists event_person_rsvps_update_same_council on public.event_person_rsvps;
drop policy if exists event_person_rsvps_delete_same_council on public.event_person_rsvps;

create policy event_person_rsvps_select_manageable_event
on public.event_person_rsvps
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_person_rsvps.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_person_rsvps_insert_manageable_event
on public.event_person_rsvps
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_person_rsvps.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_person_rsvps_update_manageable_event
on public.event_person_rsvps
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_person_rsvps.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_person_rsvps.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_person_rsvps_delete_manageable_event
on public.event_person_rsvps
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_person_rsvps.event_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

drop policy if exists event_person_rsvp_attendees_select_same_council on public.event_person_rsvp_attendees;
drop policy if exists event_person_rsvp_attendees_insert_same_council on public.event_person_rsvp_attendees;
drop policy if exists event_person_rsvp_attendees_update_same_council on public.event_person_rsvp_attendees;
drop policy if exists event_person_rsvp_attendees_delete_same_council on public.event_person_rsvp_attendees;

create policy event_person_rsvp_attendees_select_manageable_event
on public.event_person_rsvp_attendees
for select
to authenticated
using (
  exists (
    select 1
    from public.event_person_rsvps pr
    join public.events e
      on e.id = pr.event_id
    where pr.id = event_person_rsvp_attendees.event_person_rsvp_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_person_rsvp_attendees_insert_manageable_event
on public.event_person_rsvp_attendees
for insert
to authenticated
with check (
  exists (
    select 1
    from public.event_person_rsvps pr
    join public.events e
      on e.id = pr.event_id
    where pr.id = event_person_rsvp_attendees.event_person_rsvp_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_person_rsvp_attendees_update_manageable_event
on public.event_person_rsvp_attendees
for update
to authenticated
using (
  exists (
    select 1
    from public.event_person_rsvps pr
    join public.events e
      on e.id = pr.event_id
    where pr.id = event_person_rsvp_attendees.event_person_rsvp_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
)
with check (
  exists (
    select 1
    from public.event_person_rsvps pr
    join public.events e
      on e.id = pr.event_id
    where pr.id = event_person_rsvp_attendees.event_person_rsvp_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

create policy event_person_rsvp_attendees_delete_manageable_event
on public.event_person_rsvp_attendees
for delete
to authenticated
using (
  exists (
    select 1
    from public.event_person_rsvps pr
    join public.events e
      on e.id = pr.event_id
    where pr.id = event_person_rsvp_attendees.event_person_rsvp_id
      and public.has_event_management_access(auth.uid(), e.id)
  )
);

commit;
