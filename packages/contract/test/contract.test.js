"use strict";
/* ==================================================================
   Contract tests. The fixture is generated from synthetic app demo data (see
   scripts/generate-fixture.js). Every rejection case below mutates
   that fixture in exactly one way, so a pass proves the specific rule
   is live rather than proving the fixture happens to be valid.
   ================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateSnapshot, validateSyncEvent, snapshotHash, canonical, SUPPORTED_SCHEMA } = require("..");
const FIXTURE = require("../fixtures/demo-three-weeks.json");

const clone = o => JSON.parse(JSON.stringify(o));
const firstKey = o => Object.keys(o)[0];

function rejects(label, mutate, expectRule){
  test("rejects: " + label, () => {
    const p = clone(FIXTURE);
    mutate(p);
    const r = validateSnapshot(p);
    assert.equal(r.ok, false, "expected rejection");
    if(expectRule) assert.ok(r.errors.some(e => e.rule === expectRule),
      "expected a '" + expectRule + "' error, got " + JSON.stringify(r.errors.map(e => e.rule)));
  });
}
function accepts(label, mutate){
  test("accepts: " + label, () => {
    const p = clone(FIXTURE);
    mutate(p);
    const r = validateSnapshot(p);
    assert.equal(r.ok, true, JSON.stringify(r.errors));
  });
}

/* ---------- the fixture itself ---------- */
test("the synthetic export validates", () => {
  const r = validateSnapshot(FIXTURE);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});
test("the fixture is labelled synthetic", () => {
  assert.equal(FIXTURE.meta.client, "Synthetic Fixture");
  assert.equal(FIXTURE.data.profile.name, "Synthetic Fixture");
});
test("the fixture exercises every record type", () => {
  assert.ok(Object.keys(FIXTURE.data.entries).length >= 14, "entries");
  assert.ok(Object.keys(FIXTURE.data.body).length >= 2, "body checks");
  assert.ok(Object.keys(FIXTURE.data.sitreps).length >= 1, "weekly check-ins");
  assert.ok(FIXTURE.data.baseline && Object.keys(FIXTURE.data.baseline.answers).length === 10, "baseline");
});

/* ---------- envelope ---------- */
test("rejects: a non-object", () => {
  for(const v of [null, 42, "x", [], true]){
    assert.equal(validateSnapshot(v).ok, false);
    assert.equal(validateSnapshot(v).reason, "not-object");
  }
});
rejects("missing meta",               p => { delete p.meta; },                 "required");
rejects("missing data",               p => { delete p.data; },                 "required");
rejects("the wrong product",          p => { p.meta.product = "Other App"; },  "const");
rejects("an older schema in meta",    p => { p.meta.schema = 1; },             "const");
rejects("a malformed export time",    p => { p.meta.exported = "yesterday"; }, "format");
rejects("a malformed app version",    p => { p.meta.app = "latest"; },         "pattern");
test("rejects: a newer schema, with a reason the client can act on", () => {
  const p = clone(FIXTURE); p.meta.schema = SUPPORTED_SCHEMA + 1;
  const r = validateSnapshot(p);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "newer-schema");
  assert.match(r.errors[0].message, /newer Companion/);
});

/* ---------- daily check-ins ---------- */
rejects("a check-in keyed by a non-date", p => { p.data.entries["not-a-date"] = { meals:"yes" }; }, "pattern");
rejects("an impossible date",             p => { p.data.entries["2026-13-40"] = { meals:"yes" }; }, "pattern");
rejects("a metric outside the scale",     p => { p.data.entries[firstKey(p.data.entries)].gut = "terrible"; }, "enum");
rejects("a check-in with no known metric",p => { p.data.entries["2026-09-01"] = { note:"only a note" }; }, "anyOf");
rejects("an unknown symptom",             p => { p.data.entries[firstKey(p.data.entries)].symptoms = ["Dizzy"]; }, "enum");
rejects("a repeated symptom",             p => { p.data.entries[firstKey(p.data.entries)].symptoms = ["Pain","Pain"]; }, "uniqueItems");
rejects("a note longer than the UI allows", p => { p.data.entries[firstKey(p.data.entries)].note = "x".repeat(401); }, "maxLength");
accepts("a note at exactly the UI limit",   p => { p.data.entries[firstKey(p.data.entries)].note = "x".repeat(400); });
accepts("a partial check-in, as the client itself accepts", p => { p.data.entries["2026-09-01"] = { water:"nailed" }; });
accepts("an additive field on a check-in", p => { p.data.entries[firstKey(p.data.entries)].futureField = true; });

/* ---------- body checks ---------- */
rejects("a body check with neither measurement", p => { p.data.body["2026-09-01"] = { weightUnit:"kg" }; }, "anyOf");
rejects("an implausible weight",      p => { p.data.body[firstKey(p.data.body)].weightKg = 900; }, "maximum");
rejects("an implausible waist",       p => { p.data.body[firstKey(p.data.body)].waistCm = 5; },   "minimum");
rejects("an unknown weight unit",     p => { p.data.body[firstKey(p.data.body)].weightUnit = "oz"; }, "enum");
accepts("weight only, waist null",    p => { p.data.body["2026-09-01"] = { weightKg:80, waistCm:null, weightUnit:"kg", waistUnit:"cm" }; });

