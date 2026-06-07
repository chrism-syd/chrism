# Working style notes - June 7 - Schools landing page

This note is for the next helper continuing Syd's `/schools` landing page work. The previous chat became long and laggy, and Syd is frustrated by sloppy execution, avoidable mistakes, and repeated backpedaling. Treat this as the quality bar.

## How Syd likes to work

Syd is art-directing the page live. He is not asking for a generic implementation. He is looking at spacing, rhythm, image overlap, type breaks, balance, section flow, and whether the page feels intentional. Small visual differences matter.

Syd often gives direction in design language instead of exact CSS values, for example:

- "nudge it up"
- "make it feel like it is nuzzled between content"
- "clear the sweater area"
- "same treatment as the main flywheel section"
- "more Apple-ish"
- "bring the following content after the fold"

The correct response is not to over-engineer or randomly guess. Make the smallest likely change, explain what changed, and be ready to tune.

## Quality bar

Avoid careless changes. Before editing, inspect the current file and understand the existing structure. Do not rewrite whole files unless necessary. Do not remove earlier intentional work unless Syd explicitly asks.

For every change, check these things mentally before committing:

1. Does this preserve the existing visual intent?
2. Does this conflict with a previous request?
3. Does the CSS selector actually target the element being discussed?
4. Does the layout change affect desktop, tablet, and mobile differently?
5. If adding a feature, is it actually functional, not just visible?
6. If adding an asset reference, is the path exact and case-sensitive?
7. If using Next Image, are width/height/fill/sizes appropriate?

Syd is frustrated by backpedaling. Do not make broad changes that force immediate reversal. When uncertain, state the uncertainty and make a conservative adjustment.

## Preferred implementation approach

- Make small, scoped commits on `main`.
- Keep responses concise and include commit IDs.
- Do not run full-site lint/build unless Syd asks.
- Use targeted checks only for files touched, for example:

```bash
npx eslint app/school/page.tsx app/school-supplies-section.tsx app/school-how-it-works-section.tsx --max-warnings=0
```

- For visual CSS-only changes, a browser preview matters more than lint.
- If the user says an asset exists locally in `/public`, update the code reference, then remind him to add/commit/push the asset if needed.
- Use non-breaking spaces between the last two words of block text where practical.

## Communication style

Be direct and practical. Do not overpromise. Do not bury the change summary in fluff. Acknowledge when a previous approach did not work.

Good response pattern:

```text
Agreed, that pass overcorrected. I tightened the selector and only changed the spacing on the schools section, not the shared layout.

Pushed:
abc1234 Adjust schools carousel spacing
```

Bad response pattern:

```text
Great idea! I updated a bunch of things and it should work now.
```

## When Syd gives visual direction

Translate the direction into one or two CSS moves, not a redesign.

Examples:

- "Nudge it up" usually means adjust `top`, `margin-top`, `transform`, or section padding by a small amount.
- "Make the column skinnier" usually means reduce `max-width` or change grid fraction, not shrink font size.
- "Move content after the fold" usually means section padding/min-height, but be careful not to create dead space.
- "Same treatment as the main page" means inspect the main page implementation and reuse the pattern, not invent a similar-looking one.
- "Apple style carousel arrows" means clean visible controls, hidden scrollbar, working horizontal scroll, and controls placed where the eye expects them.

## Current pain points to avoid repeating

- The sweater image has been moved many times. It is absolutely positioned as decoration across hero and supply sections. Do not make it part of normal layout again unless requested.
- The carousel controls were visible but initially not meaningfully functional. Verify whether the rail overflows before declaring controls done.
- The process arrows in `How it works` should match the main page flywheel arrows. Inspect the main page if tuning this.
- The story image column was too wide. Current intent is a narrower image and wider text column.
- Section spacing has been tuned repeatedly. Avoid large padding/min-height changes unless the specific visual issue requires it.

## Current focus

Continue visual tuning on `/schools`, mainly:

- sweater placement and size
- pennant plus carousel layout
- carousel arrow size, placement, and actual scrolling behavior
- `Ideas, delivered.` section height and spinning star visibility
- process arrows matching the main flywheel treatment
- story image width and text room

Keep the hand steady. Small scalpel, not leaf blower.
