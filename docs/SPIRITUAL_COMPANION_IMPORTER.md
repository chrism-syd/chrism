# Spiritual Companion Importer

This importer loads the workbook into the normalized spiritual companion schema.

## Files
- `scripts/import_spiritual_content_from_xlsx.py`
- `scripts/spiritual_group_tag_scope.example.json`
- `scripts/requirements_spiritual_import.txt`

## What it imports
- `topic_tags` -> `spiritual_topics`, `spiritual_topic_aliases`
- `saints` -> `saints`, `saint_aliases`
- `saint_topic_map` -> `saint_topics`
- `scripture_passages` -> `scripture_passages`, `scripture_topics`
- `catechism_references` -> `catechism_references`, `catechism_topics`
- `prayers` -> `spiritual_content_items`, `spiritual_content_topics`, `spiritual_content_scopes`

## What it does NOT import yet
- `patronage_categories`
  - the starter schema did not yet include patronage tables
  - the importer reports these rows as intentionally skipped

## Safety
The importer defaults to **dry-run** mode.

That means:
- it opens a transaction
- upserts everything
- prints a summary
- rolls back

Nothing is committed unless you pass:

```bash
--write
```

## Dependencies

```bash
pip install -r scripts/requirements_spiritual_import.txt
```

## Basic run

```bash
DATABASE_URL=postgresql://...
python scripts/import_spiritual_content_from_xlsx.py \
  --xlsx ./saints_master_dataset_v1.xlsx
```

## Commit for real

```bash
DATABASE_URL=postgresql://...
python scripts/import_spiritual_content_from_xlsx.py \
  --xlsx ./saints_master_dataset_v1.xlsx \
  --write
```

## Group-specific prayers
The workbook already contains group-specific prayers such as:
- `knights_of_columbus`
- `franciscan`
- `secular_franciscan`

Those should not be flattened into global content by accident.

Use the JSON config to map those tags to organization-family or local-unit scope.

Example:

```bash
DATABASE_URL=postgresql://...
python scripts/import_spiritual_content_from_xlsx.py \
  --xlsx ./saints_master_dataset_v1.xlsx \
  --group-tag-map ./scripts/spiritual_group_tag_scope.example.json \
  --write
```

If you want to temporarily fallback unmapped group content to global scope:

```bash
--allow-unmapped-group-content-as-global
```

I would only use that for prototypes.

## Notes on workbook normalization
### Saints
The workbook repeats many saint names multiple times.
The importer normalizes saints by canonical name/slug and preserves workbook saint ID lookups internally during import.

### Topics
Topic names and topic aliases are normalized.
If scripture/catechism/prayer rows reference a topic token not present in `topic_tags`, the importer creates a lightweight dynamic topic and warns.

### Prayer scopes
Scope handling rules:
- `universal` -> `global`
- `regional` -> `global` plus territory code on the content item
- `group_specific` -> scope mapping through the JSON config or family/local-unit code lookup

## Recommended order
1. Run the schema migration first
2. Run importer in dry-run mode
3. Review warnings
4. Add/fix the group-tag mapping JSON
5. Run with `--write`

## Future improvement candidates
- Add patronage tables + patronage import
- Add daily readings importer
- Add saint/content relationships for saint-specific prayers
- Add richer text/source metadata fields if you want to preserve more of the workbook verbatim
