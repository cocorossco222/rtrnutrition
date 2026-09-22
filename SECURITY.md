# Security and client-data rules

## Never commit

- Any real Companion export or copied client health record.
- Real client names/identifiers in fixtures, test seeds, comments, screenshots, docs or source configuration.
- `.env` files, API keys, access tokens, database credentials or service-role keys.
- Local backend data dumps, SQL exports or production logs.

The committed fixture identity must remain explicitly synthetic.

## Fresh public repository rule

This directory is intended to become commit #1 of a new repository. Do **not** copy the old `.git` directory or merge/import the old history. If real client data has ever existed in an old repository, deleting it in a later commit does not make that history safe for publication.

## Before pushing

Run:

```bash
npm run check:public
npm test
```

Then perform a human search for real-client names, email addresses, phone numbers, addresses and copied case-note phrases known to the team.

## If data or a secret is committed

Treat it as disclosed, rotate exposed credentials, remove it from history, and follow the organisation's data-breach process. Health and coaching records may be special-category personal data under UK GDPR; escalation must follow the organisation's documented data-protection procedure.
