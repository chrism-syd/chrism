# Handoff - June 7 - Schools landing page and invoice upload repair

## Purpose

This is the clean handoff for continuing Syd's Chrism public landing page work after a long, laggy chat and a frustrating follow-up pass. Use this file as the current project handoff.

Repo: `chrism-syd/chrism`  
Branch: `main`  
Primary page in progress: `/schools`  
Current route file: `app/schools/page.tsx`

## Working style and quality bar

Syd is art-directing the page live. Small visual choices matter: spacing, column width, overlap, image placement, line breaks, hierarchy, and section rhythm.

Avoid broad rewrites. Inspect the current files first, then make the smallest targeted change that addresses the specific request. Do not change unrelated sections. Do not remove earlier intentional work unless Syd explicitly asks.

Syd is frustrated by repeated backpedaling. If uncertain, say what is uncertain and make a conservative adjustment. Do not claim a feature works unless the implementation actually supports it.

Preferred workflow:

- Small scoped commits to `main`.
- Keep responses concise and include commit IDs.
- Avoid full-site lint/build unless Syd asks.
- Use targeted checks for touched files only.
- For visual CSS work, browser preview matters more than broad lint.
- For local `/public` assets, update references and remind Syd to add/commit/push the asset if deployment complains.

## Key files

Schools page:

- `app/schools/page.tsx`
- `app/school-landing.module.css`
- `app/school-supplies-section.tsx`
- `app/school-how-it-works-section.tsx`

Invoice CTA/upload:

- `app/invoice-review-cta.tsx`
- `app/invoice-review-cta.module.css`
- `app/api/invoice-review/route.ts`

Shared styles:

- `app/about/about.module.css`
- `app/landing-hero.module.css`
- `app/faq-image.module.css`

## Current `/schools` page state

The `/schools` page currently has:

1. Brand header only, no Launch Operations button.
2. Hero with animated headline.
3. Absolute decorative sweater image bridging hero and `What we supply`.
4. `What we supply` intro plus pennant image and carousel.
5. `How it works` cards with spinning muted Chrism star behind the section.
6. Story section with Birmingham Museums Trust image and the eyebrow `Why schools would like us`.
7. FAQ section with Elvira Blumfelde image.
8. Shared invoice review CTA/modal.

Hero headline:

```text
Everything your school needs to print, promote, and slay. fr.
```

`slay` animates from black to plum. The whole headline fades in.

Hero subhead:

```text
Chrism is a registered Ontario business offering commercial print, custom apparel, signage, and promotional sourcing to schools and school boards at trade-level pricing.
```

## Current `What we supply` section

Component: `app/school-supplies-section.tsx`

Headline is manually broken:

```tsx
<h2>
  Print, apparel, signage,
  <br />
  and promotional sourcing without
  <br />
  the vendor shuffle.
</h2>
```

Intro paragraph:

```text
Chrism sources and manages production across print, apparel, signage, and promotional products - handling everything from quote to delivery so your school or board doesn't have to manage multiple vendors.
```

Current layout:

- `/YCDSB_Pennant.svg` is placed left of the carousel.
- Card rail is horizontal with hidden scrollbar.
- Arrow controls are under the rail on the right.
- Arrow controls were reduced after being too large.
- If arrows seem broken, check whether the rail actually overflows at the tested viewport.

Card titles are broken over two lines where useful:

- `Print & / Stationery`
- `Event & / Signage`
- `Apparel & / Uniforms`
- `Promotional / Products`
- `Spirit & / Recognition`

## Current `How it works` section

Component: `app/school-how-it-works-section.tsx`

Eyebrow:

```text
How it works
```

Headline:

```text
Ideas, delivered.
```

Intro:

```text
There's no complicated onboarding - just tell us what you need and we'll take it from there.
```

Step 1 copy:

```text
Have a finished file or a seed of an idea - either works. Tell us what you're thinking and we'll take it from there.
```

The section has a muted spinning Chrism star via CSS mask using `/chrism-star-muted.svg`. Syd wanted less top padding and more section height so the bottom of the star can be seen. Do not make huge spacing changes without visual checking.

