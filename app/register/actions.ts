'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { buildAuthConfirmRedirectUrl } from '@/lib/auth/redirects'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  REGISTRATION_CONSENT_TEXT,
  REGISTRATION_CONSENT_VERSION,
} from '@/lib/registration/consent'

type RegistrationAppUserRow = {
  id: string
  person_id: string | null
  is_active: boolean | null
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

  const userInitiatedProfilePersonId = appUserResponse.data?.person_id ?? null
  const hasUserInitiatedProfile = Boolean(userInitiatedProfilePersonId)

  const updatePayload = hasUserInitiatedProfile
    ? {
        email_verification_status: 'verified',
        admin_review_status: 'matched',
        matched_person_id: userInitiatedProfilePersonId,
        matched_at: nowIso,
        updated_at: nowIso,
      }
    : {
        email_verification_status: 'verified',
        updated_at: nowIso,
      }

  const updateResponse = await admin
    .from('public_registration_intakes')
    .update(updatePayload)
    .eq('normalized_email', normalizedEmail)

  if (updateResponse.error) {
    return { ok: false, message: updateResponse.error.message }
  }

  if (hasUserInitiatedProfile) {
    return {
      ok: true,
      status: 'existing_user_profile',
      message: 'Looks like this email is already connected to a Chrism profile. You are signed in and can continue to your profile.',
    }
  }

  return {
    ok: true,
    status: 'verified_registration',
    message: 'Your email has been verified. Your registration has been saved.',
  }
}
