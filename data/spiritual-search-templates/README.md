# Spiritual Search template kit

This kit gives you two layers:

1. authoring/saints_master_source.csv
   - your editorial saint source sheet
   - matches the columns in your enriched saints spreadsheet

2. core/*.csv
   - import-ready seed bundle templates for the MVP Spiritual Search build

3. optional/*.csv
   - later-stage templates you can ignore for the first pass

## Fill these first
- core/spiritual_topics.csv
- core/spiritual_topic_aliases.csv
- core/saints.csv
- core/saint_aliases.csv
- core/saint_topics.csv
- core/spiritual_content_items.csv
- core/spiritual_content_topics.csv
- core/catechism_references.csv
- core/catechism_topics.csv

## Good working pattern
- Maintain saint facts in authoring/saints_master_source.csv
- Later generate import-ready core/saints.csv, core/saint_aliases.csv, and core/saint_topics.csv from that source
- Keep prayer text in core/spiritual_content_items.csv, not in the saint sheet

## Notes
- Leave optional/*.csv alone unless you want scripture, scoped content, or editorial patronage reference material in the next round.
- For MVP, one search bar can fan out across saints, prayers, and catechism through topic links.

## Quick field hints
- slug fields: lowercase, hyphenated, stable identifiers
- relevance_score: use a simple scale like 1.0 for strong match, 0.7 for secondary, 0.4 for light
- is_active / is_published / is_primary_variant: use true or false
- sort_order: whole numbers
- published_at: ISO timestamp when needed, e.g. 2026-04-03T00:00:00Z
