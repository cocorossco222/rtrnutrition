# Data core

The repository includes a **scaffold**, not an activated production backend. It is designed for the G–J stages of the roadmap.

## Identity

- Authentication provider target: Supabase Auth.
- `auth.users.id` is the canonical user UUID.
- A client name is display data only; it never proves identity.
- New Auth users receive a `client` profile automatically. Coach roles and coach↔client relationships are provisioned administratively; user-controlled signup metadata cannot grant coach access.
- Devices receive their own locally generated UUID so retries and device provenance can be understood without using device fingerprints.

## Core tables

- `profiles` — UUID user profile and role.
- `coach_client_relationships` — explicit active coach↔client authorisation.
- `client_events` — immutable event stream. Initial event types are `day.resolved` and `coach.update`.
- `client_snapshots` — point-in-time Companion state for recovery/read purposes.

## RLS model

- Client: select/insert own events and snapshots.
- Coach: select records only for clients linked by an active relationship.
- Client cannot create a coaching relationship or impersonate another UUID.
- Coach does not receive blanket access to every client row merely by having the `coach` role.

The initial SQL is in `supabase/migrations/0001_data_core.sql`. It must be exercised with real Supabase RLS tests before production activation.

## Sync protocol

### Automatic resolved-day capture
1. The Companion reaches its existing local resolved-day state.
2. It creates one `day.resolved` event with a UUID and writes it to a durable local queue.
3. If authenticated and online, the queue attempts upload.
4. The database accepts the UUID once; retries are harmless. A duplicate insert is treated as success only after the client can read back its own event UUID.
5. The client receives acknowledgement and marks/removes the queue item.
6. If offline or unauthenticated, the local day remains resolved and retry happens later.

### Manual update
`Send to Coco` creates a separate `coach.update` event. The user initiates it deliberately and can include only the fields the UI makes explicit.

## Snapshot rhythm

Events answer “what changed?”. Snapshots answer “what does the current Companion state look like?” A snapshot can be taken after a resolved day or at a lower cadence once real usage shows the right balance. Do not upload on every field interaction.
