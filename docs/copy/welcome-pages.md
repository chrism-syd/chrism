# Welcome page copy variants

This document separates first-time onboarding copy from ongoing landing-page copy. The UI can share layout and components, but the messaging should not keep greeting returning members as if they have just arrived.

## Admin welcome: first-time only

Use after an invited admin accepts access for the first time.

### Page purpose

Confirm that admin access worked, frame the role as one of care and stewardship, and give the new admin a clear first step.

### Eyebrow

Admin access accepted

### Headline

Welcome, shepherd.

### Intro

You have been given admin access so you can help care for your council's members, events, and local operations.

### Primary card title

A practical first step

### Primary card body

Start by reviewing the member directory and upcoming events. Chrism is here to make the ordinary work lighter, not to add another pile to your desk.

### Primary action

Start with members

### Next-step actions

#### Review member directory

Make sure the people entrusted to your council are easy to find and follow up with.

#### Plan events

Create events, collect RSVPs, and organize volunteers from one calm place.

#### Open council settings

Review organization details, admin access, and operational settings.

## Member welcome: first-time only

Use immediately after a member signs up or successfully joins through a member-facing onboarding flow.

### Page purpose

Thank the member for signing up, confirm that their account is ready, and give them a gentle first step.

### Eyebrow

Account ready

### Headline

Welcome to Chrism.

### Intro

Thank you for signing up. Your account is ready, and you can now stay connected with your organization through Chrism.

### Primary card title

You are in the right place

### Primary card body

Chrism keeps profiles, events, and organization information close at hand so community work feels easier to follow.

### Primary action

Review my profile

### Next-step actions

#### Review your profile

Keep your contact details current so your organization can stay connected with you.

#### View events

See meetings and events connected to your organization.

#### Go to your home page

Start from your Chrism home base whenever you need to find your next step.

## Member landing: ongoing

Use as a permanent member-facing landing or help page after the first visit. This copy should assume the person already knows what Chrism is.

### Page purpose

Give returning members a calm, practical launch point without repeating first-time onboarding language.

### Eyebrow

Member home

### Headline

Your place to stay connected.

### Intro

Find your profile, events, and organization information without digging through email threads or old messages.

### Primary card title

What would you like to do?

### Primary card body

Use this page as a simple starting point whenever you need to check what is coming up or update your information.

### Primary action

Review my profile

### Next-step actions

#### Review your profile

Check your contact details and keep your information current.

#### View events

See upcoming meetings and events connected to your organization.

#### Go to your home page

Return to your main Chrism home base.

## Shared side-card copy

This can remain similar across welcome and ongoing pages.

### Title

What Chrism helps with

### Items

#### People

Keep member and contact information close.

#### Events

Plan meetings, events, RSVPs, and volunteer responses.

#### Follow-up

Make the next pastoral or practical step easier to see.

## Implementation notes

- `/welcome/admin` should be treated as a first-time admin onboarding page. It is fine if the URL remains accessible, but the app should only automatically send admins there after accepting an invite.
- `/welcome/member` can either stay first-time-only or be split later into a separate permanent landing route.
- If `/welcome/member` becomes permanent, switch it to the ongoing member landing copy above.
- Avoid database onboarding flags until the app needs automatic redirect suppression or repeat-visit state.
