begin;

alter table public.organizations
  add column if not exists annual_term_mode text not null default 'calendar',
  add column if not exists annual_term_label text not null default 'Calendar Year',
  add column if not exists annual_term_start_month integer not null default 1,
  add column if not exists annual_term_start_day integer not null default 1;

alter table public.organizations
  drop constraint if exists organizations_annual_term_mode_check;

alter table public.organizations
  add constraint organizations_annual_term_mode_check
  check (annual_term_mode in ('calendar', 'custom'));

alter table public.organizations
  drop constraint if exists organizations_annual_term_start_month_check;

alter table public.organizations
  add constraint organizations_annual_term_start_month_check
  check (annual_term_start_month between 1 and 12);

alter table public.organizations
  drop constraint if exists organizations_annual_term_start_day_check;

alter table public.organizations
  add constraint organizations_annual_term_start_day_check
  check (annual_term_start_day between 1 and 31);

update public.organizations
set
  annual_term_mode = 'custom',
  annual_term_label = 'Fraternal Year',
  annual_term_start_month = 7,
  annual_term_start_day = 1
where organization_type_code in ('knights_of_columbus', 'kofc_council')
  and annual_term_mode = 'calendar'
  and annual_term_label = 'Calendar Year'
  and annual_term_start_month = 1
  and annual_term_start_day = 1;

comment on column public.organizations.annual_term_mode is
  'Parent organization annual operating term mode: calendar or custom.';

comment on column public.organizations.annual_term_label is
  'Display label for the parent organization annual operating term, such as Calendar Year, Fraternal Year, Fiscal Year, or Program Year.';

comment on column public.organizations.annual_term_start_month is
  'Month number when the parent organization annual operating term begins. Local units inherit this unless an explicit override is introduced later.';

comment on column public.organizations.annual_term_start_day is
  'Day of month when the parent organization annual operating term begins. Local units inherit this unless an explicit override is introduced later.';

commit;
