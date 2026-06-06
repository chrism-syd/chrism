# Schema and Access Notes - Jun 05 Registration + Operations

This doc captures schema, access, and routing facts discovered or changed during the `launch-hide-spiritual` seam.

## Route and access summary

### Public routes

```text
/        public Chrism Ecosystem landing page
/about   redirects to /
/register public registration and OTP verification
/login    OTP login
```

### Operations routes

```text
/operations
operations.chrism.app/
```

`/operations` is the ministry-management gateway.

Behavior in `app/operations/page.tsx`:

- Not signed in -> `/login?next=/operations`
- Super admin acting in member mode -> `/me`
- Signed in without staff access -> `/me`
- `canManageEvents` -> `/events`
- `canAccessMemberData` -> `/members`
- `canManageCustomLists` -> `/custom-lists`
- `canAccessOrganizationSettings || canManageAdmins` -> `/me/council`
- fallback -> `/me`

### Subdomain routing

`proxy.ts` handles `operations.chrism.app`:

- If host is `operations.chrism.app` and path is `/`, rewrite internally to `/operations`.
- It keeps the URL clean in the browser.
- It preserves Supabase session cookie updates by calling `updateSession(request)`.

Important Next.js 16 rule:

- Use `proxy.ts` only.
- Do not add `middleware.ts` while `proxy.ts` exists.

## Registration / OTP schema

### public_registration_intakes

Table exists in production/dev DB as confirmed by user:

```text
public_registration_intakes
```

Used by:

```text
app/register/actions.ts
```

Fields used by code:

```text
id
first_name
last_name
email
normalized_email
phone
consent_version
consent_text
consent_accepted_at
email_verification_status
admin_review_status
matched_person_id
matched_at
updated_at
```

Expected uniqueness:

```text
normalized_email
```

The registration action uses Supabase upsert:

```ts
.upsert({...}, { onConflict: 'normalized_email' })
```

Status values currently used:

```text
email_verification_status:
- pending
- verified

admin_review_status:
- pending
- matched
```

Notes:

- This table stores the user-entered registration data before/while OTP verification completes.
- It is intentionally separate from immediately granting org membership.
- It lets Chrism verify email and capture consent before connecting a person to ministry/org context.

### public.users

Fields used by registration and operations access:

```text
id
person_id
is_active
updated_at
```

Important discovered gotcha from previous handoff:

- Do not assume `public.users` has a direct `email` column. Join to `auth.users` for email when needed.

Registration meaning:

- `public.users.id` corresponds to `auth.users.id`.
- `public.users.person_id` indicates a user-initiated/profile-linked Chrism profile.
- Existing-user detection for registration should be based on `public.users.person_id`, not merely email being present somewhere in local org data.

### people

Registration creates a provisional `people` row if the verified auth user has no `public.users.person_id`.

Fields populated by `createProfileFromRegistrationIntake`:

```text
council_id: null
first_name
last_name
email
cell_phone
home_phone: null
nickname: null
primary_relationship_code: member
created_source_code: admin_manual_member
is_provisional_member: true
created_by_auth_user_id
updated_by_auth_user_id
```

Payload is passed through:

```text
protectPeoplePayload
```

Phone from registration maps to:

```text
people.cell_phone
```

### user_unit_relationships

Used during testing/reset only in this seam.

Reset SQL removed relationships for the test auth user:

```sql
delete from public.user_unit_relationships
where user_id in (select id from target_auth_user)
```

No new org membership is granted by public registration yet.

## Registration flow details

### registerContactAction

Source:

```text
app/register/actions.ts
```

Flow:

1. Read first name, last name, email, optional phone, consent checkbox.
2. Require first name, last name, email.
3. Require consent.
4. Normalize email to lowercase.
5. Upsert `public_registration_intakes` with pending statuses.
6. Send Supabase OTP using admin client:

```ts
admin.auth.signInWithOtp({
  email: normalizedEmail,
  options: {
    shouldCreateUser: true,
    emailRedirectTo,
    data: {
      first_name,
      last_name,
      phone,
      registration_intake: true,
    },
  },
})
```

7. Redirect back to `/register` with notice/email query for verification form.

