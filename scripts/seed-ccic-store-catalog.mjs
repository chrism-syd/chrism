import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const projectRoot = process.cwd()
const buildDir = path.join(projectRoot, '.next/store-catalog-seed')
const storeCatalogMigrationPath = 'supabase/migrations/20260528211500_create_store_catalog_foundation.sql'

const sources = [
  {
    sourcePath: path.join(projectRoot, 'lib/store/catalog-model.ts'),
    compiledPath: path.join(buildDir, 'catalog-model.mjs'),
  },
  {
    sourcePath: path.join(projectRoot, 'lib/store/catalog-admin.ts'),
    compiledPath: path.join(buildDir, 'catalog-admin.mjs'),
  },
  {
    sourcePath: path.join(projectRoot, 'lib/christmas-cards/catalog.ts'),
    compiledPath: path.join(buildDir, 'christmas-cards-catalog.mjs'),
  },
  {
    sourcePath: path.join(projectRoot, 'lib/supabase/admin.ts'),
    compiledPath: path.join(buildDir, 'supabase-admin.mjs'),
  },
]

function rewriteImports(outputText) {
  return outputText
    .replace(/from ['"]\.\/catalog-model['"]/g, "from './catalog-model.mjs'")
    .replace(/from ['"]@\/lib\/store\/catalog-model['"]/g, "from './catalog-model.mjs'")
    .replace(/from ['"]@\/lib\/supabase\/admin['"]/g, "from './supabase-admin.mjs'")
}

function isMissingStoreCatalogTableError(error) {
  if (!(error instanceof Error)) return false
  return error.message.includes('store_categories') && error.message.includes('schema cache')
}

function printSeedFailure(error) {
  if (isMissingStoreCatalogTableError(error)) {
    console.error('Could not seed the CCiC store catalog because the store catalog tables do not exist yet.')
    console.error('Apply the store catalog migration first, then rerun this command.')
    console.error(`Migration: ${storeCatalogMigrationPath}`)
    console.error('After applying the migration, if Supabase still reports a schema cache error, refresh/restart the local Supabase API or wait briefly for the hosted schema cache to refresh.')
    return
  }

  console.error(error)
}

await mkdir(buildDir, { recursive: true })

try {
  for (const source of sources) {
    const sourceText = await readFile(source.sourcePath, 'utf8')
    const transpiled = ts.transpileModule(sourceText, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        isolatedModules: true,
      },
      fileName: source.sourcePath,
    })
    await writeFile(source.compiledPath, rewriteImports(transpiled.outputText), 'utf8')
  }

  const catalogModel = await import(`${pathToFileURL(path.join(buildDir, 'catalog-model.mjs')).href}?t=${Date.now()}`)
  const catalogAdmin = await import(`${pathToFileURL(path.join(buildDir, 'catalog-admin.mjs')).href}?t=${Date.now()}`)
  const christmasCatalog = await import(`${pathToFileURL(path.join(buildDir, 'christmas-cards-catalog.mjs')).href}?t=${Date.now()}`)
  const supabaseAdmin = await import(`${pathToFileURL(path.join(buildDir, 'supabase-admin.mjs')).href}?t=${Date.now()}`)

  const seed = catalogModel.buildChristmasCardStoreCatalogSeed({
    designs: christmasCatalog.CHRISTMAS_CARD_DESIGNS,
    boxes: christmasCatalog.CHRISTMAS_CARD_BOXES,
    curatedCases: christmasCatalog.CHRISTMAS_CARD_CURATED_CASES,
    config: christmasCatalog.CHRISTMAS_CARD_ORDER_CONFIG,
  })

  const admin = supabaseAdmin.createAdminClient()
  const result = await catalogAdmin.upsertStoreCatalogSeed({ admin, seed })

  console.log('CCiC store catalog seed complete.')
  console.log(`Categories: ${result.categoryCount}`)
  console.log(`Products:   ${result.productCount}`)
  console.log(`Components: ${result.componentCount}`)
  console.log(`Media:      ${result.mediaCount}`)
} catch (error) {
  printSeedFailure(error)
  process.exitCode = 1
} finally {
  await rm(buildDir, { recursive: true, force: true })
}
