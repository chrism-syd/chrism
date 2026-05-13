export type CustomListMemberState = {
  claimed_by_person_id: string | null
  claimed_at: string | null
  last_contact_at: string | null
  last_contact_by_person_id: string | null
}

export function buildCustomListContactPatch(args: {
  actorPersonId: string
  contactedAt: string
}) {
  return {
    last_contact_at: args.contactedAt,
    last_contact_by_person_id: args.actorPersonId,
  } satisfies Pick<CustomListMemberState, 'last_contact_at' | 'last_contact_by_person_id'>
}

export function buildCustomListClaimPatch(args: {
  actorPersonId: string
  claimedAt: string
}) {
  return {
    claimed_by_person_id: args.actorPersonId,
    claimed_at: args.claimedAt,
  } satisfies Pick<CustomListMemberState, 'claimed_by_person_id' | 'claimed_at'>
}

export function buildCustomListReleaseClaimPatch() {
  return {
    claimed_by_person_id: null,
    claimed_at: null,
  } satisfies Pick<CustomListMemberState, 'claimed_by_person_id' | 'claimed_at'>
}

export function applyCustomListContactPatch(
  state: CustomListMemberState,
  patch: ReturnType<typeof buildCustomListContactPatch>
): CustomListMemberState {
  return {
    ...state,
    ...patch,
  }
}

export function applyCustomListClaimPatch(
  state: CustomListMemberState,
  patch: ReturnType<typeof buildCustomListClaimPatch>
): CustomListMemberState {
  return {
    ...state,
    ...patch,
  }
}

export function applyCustomListReleaseClaimPatch(
  state: CustomListMemberState,
  patch = buildCustomListReleaseClaimPatch()
): CustomListMemberState {
  return {
    ...state,
    ...patch,
  }
}

export function shouldReleaseClaimForRevokedShare(args: {
  claimedByPersonId: string | null
  revokedPersonIds: Iterable<string>
}) {
  if (!args.claimedByPersonId) {
    return false
  }

  return new Set(args.revokedPersonIds).has(args.claimedByPersonId)
}
