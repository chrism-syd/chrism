begin;

drop policy if exists custom_lists_parallel_select on public.custom_lists;
create policy custom_lists_parallel_select
on public.custom_lists
for select
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.v_auth_effective_resource_access rag
    where rag.resource_type = 'custom_list'
      and rag.resource_key = custom_lists.id::text
      and rag.is_effective = true
  )
  or exists (
    select 1
    from public.v_auth_effective_admin_package_access apa
    where apa.local_unit_id = custom_lists.local_unit_id
      and apa.can_manage_custom_lists = true
  )
);

drop policy if exists spiritual_content_items_signed_in_read on public.spiritual_content_items;
create policy spiritual_content_items_signed_in_read
on public.spiritual_content_items
for select
using (
  auth.uid() is not null
  and status_code = 'published'
);

drop policy if exists daily_reading_entries_signed_in_read on public.daily_reading_entries;
create policy daily_reading_entries_signed_in_read
on public.daily_reading_entries
for select
using (
  auth.uid() is not null
);

drop policy if exists spiritual_content_relationships_signed_in_read on public.spiritual_content_relationships;
create policy spiritual_content_relationships_signed_in_read
on public.spiritual_content_relationships
for select
using (
  auth.uid() is not null
);

drop policy if exists spiritual_content_saints_signed_in_read on public.spiritual_content_saints;
create policy spiritual_content_saints_signed_in_read
on public.spiritual_content_saints
for select
using (
  auth.uid() is not null
);

drop policy if exists spiritual_content_topics_signed_in_read on public.spiritual_content_topics;
create policy spiritual_content_topics_signed_in_read
on public.spiritual_content_topics
for select
using (
  auth.uid() is not null
);

drop policy if exists spiritual_content_scopes_signed_in_read on public.spiritual_content_scopes;
create policy spiritual_content_scopes_signed_in_read
on public.spiritual_content_scopes
for select
using (
  auth.uid() is not null
);

drop policy if exists scripture_passages_signed_in_read on public.scripture_passages;
create policy scripture_passages_signed_in_read
on public.scripture_passages
for select
using (
  auth.uid() is not null
);

drop policy if exists catechism_references_signed_in_read on public.catechism_references;
create policy catechism_references_signed_in_read
on public.catechism_references
for select
using (
  auth.uid() is not null
);

drop policy if exists saints_signed_in_read on public.saints;
create policy saints_signed_in_read
on public.saints
for select
using (
  auth.uid() is not null
);

drop policy if exists spiritual_topics_signed_in_read on public.spiritual_topics;
create policy spiritual_topics_signed_in_read
on public.spiritual_topics
for select
using (
  auth.uid() is not null
);

commit;
