import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecord } from '@/lib/security/pii'

export type OrganizationAdminSourceCode = 'manual_assignment' | 'approved_claim' | 'admin_invitation'

type SaveOrganizationAdminAssignmentArgs = {
  organizationId: string
  actorUserId: string
  personId?: string | null
  userId?: string | null
  granteeEmail?: string | null
  sourceCode?: OrganizationAdminSourceCode
  claimRequestId?: string | null
  grantNotes?: string | null
}

type ExistingAssignmentRow = {
  id: string
  person_id: string | null
  user_id: string | null
  grantee_email: string | null
  is_active: boolean
}


type LocalUnitLookupRow = {
  id: string
  local_unit_kind: string | null
}

async function pickPrimaryLocalUnitIdForOrganization(args: { organizationId: string }) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('local_units')
    .select('id, local_unit_kind')
    .eq('legacy_organization_id', args.organizationId)

  if (error) {
    throw new Error(error.message)
  }

  const rows = ((data as LocalUnitLookupRow[] | null) ?? []).slice().sort((left, right) => {
    const leftWeight = left.local_unit_kind === 'council' ? 0 : 1
    const rightWeight = right.local_unit_kind === 'council' ? 0 : 1
    if (leftWeight !== rightWeight) return leftWeight - rightWeight
    return left.id.localeCompare(right.id)
  })

  return rows[0]?.id ?? null
}

async function syncParallelAdminPackageGrant(args: {
  actorUserId: string
  targetUserId: string | null
  organizationId: string
  note?: string | null
}) {
  if (!args.targetUserId) return

  const localUnitId = await pickPrimaryLocalUnitIdForOrganization({ organizationId: args.organizationId })
  if (!localUnitId) return

  const admin = createAdminClient()
  const { error } = await admin.rpc('grant_parallel_admin_package_to_user', {
    p_actor_user_id: args.actorUserId,
    p_target_user_id: args.targetUserId,
    p_local_unit_id: localUnitId,
    p_source_code: 'manual',
    p_note: args.note ?? null,
  })

  if (error) {
    throw new Error(error.message)
  }
}

