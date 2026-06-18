import { notFound, redirect } from 'next/navigation'
import { buildCouncilPublicOrgSlug } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'

type MeetingsPageProps = {
  params: Promise<{ councilNumber: string }>
  searchParams: Promise<{ kind?: string | string[]; meetingKind?: string | string[] }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function LegacyCouncilMeetingsRedirect({ params, searchParams }: MeetingsPageProps) {
  const { councilNumber } = await params
  const { kind, meetingKind } = await searchParams
  const supabase = createAdminClient()

  const { data: council } = await supabase
    .from('councils')
    .select('name, council_number')
    .eq('council_number', councilNumber)
    .maybeSingle()

  if (!council?.council_number) notFound()

  const slug = buildCouncilPublicOrgSlug({ name: council.name, councilNumber: council.council_number })
  const selectedKind = firstParam(meetingKind ?? kind)
  const query = selectedKind ? `?kind=${encodeURIComponent(selectedKind)}` : ''

  redirect(`/o/${slug}/events${query}`)
}
