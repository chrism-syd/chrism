'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { buildAuthConfirmRedirectUrl } from '@/lib/auth/redirects'
import {
  REGISTRATION_CONSENT_TEXT,
  REGISTRATION_CONSENT_VERSION,
} from '@/lib/registration/consent'
import { protectPeoplePayload } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

type RegistrationAppUserRow = {
  id: string
  person_id: string | null
  is_active: boolean | null
}

type RegistrationIntakeRow = {
  id: string
  first_name: string
  last_name: string
  email: string
  normalized_email: string
  phone: string | null
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function toInitialCaps(value: string | null) {
  if (!value) return null
  return value
    .toLowerCase()
    .replace(/(^|[\s'’-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
}

function isNextRedirectError(error: unknown) {
  return (
    typeof error === 'object'
    && error !== null
    && 'digest' in error
    && typeof (error as { digest?: unknown }).digest === 'string'
    && (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}

function redirectToRegister(args: { error?: string | null; notice?: string | null; email?: string | null }): never {
  const params = new URLSearchParams()
  if (args.error) params.set('error', args.error)
  if (args.notice) params.set('notice', args.notice)
  if (args.email) params.set('email', args.email)
  redirect(params.size > 0 ? `/register?${params.toString()}` : '/register')
}

function originFromHeaders(headerStore: Headers) {
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  return host ? `${protocol}://${host}` : null
}

async function createProfileFromRegistrationIntake(args: {
  admin: ReturnType<typeof createAdminClient>
  authUserId: string
  authEmail: string
  intake: RegistrationIntakeRow
}) {
  const { admin, authUserId, authEmail, intake } = args
  const nowIso = new Date().toISOString()
  const email = intake.email?.trim() || authEmail
  const phone = intake.phone?.trim() || null

  const payload = protectPeoplePayload({
    council_id: null,
    first_name: toInitialCaps(intake.first_name) ?? intake.first_name,
    last_name: toInitialCaps(intake.last_name) ?? intake.last_name,
    email,
    cell_phone: phone,
    home_phone: null,
    nickname: null,
    primary_relationship_code: 'member',
    created_source_code: 'admin_manual_member',
    is_provisional_member: true,
    created_by_auth_user_id: authUserId,
    updated_by_auth_user_id: authUserId,
  })

  const { data: insertedPerson, error: insertError } = await admin
    .from('people')
    .insert(payload)
    .select('id')
    .maybeSingle<{ id: string }>()

  if (insertError || !insertedPerson?.id) {
    return {
      ok: false as const,
      message: 'Your email was verified, but Chrism could not create your profile record yet.',
    }
  }

  const { error: userUpsertError } = await admin
    .from('users')
    .upsert({
      id: authUserId,
      person_id: insertedPerson.id,
      is_active: true,
      updated_at: nowIso,
    }, { onConflict: 'id' })

  if (userUpsertError) {
    return {
      ok: false as const,
      message: 'Your email was verified and your profile was created, but Chrism could not link it to your account yet.',
    }
  }

  return {
    ok: true as const,
    personId: insertedPerson.id,
  }
}

export async function registerContactAction(formData: FormData) {
  const firstName = textValue(formData, 'first_name')
  const lastName = textValue(formData, 'last_name')
  const email = textValue(formData, 'email')
  const phone = textValue(formData, 'phone')
  const consentAccepted = formData.get('consent_accepted') === 'on'

  if (!firstName || !lastName || !email) {
    redirectToRegister({ error: 'Enter your first name, last name, and email address.' })
  }

  if (!consentAccepted) {
    redirectToRegister({ error: 'Please review and accept the ministry contact sharing notice to continue.', email })
  }

  const normalizedEmail = normalizeEmail(email)
  const admin = createAdminClient()
  const headerStore = await headers()
  const origin = originFromHeaders(headerStore)
  const emailRedirectTo = buildAuthConfirmRedirectUrl(origin ?? 'http://localhost:3000', '/me')

  try {
    const intakeResponse = await admin
      .from('public_registration_intakes')
      .upsert({
        first_name: firstName,
        last_name: lastName,
        email,
        normalized_email: normalizedEmail,
        phone,
        consent_version: REGISTRATION_CONSENT_VERSION,
        consent_text: REGISTRATION_CONSENT_TEXT,
        consent_accepted_at: new Date().toISOString(),
        email_verification_status: 'pending',
        admin_review_status: 'pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'normalized_email' })

    if (intakeResponse.error) {
      throw new Error(intakeResponse.error.message)
    }

    const otpResponse = await admin.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone ?? null,
          registration_intake: true,
        },
      },
    })

    if (otpResponse.error) {
      throw new Error(otpResponse.error.message)
    }

    redirectToRegister({
      notice: 'Check your email for your Chrism verification code, then enter it below.',
      email: normalizedEmail,
    })
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error
    }

    const message = error instanceof Error ? error.message : 'We could not complete registration right now.'
    redirectToRegister({ error: message, email: normalizedEmail })
  }
}

export async function markRegistrationEmailVerifiedAction() {
  const supabase = await createServerClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user?.email) {
    return {
      ok: false,
      message: 'Your email was verified, but Chrism could not update the registration record yet.',
    }
  }

  const normalizedEmail = normalizeEmail(userData.user.email)
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const appUserResponse = await admin
    .from('users')
    .select('id, person_id, is_active')
    .eq('id', userData.user.id)
    .maybeSingle<RegistrationAppUserRow>()

  if (appUserResponse.error) {
    return { ok: false, message: appUserResponse.error.message }
  }

  const existingProfilePersonId = appUserResponse.data?.person_id ?? null

  if (existingProfilePersonId) {
    const updateResponse = await admin
      .from('public_registration_intakes')
      .update({
        email_verification_status: 'verified',
        admin_review_status: 'matched',
        matched_person_id: existingProfilePersonId,
        matched_at: nowIso,
        updated_at: nowIso,
      })
      .eq('normalized_email', normalizedEmail)

    if (updateResponse.error) {
      return { ok: false, message: updateResponse.error.message }
    }

    return {
      ok: true,
      status: 'existing_user_profile',
      message: 'Looks like this email is already connected to a Chrism profile. You are signed in and can continue to your profile.',
    }
  }

  const intakeResponse = await admin
    .from('public_registration_intakes')
    .select('id, first_name, last_name, email, normalized_email, phone')
    .eq('normalized_email', normalizedEmail)
    .maybeSingle<RegistrationIntakeRow>()

  if (intakeResponse.error || !intakeResponse.data) {
    return {
      ok: false,
      message: 'Your email was verified, but Chrism could not find your registration details yet.',
    }
  }

  const createProfileResult = await createProfileFromRegistrationIntake({
    admin,
    authUserId: userData.user.id,
    authEmail: userData.user.email,
    intake: intakeResponse.data,
  })

  if (!createProfileResult.ok) {
    return { ok: false, message: createProfileResult.message }
  }

  const updateResponse = await admin
    .from('public_registration_intakes')
    .update({
      email_verification_status: 'verified',
      admin_review_status: 'matched',
      matched_person_id: createProfileResult.personId,
      matched_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', intakeResponse.data.id)

  if (updateResponse.error) {
    return { ok: false, message: updateResponse.error.message }
  }

  return {
    ok: true,
    status: 'created_user_profile',
    message: 'Your email has been verified and your Chrism profile is ready.',
  }
}
