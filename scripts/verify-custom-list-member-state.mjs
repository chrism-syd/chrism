import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const projectRoot = process.cwd()
const sourcePath = path.join(projectRoot, 'lib/custom-lists/member-state.ts')
const buildDir = path.join(projectRoot, '.next/custom-list-member-state-checks')
const compiledPath = path.join(buildDir, 'member-state-under-test.mjs')

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
  const memberState = await import(`${pathToFileURL(compiledPath).href}?t=${Date.now()}`)

  const originalState = {
    claimed_by_person_id: 'claimer-person',
    claimed_at: '2026-05-01T12:00:00.000Z',
    last_contact_at: '2026-05-02T12:00:00.000Z',
    last_contact_by_person_id: 'contact-person',
  }

  const contactedState = memberState.applyCustomListContactPatch(
    originalState,
    memberState.buildCustomListContactPatch({
      actorPersonId: 'new-contact-person',
      contactedAt: '2026-05-13T10:00:00.000Z',
    })
  )

  assert.equal(contactedState.last_contact_at, '2026-05-13T10:00:00.000Z', 'logging contact updates last contact timestamp')
  assert.equal(contactedState.last_contact_by_person_id, 'new-contact-person', 'logging contact records the contacting person')
  assert.equal(contactedState.claimed_by_person_id, originalState.claimed_by_person_id, 'logging contact does not steal or clear a claim')
  assert.equal(contactedState.claimed_at, originalState.claimed_at, 'logging contact does not create or change claim timestamp')

  const claimedState = memberState.applyCustomListClaimPatch(
    originalState,
    memberState.buildCustomListClaimPatch({
      actorPersonId: 'new-claimer-person',
      claimedAt: '2026-05-13T11:00:00.000Z',
    })
  )

  assert.equal(claimedState.claimed_by_person_id, 'new-claimer-person', 'claiming assigns the claiming person')
  assert.equal(claimedState.claimed_at, '2026-05-13T11:00:00.000Z', 'claiming records claim timestamp')
  assert.equal(claimedState.last_contact_at, originalState.last_contact_at, 'claiming does not log contact')
  assert.equal(claimedState.last_contact_by_person_id, originalState.last_contact_by_person_id, 'claiming does not change last-contact person')

  const releasedState = memberState.applyCustomListReleaseClaimPatch(originalState)

  assert.equal(releasedState.claimed_by_person_id, null, 'releasing claim clears claimed person')
  assert.equal(releasedState.claimed_at, null, 'releasing claim clears claim timestamp')
  assert.equal(releasedState.last_contact_at, originalState.last_contact_at, 'releasing claim preserves contact history')
  assert.equal(releasedState.last_contact_by_person_id, originalState.last_contact_by_person_id, 'releasing claim preserves last-contact person')

  assert.equal(
    memberState.shouldReleaseClaimForRevokedShare({
      claimedByPersonId: 'claimer-person',
      revokedPersonIds: ['other-person', 'claimer-person'],
    }),
    true,
    'revoking a share releases claims owned by the revoked person'
  )

  assert.equal(
    memberState.shouldReleaseClaimForRevokedShare({
      claimedByPersonId: 'claimer-person',
      revokedPersonIds: ['other-person'],
    }),
    false,
    'revoking another person does not release unrelated claims'
  )

  assert.equal(
    memberState.shouldReleaseClaimForRevokedShare({
      claimedByPersonId: null,
      revokedPersonIds: ['claimer-person'],
    }),
    false,
    'unclaimed rows do not need claim release during revoke'
  )

  console.log('Custom list member state regression checks passed.')
} finally {
  await rm(buildDir, { recursive: true, force: true })
}
