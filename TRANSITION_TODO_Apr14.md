# Transition TODO — Apr 14

## High priority
- Finish / verify custom-list shared-access collapse by hidden identity
- Investigate custom-list scoping bug where a St. Patrick’s list appears in St. Martin
- Review custom-list share/revoke actions for identity-aware behavior
- Continue moving person-aware features from exact `person_id` logic to hidden identity logic
- Continue larger move away from `council_id` as primary truth, including Supabase cleanup

## Supabase / architecture cleanup
- Audit functions, policies, and views that still assume council-first truth
- Reduce reliance on `users.person_id` as a human identity anchor
- Continue deciding how long `member_records` remains transitional plumbing
- Review legacy tables/helpers still depending on `legacy_people_id` and `legacy_council_id`

## People-first naming
- Rename members-facing areas toward people where the scope includes volunteers/prospects
- Keep selectors and labels people-inclusive

## Identity / UI
- Disambiguate same-name people in selectors with extra context
- Do not collapse by name alone
- Make identity-aware app behavior consistent across list/profile/share surfaces

## Custom lists
- Share List card should display one real human per hidden identity
- Consider whether share/revoke behavior should operate at identity-aware level
- Preserve data integrity around `custom_list_members`
- Review duplicate-human presentation in selectors and member add/share flows

## Events
- Replace edit-event browser confirm with app toast/confirmation UI
- Split event archive / history IA more clearly:
  - past events
  - past meetings
  - manually archived
- Clarify labels between historical events and manually archived events
- Fix event edit header card styling to match the rest of the app

## Missing product surfaces
- External invitee send/share UI
- Event manager / event admin UI
- Notes/admin-history UI:
  - visible admin history
  - added/removed admin notes and timestamps

## URL / notice oddities
- Manual admin URL notice persistence on `/me/council` still feels odd and may need cleanup

## Original transition mission to preserve
- Keep carving away legacy council-auth and council-first assumptions
- Prevent fallback logic from becoming primary truth again
- Keep changes surgical and checkpointed
- Do not let the long-term transition drift without written state