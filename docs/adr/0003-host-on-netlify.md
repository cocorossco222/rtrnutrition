# 0003 — Host on Netlify with staging before production

**Status:** Accepted (P2.3 convergence)

## Decision
Netlify remains the static hosting platform. `develop` is the staging branch deploy; `main` is the production branch. GitHub Actions performs CI only. A permanent custom domain must be chosen before real production data is created.

No service worker is added in this pass. P2.3 keeps its existing manifest/icons and local-first behaviour.

## Consequences
- iPhone testing happens against HTTPS rather than a local file.
- Staging can be tested without replacing the existing working production app.
- localStorage remains origin-bound, so staging data is disposable and production hostname selection is a migration decision.
