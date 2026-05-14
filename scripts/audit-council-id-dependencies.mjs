#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repoRoot = process.cwd()
const outputPath = path.join(os.homedir(), 'Downloads', 'chrism-council-id-audit-report.txt')

const ignoredDirectories = new Set([
  '.git',
  '.next',
  'node_modules',
  '.vercel',
  'dist',
  'coverage',
])

const ignoredExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.tgz',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.mov',
  '.xls',
  '.xlsx',
])

const pathInfoOnlyPrefixes = [
  'docs/',
  'supabase/migrations/',
  'supabase/migrations_legacy/',
  'supabase/reference/',
  'supabase/schema.sql',
  'database.types.ts',
]

const intentionalGuardrailFiles = new Set([
  'scripts/audit-council-id-dependencies.mjs',
  'scripts/verify-supreme-import-local-unit-cutover-readiness.sql',
  'scripts/patch-event-detail-local-unit-scope.mjs',
  'scripts/patch-event-actions-local-unit-scope.mjs',
])

const intentionalPublicRouteFiles = new Set([
  'app/councils/[councilNumber]/meetings/page.tsx',
  'app/councils/[councilNumber]/meetings.ics/route.ts',
])

const patterns = [
  {
    id: 'current-council-helper',
    severity: 'BLOCKER',
    regex: /\bcurrent_council_id\b|app\.current_council_id\b/g,
    note: 'Old session-derived council helper should not be referenced by live app/RLS code.',
  },
  {
    id: 'legacy-nonmember-wrapper-create-prospect',
    severity: 'BLOCKER',
    regex: /\bcreate_prospect\s*\(/g,
    ignoreLine: (line) => /create_prospect_for_local_unit/.test(line),
    note: 'Legacy council-scoped create_prospect wrapper should not be called or recreated.',
  },
  {
    id: 'legacy-nonmember-wrapper-create-volunteer',
    severity: 'BLOCKER',
    regex: /\bcreate_volunteer_only\s*\(/g,
    ignoreLine: (line) => /create_volunteer_only_for_local_unit/.test(line),
    note: 'Legacy council-scoped create_volunteer_only wrapper should not be called or recreated.',
  },
  {
    id: 'supreme-import-p-council-id',
    severity: 'BLOCKER',
    regex: /\bp_council_id\b/g,
    note: 'Supreme import RPC/apply path should use p_local_unit_id, not p_council_id.',
  },
  {
    id: 'direct-council-id-filter',
    severity: 'WARN',
    regex: /\.(eq|neq|in|not)\(\s*['"]council_id['"]/g,
    note: 'Direct council_id filters need review: allowed only for legacy bridge/routing, not operational scope.',
  },
  {
    id: 'people-council-id-reference',
    severity: 'WARN',
    regex: /\bpeople\.council_id\b/g,
    note: 'people.council_id is legacy compatibility only; review for operational dependency.',
  },
  {
    id: 'council-id-token',
    severity: 'INFO',
    regex: /\bcouncil_id\b/g,
    note: 'council_id token remains expected in schema, legacy bridge, docs, and historical migrations.',
  },
  {
    id: 'council-id-camel-token',
    severity: 'INFO',
    regex: /\bcouncilId\b/g,
    note: 'councilId remains expected in compatibility context objects and bridge helpers.',
  },
]

function normalizeRelativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/')
}

function shouldTreatAsInfoOnly(relativePath) {
  return pathInfoOnlyPrefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(prefix))
}

function isIntentionalGuardrailFile(relativePath) {
  return intentionalGuardrailFiles.has(relativePath)
}

function isIntentionalPublicRouteFile(relativePath) {
  return intentionalPublicRouteFiles.has(relativePath)
}

function isBinaryish(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return ignoredExtensions.has(ext)
}

function walk(directory) {
  const entries = readdirSync(directory)
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry)
    const stats = statSync(absolutePath)

    if (stats.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        files.push(...walk(absolutePath))
      }
      continue
    }

    if (stats.isFile() && !isBinaryish(absolutePath)) {
      files.push(absolutePath)
    }
  }

  return files
}

