"use strict";
/* ==================================================================
   The client and the contract, checked against each other.


   The Companion cannot import @rtr/contract — it is one file with no
   build step. So this suite runs the real app in jsdom, drives it into
   each meaningful state, and validates what exportPayload() produces.
   If the client's data model changes without the schema following,
   this fails here, before a server ever sees the difference.
   ================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const { validateSnapshot, snapshotHash } = require("@rtr/contract");

const APP = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const FIXTURE = require("@rtr/contract/fixtures/demo-three-weeks.json");
const WED = new Date(2026, 8, 2, 10, 30, 0);
const SAT = new Date(2026, 8, 5, 10, 30, 0);

function fakeDate(ms){
  const Real = Date;
  function F(...a){ return a.length ? new Real(...a) : new Real(ms); }
  F.prototype = Real.prototype; F.now = () => ms; F.parse = Real.parse; F.UTC = Real.UTC;
  return F;
}
function boot(at){
  const dom = new JSDOM(APP, {
    runScripts: "dangerously", url: "https://contract.local/",
    virtualConsole: new VirtualConsole(),
    beforeParse(w){
      w.Date = fakeDate((at || WED).getTime());
      w.Math.random = () => 0.5;
      w.scrollTo = () => {};
      w.URL.createObjectURL = () => "blob:stub";
      w.HTMLAnchorElement.prototype.click = function(){};
    }
  });
  const w = dom.window, d = w.document;
  const click = sel => {
    const el = typeof sel === "string" ? d.querySelector(sel) : sel;
    assert.ok(el, "missing element: " + sel);
    el.dispatchEvent(new w.MouseEvent("click", { bubbles:true, cancelable:true }));
  };
  return { w, d, click, exp: () => w.eval("exportPayload")() };
}
function assertValid(payload, label){
  const r = validateSnapshot(payload);
  assert.equal(r.ok, true, label + " failed the contract: " + JSON.stringify(r.errors));
}
function startBaseline(t){
  t.click('[data-act="ob-start"]');

  const name = t.d.querySelector("#obname");
  if(name){
    name.value = "Synthetic Client";
    t.click('[data-act="ob-name"]');
  }
}

function onboard(t){
  startBaseline(t);
  for(let i = 0; i < 10; i++){
    t.click(t.d.querySelector('[data-act="ob-a"]'));
  }
  t.click('[data-act="ob-done"]');
}
function checkIn(t, vals){
  t.click('.tab[data-tab="track"]');
  const v = Object.assign({ meals:"yes", protein:"good", plants:"plenty",
                            water:"nailed", gut:"good", energy:"good" }, vals || {});
  Object.keys(v).forEach(m => t.click('[data-act="opt"][data-m="' + m + '"][data-v="' + v[m] + '"]'));
  t.click('[data-act="save"]');
}

/* ---------- every state the client can be exported from ---------- */
test("a brand-new, un-onboarded Companion exports a valid snapshot", () => {
  assertValid(boot().exp(), "fresh state");
});
test("a part-finished baseline exports a valid snapshot", () => {
  const t = boot();
  t.click('[data-act="ob-start"]');
  t.click(t.d.querySelector('[data-act="ob-a"]'));
  assertValid(t.exp(), "interrupted onboarding");
});
test("an onboarded Companion with no check-ins exports a valid snapshot", () => {
  const t = boot(); onboard(t);
  assertValid(t.exp(), "onboarded, empty");
});
test("a check-in made through the real UI exports a valid snapshot", () => {
  const t = boot(); onboard(t); checkIn(t);
  const p = t.exp();
  assertValid(p, "after a check-in");
  assert.equal(Object.keys(p.data.entries).length, 1);
});
test("a rough-gut check-in with symptoms and a note exports a valid snapshot", () => {
  const t = boot(); onboard(t);
  t.click('.tab[data-tab="track"]');
  ["meals:mostly","protein:some","plants:low","water:behind","gut:rough","energy:low"].forEach(s => {
    const [m, v] = s.split(":");
    t.click('[data-act="opt"][data-m="' + m + '"][data-v="' + v + '"]');
  });
  const chip = t.d.querySelector('[data-act="sym"]');
  if(chip) t.click(chip);
  const note = t.d.querySelector("#dnote");
  if(note) note.value = "Synthetic check-in note.";
  t.click('[data-act="save"]');
  assertValid(t.exp(), "rough day with detail");
});
test("the demo's three weeks export a valid snapshot", () => {
  const t = boot(); t.w.eval("loadDemo")();
  assertValid(t.exp(), "demo data");
});
test("body checks in both unit systems export a valid snapshot", () => {
  const t = boot(); t.w.eval("loadDemo")();
  const toKg = t.w.eval("toKg"), toCm = t.w.eval("toCm"), saveBody = t.w.eval("saveBody");
  saveBody("2026-08-23", { weightKg: toKg("kg", 80), waistCm: toCm("cm", 90), weightUnit:"kg", waistUnit:"cm" });
  saveBody("2026-08-30", { weightKg: toKg("st", 12, 8), waistCm: null, weightUnit:"st", waistUnit:"in" });
  assertValid(t.exp(), "body checks");
});
test("a weekly check-in saved through the real UI exports a valid snapshot", () => {
  const t = boot(SAT); t.w.eval("loadDemo")();
  t.w.eval("sitrepSheet")();
  ["best","hardest","gut","energy","improve"].forEach(f =>
    t.click(t.d.querySelector('[data-act="sit"][data-f="' + f + '"]')));
  t.click('[data-act="sit-save"]');
  assertValid(t.exp(), "after a weekly check-in");
});
test("a deferred weekly check-in exports a valid snapshot", () => {
  const t = boot(SAT); t.w.eval("loadDemo")();
  t.w.eval("sitrepSheet")();
  t.click('[data-act="sit-later"]');
  assertValid(t.exp(), "deferral");
});

/* ---------- round trip ---------- */
test("the contract fixture restores through the client's own import", () => {
  const t = boot();
  const r = t.w.eval("validateBackup")(JSON.stringify(FIXTURE));
  assert.equal(r.ok, true, r.error);
  assert.equal(r.summary.checkIns, FIXTURE.meta.counts.checkIns);
  assert.equal(r.summary.bodyChecks, FIXTURE.meta.counts.bodyChecks);
  assert.equal(r.discarded, 0, "the client discarded records the contract accepted");
});
test("the committed fixture is explicitly synthetic and contract-valid", () => {
  assert.equal(FIXTURE.meta.client, "Synthetic Fixture");
  assert.equal(FIXTURE.data.profile.name, "Synthetic Fixture");
  assertValid(FIXTURE, "synthetic fixture");
});

/* ---------- a deliberate asymmetry ---------- */
test("the server is stricter than the client's import, on purpose", () => {
  /* The client's import quietly drops an unreadable check-in and keeps
     the rest — right for a person restoring their own file. A server
     receiving a live snapshot should refuse it instead, because a bad
     value arriving from the client means a bug worth surfacing. */
  const bad = JSON.parse(JSON.stringify(FIXTURE));
  const k = Object.keys(bad.data.entries)[0];
  bad.data.entries[k] = { gut: "terrible" };
  const t = boot();
  const client = t.w.eval("validateBackup")(JSON.stringify(bad));
  assert.equal(client.ok, true, "client import should tolerate and discard");
  assert.equal(client.discarded, 1);
  assert.equal(validateSnapshot(bad).ok, false, "the contract should refuse");
});
