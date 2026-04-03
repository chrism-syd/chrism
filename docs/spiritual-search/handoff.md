# Spiritual Search Handoff

## What this handoff is for
This handoff is for the next helper working with Syd on the Chrism **Spiritual Search** feature.

This is **not implemented yet** as full search logic in the codebase. The current state is:
- the prayer-library UI exists in the repo
- the product direction has been changed from **Prayer Library** to **Spiritual Search**
- blank populate-ready data templates were created
- the intended retrieval/search behavior has been defined

## Current product decision
The page should be called **Spiritual Search** instead of **Prayer Library**.

This page should have **one search bar**.

That single search bar is intended to search across multiple spiritual content families:
- prayers
- saints
- catechism references
- scripture later (optional for MVP)
- topics and topic aliases as the shared retrieval spine

## The intended singular search-bar logic
This logic is important and should be treated as the current product direction.

### User input
One search bar should accept:
- saint names
- topic keywords
- words from a prayer
- catechism-related keywords

### Search flow
1. Check for **direct text matches** first
   - prayer title / summary / body
   - saint name / common name / aliases
   - catechism title / excerpt / section reference
   - scripture reference later

2. Resolve to **canonical topics** where possible
   - through saint match
   - through topic alias match
   - through direct topic-name match

3. Expand results through the topic network
   - saint -> saint_topics -> topics
   - topics -> spiritual_content_topics -> prayers
   - topics -> catechism_topics -> catechism references
   - topics -> scripture_topics -> scripture later

4. Return **grouped results**, not one mixed pile
   - Saints
   - Prayers
   - Catechism
   - Scripture later

### Ranking intent for MVP
Preferred ranking order:
1. exact text matches
2. exact saint match -> topic-related content
3. exact topic match -> related content
4. weaker text matches

### UX direction
- keep the page calm
- do not force the user to pick a search mode first
- do not turn the page into a giant mixed card pile
- show grouped sections
- include light “why this matched” language later if helpful

## Data / spreadsheet direction
### What Syd is using now
Syd has an enriched saint source spreadsheet / CSV with these useful columns:
- Saint ID
- Canonical Name
- Common Name
- Feast Day
- Feast Day ISO
- Era
- Canonization Status
- Primary Patronage Category
- Patronages
- Short Bio
- Associated Topics
- Source 1
- Source 2
- Normalized Primary Patronage Category
- Normalized Patronages
- Normalized Topics

### Important modeling rule
Do **not** put prayer text into the saint source sheet.

Prayer text belongs with the prayer records.

Saints should connect to prayers through:
- normalized topics
- optional saint aliases
- optional curated saint-prayer override mapping later if needed

### MVP recommendation
For MVP, use topics as the main connector:
- saint name -> saint
- saint -> saint topics
- saint topics -> prayers / catechism / scripture

No AI required for this first pass.

## File/template kit that was created
The blank template kit was created to support this feature.
It includes:
- authoring/saints_master_source.csv
- core/saints.csv
- core/spiritual_topics.csv
- core/spiritual_topic_aliases.csv
- core/saint_aliases.csv
- core/saint_topics.csv
- core/spiritual_content_items.csv
- core/spiritual_content_topics.csv
- core/catechism_references.csv
- core/catechism_topics.csv
- optional/scripture_passages.csv
- optional/scripture_topics.csv
- optional/spiritual_content_relationships.csv
- optional/spiritual_content_scopes.csv
- optional/patronage_categories_reference.csv

## Working recommendation for the next helper
1. Keep Syd’s saint source sheet as the editorial source of truth
2. Do not duplicate prayer text into saint rows
3. Build Spiritual Search around topic links first
4. Rename the page to Spiritual Search in the UI when implementation begins
5. When implementing search, prefer deterministic retrieval over AI for MVP
6. Group results by content family

## What is already in the repo vs not yet built
### Already in repo
- the existing prayer library pages and styles
- basic client-side prayer text/title filtering
- basic prayer retrieval from `spiritual_content_items`

### Not yet built
- the broader Spiritual Search page experience
- grouped mixed results
- saint/topic/catechism expansion logic
- data loaders for the new templates
- topic-driven retrieval across multiple content families

## Guiding product principle
This should feel like a calm, trustworthy spiritual search surface, not a chaotic search engine and not an AI chatbot first.
