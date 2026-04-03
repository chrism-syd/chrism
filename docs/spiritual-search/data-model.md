# Spiritual Search Data Model

This doc describes the blank template files added for the Spiritual Search MVP.

## Product direction
- Rename the current prayer-library concept to **Spiritual Search**
- Use **one singular search bar**
- Accept saint names, prayer words, topic words, and catechism-related terms
- For MVP, use direct matches first, then topic expansion
- Return grouped results across Saints, Prayers, Catechism, and Scripture later

## File roles

### authoring/saints_master_source.csv
Editorial source-of-truth sheet for saint research. This is the working sheet Syd populates first. It is not the final import format.

Columns:
- `Saint ID`
- `Canonical Name`
- `Common Name`
- `Feast Day`
- `Feast Day ISO`
- `Era`
- `Canonization Status`
- `Primary Patronage Category`
- `Patronages`
- `Short Bio`
- `Associated Topics`
- `Source 1`
- `Source 2`
- `Normalized Primary Patronage Category`
- `Normalized Patronages`
- `Normalized Topics`

### core/spiritual_topics.csv
Canonical topic list used as the retrieval spine for Spiritual Search.

Columns:
- `slug`
- `name`
- `topic_group`
- `description`
- `is_active`
- `sort_order`
- `source_kind`
- `source_ref`

### core/spiritual_topic_aliases.csv
Alias table so search terms can resolve to canonical topics.

Columns:
- `topic_slug`
- `alias`
- `alias_kind`

### core/saints.csv
Import-ready saint records derived from the authoring sheet.

Columns:
- `slug`
- `canonical_name`
- `common_name`
- `short_bio`
- `feast_month`
- `feast_day`
- `era_label`
- `canonization_status`
- `patron_summary`
- `is_active`
- `source_1`
- `source_2`
- `review_status`
- `data_tier`
- `workbook_saint_id`

### core/saint_aliases.csv
Alternate saint names used for lookup and search.

Columns:
- `saint_slug`
- `alias`

### core/saint_topics.csv
Maps saints to canonical topics. This is the main saint-to-topic bridge for search expansion.

Columns:
- `saint_slug`
- `topic_slug`
- `relevance_score`
- `notes`
- `source_map_id`

### core/spiritual_content_items.csv
Prayer/content records. For MVP, this is where prayer text lives. Do not place prayer text in the saint authoring sheet.

Columns:
- `slug`
- `title`
- `content_kind`
- `prayer_type`
- `summary`
- `body_markdown`
- `body_html`
- `language_code`
- `territory_code`
- `record_type`
- `authority_level`
- `source_label`
- `source_url`
- `text_status`
- `sort_order`
- `is_active`
- `is_published`
- `published_at`
- `variant_label`
- `is_primary_variant`
- `source_body`
- `notes`
- `workbook_prayer_id`

### core/spiritual_content_topics.csv
Maps prayer/content records to canonical topics.

Columns:
- `content_slug`
- `topic_slug`
- `relevance_score`

### core/catechism_references.csv
Catechism excerpts or references that can be surfaced by topic.

Columns:
- `slug`
- `reference_code`
- `title`
- `summary`
- `body_excerpt`
- `is_active`
- `source_1`
- `source_2`
- `workbook_catechism_id`

### core/catechism_topics.csv
Maps catechism references to canonical topics.

Columns:
- `catechism_slug`
- `topic_slug`
- `relevance_score`

## Optional later files
These are included in the template pack but are not required for the first Spiritual Search pass:
- `optional/scripture_passages.csv`
- `optional/scripture_topics.csv`
- `optional/spiritual_content_relationships.csv`
- `optional/spiritual_content_scopes.csv`
- `optional/patronage_categories_reference.csv`

## Working rules
- Keep saint facts in `authoring/saints_master_source.csv`
- Keep prayer text in `core/spiritual_content_items.csv`
- Use topic maps, not duplicated prayer text in saint rows
- Use `spiritual_topics` and `spiritual_topic_aliases` as the shared search vocabulary
- Scripture can join later without changing the core search concept

## Intended singular-search flow
1. User types in one search bar
2. Resolve direct text matches first
3. Resolve saint names and topic aliases to canonical topics
4. Expand through:
   - saint -> saint_topics
   - topics -> spiritual_content_topics
   - topics -> catechism_topics
   - topics -> scripture_topics later
5. Return grouped results:
   - Saints
   - Prayers
   - Catechism
   - Scripture later
