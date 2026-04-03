'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecord, protectPeoplePayload } from '@/lib/security/pii'
import {
  insertOrganizationClaimRequest,
  normalizeClaimText,
} from '@/lib/organizations/claim-requests'
import type { ClaimOrganizationActionState } from './action-state'

function fallbackNameFromEmail(email: string | null) {
  const local = email?.split('@')[0]?.replace(/[._-]+/g, ' ')?.trim()
  return local ? local.replace(/\b\w/g, (part) => part.toUpperCase()) : 'Member'
}

function splitNameParts(value: string | null, fallbackEmail: string | null) {
  const source = value?.trim() || fallbackNameFromEmail(fallbackEmail)
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { firstName: parts[0], lastName: 'User' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.slice(-1).join(' ') }
}

export async function submitSignedInOrganizationClaimAction(
  _previousState: ClaimOrganizationActionState,
  formData: FormData
): Promise<ClaimOrganizationActionState> {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) {
    return { status: 'error', message: 'Please sign in again before requesting organization access.' }
  }

  const selectedCouncilId = normalizeClaimText(formData.get('selected_council_id') as string | null)
  const selectedOrganizationId = normalizeClaimText(formData.get('selected_organization_id') as string | null)
  const requestedCouncilNumber = normalizeClaimText(formData.get('requested_council_number') as string | null)
  const requestedCouncilName = normalizeClaimText(formData.get('requested_council_name') as string | null)
  const requestedCity = normalizeClaimText(formData.get('requested_city') as string | null)
  const requestNotes = normalizeClaimText(formData.get('request_notes') as string | null)
  const submittedRequesterName = normalizeClaimText(formData.get('requester_name') as string | null)

  if (!selectedCouncilId && !(requestedCouncilName && requestedCity)) {
    return { status: 'error', message: 'Choose a listed council or switch to Request Access before submitting.' }
  }

  const admin = createAdminClient()
  const person = permissions.personId
    ? await admin.from('people').select('id, first_name, last_name, nickname, cell_phone, email').eq('id', permissions.personId).maybeSingle()
    : { data: null, error: null }

  if (person.error) return { status: 'error', message: person.error.message }

  const decryptedPerson = person.data
    ? decryptPeopleRecord(person.data as { id: string; first_name: string; last_name: string; nickname: string | null; cell_phone: string | null; email: string | null })
    : null

  const requesterName =
    submittedRequesterName ||
    (decryptedPerson
      ? `${decryptedPerson.nickname?.trim() || decryptedPerson.first_name} ${decryptedPerson.last_name}`.trim()
      : fallbackNameFromEmail(permissions.email))

  if (!permissions.organizationId) {
    const nameParts = splitNameParts(requesterName, permissions.email)
    const targetPersonId = permissions.personId ?? decryptedPerson?.id ?? null

    const peoplePayload = protectPeoplePayload({
      first_name: nameParts.firstName,
      last_name: nameParts.lastName,
      nickname: submittedRequesterName ?? decryptedPerson?.nickname ?? null,
      email: permissions.email ?? decryptedPerson?.email ?? null,
      cell_phone: decryptedPerson?.cell_phone ?? null,
      council_id: null,
      primary_relationship_code: 'member',
      created_source_code: 'admin_manual_member',
      is_provisional_member: true,
      updated_by_auth_user_id: permissions.authUser.id,
      created_by_auth_user_id: targetPersonId ? undefined : permissions.authUser.id,
    })

    if (targetPersonId) {
      await admin.from('people').update(peoplePayload).eq('id', targetPersonId)
    } else {
      const { data: insertedPerson } = await admin.from('people').insert(peoplePayload).select('id').maybeSingle<{ id: string }>()
      if (insertedPerson?.id) {
        await admin.from('users').update({ person_id: insertedPerson.id, updated_at: new Date().toISOString() }).eq('id', permissions.authUser.id)
      }
    }
  }

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
    return { status: 'error', message }
  }

  revalidatePath('/me')
  revalidatePath('/me/claim-organization')
  revalidatePath('/super-admin/organization-claims')

  return { status: 'success', message: 'Request submitted. It is now in the review queue.' }
}
