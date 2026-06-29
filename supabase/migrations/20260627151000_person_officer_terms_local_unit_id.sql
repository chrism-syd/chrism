begin;

alter table public.person_officer_terms
  add column if not exists local_unit_id uuid;

update public.person_officer_terms term
set local_unit_id = unit.id
from public.local_units unit
where term.local_unit_id is null
  and term.council_id = unit.legacy_council_id;

alter table public.person_officer_terms
  add constraint person_officer_terms_local_unit_id_fkey
  foreign key (local_unit_id) references public.local_units(id)
  on delete restrict
  not valid;

alter table public.person_officer_terms
  validate constraint person_officer_terms_local_unit_id_fkey;

create index if not exists person_officer_terms_local_unit_id_idx
  on public.person_officer_terms (local_unit_id);

create index if not exists person_officer_terms_local_unit_person_idx
  on public.person_officer_terms (local_unit_id, person_id);

create index if not exists person_officer_terms_local_unit_office_idx
  on public.person_officer_terms (local_unit_id, office_scope_code, office_code, office_rank);

create or replace function public.set_person_officer_terms_local_unit_id()
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

drop trigger if exists person_officer_terms_set_local_unit_id on public.person_officer_terms;

create trigger person_officer_terms_set_local_unit_id
before insert or update of council_id, local_unit_id on public.person_officer_terms
for each row
execute function public.set_person_officer_terms_local_unit_id();

commit;
