insert into public.event_message_types (code, label, sort_order)
values
  ('volunteer_confirmation', 'Volunteer confirmation', 40),
  ('volunteer_removed', 'Volunteer removed', 50),
  ('volunteer_reminder', 'Volunteer reminder', 60)
on conflict (code) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order;
