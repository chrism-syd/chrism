begin;

insert into public.person_source_types (code, label)
values ('admin_invitation', 'Admin invitation')
on conflict (code) do update
set label = excluded.label;

commit;
