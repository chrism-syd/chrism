import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sanitizeNextPath } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const nextPath =
    sanitizeNextPath(searchParams.get('next')) ?? sanitizeNextPath(searchParams.get('redirect_to'))

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    if (!error) {
      return NextResponse.redirect(`${origin}${nextPath ?? '/'}`)
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user && nextPath) {
    return NextResponse.redirect(`${origin}${nextPath}`)
  }

  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
