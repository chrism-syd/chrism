import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const projectRoot = process.cwd()
const sourcePath = path.join(projectRoot, 'lib/auth/org-admin-area-access.ts')
const buildDir = path.join(projectRoot, '.next/org-admin-area-access-checks')
const compiledPath = path.join(buildDir, 'org-admin-area-access-under-test.mjs')

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
  const orgAdminAccess = await import(`${pathToFileURL(compiledPath).href}?t=${Date.now()}`)

  assert.deepEqual(
    orgAdminAccess.ORG_ADMIN_MANAGED_AREA_CODES,
    ['members', 'events', 'custom_lists', 'admins', 'local_unit_settings'],
    'active org admins receive manage access for the intended operational areas'
  )

  assert.deepEqual(
    orgAdminAccess.ORG_ADMIN_EXCLUDED_AREA_CODES,
    ['claims'],
    'claims remains intentionally excluded from automatic org-admin area access'
  )

  for (const areaCode of orgAdminAccess.ORG_ADMIN_MANAGED_AREA_CODES) {
    assert.equal(
      orgAdminAccess.isOrgAdminManagedAreaCode(areaCode),
      true,
      `${areaCode} is included in automatic org-admin access`
    )

    assert.equal(
      orgAdminAccess.getOrgAdminAreaAccessLevel(areaCode),
      'manage',
      `${areaCode} receives manage access for active org admins`
    )
  }

  assert.equal(
    orgAdminAccess.isOrgAdminManagedAreaCode('claims'),
    false,
    'claims is not included in automatic org-admin access'
  )

  assert.equal(
    orgAdminAccess.getOrgAdminAreaAccessLevel('claims'),
    null,
    'claims receives no automatic org-admin access level'
  )

  const rows = orgAdminAccess.listOrgAdminAreaAccessRows({
    localUnitId: 'local-unit-1',
    localUnitName: 'St. Example Council',
  })

  assert.equal(rows.length, 5, 'org-admin branch emits one row for each managed area')
  assert.deepEqual(
    rows.map((row) => row.area_code),
    orgAdminAccess.ORG_ADMIN_MANAGED_AREA_CODES,
    'org-admin branch row order matches the managed-area contract'
  )
  assert.deepEqual(
    [...new Set(rows.map((row) => row.access_level))],
    ['manage'],
    'org-admin branch emits manage access only'
  )
  assert.equal(
    rows.every((row) => row.local_unit_id === 'local-unit-1' && row.local_unit_name === 'St. Example Council'),
    true,
    'org-admin branch rows preserve local-unit context'
  )

  console.log('Org admin area access regression checks passed.')
} finally {
  await rm(buildDir, { recursive: true, force: true })
}
