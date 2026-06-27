# Next Helper Starter Prompt - Jun 15

Copy/paste this into the next chat to continue smoothly:

```text
We are working in GitHub repo chrism-syd/chrism on main. Please read docs/handoff/HANDOFF_Jun15_Welcome_Monetization_Email.md first, then docs/handoff/HANDOFF_Jun13_Routing_Onboarding_Smoke.md and docs/handoff/PERMISSIONS_AND_ACCESS_May09_UPDATED.md before making repo changes.

Working style:
- Be direct, practical, and honest. Push back on risky assumptions.
- Syd prefers targeted GitHub commits, not huge inline code blocks.
- Inspect current repo state before making claims.
- Make changed-file patches/commits only unless Syd explicitly asks for a full bundle.
- After commits, provide:
  cd /Users/syd.fernandez/Chrism
  git pull --ff-only origin main
  npm run typecheck
  npm run build
  npx vercel --prod
- Vercel deploys are manual. Do not assume a commit is live.
- Keep external-facing written artifacts concise, direct, and professional. Sarcasm is fine in chat, not in artifacts.

Current state:
- www.chrism.app / chrism.app = app/operations.
- www.chrismworks.com = public marketing.
- operations.chrism.app is deprecated and tracked under #42.
- /welcome/admin exists and is deployed. Admin invite acceptance should set local-unit operations scope and redirect there.
- /welcome/admin?localUnitId=<local_units.id> is a smoke-test display override. It expects local_units.id, not organizations.id.
- The first real Grand Knight invite was sent to Kristian. Keep stability high and prioritize first-user friction.
- Email routing for syd@chrismworks.com -> Gmail works inbound through Cloudflare. Gmail Send As may still need final setup/verification.
- public/Chrism-works.png was added for email signature use and should resolve after deploy at https://www.chrismworks.com/Chrism-works.png.

Access model:
- local_unit_id = operational scope/ownership truth.
- council_id = legacy/public/compat/routing.
- people = product noun.
- External admin invite acceptance may create/update people and organization_admin_assignments, but not member_records or user_unit_relationships unless separately a real local member.

Product direction:
- Core should be free enough for local ministries/councils to adopt.
- Paid surfaces should be Chrism Care: automation, reporting, saved custom lists, communication nudges, leadership continuity.
- RSVP collection should remain free.
- Issues #56-#60 capture public pages, pricing entitlements, Brevo SMS, opt-in/out compliance, and WhatsApp organizer nudge workflow.

Ask Syd what he wants to tackle first, then make small, safe commits.
```
