-- 20260401_spiritual_companion_foundation.sql
-- Purpose:
--   Foundational schema for Chrism's spiritual companion side.
--   Designed to support:
--   - global content
--   - organization-family content
--   - local-unit content
--   - saints, topics, scripture, catechism references
--   - prayers and daily readings
--
-- Notes:
--   1. This is a normalized foundation, not a direct 1:1 import of the workbook.
--   2. It intentionally avoids storing names redundantly in join tables.
--   3. It assumes existing public.organization_families and public.local_units tables.
--   4. It assumes existing public.users for user-level saves/history. Adjust if needed.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'spiritual_scope_kind') then
    create type public.spiritual_scope_kind as enum (
      'global',
      'organization_family',
      'local_unit'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'spiritual_content_kind') then
    create type public.spiritual_content_kind as enum (
      'prayer',
      'daily_reading',
      'reflection',
      'saint_profile',
      'scripture_passage',
      'catechism_reference'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'prayer_type_code') then
    create type public.prayer_type_code as enum (
      'traditional',
      'litany',
      'novena',
      'chaplet',
      'intercession',
      'blessing',
      'collect',
      'devotion',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'spiritual_text_status_code') then
    create type public.spiritual_text_status_code as enum (
      'draft',
      'review',
      'approved',
      'published',
      'retired'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'content_relationship_kind') then
    create type public.content_relationship_kind as enum (
      'variant',
      'child',
      'related',
      'companion',
      'source'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'content_saint_relationship_kind') then
    create type public.content_saint_relationship_kind as enum (
      'about',
      'to',
      'through',
      'patron'
    );
  end if;
end
$$;

create table if not exists public.spiritual_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  topic_group text null,
  description text null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.spiritual_topic_aliases (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.spiritual_topics(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (topic_id, alias)
);

create unique index if not exists spiritual_topic_aliases_alias_lower_uidx
  on public.spiritual_topic_aliases (lower(alias));

create table if not exists public.saints (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  canonical_name text not null unique,
  common_name text null,
  short_bio text null,
  feast_month smallint null check (feast_month between 1 and 12),
  feast_day smallint null check (feast_day between 1 and 31),
  era_label text null,
  canonization_status text null,
  patron_summary text null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saint_aliases (
  id uuid primary key default gen_random_uuid(),
  saint_id uuid not null references public.saints(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (saint_id, alias)
);

create unique index if not exists saint_aliases_alias_lower_uidx
  on public.saint_aliases (lower(alias));

create table if not exists public.saint_topics (
  saint_id uuid not null references public.saints(id) on delete cascade,
  topic_id uuid not null references public.spiritual_topics(id) on delete cascade,
  relevance_score smallint null check (relevance_score between 1 and 5),
  notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (saint_id, topic_id)
);

create table if not exists public.scripture_passages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  book text not null,
  chapter_start integer null,
  verse_start integer null,
  chapter_end integer null,
  verse_end integer null,
  reference_label text not null,
  summary text null,
  text_excerpt text null,
  translation_code text null default 'NRSVCE',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.scripture_topics (
  scripture_passage_id uuid not null references public.scripture_passages(id) on delete cascade,
  topic_id uuid not null references public.spiritual_topics(id) on delete cascade,
  relevance_score smallint null check (relevance_score between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (scripture_passage_id, topic_id)
);

create table if not exists public.catechism_references (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  reference_code text not null unique,
  title text null,
  summary text null,
  body_excerpt text null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.catechism_topics (
  catechism_reference_id uuid not null references public.catechism_references(id) on delete cascade,
  topic_id uuid not null references public.spiritual_topics(id) on delete cascade,
  relevance_score smallint null check (relevance_score between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (catechism_reference_id, topic_id)
);

create table if not exists public.spiritual_content_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_kind public.spiritual_content_kind not null,
  prayer_type public.prayer_type_code null,
  summary text null,
  body_markdown text null,
  body_html text null,
  language_code text not null default 'en',
  territory_code text null,
  record_type text not null default 'standalone',
  authority_level text null,
  source_label text null,
  source_url text null,
  text_status public.spiritual_text_status_code not null default 'draft',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_published boolean not null default false,
  published_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.spiritual_content_scopes (
  id uuid primary key default gen_random_uuid(),
  spiritual_content_item_id uuid not null references public.spiritual_content_items(id) on delete cascade,
  scope_kind public.spiritual_scope_kind not null,
  organization_family_id uuid null references public.organization_families(id) on delete cascade,
  local_unit_id uuid null references public.local_units(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint spiritual_content_scopes_scope_ck check (
    (scope_kind = 'global' and organization_family_id is null and local_unit_id is null) or
    (scope_kind = 'organization_family' and organization_family_id is not null and local_unit_id is null) or
    (scope_kind = 'local_unit' and organization_family_id is null and local_unit_id is not null)
  ),
  unique (spiritual_content_item_id, scope_kind, organization_family_id, local_unit_id)
);

create index if not exists spiritual_content_scopes_family_idx
  on public.spiritual_content_scopes (organization_family_id)
  where organization_family_id is not null;

create index if not exists spiritual_content_scopes_local_unit_idx
  on public.spiritual_content_scopes (local_unit_id)
  where local_unit_id is not null;

create table if not exists public.spiritual_content_topics (
  spiritual_content_item_id uuid not null references public.spiritual_content_items(id) on delete cascade,
  topic_id uuid not null references public.spiritual_topics(id) on delete cascade,
  relevance_score smallint null check (relevance_score between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (spiritual_content_item_id, topic_id)
);

create table if not exists public.spiritual_content_saints (
  spiritual_content_item_id uuid not null references public.spiritual_content_items(id) on delete cascade,
  saint_id uuid not null references public.saints(id) on delete cascade,
  relationship_kind public.content_saint_relationship_kind not null default 'about',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (spiritual_content_item_id, saint_id, relationship_kind)
);

create table if not exists public.spiritual_content_relationships (
  id uuid primary key default gen_random_uuid(),
  parent_content_item_id uuid not null references public.spiritual_content_items(id) on delete cascade,
  child_content_item_id uuid not null references public.spiritual_content_items(id) on delete cascade,
  relationship_kind public.content_relationship_kind not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (parent_content_item_id, child_content_item_id, relationship_kind),
  constraint spiritual_content_relationships_not_self_ck check (parent_content_item_id <> child_content_item_id)
);

create table if not exists public.daily_reading_entries (
  id uuid primary key default gen_random_uuid(),
  reading_date date not null unique,
  title text not null,
  summary text null,
  scripture_passage_id uuid null references public.scripture_passages(id) on delete set null,
  spiritual_content_item_id uuid null references public.spiritual_content_items(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_saved_spiritual_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  spiritual_content_item_id uuid not null references public.spiritual_content_items(id) on delete cascade,
  saved_at timestamptz not null default timezone('utc', now()),
  unique (user_id, spiritual_content_item_id)
);

create table if not exists public.user_spiritual_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  activity_code text not null,
  spiritual_content_item_id uuid null references public.spiritual_content_items(id) on delete cascade,
  daily_reading_entry_id uuid null references public.daily_reading_entries(id) on delete cascade,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_spiritual_activity_target_ck check (
    spiritual_content_item_id is not null or daily_reading_entry_id is not null
  )
);

create index if not exists user_spiritual_activity_user_created_idx
  on public.user_spiritual_activity (user_id, created_at desc);

create index if not exists spiritual_content_items_kind_published_idx
  on public.spiritual_content_items (content_kind, is_published, is_active, sort_order);

commit;
