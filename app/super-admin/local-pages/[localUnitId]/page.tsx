import { notFound, redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { buildCouncilPublicOrgSlug } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'

type PageProps = {
  params: Promise<{ localUnitId: string }>
}

type LocalUnitRow = {
  id: string
  legacy_council_id: string | null
}

type CouncilRow = {
  id: string
  name: string | null
  council_number: string | null
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LocalPageTemplatePreview({ params }: PageProps) {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }

  const { localUnitId } = await params
  const admin = createAdminClient()

  const { data: localUnit } = await admin
    .from('local_units')
    .select('id, legacy_council_id')
    .eq('id', localUnitId)
    .maybeSingle<LocalUnitRow>()

  if (!localUnit?.legacy_council_id) notFound()

  const { data: council } = await admin
    .from('councils')
    .select('id, name, council_number')
    .eq('id', localUnit.legacy_council_id)
    .maybeSingle<CouncilRow>()

  if (!council?.council_number) notFound()

  const canonicalSlug = buildCouncilPublicOrgSlug({
    name: council.name,
    councilNumber: council.council_number,
  })

  redirect(`/o/${canonicalSlug}`)
}
