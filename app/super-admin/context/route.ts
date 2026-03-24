import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  ACTING_COUNCIL_COOKIE,
  ACTING_MODE_COOKIE,
  ACTING_ORGANIZATION_COOKIE,
  isConfiguredSuperAdminEmail,
  normalizeActingMode,
} from '@/lib/auth/super-admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isConfiguredSuperAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { mode?: string; organizationId?: string | null }
  const mode = normalizeActingMode(body.mode)
  const organizationId = typeof body.organizationId === 'string' && body.organizationId.trim() ? body.organizationId.trim() : null

  const response = NextResponse.json({ ok: true })
  const maxAge = 60 * 60 * 24
  response.cookies.set(ACTING_MODE_COOKIE, mode, { path: '/', sameSite: 'lax', maxAge })

  if (mode === 'normal') {
    response.cookies.delete(ACTING_ORGANIZATION_COOKIE)
    response.cookies.delete(ACTING_COUNCIL_COOKIE)
    return response
  }

  if (!organizationId) {
    response.cookies.delete(ACTING_ORGANIZATION_COOKIE)
    response.cookies.delete(ACTING_COUNCIL_COOKIE)
    return response
  }

  const admin = createAdminClient()
  const { data: org } = await admin.from('organizations').select('id').eq('id', organizationId).maybeSingle()
  if (!org) {
    response.cookies.delete(ACTING_ORGANIZATION_COOKIE)
    response.cookies.delete(ACTING_COUNCIL_COOKIE)
    return response
  }

  response.cookies.set(ACTING_ORGANIZATION_COOKIE, organizationId, { path: '/', sameSite: 'lax', maxAge })
  const { data: council } = await admin.from('councils').select('id').eq('organization_id', organizationId).maybeSingle()
  if (council?.id) {
    response.cookies.set(ACTING_COUNCIL_COOKIE, council.id, { path: '/', sameSite: 'lax', maxAge })
  } else {
    response.cookies.delete(ACTING_COUNCIL_COOKIE)
  }
  return response
}