Known UX debt:

- Redirect still uses query params for `error`, `notice`, and `email`.
- User wants clean URLs long-term.

### VerifyRegistrationCodeForm

Source:

```text
app/register/verify-registration-code-form.tsx
```

Flow:

1. User enters OTP code.
2. Client calls:

```ts
supabase.auth.verifyOtp({
  email,
  token: cleanedCode,
  type: 'email',
})
```

3. Client calls `markRegistrationEmailVerifiedAction()`.
4. Client routes to `/me` on success.

Safety added:

- 45s resend cooldown.
- 15s profile sync timeout.
- try/catch around verification so UI does not hang forever.

### markRegistrationEmailVerifiedAction

Source:

```text
app/register/actions.ts
```

Flow:

1. Get authenticated user through Supabase server client.
2. Find app user by `public.users.id = auth.users.id`.
3. If existing app user has `person_id`:
   - mark intake verified/matched
   - set `matched_person_id` to existing `person_id`
   - return `existing_user_profile`
4. If no `person_id`:
   - load intake by normalized email
   - create provisional `people` row
   - upsert `public.users.person_id`
   - mark intake verified/matched
   - return `created_user_profile`

## Consent

Consent constants live in:

```text
lib/registration/consent.ts
```

The position established with the user:

- A person signing up accepts that their information may be shared with ministries on Chrism that they belong to.
- Their contact information may be used by those ministries for the purposes of running their ministry.
- Information should not be explicitly shared with organizations they do not belong to or have not chosen to share with.

Future work should preserve this consent framing.

## Known test email and reset

Reusable test inbox:

```text
syd.fernandez@chrism.app
```

User does not have unlimited test inboxes, so keep this test pattern available.

Safe reset for fresh registration retest:

```sql
begin;

with target_auth_user as (
  select id
  from auth.users
  where lower(email) = lower('syd.fernandez@chrism.app')
),
target_app_user as (
  select u.id, u.person_id
  from public.users u
  join target_auth_user au on au.id = u.id
),
deleted_intake as (
  delete from public.public_registration_intakes
  where normalized_email = lower('syd.fernandez@chrism.app')
  returning id
),
removed_unit_relationships as (
  delete from public.user_unit_relationships
  where user_id in (select id from target_auth_user)
  returning id
),
unlinked_app_user as (
  update public.users
  set
    person_id = null,
    updated_at = now()
  where id in (select id from target_auth_user)
  returning id
)
select
  (select count(*) from deleted_intake) as deleted_registration_intakes,
  (select count(*) from removed_unit_relationships) as removed_unit_relationships,
  (select count(*) from unlinked_app_user) as unlinked_app_users;

commit;
```

Verification query:

```sql
select
  pri.first_name,
  pri.last_name,
  pri.email,
  pri.phone,
  pri.email_verification_status,
  pri.admin_review_status,
  pri.matched_person_id,
  u.person_id
from public.public_registration_intakes pri
left join auth.users au on lower(au.email) = pri.normalized_email
left join public.users u on u.id = au.id
where pri.normalized_email = lower('syd.fernandez@chrism.app');
```

Expected after successful retest:

```text
email_verification_status = verified
admin_review_status = matched
matched_person_id populated
u.person_id populated and equals matched_person_id
```

## Invite/access planning

Future intended direction:

- Admin invites and local org member invites should eventually use the same OTP verifier mechanism.
- Invite email should still be an invite email that carries invite context.
- The user should verify email via OTP.
- If existing Chrism user: link their profile to the invited org/role context.
- If not existing Chrism user: route through new member intake for name/contact consent, then connect to org context.
- Do not reveal hidden local-org database matches to public registrants. Only show existing-profile messaging when the user has already initiated/linked a Chrism profile.

## Security / access cautions

- Keep org/member data scoped by existing permission helpers in `lib/auth/permissions.ts`.
- Do not add public registration as automatic membership in a local org.
- Do not expose local org membership/email matches during public registration.
- Maintain passwordless direction: OTP preferred over magic-link UX wording.
- Keep URLs clean after notices/errors. Query-string notices are tolerated in current implementation but are known UX debt.
