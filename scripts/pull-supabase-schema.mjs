import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const OUTPUT_DIR = path.join(ROOT, 'supabase', 'reference');
const OPENAPI_PATH = path.join(OUTPUT_DIR, 'public-openapi.json');
const SUMMARY_PATH = path.join(OUTPUT_DIR, 'public-schema-summary.json');
const MARKDOWN_PATH = path.join(OUTPUT_DIR, 'public-schema-reference.md');

function parseEnvFile(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');

        if (separatorIndex === -1) {
          return [line, ''];
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line
          .slice(separatorIndex + 1)
          .trim()
          .replace(/^"(.*)"$/, '$1');

        return [key, value];
      })
  );
}

function extractForeignKey(description = '') {
  const match = description.match(/<fk table='([^']+)' column='([^']+)'\/>/);
  if (!match) {
    return null;
  }

  return {
    table: match[1],
    column: match[2],
  };
}

function isPrimaryKey(description = '') {
  return description.includes('<pk/>');
}

function namesFromPaths(paths, prefix = '/') {
  return Object.keys(paths)
    .filter((entry) => entry.startsWith(prefix) && entry !== '/')
    .map((entry) => entry.replace(/^\//, ''))
    .sort((left, right) => left.localeCompare(right));
}

function buildSummary(openapi) {
  const definitions = openapi.definitions ?? {};
  const paths = openapi.paths ?? {};
  const tables = namesFromPaths(paths)
    .filter((entry) => !entry.startsWith('rpc/'))
    .map((tableName) => {
    const definition = definitions[tableName] ?? {};
    const properties = definition.properties ?? {};
    const required = new Set(definition.required ?? []);

    const columns = Object.entries(properties).map(([columnName, column]) => ({
      name: columnName,
      type: column.format ?? column.type ?? 'unknown',
      required: required.has(columnName),
      default: column.default ?? null,
      primaryKey: isPrimaryKey(column.description),
      foreignKey: extractForeignKey(column.description),
      description: column.description ?? null,
    }));

    return {
      name: tableName,
      operations: Object.keys(paths[`/${tableName}`] ?? {}).sort(),
      columns,
    };
  });

  const rpcFunctions = namesFromPaths(paths, '/rpc/').map((functionName) => ({
    name: functionName.replace(/^rpc\//, ''),
    operations: Object.keys(paths[`/${functionName}`] ?? {}).sort(),
  }));

  return {
    fetchedAt: new Date().toISOString(),
    source: 'Supabase REST OpenAPI',
    schema: openapi.info?.title ?? 'public schema',
    tableCount: tables.length,
    rpcCount: rpcFunctions.length,
    tables,
    rpcFunctions,
  };
}

function buildMarkdown(summary) {
  const lines = [
    '# Supabase Public Schema Reference',
    '',
    `Fetched: ${summary.fetchedAt}`,
    `Source: ${summary.source}`,
    `Schema: ${summary.schema}`,
    `Tables: ${summary.tableCount}`,
    `RPC Functions: ${summary.rpcCount}`,
    '',
    'This snapshot is generated from the live Supabase REST OpenAPI document.',
    'It reflects the API-visible `public` schema, including columns, types, defaults, primary keys, and foreign-key annotations when exposed.',
    'It does not capture non-public schemas, RLS policies, triggers, indexes, or database functions.',
    '',
  ];

  for (const table of summary.tables) {
    lines.push(`## ${table.name}`);
    lines.push('');
    lines.push(`Operations: ${table.operations.join(', ') || 'none'}`);
    lines.push('');
    lines.push('| Column | Type | Required | Default | Key | References |');
    lines.push('| --- | --- | --- | --- | --- | --- |');

    for (const column of table.columns) {
      const key = column.primaryKey ? 'PK' : '';
      const references = column.foreignKey
        ? `${column.foreignKey.table}.${column.foreignKey.column}`
        : '';

      lines.push(
        `| ${column.name} | ${column.type} | ${column.required ? 'yes' : 'no'} | ${column.default ?? ''} | ${key} | ${references} |`
      );
    }

    lines.push('');
  }

  if (summary.rpcFunctions.length > 0) {
    lines.push('## RPC Functions');
    lines.push('');
    lines.push('| Function | Operations |');
    lines.push('| --- | --- |');

    for (const rpcFunction of summary.rpcFunctions) {
      lines.push(`| ${rpcFunction.name} | ${rpcFunction.operations.join(', ') || 'none'} |`);
    }

    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const envSource = await fs.readFile(ENV_PATH, 'utf8');
  const env = parseEnvFile(envSource);
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;

  if (!baseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  }

  if (!secretKey) {
    throw new Error('Missing SUPABASE_SECRET_KEY in .env.local');
  }

  const response = await fetch(`${baseUrl}/rest/v1/`, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI schema: ${response.status} ${response.statusText}`);
  }

  const openapi = await response.json();
  const summary = buildSummary(openapi);
  const markdown = buildMarkdown(summary);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OPENAPI_PATH, JSON.stringify(openapi, null, 2));
  await fs.writeFile(SUMMARY_PATH, JSON.stringify(summary, null, 2));
  await fs.writeFile(MARKDOWN_PATH, markdown);

  console.log(`Saved ${summary.tableCount} tables to ${path.relative(ROOT, OUTPUT_DIR)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