async function syncParallelAdminPackageRevoke(args: {
  actorUserId: string
  targetUserId: string | null
  organizationId: string
  note?: string | null
}) {
  if (!args.targetUserId) return

  const localUnitId = await pickPrimaryLocalUnitIdForOrganization({ organizationId: args.organizationId })
  if (!localUnitId) return

  const admin = createAdminClient()
  const { error } = await admin.rpc('revoke_parallel_admin_package_from_user', {
    p_actor_user_id: args.actorUserId,
    p_target_user_id: args.targetUserId,
    p_local_unit_id: localUnitId,
    p_source_code: 'manual',
    p_note: args.note ?? null,
  })

  if (error) {
    throw new Error(error.message)
  }
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

async function buildPersonBasedTarget(args: {
  personId: string
}) {
  const admin = createAdminClient()
  const [{ data: person }, { data: linkedUser }] = await Promise.all([
    admin.from('people').select('id, email').eq('id', args.personId).maybeSingle(),
    admin.from('users').select('id').eq('person_id', args.personId).maybeSingle(),
  ])

  const decryptedPerson = person ? decryptPeopleRecord(person as { id: string; email: string | null }) : null

  return {
    personId: args.personId,
    userId: (linkedUser as { id: string } | null)?.id ?? null,
    granteeEmail: normalizeEmail(decryptedPerson?.email ?? null),
  }
}

export async function saveOrganizationAdminAssignment(args: SaveOrganizationAdminAssignmentArgs) {
  const admin = createAdminClient()

  let target = {
    personId: args.personId ?? null,
    userId: args.userId ?? null,
    granteeEmail: normalizeEmail(args.granteeEmail ?? null),
  }

  if (target.personId) {
    target = await buildPersonBasedTarget({ personId: target.personId })
  }

  if (!target.personId && !target.userId && !target.granteeEmail) {
    throw new Error('An admin assignment needs a member, user, or email address.')
  }

  const filters = [
    target.personId ? `person_id.eq.${target.personId}` : '',
    target.userId ? `user_id.eq.${target.userId}` : '',
    target.granteeEmail ? `grantee_email.eq.${target.granteeEmail}` : '',
  ]
    .filter(Boolean)
    .join(',')

  const { data: existingAssignments, error: existingError } = await admin
    .from('organization_admin_assignments')
    .select('id, person_id, user_id, grantee_email, is_active')
    .eq('organization_id', args.organizationId)
    .or(filters)
    .order('created_at', { ascending: false })

  if (existingError) {
    throw new Error(existingError.message)
  }

  const matchingAssignments = ((existingAssignments as ExistingAssignmentRow[] | null) ?? []).filter((assignment) => {
    if (target.personId && assignment.person_id === target.personId) return true
    if (target.userId && assignment.user_id === target.userId) return true
    if (target.granteeEmail && normalizeEmail(assignment.grantee_email) === target.granteeEmail) return true
    return false
  })

  const activeMatch = matchingAssignments.find((assignment) => {
    if (!assignment.is_active) return false
    if (target.personId && assignment.person_id === target.personId) return true
    if (target.userId && assignment.user_id === target.userId) return true
    if (target.granteeEmail && normalizeEmail(assignment.grantee_email) === target.granteeEmail) return true
    return false
  })

  const targetAssignment = activeMatch ?? matchingAssignments[0] ?? null
  const payload = {
    organization_id: args.organizationId,
    person_id: target.personId,
    user_id: target.userId,
    grantee_email: target.granteeEmail,
    is_active: true,
    source_code: args.sourceCode ?? 'manual_assignment',
    organization_claim_request_id: args.claimRequestId ?? null,
    grant_notes: args.grantNotes ?? null,
    revoked_at: null,
    revoked_by_user_id: null,
    revoked_notes: null,
    updated_by_user_id: args.actorUserId,
  }

  const mutation = targetAssignment?.id
    ? admin.from('organization_admin_assignments').update(payload).eq('id', targetAssignment.id)
    : admin.from('organization_admin_assignments').insert({
        ...payload,
        created_by_user_id: args.actorUserId,
      })

  const { error } = await mutation

  if (error) {
    if (error.code === '23505') {
      throw new Error('That admin access is already on file. Refresh the page and try again.')
    }
    throw new Error(error.message)
  }

  const { data: savedAssignment, error: savedError } = await admin
    .from('organization_admin_assignments')
    .select('id')
    .eq('organization_id', args.organizationId)
    .or(filters)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (savedError) {
    throw new Error(savedError.message)
  }

  await syncParallelAdminPackageGrant({
    actorUserId: args.actorUserId,
    targetUserId: target.userId,
    organizationId: args.organizationId,
    note: args.grantNotes ?? null,
  })

  return { id: (savedAssignment as { id: string } | null)?.id ?? targetAssignment?.id ?? null }
}

export async function deactivateOrganizationAdminAssignment(args: {
  assignmentId: string
  organizationId: string
  actorUserId: string
  revokeNotes?: string | null
}) {
  const admin = createAdminClient()

  const { data: existingAssignment, error: lookupError } = await admin
    .from('organization_admin_assignments')
    .select('user_id')
    .eq('id', args.assignmentId)
    .eq('organization_id', args.organizationId)
    .maybeSingle<{ user_id: string | null }>()

  if (lookupError) {
    throw new Error(lookupError.message)
  }

  const { error } = await admin
    .from('organization_admin_assignments')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by_user_id: args.actorUserId,
      revoked_notes: args.revokeNotes ?? null,
      updated_by_user_id: args.actorUserId,
    })
    .eq('id', args.assignmentId)
    .eq('organization_id', args.organizationId)

  if (error) {
    throw new Error(error.message)
  }

  await syncParallelAdminPackageRevoke({
    actorUserId: args.actorUserId,
    targetUserId: existingAssignment?.user_id ?? null,
    organizationId: args.organizationId,
    note: args.revokeNotes ?? null,
  })
}

export function normalizeAdminGrantEmail(value: string | null | undefined) {
  return normalizeEmail(value)
}
