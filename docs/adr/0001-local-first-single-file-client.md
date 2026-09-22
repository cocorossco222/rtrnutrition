# 0001 — Local-first, single-file client

**Status:** Accepted (Pass 1; reaffirmed P2.3)

## Context
The Companion supports behaviour change through a coaching relationship. Its core — tracking, the Curiosity Engine, SITREP, Insights, Coach Review, readiness — must be explainable by the coach and must keep working with no network.

## Decision
The client is one self-contained HTML file: no framework, no build step, no runtime dependencies, browser storage behind a small store facade, all logic as transparent rules. No AI in the core.

## Consequences
- Works offline, loads instantly, and will still open years from now.
- Testing needs jsdom, which does no layout — real-device testing gates every pass (the P2.1 blank screen proved why).
- Hosting (ADR 0003) adds a manifest and icons beside the file. They are hosting assets, not runtime dependencies; the file still works on its own.
