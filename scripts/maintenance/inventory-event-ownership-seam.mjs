import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ROOT = process.cwd()
const OUT = path.join(os.homedir(), 'Downloads', 'chrism-event-ownership-inventory.md')
const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.vercel'])
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.sql', '.md', '.json'])

const patterns = [
  ['Event/council ownership', /\bcouncil_id\b|\bcouncilId\b|\bhostCouncilId\b|\bhost_council_id\b|\blegacy_council_id\b/],
]

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) walk(full, files)
    } else if (EXTS.has(path.extname(full))) {
      files.push(full)
    }
  }
  return files
}

function classify(file, line) {
  if (file === 'database.types.ts') return 'Schema/generated type'
  if (file.startsWith('supabase/migrations')) return 'Schema/history'
  if (file.startsWith('docs') || file.includes('/archive/')) return 'Docs/history'
  if (line.includes('legacy_council_id')) return 'Compatibility bridge'
  if (line.includes('council_number')) return 'Product truth/public identity'
  if (file.startsWith('app/events') || file.startsWith('lib/events')) return 'Event ownership surface'
  if (file.startsWith('lib/rsvp') || file.startsWith('app/rsvp')) return 'RSVP surface'
  return 'Needs review'
}

let out = `# Chrism event ownership inventory\n\nGenerated: ${new Date().toISOString()}\n\n`
const groups = {}

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file)
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split('\n')

  lines.forEach((line, index) => {
    for (const [, pattern] of patterns) {
      pattern.lastIndex = 0
      if (!pattern.test(line)) continue
      const bucket = classify(rel, line)
      groups[bucket] ||= []
      groups[bucket].push(`- \`${rel}:${index + 1}\` — \`${line.trim()}\``)
    }
  })
}

for (const [bucket, rows] of Object.entries(groups).sort()) {
  out += `## ${bucket} (${rows.length})\n\n${rows.join('\n')}\n\n`
}

fs.writeFileSync(OUT, out)
console.log(`Inventory written to: ${OUT}`)
