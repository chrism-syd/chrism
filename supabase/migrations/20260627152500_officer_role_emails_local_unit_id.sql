begin;

alter table public.officer_role_emails
  add column if not exists local_unit_id uuid;

update public.officer_role_emails email
set local_unit_id = unit.id
from public.local_units unit
where email.local_unit_id is null
  and email.council_id = unit.legacy_council_id;

alter table public.officer_role_emails
  add constraint officer_role_emails_local_unit_id_fkey
  foreign key (local_unit_id) references public.local_units(id)
  on delete restrict
  not valid;

alter table public.officer_role_emails
  validate constraint officer_role_emails_local_unit_id_fkey;

create index if not exists officer_role_emails_local_unit_id_idx
  on public.officer_role_emails (local_unit_id);

create index if not exists officer_role_emails_local_unit_office_idx
  on public.officer_role_emails (local_unit_id, office_scope_code, office_code, office_rank)
  where is_active = true;

create or replace function public.set_officer_role_emails_local_unit_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.local_unit_id is null and new.council_id is not null then
    select unit.id
      into new.local_unit_id
      from public.local_units unit
      where unit.legacy_council_id = new.council_id
      order by unit.created_at asc
      limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists officer_role_emails_set_local_unit_id on public.officer_role_emails;

create trigger officer_role_emails_set_local_unit_id
before insert or update of council_id, local_unit_id on public.officer_role_emails
for each row
execute function public.set_officer_role_emails_local_unit_id();

commit;
