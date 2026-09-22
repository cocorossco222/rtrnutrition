# 0002 — Hash-based routing

**Status:** Accepted (P2.2b)

## Context
The Android back gesture was closing the app. `history.pushState` was throwing a SecurityError when the app was opened from a `content://` URI; a `try/catch` swallowed it, so the history entry was never created. The catch hid the bug.

## Decision
Routing uses `location.hash`: the tab, plus `!panel` while a sheet is open. Hash changes are same-document navigations and work on any origin.

## Consequences
- Back closes a sheet, then walks back through tabs, and only leaves the app from the first screen.
- Works identically from a file, a `content://` URI and a hosted URL.
- Lesson recorded: a `catch` that does nothing can turn a loud failure into a silent one.
