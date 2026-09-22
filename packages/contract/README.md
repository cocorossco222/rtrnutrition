# @rtr/contract

Contracts crossing the boundary between the local-first Companion and future platform services.

- `backup.v2.schema.json` describes the P2.3 export/restore envelope.
- `sync-event.v1.schema.json` describes queued future events: `day.resolved` and `coach.update`.
- `fixtures/demo-three-weeks.json` is deterministic synthetic data generated from the Companion's built-in demo path.

A breaking change gets a new schema file. Do not mutate an old version in a way that rejects data it previously accepted.
