# Delivery roadmap

This repository follows the A–K convergence plan. P2.3 is the code baseline; infrastructure is changed around it in controlled stages rather than rewriting the product while it is being stabilised.

## A — Sanitise — complete in this repository
- Remove all real-client names and client-specific history from source, tests, fixtures and docs.
- Keep only explicitly synthetic fixture data.
- Run the public-repo guard in local tests and CI.

## B — Converge — complete in this repository
- P2.3 is the canonical Companion.
- Netlify remains the deployment platform.
- Remove the abandoned GitHub Pages path and the old manual bearer-token/file-store sync implementation.

## C — Clean repository — ready
- Start the new GitHub repository from this directory with no inherited `.git` history.
- Commit only after `npm test` and a final human search for client-identifying material.

## D — Staging — next operational step
- Connect the fresh GitHub repository to a **new or staging-safe Netlify site**.
- Use `develop` as a branch deploy, e.g. `develop--<site-name>.netlify.app`.
- Do not point the existing working production origin at this branch.

## E — iPhone test — gate before production
Test P2.3 on a real iPhone in both Safari and Add to Home Screen. The checklist is in `docs/operations/iphone.md`.

## F — Permanent production address — decide before real data
Attach the origin intended to survive, preferably a dedicated subdomain such as `nutrition.rtrcoaching.co.uk`. Browser storage is origin-bound; another origin move requires explicit export/import migration.

## G — Data core — scaffolded, not activated
Target: Supabase Auth + Postgres UUID identity, client events, snapshots and RLS. Migration scaffold: `supabase/migrations/0001_data_core.sql`.

Activation gate: provider region/DPA/privacy work completed, auth journey device-tested, production origin finalised, and RLS verified with client/coach adversarial tests.

## H — Automatic resolved-day sync
Implement only after G passes its gate:

`Done for today → queue event locally → authenticated upload → idempotent acknowledgement → remove/mark queued item`

Offline completion must still work. A failed sync must never turn a resolved day back into an unresolved one.

## I — Send to Coco
Keep a separate manual `coach.update` event for a client-selected priority/update. It is additive to automatic `day.resolved` capture, not a replacement for it.

## J — Coach read model
Start with the minimum useful read model: client identity, most recent resolved-day event, most recent manual update and latest snapshot timestamp. No complex dashboard until use proves the need.

## K — Production client migration
On the final origin: install from Safari to Home Screen → establish authenticated UUID identity → import any existing local record if required → complete a day → verify sync acknowledgement → verify the coach read model → only then retire the previous shortcut/origin.
