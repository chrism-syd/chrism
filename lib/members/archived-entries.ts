export type ArchivedRecord = {
  id: string
  legacy_people_id: string | null
  preferred_display_name: string | null
  archived_at: string | null
  lifecycle_state: string | null
}

export type EndedAssignment = { id: string; person_id: string; ended_at: string | null }

// An ended organization assignment is sufficient for an archive entry.
// Keep legacy archives visible while deduplicating multiple supporting records.
export function mergeArchivedEntries(records: ArchivedRecord[], assignments: EndedAssignment[]) {
  const assignedPeople = new Set(assignments.map((row) => row.person_id))
  const activePeople = new Set([
    ...assignments.filter((row) => !row.ended_at).map((row) => row.person_id),
    ...records.filter((row) => row.legacy_people_id && !assignedPeople.has(row.legacy_people_id)
      && !row.archived_at && row.lifecycle_state !== 'archived').map((row) => row.legacy_people_id!),
  ])
  const entries = new Map<string, ArchivedRecord>()
  for (const record of records) {
    if (!record.legacy_people_id || !record.archived_at || activePeople.has(record.legacy_people_id)) continue
    const existing = entries.get(record.legacy_people_id)
    if (!existing || (record.archived_at ?? '') > (existing.archived_at ?? '')) {
      entries.set(record.legacy_people_id, record)
    }
  }
  for (const assignment of assignments) {
    if (!assignment.ended_at || activePeople.has(assignment.person_id)) continue
    const existing = entries.get(assignment.person_id)
    entries.set(assignment.person_id, {
      id: assignment.id,
      legacy_people_id: assignment.person_id,
      preferred_display_name: existing?.preferred_display_name ?? null,
      archived_at: assignment.ended_at,
      lifecycle_state: 'archived',
    })
  }
  return [...entries.values()].sort((a, b) =>
    (b.archived_at ?? '').localeCompare(a.archived_at ?? '')
  )
}