function readTextFile(filePath) {
  const buffer = readFileSync(filePath)

  if (buffer.includes(0)) {
    return null
  }

  return buffer.toString('utf8')
}

function auditFile(filePath) {
  const relativePath = normalizeRelativePath(filePath)
  const text = readTextFile(filePath)

  if (text === null) return []

  const lines = text.split(/\r?\n/)
  const pathIsInfoOnly = shouldTreatAsInfoOnly(relativePath)
  const pathIsGuardrail = isIntentionalGuardrailFile(relativePath)
  const pathIsPublicRoute = isIntentionalPublicRouteFile(relativePath)
  const findings = []

  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0
      if (!pattern.regex.test(line)) continue
      if (pattern.ignoreLine?.(line)) continue

      const severity = pathIsGuardrail || pathIsPublicRoute
        ? 'INFO'
        : pathIsInfoOnly && pattern.severity !== 'BLOCKER'
          ? 'INFO'
          : pathIsInfoOnly && pattern.severity === 'BLOCKER'
            ? 'WARN'
            : pattern.severity

      const intentionalPrefix = pathIsGuardrail
        ? 'Intentional audit/verifier guardrail. '
        : pathIsPublicRoute
          ? 'Intentional local-org-specific public route. '
          : ''

      findings.push({
        severity,
        patternId: pattern.id,
        path: relativePath,
        lineNumber: index + 1,
        line: line.trim(),
        note: `${intentionalPrefix}${pattern.note}`,
      })
    }
  })

  return findings
}

function buildReport(args) {
  const { files, findings, summary } = args
  const lines = []

  lines.push('Council dependency audit summary')
  lines.push('================================')
  lines.push(`Generated at: ${new Date().toISOString()}`)
  lines.push(`Repo root: ${repoRoot}`)
  lines.push(`Files scanned: ${files.length}`)
  lines.push(`BLOCKER: ${summary.BLOCKER ?? 0}`)
  lines.push(`WARN:    ${summary.WARN ?? 0}`)
  lines.push(`INFO:    ${summary.INFO ?? 0}`)
  lines.push('')

  if (findings.length === 0) {
    lines.push('No council-id dependency findings.')
    lines.push('')
    return lines.join('\n')
  }

  for (const finding of findings) {
    lines.push(`[${finding.severity}] ${finding.path}:${finding.lineNumber} ${finding.patternId}`)
    lines.push(`  ${finding.line}`)
    lines.push(`  ${finding.note}`)
  }

  lines.push('')
  return lines.join('\n')
}

if (!existsSync(path.join(repoRoot, 'package.json'))) {
  console.error('Run this script from the repository root.')
  process.exit(2)
}

const files = walk(repoRoot)
const findings = files.flatMap(auditFile)

const severityOrder = new Map([
  ['BLOCKER', 0],
  ['WARN', 1],
  ['INFO', 2],
])

findings.sort((left, right) => {
  const severityDelta = severityOrder.get(left.severity) - severityOrder.get(right.severity)
  if (severityDelta !== 0) return severityDelta
  const pathDelta = left.path.localeCompare(right.path)
  if (pathDelta !== 0) return pathDelta
  return left.lineNumber - right.lineNumber
})

const summary = findings.reduce((accumulator, finding) => {
  accumulator[finding.severity] = (accumulator[finding.severity] ?? 0) + 1
  return accumulator
}, {})

const report = buildReport({ files, findings, summary })

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, report, 'utf8')

console.log('Council dependency audit summary')
console.log('================================')
console.log(`Files scanned: ${files.length}`)
console.log(`BLOCKER: ${summary.BLOCKER ?? 0}`)
console.log(`WARN:    ${summary.WARN ?? 0}`)
console.log(`INFO:    ${summary.INFO ?? 0}`)
console.log(`Report written to: ${outputPath}`)

if ((summary.BLOCKER ?? 0) > 0) {
  console.error('\nCouncil dependency audit found BLOCKER findings.')
  process.exit(1)
}
