"use strict";
/* ==================================================================
   @rtr/contract
   The one definition of what crosses the boundary between the local-
   first Companion and anything else. The client never imports this —
   it is a single file with no build step — but its test suite proves
   that what the client exports validates here, and the server refuses
   anything that does not. Drift therefore fails CI on both sides.
   ================================================================== */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const SUPPORTED_SCHEMA = 2;
const SCHEMA_PATH = path.join(__dirname, "schema", "backup.v2.schema.json");
const EVENT_SCHEMA_PATH = path.join(__dirname, "schema", "sync-event.v1.schema.json");
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const eventSchema = JSON.parse(fs.readFileSync(EVENT_SCHEMA_PATH, "utf8"));

/* strict:true catches misspelt keywords in the schema itself, which is
   the failure that would otherwise pass silently. strictTypes and
   strictRequired are relaxed only because the entry and body rules use
   the idiomatic type-free `anyOf: [{ required: [...] }]` pattern. */
const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, strictRequired: false });
addFormats(ajv);
const compiled = ajv.compile(schema);
const compiledEvent = ajv.compile(eventSchema);

const MAX_ERRORS = 20;

/* Errors carry the path and the rule, never the offending value. The
   payload is health data; an error message is not the place for it. */
function summarise(errors){
  return (errors || []).slice(0, MAX_ERRORS).map(e => ({
    path: e.instancePath || "/",
    rule: e.keyword,
    message: e.message
  }));
}

/**
 * Validate a parsed snapshot against the current contract.
 * @param {unknown} payload
 * @returns {{ok:true, errors:[]} | {ok:false, reason:"not-object"|"newer-schema"|"invalid", errors:Array}}
 */
function validateSnapshot(payload){
  if(!payload || typeof payload !== "object" || Array.isArray(payload)){
    return { ok:false, reason:"not-object",
             errors:[{ path:"/", rule:"type", message:"must be a JSON object" }] };
  }
  const s = payload.meta && payload.meta.schema;
  if(typeof s === "number" && s > SUPPORTED_SCHEMA){
    return { ok:false, reason:"newer-schema",
             errors:[{ path:"/meta/schema", rule:"maximum",
                       message:"written by a newer Companion (schema " + s + "); this service reads schema " + SUPPORTED_SCHEMA }] };
  }
  return compiled(payload)
    ? { ok:true, errors:[] }
    : { ok:false, reason:"invalid", errors: summarise(compiled.errors) };
}

/** Validate a queued client sync event. Identity is deliberately absent:
 * the server derives client identity from authenticated context. */
function validateSyncEvent(payload){
  if(!payload || typeof payload !== "object" || Array.isArray(payload)){
    return { ok:false, reason:"not-object",
             errors:[{ path:"/", rule:"type", message:"must be a JSON object" }] };
  }
  return compiledEvent(payload)
    ? { ok:true, errors:[] }
    : { ok:false, reason:"invalid", errors:summarise(compiledEvent.errors) };
}

/* Canonical JSON: keys sorted at every level, so two exports of the
   same data hash identically regardless of key order. */
function canonical(value){
  if(Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if(value && typeof value === "object"){
    return "{" + Object.keys(value).sort()
      .map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

/* Hashes the data only. meta.exported changes on every export even when
   nothing else has, so including it would defeat deduplication. */
function snapshotHash(payload){
  return crypto.createHash("sha256").update(canonical(payload.data)).digest("hex");
}

module.exports = { SUPPORTED_SCHEMA, SCHEMA_PATH, EVENT_SCHEMA_PATH, schema, eventSchema, validateSnapshot, validateSyncEvent, snapshotHash, canonical };
