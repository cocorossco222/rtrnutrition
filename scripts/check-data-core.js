#!/usr/bin/env node
"use strict";
const fs = require("fs");
const sql = fs.readFileSync("supabase/migrations/0001_data_core.sql", "utf8");
const required = [
  "client_events", "client_snapshots", "coach_client_relationships",
  "enable row level security", "auth.uid()", "security_invoker = true",
  "event_type in ('day.resolved', 'coach.update')",
  "p.role = 'client'::public.rtr_role",
  "handle_new_auth_user", "values (new.id, 'client'::public.rtr_role)",
  "revoke all", "grant select, insert"
];
const missing = required.filter(x => !sql.includes(x));
if(missing.length){ console.error("data-core scaffold missing: " + missing.join(", ")); process.exit(1); }
console.log("data-core scaffold present");
