'use server'

import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecord } from '@/lib/security/pii'
import {
  insertOrganizationClaimRequest,
  normalizeClaimText,
} from '@/lib/organizations/claim-requests'

function redirectToClaimPage(args: { error?: string | null; notice?: string | null }): never {
  const params = new URLSearchParams()

  if (args.error) {
    params.set('error', args.error)
  }

  if (args.notice) {
    params.set('notice', args.notice)
  }

  redirect(params.size > 0 ? `/me/claim-organization?${params.toString()}` : '/me/claim-organization')
}

function fallbackNameFromEmail(email: string | null) {
  const local = email?.split('@')[0]?.replace(/[._-]+/g, ' ')?.trim()
  return local ? local.replace(/\b\w/g, (part) => part.toUpperCase()) : 'Member'
}

export async function submitSignedInOrganizationClaimAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) {
    redirect('/login?next=/me/claim-organization')
  }

  const selectedCouncilId = normalizeClaimText(formData.get('selected_council_id') as string | null)
  const selectedOrganizationId = normalizeClaimText(formData.get('selected_organization_id') as string | null)
  const requestedCouncilNumber = normalizeClaimText(formData.get('requested_council_number') as string | null)
  const requestedCouncilName = normalizeClaimText(formData.get('requested_council_name') as string | null)
  const requestedCity = normalizeClaimText(formData.get('requested_city') as string | null)
  const requestNotes = normalizeClaimText(formData.get('request_notes') as string | null)

  if (!selectedCouncilId && !(requestedCouncilName && requestedCity)) {
    redirectToClaimPage({ error: 'Choose a listed council or switch to Request Access before submitting.' })
  }

  const admin = createAdminClient()
  const person = permissions.personId
    ? await admin
        .from('people')
        .select('id, first_name, last_name, nickname, cell_phone')
        .eq('id', permissions.personId)
        .maybeSingle()
    : { data: null, error: null }

  if (person.error) {
    redirectToClaimPage({ error: person.error.message })
  }

  const decryptedPerson = person.data
    ? decryptPeopleRecord(person.data as { id: string; first_name: string; last_name: string; nickname: string | null; cell_phone: string | null })
    : null

  const requesterName = decryptedPerson
    ? `${decryptedPerson.nickname?.trim() || decryptedPerson.first_name} ${decryptedPerson.last_name}`.trim()
    : fallbackNameFromEmail(permissions.email)

  try {
    await insertOrganizationClaimRequest({
      organizationId: selectedOrganizationId,
      councilId: selectedCouncilId,
      requestedByAuthUserId: permissions.authUser.id,
      requestedByPersonId: permissions.personId,
      requesterName,
      requesterEmail: permissions.email ?? 'unknown@example.com',
      requesterPhone: decryptedPerson?.cell_phone ?? null,
      requestedCouncilNumber,
      requestedCouncilName,
      requestedCity,
      requestNotes,
      initiatedViaCode: 'signed_in_member',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not submit the request right now.'
    redirectToClaimPage({ error: message })
  }

  redirectToClaimPage({ notice: 'Request submitted. It is now in the review queue.' })
}