## Current story section

Eyebrow:

```text
Why schools would like us
```

Image:

```tsx
src="/birmingham-museums-trust-aE0-ZJb2VTQ-unsplash.jpg"
alt="Painting of a woman wearing a red beaded necklace"
```

Credit:

```text
Photo by Birmingham Museums Trust on Unsplash
```

Intent: image should be narrower, copy should have more room. Current custom classes are `schoolStoryGrid`, `schoolStoryImageColumn`, and `schoolStoryCopyColumn`.

## Invoice review upload/modal repair

This was fixed after the follow-up helper broke or failed to restore the behavior.

Current relevant files:

- `app/invoice-review-cta.tsx`
- `app/invoice-review-cta.module.css`
- `app/api/invoice-review/route.ts`

The client CTA:

- Lets users select or drop an invoice.
- Opens a modal after a valid file is selected.
- Shows attached filename and size.
- Collects name, email, org, and org type.
- Submits `FormData` to `/api/invoice-review`.
- Shows a success state inside the modal after submission.

Repair commits:

- `9958c1d` - Restore invoice review modal layout
- `e902120` - Harden invoice upload validation

What changed:

- Restored actual modal/lightbox CSS for `.invoiceModalBackdrop`, `.invoiceModal`, close button, modal header, file summary, and confirmation styling.
- Hardened API file detection instead of relying only on `invoice instanceof File`.
- Added `export const runtime = 'nodejs'` to the invoice route.
- Added accepted MIME type validation.
- Kept the existing Brevo email provider.

Important: the API route requires these deployment environment variables:

```text
BREVO_API_KEY
BREVO_SENDER_EMAIL
BREVO_SENDER_NAME optional, defaults to Chrism
```

Recipient is hardcoded as:

```text
syd.fernandez@chrism.app
```

If submit still fails after the modal opens, check deployment env vars first. If the modal does not open after selecting a file, inspect the client component and CSS. If the email does not arrive, inspect Brevo response/logs.

## Assets referenced

Confirm these exist and are committed in `/public`:

- `/st-eds_royals_sweater.png`
- `/YCDSB_Pennant.svg`
- `/birmingham-museums-trust-aE0-ZJb2VTQ-unsplash.jpg`
- `/elvira-blumfelde-XzI0bYWdhbY-unsplash.jpg`
- `/chrism-star-muted.svg`
- `/Chrism_horiz.svg`

## Likely next tasks

Continue visual tuning on `/schools`, likely:

- sweater placement and size
- pennant plus carousel layout
- carousel arrow functionality/size/placement
- `Ideas, delivered.` star visibility and section height
- process arrows matching the main-page flywheel treatment
- story image width and crop
- CTA modal visual polish only if needed

## Targeted checks

Use targeted checks, not full-site verification unless requested:

```bash
npx eslint app/schools/page.tsx app/school-supplies-section.tsx app/school-how-it-works-section.tsx app/invoice-review-cta.tsx app/api/invoice-review/route.ts --max-warnings=0
```

If testing upload locally, make sure `.env.local` has Brevo variables, then use the CTA on `/` or `/schools`.

## Starter prompt for next helper

Paste this into a new helper:

```text
We are working in repo chrism-syd/chrism on main. Please read docs/handoff/HANDOFF_Jun07_Schools_Invoice_Repair.md first and follow it closely.

The current page in progress is /schools, implemented at app/schools/page.tsx. Keep changes scoped, push small commits to main, avoid full-site lint/build unless I ask, and use targeted checks only. I am art-directing live, so make small intentional CSS/layout changes rather than broad rewrites.

Very important: the invoice review upload/modal was repaired in commits 9958c1d and e902120. Do not rewrite that flow casually. The modal is in app/invoice-review-cta.tsx and app/invoice-review-cta.module.css, and the endpoint is app/api/invoice-review/route.ts using Brevo env vars.

Current likely focus: keep tuning /schools visual layout, especially sweater placement, pennant/carousel layout, carousel arrow behavior, Ideas delivered star visibility, process arrows, and story image width. Preserve existing design decisions unless I explicitly ask to reverse them.
```
