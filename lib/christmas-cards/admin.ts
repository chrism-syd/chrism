import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  CCIC_ADMIN_SESSION_COOKIE,
  hashCcicAdminEmail,
  hashCcicAdminSessionToken,
  normalizeCcicAdminEmail,
} from './admin-auth'

export function getCcicOrderAdminEmails() {
  const emails = (process.env.CCIC_ORDER_ADMIN_EMAILS || '')
    .split(',')
    .map(normalizeCcicAdminEmail)
    .filter(Boolean)

  if (emails.length !== 4 || new Set(emails).size !== 4) {
    throw new Error('CCIC_ORDER_ADMIN_EMAILS must contain exactly four unique email addresses.')
  }

  return new Set(emails)
}

export function isCcicOrderAdminEmail(email: string | null | undefined) {
  const normalized = normalizeCcicAdminEmail(email)
  return Boolean(normalized && getCcicOrderAdminEmails().has(normalized))
}

export async function getCcicOrderAdminSession() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(CCIC_ADMIN_SESSION_COOKIE)?.value?.trim()
  if (!sessionToken) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ccic_admin_sessions')
    .select('email_hash, expires_at')
    .eq('token_hash', hashCcicAdminSessionToken(sessionToken))
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) return null

  const allowedEmail = [...getCcicOrderAdminEmails()]
    .find((email) => hashCcicAdminEmail(email) === data.email_hash)

  return allowedEmail ? { email: allowedEmail, expiresAt: data.expires_at as string } : null
}

export async function requireCcicOrderAdmin(nextPath = '/ccic/admin/orders') {
  const session = await getCcicOrderAdminSession()

  if (!session) {
    redirect(`/ccic/admin/login?next=${encodeURIComponent(nextPath)}`)
  }

  return session
}
