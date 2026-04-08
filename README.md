# Chrism

Chrism is a Next.js application for church and ministry administration. It supports two primary experiences:

- **Operations / staff** workflows for member management, custom lists, event planning, admin access, and organization settings
- **Spiritual / member** workflows for profile management, public meeting access, invited events, and explicitly shared custom lists

The app is built around organization-aware access control, with active work underway to move context and permissions from legacy council-only assumptions toward a newer local-unit model.

## What the app does

### Member and profile workflows
- Personal profile management under `/me`
- Pending and reviewed profile change requests
- Organization claim / admin-access request flows
- Claimed RSVP history for signed-in users

### Staff operations
- Member directory and officer views
- Custom lists for outreach, follow-up, and planning
- Event scheduling, RSVP management, volunteer coordination, and public meetings
- Organization settings, officer assignments, and admin invitations

### Multi-context and preview tooling
- Role-aware navigation for staff vs member users
- Context switching between accessible organization areas
- Super-admin dev preview for testing organization/member/admin views

## Main areas

- `/` — staff operations landing page
- `/spiritual` — member-facing landing page
- `/me` — personal profile and organization/account status
- `/members` — member directory
- `/custom-lists` — custom list management and shared-list access
- `/events` — events and public meeting workflows
- `/me/council` — organization settings and admin management

## Tech stack

- **Next.js** app router application
- **React**
- **Supabase** for data access, auth-adjacent access checks, and server actions
- Role- and context-aware navigation built around current user permissions

## Local development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

You can start from the main entry points in:

- `app/page.tsx`
- `app/spiritual/page.tsx`
- `app/me/page.tsx`
- `app/members/page.tsx`
- `app/custom-lists/page.tsx`
- `app/events/page.tsx`

## Current architecture note

The codebase is in the middle of a permissions/context migration:

- prefer **local-unit-aware** access and context resolution
- retain some **legacy `council_id` compatibility bridges** where the database schema still requires them

If you are working on permissions, acting context, custom lists, or area access, check the latest migration and auth helpers before widening legacy behavior.

## Recommended areas to understand first

If you are onboarding into the codebase, start here:

- `app/app-header.tsx`
- `lib/auth/permissions.ts`
- `lib/auth/acting-context.ts`
- `lib/auth/parallel-access-summary.ts`
- `lib/custom-lists.ts`
- `app/custom-lists/`
- `app/events/`
- `app/me/`

## Notes for contributors

- Keep product behavior different for **staff** and **non-staff** users
- Be careful with access checks that mix legacy council context and newer local-unit context
- Prefer small, testable changes in auth, preview mode, and custom-list flows
- Treat helper scripts used during refactors/debugging as disposable and keep them out of git

## Deployment

This is a Next.js app. Standard deployment guidance applies for your chosen platform. If deploying with Vercel, start with the usual Next.js deployment flow and ensure all required environment variables and Supabase credentials are configured for the target environment.