/* ---------- weekly check-ins ---------- */
rejects("an unknown weekly focus",    p => { p.data.sitreps[firstKey(p.data.sitreps)].best = "sleep"; }, "enum");
rejects("an unknown weekly energy",   p => { p.data.sitreps[firstKey(p.data.sitreps)].energy = "great"; }, "enum");
rejects("weekly text over the UI limit", p => { p.data.sitreps[firstKey(p.data.sitreps)].bestText = "x".repeat(301); }, "maxLength");
accepts("an unanswered weekly question as the empty string", p => { p.data.sitreps[firstKey(p.data.sitreps)].improve = ""; });

/* ---------- baseline and logs ---------- */
rejects("a baseline answer out of range", p => { p.data.baseline.answers.q1 = 5; }, "maximum");
rejects("a baseline question id that isn't one", p => { p.data.baseline.answers.hack = 2; }, "pattern");
rejects("an insight log beyond the client's cap", p => {
  p.data.insightLog = Array.from({ length: 401 }, () => ({ d:"2026-09-01", text:"t", tone:"neutral" }));
}, "maxItems");
rejects("an unknown insight tone", p => { p.data.insightLog = [{ d:"2026-09-01", text:"t", tone:"alarming" }]; }, "enum");

/* ---------- privacy of error output ---------- */
test("error output never echoes the offending value", () => {
  const p = clone(FIXTURE);
  const k = firstKey(p.data.entries);
  p.data.entries[k].note = "SENSITIVE-" + "x".repeat(400);
  const r = validateSnapshot(p);
  assert.equal(r.ok, false);
  assert.ok(!JSON.stringify(r).includes("SENSITIVE"), "a note leaked into the error output");
});
test("error output is capped", () => {
  const p = clone(FIXTURE);
  Object.keys(p.data.entries).forEach(k => { p.data.entries[k].gut = "bad"; p.data.entries[k].energy = "bad"; });
  assert.ok(validateSnapshot(p).errors.length <= 20);
});

/* ---------- hashing ---------- */
/* Reverses key order at every depth without dropping anything. (A
   JSON.stringify key-array replacer looks similar but filters keys at
   every level, which silently loses data — an early draft of this test
   made exactly that mistake.) */
function reverseKeys(v){
  if(Array.isArray(v)) return v.map(reverseKeys);
  if(v && typeof v === "object"){
    const out = {};
    Object.keys(v).reverse().forEach(k => { out[k] = reverseKeys(v[k]); });
    return out;
  }
  return v;
}
test("the hash ignores key order", () => {
  assert.equal(canonical({ b:1, a:{ d:2, c:3 } }), canonical({ a:{ c:3, d:2 }, b:1 }));
  const reordered = { meta: FIXTURE.meta, data: reverseKeys(FIXTURE.data) };
  assert.deepEqual(reordered.data, FIXTURE.data, "the reorder must be lossless");
  assert.notEqual(JSON.stringify(reordered.data), JSON.stringify(FIXTURE.data), "and must actually reorder");
  assert.equal(snapshotHash(reordered), snapshotHash(FIXTURE));
});
test("the hash ignores the export time, which changes on every export", () => {
  const p = clone(FIXTURE); p.meta.exported = "2027-01-01T00:00:00.000Z";
  assert.equal(snapshotHash(p), snapshotHash(FIXTURE));
});
test("the hash changes when any data changes", () => {
  const p = clone(FIXTURE); p.data.entries[firstKey(p.data.entries)].water = "nailed";
  const q = clone(FIXTURE); q.data.entries[firstKey(q.data.entries)].water = "nearly";
  assert.notEqual(snapshotHash(p), snapshotHash(q));
});


/* ---------- future queued sync events ---------- */
test("accepts a resolved-day sync event with no client identity in the payload", () => {
  const e = {
    schema:1,
    eventId:"11111111-1111-4111-8111-111111111111",
    deviceId:"22222222-2222-4222-8222-222222222222",
    eventType:"day.resolved",
    occurredAt:"2026-09-22T09:00:00.000Z",
    dayKey:"2026-09-22",
    payload:{ version:"p2.3" }
  };
  assert.equal(validateSyncEvent(e).ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(e, "clientId"), false);
});

test("accepts a manual coach-update event", () => {
  const e = {
    schema:1,
    eventId:"33333333-3333-4333-8333-333333333333",
    deviceId:"22222222-2222-4222-8222-222222222222",
    eventType:"coach.update",
    occurredAt:"2026-09-22T09:05:00.000Z",
    dayKey:"2026-09-22",
    payload:{ priority:"normal" }
  };
  assert.equal(validateSyncEvent(e).ok, true);
});

test("rejects a client-supplied identity field on sync events", () => {
  const e = {
    schema:1,
    eventId:"44444444-4444-4444-8444-444444444444",
    deviceId:"22222222-2222-4222-8222-222222222222",
    eventType:"day.resolved",
    occurredAt:"2026-09-22T09:10:00.000Z",
    dayKey:"2026-09-22",
    payload:{},
    clientId:"55555555-5555-4555-8555-555555555555"
  };
  const r = validateSyncEvent(e);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(x => x.rule === "additionalProperties"));
});
