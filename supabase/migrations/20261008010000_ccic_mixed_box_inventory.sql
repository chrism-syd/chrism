create table if not exists public.ccic_mixed_box_commitments (
  mixed_catalog_id text primary key,
  committed_mixed_boxes integer not null default 0 check (committed_mixed_boxes >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ccic_mixed_box_commitments enable row level security;
revoke all on table public.ccic_mixed_box_commitments from anon, authenticated;
grant all on table public.ccic_mixed_box_commitments to service_role;

comment on table public.ccic_mixed_box_commitments is
  'Tracks committed school mixed boxes. Each group of 1-4 mixed boxes reserves one whole source box from each of the four designs in its collection.';
