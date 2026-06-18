begin;

alter table public.organizations
  add column if not exists public_page_enabled boolean not null default true,
  add column if not exists public_description text,
  add column if not exists public_contact_form_enabled boolean not null default true;

create table if not exists public.local_unit_external_links (
  id uuid primary key default gen_random_uuid(),
  local_unit_id uuid not null references public.local_units(id) on delete cascade,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by_auth_user_id uuid null,
  updated_by_auth_user_id uuid null,
  constraint local_unit_external_links_label_not_blank check (length(btrim(label)) > 0),
  constraint local_unit_external_links_url_not_blank check (length(btrim(url)) > 0),
  constraint local_unit_external_links_sort_order_nonnegative check (sort_order >= 0)
);

create index if not exists local_unit_external_links_local_unit_id_idx
  on public.local_unit_external_links (local_unit_id);

create index if not exists local_unit_external_links_active_sort_idx
  on public.local_unit_external_links (local_unit_id, sort_order, created_at)
  where is_active = true;

drop trigger if exists local_unit_external_links_set_updated_at on public.local_unit_external_links;
create trigger local_unit_external_links_set_updated_at
before update on public.local_unit_external_links
for each row
execute function public.set_updated_at();

create or replace function public.enforce_local_unit_external_links_active_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_active_count integer;
begin
  if new.is_active then
    select count(*)
    into v_active_count
    from public.local_unit_external_links
    where local_unit_id = new.local_unit_id
      and is_active = true
      and id <> new.id;

    if v_active_count >= 3 then
      raise exception 'A local unit can have at most 3 active public external links.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists local_unit_external_links_active_limit on public.local_unit_external_links;
create trigger local_unit_external_links_active_limit
before insert or update of local_unit_id, is_active on public.local_unit_external_links
for each row
execute function public.enforce_local_unit_external_links_active_limit();

commit;
