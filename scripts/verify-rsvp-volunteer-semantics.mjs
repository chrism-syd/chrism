import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const projectRoot = process.cwd()
const sourcePath = path.join(projectRoot, 'lib/rsvp/person-rsvp-attendees.ts')
const buildDir = path.join(projectRoot, '.next/rsvp-volunteer-checks')
const compiledPath = path.join(buildDir, 'person-rsvp-attendees-under-test.mjs')

const source = await readFile(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    isolatedModules: true,
  },
  fileName: sourcePath,
})

await mkdir(buildDir, { recursive: true })
await writeFile(compiledPath, transpiled.outputText, 'utf8')

try {
  const rsvpAttendees = await import(`${pathToFileURL(compiledPath).href}?t=${Date.now()}`)

  const baseArgs = {
    submissionId: 'submission-1',
    matchedPrimaryPersonId: 'person-1',
    primaryName: 'Primary Person',
    normalizedPrimaryEmail: 'primary@example.com',
    primaryPhone: '555-0101',
    sourceCode: 'public_link',
    attendees: [],
  }

  const rsvpOnlyRows = rsvpAttendees.buildPersonRsvpAttendeeRows({
    ...baseArgs,
    primaryIsVolunteer: false,
  })

  assert.equal(rsvpOnlyRows.length, 1, 'RSVP-only submission creates one primary attendee row')
  assert.equal(rsvpOnlyRows[0].is_primary, true, 'primary attendee row is marked primary')
  assert.equal(rsvpOnlyRows[0].is_volunteer, false, 'RSVP-only primary attendee is not a volunteer')
  assert.equal(rsvpAttendees.countVolunteerAttendeeRows(rsvpOnlyRows), 0, 'RSVP-only submission has zero volunteers')
  assert.equal(rsvpAttendees.hasVolunteerAttendee(rsvpOnlyRows), false, 'RSVP-only submission is absent from volunteer roster')

  const volunteerRows = rsvpAttendees.buildPersonRsvpAttendeeRows({
    ...baseArgs,
    primaryIsVolunteer: true,
  })

  assert.equal(volunteerRows[0].is_volunteer, true, 'primary volunteer checkbox marks primary attendee as volunteer')
  assert.equal(rsvpAttendees.countVolunteerAttendeeRows(volunteerRows), 1, 'primary volunteer counts as one volunteer')
  assert.equal(rsvpAttendees.hasVolunteerAttendee(volunteerRows), true, 'primary volunteer appears in volunteer roster')

  const mixedRows = rsvpAttendees.buildPersonRsvpAttendeeRows({
    ...baseArgs,
    primaryIsVolunteer: false,
    attendees: [
      {
        matched_person_id: 'person-2',
        attendee_name: 'RSVP Guest',
        attendee_email: 'guest@example.com',
        attendee_phone: null,
        uses_primary_contact: false,
        is_volunteer: false,
        sort_order: 1,
      },
      {
        matched_person_id: 'person-3',
        attendee_name: 'Volunteer Guest',
        attendee_email: 'volunteer@example.com',
        attendee_phone: null,
        uses_primary_contact: false,
        is_volunteer: true,
        sort_order: 2,
      },
    ],
  })

  assert.equal(mixedRows.length, 3, 'additional RSVP attendees are preserved')
  assert.deepEqual(
    mixedRows.map((row) => row.is_volunteer),
    [false, false, true],
    'additional attendee volunteer intent is row-specific, not inherited from RSVP attendance'
  )
  assert.equal(rsvpAttendees.countVolunteerAttendeeRows(mixedRows), 1, 'only explicitly marked attendee volunteers count')
  assert.equal(rsvpAttendees.hasVolunteerAttendee(mixedRows), true, 'submission with any volunteer appears in volunteer roster')

  const hostManualRows = rsvpAttendees.buildPersonRsvpAttendeeRows({
    ...baseArgs,
    sourceCode: 'host_manual',
    primaryIsVolunteer: false,
  })

  assert.equal(
    hostManualRows[0].is_volunteer,
    true,
    'host-manual submissions remain explicit volunteer submissions even without primary checkbox input'
  )
  assert.equal(rsvpAttendees.countVolunteerAttendeeRows(hostManualRows), 1, 'host-manual primary row counts as volunteer')

  console.log('RSVP volunteer regression checks passed.')
} finally {
  await rm(buildDir, { recursive: true, force: true })
}
