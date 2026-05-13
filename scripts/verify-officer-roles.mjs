import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const projectRoot = process.cwd()
const sourcePath = path.join(projectRoot, 'lib/members/officer-roles.ts')
const buildDir = path.join(projectRoot, '.next/officer-role-checks')
const compiledPath = path.join(buildDir, 'officer-roles-under-test.mjs')

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
  const officerRoles = await import(`${pathToFileURL(compiledPath).href}?t=${Date.now()}`)

  const historicalGrandKnightTerm = {
    id: 'historical-grand-knight',
    office_scope_code: 'council',
    office_code: 'grand_knight',
    office_label: 'Grand Knight',
    office_rank: null,
    service_start_year: 2024,
    service_end_year: 2025,
    manual_end_effective_date: null,
  }

  const currentGrandKnightTerm = {
    ...historicalGrandKnightTerm,
    id: 'current-grand-knight',
    service_start_year: 2025,
    service_end_year: 2026,
  }

  assert.equal(
    officerRoles.getKnightsOfColumbusFraternalYearForDate(new Date('2025-06-30T12:00:00Z')),
    2024,
    'June remains in the previous KofC fraternal year'
  )

  assert.equal(
    officerRoles.getKnightsOfColumbusFraternalYearForDate(new Date('2025-07-01T12:00:00Z')),
    2025,
    'July starts the new KofC fraternal year'
  )

  assert.equal(
    officerRoles.isCurrentOfficerTerm(historicalGrandKnightTerm, 2024),
    true,
    '2024-2025 Grand Knight is current during fraternal start year 2024'
  )

  assert.equal(
    officerRoles.isCurrentOfficerTerm(historicalGrandKnightTerm, 2025),
    false,
    '2024-2025 Grand Knight is past once fraternal start year 2025 begins'
  )

  assert.equal(
    officerRoles.isOfficerTermActive(historicalGrandKnightTerm, {
      referenceDate: new Date('2025-06-30T12:00:00Z'),
      useKnightsOfColumbusFraternalYear: true,
    }),
    true,
    'historical Grand Knight remains active through the final day of the 2024-2025 fraternal year'
  )

  assert.equal(
    officerRoles.isOfficerTermActive(historicalGrandKnightTerm, {
      referenceDate: new Date('2025-07-01T12:00:00Z'),
      useKnightsOfColumbusFraternalYear: true,
    }),
    false,
    'historical Grand Knight is inactive on the first day of the 2025-2026 fraternal year'
  )

  assert.deepEqual(
    officerRoles.summarizeCurrentOfficerLabels([historicalGrandKnightTerm, currentGrandKnightTerm], 2025),
    ['Grand Knight'],
    'current officer summary excludes past Grand Knight terms'
  )

  assert.deepEqual(
    officerRoles.summarizeLastingHonorifics([historicalGrandKnightTerm, currentGrandKnightTerm], {
      referenceDate: new Date('2025-07-01T12:00:00Z'),
      useKnightsOfColumbusFraternalYear: true,
    }),
    ['Past Grand Knight'],
    'past Grand Knight receives lasting honorific after term expires'
  )

  assert.deepEqual(
    officerRoles.summarizeHonorificSuffixes([historicalGrandKnightTerm, currentGrandKnightTerm], {
      referenceDate: new Date('2025-07-01T12:00:00Z'),
      useKnightsOfColumbusFraternalYear: true,
    }),
    ['PGK'],
    'past Grand Knight receives lasting suffix after term expires'
  )

  assert.equal(
    officerRoles.isAutomaticCouncilAdminTerm(historicalGrandKnightTerm),
    true,
    'Grand Knight remains an automatic admin office code; currentness must be checked separately'
  )

  console.log('Officer role regression checks passed.')
} finally {
  await rm(buildDir, { recursive: true, force: true })
}
