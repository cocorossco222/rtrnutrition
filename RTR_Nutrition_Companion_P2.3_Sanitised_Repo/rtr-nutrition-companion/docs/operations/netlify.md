# Netlify staging and production

## Repository connection

1. Create the fresh GitHub repository from this sanitised directory.
2. Connect it to a **new staging-safe Netlify site** or otherwise lock the existing production site so changing repository linkage cannot publish over the live version by accident.
3. Netlify reads `netlify.toml`: build command `npm ci && npm test && npm run build:static`; publish directory `dist/companion`. Only the app HTML, manifest and icons are staged for publication.
4. Keep GitHub Actions for CI. Do not enable GitHub Pages.

## Staging

Create/use branch `develop` and enable Netlify branch deploys. Netlify normally exposes it as:

`https://develop--<site-name>.netlify.app`

This is the P2.3 UAT origin. It must not replace the currently working production deployment. If there is any uncertainty about the current site linkage, use a separate Netlify site for staging and move the custom domain only after UAT.

## Production

`main` is the production branch, but do not move a real client there until the permanent custom domain has been chosen and attached. Preferred pattern:

`https://nutrition.rtrcoaching.co.uk`

Treat the hostname as durable product infrastructure. Changing it later creates a new browser origin and therefore a new localStorage silo.

## Netlify settings to verify

- Production branch: `main`.
- Branch deploys: `develop` enabled.
- Deploy previews: optional for pull requests; never use them with real client data.
- Build failure stops publish.
- HTTPS enforced.
- No environment secret is required for P2.3 static hosting.
