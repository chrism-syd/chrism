# Instructions for AI coding agents

These requirements apply throughout the `chrism` repository to Codex and other AI coding agents. Follow the user's explicitly authorized scope. Repository instructions and documented commands do not themselves authorize production access, commits, merges, or deployments.

## Read the living documentation

Before implementation, read the documents relevant to the change:

- [Development workflow](docs/DEVELOPMENT.md)
- [Product and engineering principles](docs/CHRISM_PRINCIPLES.md)
- [Architecture](docs/ARCHITECTURE.md), including security posture and verification guidance
- [Ministry Operations Application architecture](docs/OPERATIONS_ARCHITECTURE.md)
- [Public local organization pages](docs/PUBLIC_PAGES.md)
- [Supabase workflow](docs/SUPABASE_WORKFLOW.md)
- [Available scripts](package.json)

Use these documents for implementation details rather than duplicating their rules. GitHub issues remain the canonical task backlog. Treat archived documentation and dated handoffs as historical evidence, not current instructions or authorization. Prefer living documentation and verified configurations; report discrepancies before acting on assumptions. The branch and production-authorization requirements below govern agent work even when older examples describe direct commits or deployment commands.

## Protect every application and domain

Treat every existing website, application, route, API, integration, and database as production-critical unless explicitly designated otherwise. Active development does not imply that existing behavior is disposable.

This repository serves multiple applications through shared code and deployment infrastructure:

| Domain | Application or role |
| --- | --- |
| `chrismworks.com` | Chrism's primary marketing website |
| `chrismworks.ca` | Chrism marketing domain; preserve its configured behavior |
| `chrism.app` | Ministry Operations Application, currently under active development |
| `operations.chrism.app` | Legacy address for the Ministry Operations Application |
| `ccic.supplies` | Christmas card ordering and fundraising platform |

Protect all configured `www` variants and any other domains served by this repository. Always call the operations platform the **Ministry Operations Application**, never the Knights Operations Application. Preserve legitimate Knights of Columbus terminology within its specific product workflows as described in the living architecture documents.

Treat the current domain assignments as intentional. Preserve existing behavior at `operations.chrism.app`; do not remove, redirect, or retire it without explicit authorization, regardless of historical retirement notes. Do not restructure or consolidate applications without explicit authorization.

Before changing shared routing, authentication, middleware/proxy logic, layouts, dependencies, APIs, integrations, or database structures, identify impacts across every affected application and domain. Include routes, redirects, sessions, permissions, public assets, generated links, integrations, and domain-specific behavior in the impact assessment. A change aimed at one application must preserve the others.

## Development scope and baseline

- Inspect the current branch and working-tree changes before editing. Preserve existing user work.
- Perform development on a dedicated feature branch. Do not modify `main` directly unless explicitly authorized. Use the existing isolated checkout; do not create a worktree unless the user requests one.
- Keep changes focused on the authorized task. Avoid unrelated refactoring, dependency upgrades, or architectural modifications.
- Before significant changes, identify the current production commit and deployment baseline from accessible, authorized deployment metadata. Do not assume `main` matches production or that a commit is live. If the baseline is unavailable, record that uncertainty and its risks; do not seek production credentials or access a production database merely to establish it.
- Follow existing ownership and permission helpers, compatibility rules, and public-data boundaries in the living documentation. Preserve existing functionality across all applications.

## Production authorization and sensitive information

Never access or modify production databases, credentials, environment variables, DNS, or deployment settings without explicit authorization. Migration and RLS files may be prepared on development branches when they are within the approved feature scope. Applying migration or RLS changes to any database requires separate, explicit authorization. Confirm the target environment and authorized operation before running database, schema-pull, repair, backfill, or integration commands. Inspect scripts before execution; a development command can still contact production or send real messages.

Never merge, promote, or deploy changes to production without separate, explicit authorization. Development branch pushes may be permitted within an approved workflow once their automatic deployment effects have been verified. Do not push if doing so would trigger a production deployment without separate, explicit deployment authorization. Approval to implement or commit code alone does not imply permission to push, merge, promote, deploy, change settings, or apply database changes. Documentation examples are procedures to use only when authorized.

Never expose secrets, credentials, or customer information in code, chat, logs, screenshots, fixtures, reports, or commits. Use synthetic data for development checks. Do not dump environment variables or credential files. Keep sensitive values out of saved instructions and use approved secure configuration mechanisms when authorized.

## Validation

Run applicable lint, TypeScript, regression, and build checks using the current scripts in `package.json`:

```bash
npm run lint -- --max-warnings=0
npm run typecheck
npm run verify
npm run build
```

`npm run verify` includes lint, typecheck, and five semantic regression scripts. If it stops early, run applicable remaining regression scripts individually and report their outcomes separately. Follow the architecture documents for the council dependency audit, dependency security audit, and relevant functional smoke tests. Validate domain-specific routing and affected application flows in an explicitly designated non-production environment; production smoke tests require authorization.

Report passed, failed, skipped, and unrun checks accurately, including missing configuration or access prerequisites. Distinguish existing repository failures from failures introduced by the change. Never suppress assertions, disable validation, weaken security controls, or bypass checks to force a deployment. A blocked check is not a pass.

## Rollback and handoff

Preserve rollback options through focused, reversible changes and retention of necessary compatibility. For significant changes, document how to restore prior behavior, including any database or configuration dependencies; do not execute a production rollback without authorization.

Report the change scope, affected applications and domains, baseline evidence or uncertainty, risks, validation results, rollback approach, and unresolved issues. Update living documentation only when authorized and needed for durable decisions. Clearly distinguish implemented, committed, merged, and deployed states; never imply that one establishes another.
