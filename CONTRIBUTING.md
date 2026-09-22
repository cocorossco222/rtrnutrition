# Contributing

## Working model

Use short-lived feature branches into `develop`. Staging/UAT happens from the Netlify `develop` branch deploy. Promote the tested commit from `develop` to `main` only for production.

Each material pass needs a short purpose, scope boundary and acceptance gate. Real-device testing is required for client-facing UI changes because jsdom does not test layout or iOS browser behaviour.

## Tests

```bash
npm test
```

The suite covers the backup contract, Companion QA and negative controls, hosting assertions, the data-core scaffold and the public-repository guard.

Important rules:
- Every meaningful regression check should have a negative control where practical.
- Pin time/randomness in deterministic tests.
- No scoring, shame or diagnosis language; curiosity notes must not present correlation as cause.
- Keep P2.3 usable offline.
- Never commit real client identity/data or production secrets.

## Data model changes

A breaking contract change gets a new schema version. Regenerate only synthetic fixtures. Production database migrations must preserve RLS and be tested as both a client and a coach before deployment.
