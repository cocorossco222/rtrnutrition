# Release process

## Branch model

- `develop` — staging/UAT through a Netlify branch deploy.
- `main` — production code branch.
- Pull requests — CI and optional Netlify deploy previews with synthetic/test data only.

## Staging release

1. `npm ci && npm test` locally.
2. Push to `develop`.
3. Confirm Netlify branch deploy passes its build/test gate.
4. Complete the iPhone checklist.
5. Record defects before promotion.

## Production promotion

1. Permanent production custom domain already attached and verified.
2. All staging/UAT gates green.
3. Merge the tested commit to `main`.
4. Verify the version stamp and core flow at the permanent origin.
5. Do not delete the previous client origin/shortcut until migration verification is complete.

Deploying code must not silently clear or rename the local storage key. Data-model changes require explicit migration tests.
