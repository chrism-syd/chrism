import 'server-only'

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function allowedAdminEmails() {
  const configured = process.env.CCIC_ORDER_ADMIN_EMAILS
    || process.env.CCIC_ORDER_NOTIFICATION_EMAIL
    || ''

  return new Set(
    configured
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

export async function requireCcicOrderAdmin(nextPath = '/ccic/admin/orders') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  const email = user.email?.trim().toLowerCase() || ''
  if (!email || !allowedAdminEmails().has(email)) {
    notFound()
  }

  return user
}
