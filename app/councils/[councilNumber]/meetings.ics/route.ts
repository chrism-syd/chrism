import { NextResponse } from 'next/server'
import { buildCouncilPublicOrgSlug } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteProps = {
  params: Promise<{ councilNumber: string }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request, { params }: RouteProps) {
  const { councilNumber } = await params
  const supabase = createAdminClient()

  const { data: council } = await supabase
    .from('councils')
    .select('name, council_number')
    .eq('council_number', councilNumber)
    .maybeSingle()

  if (!council?.council_number) {
    return new NextResponse('Calendar not found', { status: 404 })
  }

  const slug = buildCouncilPublicOrgSlug({ name: council.name, councilNumber: council.council_number })
  return NextResponse.redirect(new URL(`/o/${encodeURIComponent(slug)}/calendar.ics`, request.url), 308)
}
