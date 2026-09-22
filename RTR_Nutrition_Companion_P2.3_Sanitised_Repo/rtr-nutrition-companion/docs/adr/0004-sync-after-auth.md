# 0004 — Automatic sync only after authenticated data core

**Status:** Accepted

## Decision
P2.3 itself remains network-independent. The next sync implementation is not a manual bearer-token/file-store bridge. It is built after UUID identity, authentication and RLS are in place.

The first automatic event is `day.resolved`: local completion writes an idempotent queued event, authenticated sync uploads it, and an acknowledgement clears/marks the queue item. Offline failure never reverses local completion.

A separate user-initiated `coach.update` event supports **Send to Coco**.
