# Supabase data-core scaffold

This directory is for stages G–J of the roadmap. It is **not** activated by P2.3 and contains no project URL, anon key, service-role key or production data.

`migrations/0001_data_core.sql` establishes:

- UUID profiles linked to Supabase Auth;
- safe default provisioning as `client` only;
- administratively controlled coach↔client relationships;
- immutable client events (`day.resolved`, `coach.update`);
- point-in-time snapshots;
- row-level security for client ownership and linked-coach read access;
- a minimal coach read model.

Before applying it to a production project, test the migration in a disposable Supabase environment and verify RLS as at least four cases: anonymous user, client A, client B, and the linked coach. A client must never read/write another client's rows; an unlinked coach must see nothing.
