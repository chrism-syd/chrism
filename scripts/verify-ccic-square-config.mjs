// Local Square configuration regression tests. No network or real credentials.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/christmas-cards/square-config.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const scenarios = [
  ['unset', {}, false],
  ['invalid', { SQUARE_ENVIRONMENT:'live' }, false],
  ['sandbox incomplete', { SQUARE_ENVIRONMENT:'sandbox' }, false],
  ['sandbox valid', { SQUARE_ENVIRONMENT:'sandbox', SQUARE_APPLICATION_ID:'sandbox-app', SQUARE_LOCATION_ID:'sandbox-location', SQUARE_ACCESS_TOKEN:'sandbox-token' }, true, 'https://connect.squareupsandbox.com'],
  ['production opt-in absent', { SQUARE_ENVIRONMENT:'production', SQUARE_APPLICATION_ID:'live-app', SQUARE_LOCATION_ID:'live-location', SQUARE_ACCESS_TOKEN:'live-token' }, false],
  ['production opt-in false', { SQUARE_ENVIRONMENT:'production', CCIC_SQUARE_LIVE_PAYMENTS_ENABLED:'false', SQUARE_APPLICATION_ID:'live-app', SQUARE_LOCATION_ID:'live-location', SQUARE_ACCESS_TOKEN:'live-token' }, false],
  ['production valid', { SQUARE_ENVIRONMENT:'production', CCIC_SQUARE_LIVE_PAYMENTS_ENABLED:'true', SQUARE_APPLICATION_ID:'live-app', SQUARE_LOCATION_ID:'live-location', SQUARE_ACCESS_TOKEN:'live-token' }, true, 'https://connect.squareup.com'],
  ['production missing token', { SQUARE_ENVIRONMENT:'production', CCIC_SQUARE_LIVE_PAYMENTS_ENABLED:'true', SQUARE_APPLICATION_ID:'live-app', SQUARE_LOCATION_ID:'live-location' }, false],
]
for (const [name, vars, expectedEnabled, expectedApi] of scenarios) {
  const sandbox = { exports:{}, process:{env:vars} }
  // Config imports server-only; strip this inert import in isolated VM, never load external modules.
  const runnable = js.replace(/require\(["']server-only["']\);?/g, '')
  vm.runInNewContext(runnable, sandbox, {timeout:1000})
  const result = sandbox.exports.getCcicSquareConfig()
  assert.equal(Boolean(result), expectedEnabled, `${name}: enabled`)
  if (expectedApi) assert.equal(result.apiBase, expectedApi, `${name}: endpoint`)
  console.log(`PASS: ${name}`)
}
console.log('Square config isolation tests passed. No network or credentials used.')
