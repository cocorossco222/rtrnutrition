# RTR Nutrition Companion

The canonical public codebase for the RTR Nutrition Companion. P2.3 remains the client baseline: a local-first, single-file coaching companion with offline-first behaviour, Home Screen support and a tested resolved-day experience.

**Public-repo rule:** no real client identity, exported health data, credentials or deployment secrets may ever be committed.

> **Food is Medicine.** No scores, no streaks, no perfect days. Missing a day is missing an observation, never a failure.

## Current position

| Area | State |
|---|---|
| Companion | **P2.3 canonical baseline**; neutral public build |
| Hosting | **Netlify retained**; `develop` branch for staging, `main` reserved for production |
| Permanent origin | Must be chosen before a real client creates production data; preferred pattern: `nutrition.rtrcoaching.co.uk` |
| Identity/data core | Supabase/Postgres design scaffold included; not wired into P2.3 yet |
| Automatic sync | Contract defined; implementation follows data-core/auth activation |
| Coach read model | Minimal SQL read model scaffolded; no elaborate dashboard |

The delivery sequence is documented in [`docs/roadmap.md`](docs/roadmap.md): sanitise → converge → clean repo → staging → iPhone UAT → permanent origin → data core → resolved-day sync → manual coach update → coach read model → client migration.

## Repository map

```text
apps/companion/          Canonical P2.3 client and its QA suite
packages/contract/       Backup + future sync-event contracts and synthetic fixtures
supabase/migrations/     UUID/auth/event/snapshot/RLS data-core scaffold
scripts/                 Fixture generation and public-repo safety checks
docs/                    Architecture, ADRs, staging/iPhone/release/migration runbooks
.github/workflows/        CI only; Netlify owns deployment
netlify.toml              Netlify build/publish/security-header configuration
```

## Quick start

Requires Node 22.22.2 (pinned in `.nvmrc`).

```bash
npm ci
npm test
```

For local browser use, open `apps/companion/index.html`. For iPhone testing, use the Netlify staging origin; local-file operation is not the acceptance path.

## Netlify release model

- `develop` → branch deploy / staging, normally `develop--<site-name>.netlify.app`.
- `main` → production branch, but do **not** migrate a real client until the permanent custom domain is attached.
- Netlify runs `npm ci && npm test && npm run build:static`, then publishes only `dist/companion`.
- GitHub Actions runs CI only; this repository intentionally contains no GitHub Pages deploy workflow.

See [`docs/operations/netlify.md`](docs/operations/netlify.md) and [`docs/operations/release.md`](docs/operations/release.md).

## Data-core direction

P2.3 stays local-first. The next platform layer uses authenticated UUID identity, client events, snapshots and row-level authorisation. The important behavioural contract is:

`Done for today → durable local queue → authenticated sync → acknowledgement`

A separate manual event remains available for **Send to Coco** / priority updates. The server derives the client identity from authentication; names inside payloads never establish identity.

See [`docs/data-core.md`](docs/data-core.md) and [`packages/contract/schema/sync-event.v1.schema.json`](packages/contract/schema/sync-event.v1.schema.json).

## Public-repo safety

Before every push:

```bash
npm run check:public
```

The guard rejects Companion exports, secrets, sync data, non-synthetic fixture identity, and other high-risk repository artefacts. It is a guardrail, not a substitute for human review.

## Further reading

[Architecture](docs/architecture.md) · [Roadmap](docs/roadmap.md) · [ADRs](docs/adr/) · [Data core](docs/data-core.md) · [Data protection](docs/data-protection.md) · [Netlify](docs/operations/netlify.md) · [iPhone UAT](docs/operations/iphone.md) · [Production migration](docs/operations/migration.md) · [Release](docs/operations/release.md)
