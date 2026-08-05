import 'server-only'

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export function getCcicOrderAdminEmails() {
  const emails = (process.env.CCIC_ORDER_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  if (emails.length !== 4 || new Set(emails).size !== 4) {
    throw new Error('CCIC_ORDER_ADMIN_EMAILS must contain exactly four unique email addresses.')
  }

  return new Set(emails)
}

export function isCcicOrderAdminEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() || ''
  return Boolean(normalized && getCcicOrderAdminEmails().has(normalized))
}

export async function requireCcicOrderAdmin(nextPath = '/ccic/admin/orders') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/ccic/admin/login?next=${encodeURIComponent(nextPath)}`)
  }

  if (!isCcicOrderAdminEmail(user.email)) {
    notFound()
  }

  return user
}
