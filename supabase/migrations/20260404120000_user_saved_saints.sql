begin;

create table if not exists public.user_saved_saints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  saint_id uuid not null references public.saints(id) on delete cascade,
  saved_at timestamptz not null default timezone('utc', now()),
  unique (user_id, saint_id)
);

create index if not exists user_saved_saints_user_saved_idx
  on public.user_saved_saints (user_id, saved_at desc);

commit;
