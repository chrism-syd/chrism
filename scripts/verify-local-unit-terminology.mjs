import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const projectRoot = process.cwd()
const sourcePath = path.join(projectRoot, 'lib/local-units/terminology.ts')
const buildDir = path.join(projectRoot, '.next/local-unit-terminology-checks')
const compiledPath = path.join(buildDir, 'terminology-under-test.mjs')

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
  const terminology = await import(`${pathToFileURL(compiledPath).href}?t=${Date.now()}`)

  assert.deepEqual(
    terminology.getLocalUnitTerminology('council'),
    {
      singular: 'Council',
      plural: 'Councils',
      numberLabel: 'Council number',
      genericSingular: 'council',
      genericPlural: 'councils',
    },
    'Knights local orgs should use Council as their local-unit noun'
  )

  assert.deepEqual(
    terminology.getLocalUnitTerminology('conference'),
    {
      singular: 'Conference',
      plural: 'Conferences',
      numberLabel: 'Conference number',
      genericSingular: 'conference',
      genericPlural: 'conferences',
    },
    'SVDP-style local orgs should use Conference as their local-unit noun'
  )

  assert.deepEqual(
    terminology.getLocalUnitTerminology('parish'),
    {
      singular: 'Parish',
      plural: 'Parishes',
      numberLabel: null,
      genericSingular: 'parish',
      genericPlural: 'parishes',
    },
    'Parish local orgs should use Parish as their local-unit noun'
  )

  assert.deepEqual(
    terminology.getLocalUnitTerminology('ministry'),
    {
      singular: 'Ministry',
      plural: 'Ministries',
      numberLabel: null,
      genericSingular: 'ministry',
      genericPlural: 'ministries',
    },
    'Ministry local orgs should use Ministry as their local-unit noun'
  )

  assert.deepEqual(
    terminology.getLocalUnitTerminology('other'),
    terminology.DEFAULT_LOCAL_UNIT_TERMINOLOGY,
    'Other local orgs should fall back to generic local organization terminology'
  )

  assert.deepEqual(
    terminology.getLocalUnitTerminology('unknown-kind'),
    terminology.DEFAULT_LOCAL_UNIT_TERMINOLOGY,
    'Unknown local-unit kinds should fall back safely'
  )

  assert.equal(
    terminology.formatLocalUnitNumberLabel('council'),
    'Council number',
    'Council number should remain valid Knights terminology'
  )

  assert.equal(
    terminology.formatLocalUnitNumberLabel('other'),
    'Local organization number',
    'Generic local orgs should not use council-specific number labels'
  )

  assert.equal(
    terminology.formatLocalUnitMismatchMessage({ kind: 'council', actualIdentifier: 1234 }),
    'This row belongs to council 1234 and will stay skipped for this council import.',
    'Knights Supreme imports can still display council as the local-org noun'
  )

  assert.equal(
    terminology.formatLocalUnitMismatchMessage({ kind: 'conference', actualIdentifier: 55 }),
    'This row belongs to conference 55 and will stay skipped for this conference import.',
    'Other parent orgs can use their own local-org noun in the same flow shape'
  )

  console.log('Local unit terminology regression checks passed.')
} finally {
  await rm(buildDir, { recursive: true, force: true })
}
