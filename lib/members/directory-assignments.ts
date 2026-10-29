type Assignment = { person_id: string | null; ended_at: string | null }

// Explicit organization assignments override legacy member-record lifecycle.
export function activeDirectoryPersonIds(
  legacyPersonIds: Array<string | null>, assignments: Assignment[]
) {
  const assigned = new Set(assignments.map((row) => row.person_id))
  return [...new Set([
    ...legacyPersonIds.filter((id): id is string => Boolean(id) && !assigned.has(id)),
    ...assignments.filter((row) => !row.ended_at).map((row) => row.person_id)
      .filter((id): id is string => Boolean(id)),
  ])]
}
