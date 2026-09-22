# Data protection notes

The Companion can contain nutrition, symptom and coaching information that may be personal data and may include special-category health data. This repository contains no real client record.

Before any backend stores real client data, complete and record: lawful basis and, where relevant, Article 9 condition; privacy notice; processor/DPA review; hosting region; retention/deletion procedure; access/correction/erasure procedure; breach process; role/access review; and whether a DPIA is required.

Technical direction: authenticated UUID identity, RLS authorisation, least-privilege coach access, no client data in logs, no secrets in the repository, and explicit production-origin control.
