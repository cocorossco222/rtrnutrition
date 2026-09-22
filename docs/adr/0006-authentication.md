# 0006 — Authentication and authorisation

**Status:** Accepted direction; UX implementation pending

Use managed authentication with UUID user identity. Production authorisation is enforced in Postgres RLS, not by a first name, client-supplied identifier, or hidden UI route. Clients access their own rows; coaches access only clients linked by an active coaching relationship. The Companion must remain fully useful while offline or temporarily signed out.
