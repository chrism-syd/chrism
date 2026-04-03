-- Spiritual read policies for authenticated users
-- and custom_lists select policy fix to avoid recursive policy/function loops.

alter table public.spiritual_content_items enable row level security;
alter table public.spiritual_content_topics enable row level security;
alter table public.spiritual_content_scopes enable row level security;
alter table public.spiritual_content_relationships enable row level security;
alter table public.spiritual_topics enable row level security;
alter table public.spiritual_topic_aliases enable row level security;
alter table public.saints enable row level security;
alter table public.saint_aliases enable row level security;
alter table public.saint_topics enable row level security;
alter table public.scripture_passages enable row level security;
alter table public.scripture_topics enable row level security;
alter table public.catechism_references enable row level security;
alter table public.catechism_topics enable row level security;

drop policy if exists "read published spiritual content items" on public.spiritual_content_items;
create policy "read published spiritual content items"
on public.spiritual_content_items
for select
to authenticated
using (is_published = true);

drop policy if exists "read spiritual content topics" on public.spiritual_content_topics;
create policy "read spiritual content topics"
on public.spiritual_content_topics
for select
to authenticated
using (true);

drop policy if exists "read spiritual content scopes" on public.spiritual_content_scopes;
create policy "read spiritual content scopes"
on public.spiritual_content_scopes
for select
to authenticated
using (true);

drop policy if exists "read spiritual content relationships" on public.spiritual_content_relationships;
create policy "read spiritual content relationships"
on public.spiritual_content_relationships
for select
to authenticated
using (true);

drop policy if exists "read spiritual topics" on public.spiritual_topics;
create policy "read spiritual topics"
on public.spiritual_topics
for select
to authenticated
using (true);

drop policy if exists "read spiritual topic aliases" on public.spiritual_topic_aliases;
create policy "read spiritual topic aliases"
on public.spiritual_topic_aliases
for select
to authenticated
using (true);

drop policy if exists "read saints" on public.saints;
create policy "read saints"
on public.saints
for select
to authenticated
using (true);

drop policy if exists "read saint aliases" on public.saint_aliases;
create policy "read saint aliases"
on public.saint_aliases
for select
to authenticated
using (true);

drop policy if exists "read saint topics" on public.saint_topics;
create policy "read saint topics"
on public.saint_topics
for select
to authenticated
using (true);

drop policy if exists "read scripture passages" on public.scripture_passages;
create policy "read scripture passages"
on public.scripture_passages
for select
to authenticated
using (true);

drop policy if exists "read scripture topics" on public.scripture_topics;
create policy "read scripture topics"
on public.scripture_topics
for select
to authenticated
using (true);

drop policy if exists "read catechism references" on public.catechism_references;
create policy "read catechism references"
on public.catechism_references
for select
to authenticated
using (true);

drop policy if exists "read catechism topics" on public.catechism_topics;
create policy "read catechism topics"
on public.catechism_topics
for select
to authenticated
using (true);

-- Replace the recursive custom list select policy with direct area/resource checks.
drop policy if exists custom_lists_parallel_select on public.custom_lists;
create policy custom_lists_parallel_select
on public.custom_lists
for select
to authenticated
using (
  public.auth_has_area_access(
    local_unit_id,
    'custom_lists'::public.member_area_code,
    'interact'::public.area_access_level
  )
  or public.auth_has_resource_access(
    local_unit_id,
    'custom_list'::public.resource_type_code,
    (id)::text,
    'interact'::public.area_access_level
  )
);
