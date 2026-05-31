import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const projectRoot = process.cwd()
const buildDir = path.join(projectRoot, '.next/store-catalog-checks')

const sources = [
  {
    sourcePath: path.join(projectRoot, 'lib/store/catalog-model.ts'),
    compiledPath: path.join(buildDir, 'catalog-model-under-test.mjs'),
    importPath: null,
  },
  {
    sourcePath: path.join(projectRoot, 'lib/christmas-cards/catalog.ts'),
    compiledPath: path.join(buildDir, 'christmas-cards-catalog-under-test.mjs'),
    importPath: './catalog-model-under-test.mjs',
  },
]

function rewriteImports(outputText) {
  return outputText.replace(/from ['"]@\/lib\/christmas-cards\/catalog['"]/g, "from './christmas-cards-catalog-under-test.mjs'")
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

  const model = await import(`${pathToFileURL(path.join(buildDir, 'catalog-model-under-test.mjs')).href}?t=${Date.now()}`)
  const christmasCatalog = await import(`${pathToFileURL(path.join(buildDir, 'christmas-cards-catalog-under-test.mjs')).href}?t=${Date.now()}`)

  const seed = model.buildChristmasCardStoreCatalogSeed({
    boxes: christmasCatalog.CHRISTMAS_CARD_BOXES,
    curatedCases: christmasCatalog.CHRISTMAS_CARD_CURATED_CASES,
    config: christmasCatalog.CHRISTMAS_CARD_ORDER_CONFIG,
  })

  model.assertStoreCatalogSeedInvariants(seed)

  assert.equal(seed.categories.length, 1, 'CCiC seed has one Christmas Cards category')
  assert.equal(seed.categories[0].slug, 'christmas-cards', 'CCiC category slug is stable')

  const boxProducts = seed.products.filter((product) => product.productKind === 'christmas_card_box')
  const caseProducts = seed.products.filter((product) => product.productKind === 'christmas_card_case')
  const addOnProducts = seed.products.filter((product) => product.productKind === 'store_add_on')

  assert.equal(
    boxProducts.length,
    christmasCatalog.CHRISTMAS_CARD_BOXES.length,
    'Each current CCiC card art maps to one boxed product'
  )
  assert.equal(caseProducts.length, christmasCatalog.CHRISTMAS_CARD_CURATED_CASES.length, 'Each curated case maps to one case product')
  assert.equal(addOnProducts.length, 2, 'Promotion and Campaign packages map to add-on products')

  for (const product of boxProducts) {
    assert.equal(product.cardsPerBox, 12, `${product.title} remains a 12-card box`)
    assert.equal(product.envelopesPerBox, 12, `${product.title} remains a 12-envelope box`)
    assert.equal(product.boxesPerCase, null, `${product.title} does not carry case sizing`)
    assert.equal(product.priceCents, 1300, `${product.title} box price remains $13.00 CAD while static catalog is source of truth`)
  }

  const classicCase = caseProducts.find((product) => product.slug === 'classic-sacred-case')
  assert.ok(classicCase, 'Classic Sacred Case is present')
  assert.equal(classicCase.priceCents, 44900, 'Classic Sacred Case remains $449 CAD')
  assert.equal(classicCase.boxesPerCase, 35, 'Classic Sacred Case remains 35 boxes')

  const classicCaseBoxCount = model.countBoxQuantityForProduct({
    productLegacyKey: classicCase.legacyKey,
    products: seed.products,
    components: seed.components,
  })
  assert.equal(classicCaseBoxCount, 35, 'Classic Sacred Case component math totals 35 boxes')

  const promotionPackage = addOnProducts.find((product) => product.slug === 'promotion-package')
  const campaignPackage = addOnProducts.find((product) => product.slug === 'campaign-package')
  assert.ok(promotionPackage, 'Promotion Package is present')
  assert.ok(campaignPackage, 'Campaign Package is present')
  assert.equal(promotionPackage.priceCents, 6500, 'Promotion Package remains +$65 CAD')
  assert.equal(campaignPackage.priceCents, 19500, 'Campaign Package remains +$195 CAD')

  assert.equal(
    christmasCatalog.CHRISTMAS_CARD_ORDER_CONFIG.shippingLabel,
    'Shipping calculated after order review.',
    'Public shipping wording remains stable'
  )

  console.log('Store catalog model checks passed.')
} finally {
  await rm(buildDir, { recursive: true, force: true })
}
