# Companion

`index.html` is the canonical P2.3 client: one self-contained HTML file with no runtime dependencies. The manifest and icons exist only for hosted Home Screen installation.

The public baseline is deliberately client-neutral: `const CLIENT = { name:"" };`. The existing onboarding flow captures a first name locally. Do **not** commit a real client name into the source to create a bespoke build. Authenticated UUID identity is the target in the data-core phase.

Run `npm test` from this directory or the repository root. The QA harness injects a clearly synthetic configured client so both the bespoke P2.3 path and the neutral public source stay covered.
