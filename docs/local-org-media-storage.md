# Local organization media storage

This document defines where local organization images and related media should live. It is intentionally boring. Boring storage is findable storage.

## Principles

- Do not store organization or person uploads in the Next.js `/public` directory.
- Store uploaded media in Supabase Storage buckets.
- Store durable references in database columns as `storage_bucket` and `storage_path`.
- Prefer private buckets for anything person-linked or organization-admin-controlled.
- Public pages should use signed URLs or controlled public delivery, not raw app files.
- Path prefixes should begin with the owning local unit so cleanup, export, and future migrations stay manageable.
- Keep originals and generated/derived images in separate folders when image processing is added.

## Buckets

### `people-portraits`

Private bucket for person-linked images.

Use this for:

- Person profile images.
- Public officer portraits.
- Future member/person avatar-style images.

Recommended paths:

```text
local-units/{localUnitId}/people/{personId}/profile/{uuid}.{ext}
local-units/{localUnitId}/people/{personId}/public-officers/{personOfficerTermId}/portrait/{uuid}.{ext}
```

Notes:

- A person profile image belongs to the person.
- A public officer portrait belongs to the public role presentation and can override the person profile image.
- Existing older paths may continue to resolve because the database stores the full storage path.

### Future `local-org-media`

Use a separate bucket for organization-owned public page media that is not tied to a person.

Recommended paths:

```text
local-units/{localUnitId}/profile/logo/{uuid}.{ext}
local-units/{localUnitId}/public-page/hero/{uuid}.{ext}
local-units/{localUnitId}/public-page/gallery/{uuid}.{ext}
local-units/{localUnitId}/public-page/documents/{uuid}.{ext}
```

This keeps local organization assets separate from person portraits.

## Derived image variants

If image processing is added later, keep originals and generated files separate.

Example:

```text
local-units/{localUnitId}/public-page/gallery/original/{uuid}.{ext}
local-units/{localUnitId}/public-page/gallery/derived/card/{uuid}.webp
local-units/{localUnitId}/public-page/gallery/derived/hero/{uuid}.webp
```

## Database conventions

Use paired columns for references:

```text
*_storage_bucket text null
*_storage_path text null
```

The pair should either both be null or both be set.

For portraits or crop-aware images, use these companion fields where appropriate:

```text
*_zoom numeric(5,2) default 1
*_position_x numeric(5,2) default 50
*_position_y numeric(5,2) default 50
```

Suggested constraints:

```text
zoom: 1 to 3
position x/y: 0 to 100
alt text: null or non-blank
```

## Current implementation notes

- `local_unit_public_officers.photo_storage_bucket` and `photo_storage_path` store role-specific public officer portraits.
- `people.profile_image_storage_bucket` and `profile_image_storage_path` are reserved for quiet person profile images.
- Public officer pages should prefer the role-specific portrait first. A later feature may fall back to the person profile image when no officer-specific portrait exists.

## Manual deployment note

The repository currently disables automatic Vercel Git deployments in `vercel.json` while the project is constrained by free-plan deployment limits. Manual deploys remain available with:

```bash
npx vercel --prod
```
