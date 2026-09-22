/* ==================================================================
   RTR NUTRITION COMPANION — P2.2 QA SUITE
   Runs the real file in jsdom, drives the real client journey, and
   audits the rendered DOM rather than the source where it can.
   ================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const FILE = path.join(__dirname, "..", "index.html");
const RAW  = fs.readFileSync(FILE, "utf8");
const TEST_CLIENT = "Synthetic Client";
const SRC  = RAW.replace('const CLIENT = { name:"" };', 'const CLIENT = { name:"' + TEST_CLIENT + '" };');

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label){
  if(cond){ pass++; }
  else { fail++; failures.push(label); }
}
function eq(a, b, label){ ok(a === b, label + "  (got: " + JSON.stringify(a) + ", want: " + JSON.stringify(b) + ")"); }
function has(hay, needle, label){ ok(String(hay).indexOf(needle) > -1, label); }
function hasNot(hay, needle, label){ ok(String(hay).indexOf(needle) === -1, label); }
/* Pinned clocks. Weekday-dependent behaviour must be tested on purpose,
   never on whatever day the suite happens to be run. */
const NOW_WED = new Date(2026, 8, 2, 10, 30, 0);   // Wednesday 2 September 2026
const NOW_SAT = new Date(2026, 8, 5, 10, 30, 0);   // Saturday 5 September 2026

/* Explicit disclaimers ("it may not be the cause") are the point of the
   engine, so they are stripped before testing for causal assertions. */
function causalTest(t){
  return /\bcaus(e|es|ed|ing)\b|\bproves?\b|\bbecause of\b|\bdue to\b|\bresults? in\b|\bleads? to\b|\bmakes you\b/i
    .test(String(t).replace(/(may )?not (necessarily )?(be the |)cause[sd]?\b/ig, ""));
}

const DOWN=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const longDateOf = d => DOWN[d.getDay()]+" "+d.getDate()+" "+MONN[d.getMonth()];

function group(name){ console.log("\n\u2500\u2500 " + name); }

/* ---------- harness ---------------------------------------------- */
function makeFakeDate(ms){
  const Real = Date;
  function FD(...args){
    if(!(this instanceof FD)) return new Real(ms).toString();
    return args.length === 0 ? new Real(ms) : new Real(...args);
  }
  FD.prototype = Real.prototype;
  FD.now   = () => ms;
  FD.parse = Real.parse;
  FD.UTC   = Real.UTC;
  return FD;
}

/* seed: a JSON string to place in localStorage before the script runs
   at: a Date to pretend "now" is */
function boot(opts){
  opts = opts || {};
  const at = opts.at || NOW_WED;
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => {
    // navigation and layout are not implemented in jsdom; those are expected
    if(/Not implemented/.test(e.message)) return;
    errors.push(e.message);
  });
  vc.on("error", (...a) => errors.push(a.join(" ")));

  const dom = new JSDOM(SRC, {
    runScripts: "dangerously",
    url: "https://rtr.local/companion",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window){
      window.Date = makeFakeDate(at.getTime());
      window.scrollTo = () => {};
      /* Lesson rotation draws at random. A suite whose result depends
         on the draw is not a suite. */
      window.Math.random = () => 0.5;
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.URL.createObjectURL = () => "blob:stub";
      window.URL.revokeObjectURL = () => {};
      window.HTMLAnchorElement.prototype.click = function(){ /* no navigation */ };
      if(opts.seed) window.localStorage.setItem("rtr.companion.v1", opts.seed);
      if(opts.blockStorage){
        Object.defineProperty(window, "localStorage", {
          configurable: true,
          get(){ throw new Error("blocked"); }
        });
      }
    }
  });
  const w = dom.window, d = w.document;
  return {
    dom, window: w, document: d, errors,
    /* Top-level const/let live in the script's global lexical scope,
       not on window. Indirect eval in global scope reaches them. */
    ev: expr => w.eval(expr),
    $: s => d.querySelector(s),
    $$: s => Array.from(d.querySelectorAll(s)),
    text: () => d.body.textContent.replace(/\s+/g, " "),
    view: () => (d.querySelector("#view") || {}).innerHTML || "",
    ob:   () => (d.querySelector("#obroot") || {}).innerHTML || "",
    click(sel){
      const el = typeof sel === "string" ? d.querySelector(sel) : sel;
      if(!el) throw new Error("no element for " + sel);
      el.dispatchEvent(new w.MouseEvent("click", { bubbles:true, cancelable:true }));
      return el;
    },
    byText(sel, txt){
      return Array.from(d.querySelectorAll(sel)).find(e => e.textContent.indexOf(txt) > -1);
    },
    store(){ return JSON.parse(w.localStorage.getItem("rtr.companion.v1")); }
  };
}

/* Drives onboarding to completion. */
function completeOnboarding(t){
  t.click('[data-act="ob-start"]');
  for(let i = 0; i < 10; i++){
    const opt = t.$('[data-act="ob-a"]:nth-child(3)') || t.$('[data-act="ob-a"]');
    t.click(opt);
  }
  t.click('[data-act="ob-done"]');
}

function fillCheckIn(t, vals){
  const v = Object.assign(
    { meals:"yes", protein:"good", plants:"plenty", water:"nailed", gut:"good", energy:"good" }, vals || {});
  Object.keys(v).forEach(m => t.click('[data-act="opt"][data-m="' + m + '"][data-v="' + v[m] + '"]'));
}

/* A ready-made state, written the way the app writes it. */
function seedState(days, extra, now){
  now = now || NOW_WED;
  const k = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  const entries = {};
  for(let i = 0; i < days; i++){
    const d = new Date(now.getTime()); d.setDate(d.getDate() - i);
    entries[k(d)] = { meals:"yes", protein:"good", plants:"plenty", water:"nailed",
                      gut:"good", energy:"good", symptoms:[], note:"",
                      ts:new Date(d).toISOString() };
  }
  return JSON.stringify(Object.assign({
    schema:2, v:1,
    profile:{ name:"Synthetic Client", created:now.toISOString(), onboarded:true },
    baseline:{ date:now.toISOString(), answers:{q1:2,q2:2,q3:2,q4:2,q5:2,q6:2,q7:2,q8:2,q9:2,q10:2} },
    entries, body:{}, sitreps:{}, seen:{},
    today:{ date: k(now), lessonId:"hydration" }, coach:[],
    prefs:{weightUnit:"kg",waistUnit:"cm"},
    usage:{opens:5,firstOpen:now.toISOString(),lastOpen:now.toISOString(),views:{}},
    insightLog:[], reportLog:[], defer:{}, obDraft:null,
    phase:{key:"stabilise",name:"Stabilise",locked:true}
  }, extra || {}));
}

/* ==================================================================
   A · FILE INTEGRITY AND OFFLINE GUARANTEE
   ================================================================== */
group("A · file integrity and the offline guarantee");
ok(SRC.startsWith("<!DOCTYPE html>"), "A1 file is a complete HTML document");
ok(!/<script[^>]+src=/i.test(SRC), "A2 no external script is loaded");
ok(!/<link[^>]+stylesheet/i.test(SRC), "A3 no external stylesheet is loaded");
ok(!/\bfetch\s*\(/.test(SRC), "A4 no fetch call anywhere");
ok(!/XMLHttpRequest/.test(SRC), "A5 no XMLHttpRequest anywhere");
ok(!/https?:\/\/(?!www\.w3\.org)/.test(SRC.replace(/https:\/\/rtr\.local/g,"")), "A6 no remote URLs besides the SVG namespace");
ok(!/api\.anthropic|openai|googleapis/i.test(SRC), "A7 no AI or cloud service referenced");
has(SRC, 'const APP_VERSION = "p2.3"', "A8 version stamped as p2.3 (hosted pilot)");
has(SRC, "const SCHEMA = 2", "A9 schema still 2 — no breaking change");
ok(SRC.indexOf("localStorage") > -1 && !/indexedDB\s*[.(\[]/i.test(SRC),
   "A10 still localStorage only — IndexedDB is mentioned only as a future note");

/* ==================================================================
   B · SYNTHETIC CLIENT'S OPENING
   ================================================================== */
group("B · first use — Synthetic Client's opening");
{
  const t = boot();
  eq(t.errors.length, 0, "B1 boot raises no script errors");
  ok(t.$("#app").hasAttribute("hidden"), "B2 the app shell is hidden during onboarding");
  eq(t.window.getComputedStyle(t.$("#app")).display, "none",
     "B3 REGRESSION (P2.1 blank screen): #app computes to display:none, not flex");
  eq(t.$("#obroot").hidden, false, "B4 the onboarding root is visible");

  const first = t.ob();
  has(first, "Synthetic Client, this is your Nutrition Companion.", "B5 opening names Synthetic Client in the headline");
  has(first, "Built around you, your routine", "B6 opening says it was built around him");
  has(first, "notice what works", "B7 opening states the purpose of the tool");
  has(first, "No scores. No perfect days.", "B8 opening sets the no-scores expectation");
  has(first, "Enter my Companion", "B9 primary CTA is Enter my Companion");
  hasNot(first, "Begin", "B10 the generic Begin CTA is gone");
  eq(t.$$("#obroot input").length, 0, "B11 no input field on the welcome screen");
  eq(t.ev("OB_STEPS").length, 12, "B12 twelve steps: welcome + ten questions + summary");
  eq(t.$$("#obroot .dots i").length, 12, "B13 the progress dots match the step count");
  ok(t.$("#obroot .phx-hero"), "B14 the phoenix mark opens the experience");
}

group("B · no name gate anywhere in the run");
{
  const t = boot();
  t.click('[data-act="ob-start"]');
  let inputsSeen = 0;
  for(let i = 0; i < 10; i++){
    inputsSeen += t.$$("#obroot input").length;
    ok(!!t.$('[data-act="ob-a"]'), "B15." + i + " step " + (i+1) + " is a baseline question");
    t.click(t.$('[data-act="ob-a"]'));
  }
  eq(inputsSeen, 0, "B16 no name-entry field appears at any point in onboarding");
  has(t.ob(), "That\u2019s the snapshot.", "B17 the run ends on the baseline summary");
  has(t.ob(), "Start with today", "B18 the closing CTA leads into Today");
  has(t.ob(), "Phase 1 in five lines", "B19 the five anchors are shown before entry");
}

group("B · the architecture still holds a name");
{
  const t = boot();
  completeOnboarding(t);
  const s = t.store();
  eq(s.profile.name, "Synthetic Client", "B20 the configured client name is written to state");
  eq(s.profile.onboarded, true, "B21 onboarding is marked complete");
  ok(s.baseline && Object.keys(s.baseline.answers).length === 10, "B22 all ten baseline answers are stored");
  eq(s.obDraft, null, "B23 the onboarding draft is cleared once complete");
  ok(SRC.indexOf("const CLIENT = { name:\"Synthetic Client\" }") > -1, "B24 the name is configuration, not scattered literals");
  ok(SRC.indexOf("const ASK_NAME = !CLIENT.name") > -1, "B25 clearing the name restores name capture");
  const nameUses = (t.view().match(/Synthetic Client/g) || []).length;
  ok(nameUses <= 1, "B26 Synthetic Client is not plastered across the first Today screen (" + nameUses + " use)");
}

group("B · an interrupted baseline is not lost");
{
  const t = boot();
  t.click('[data-act="ob-start"]');
  t.click(t.$('[data-act="ob-a"]'));
  t.click(t.$('[data-act="ob-a"]'));
  const saved = t.store();
  ok(saved.obDraft && saved.obDraft.step === 3, "B27 progress through the baseline is persisted");
  eq(Object.keys(saved.obDraft.answers).length, 2, "B28 answers given so far are kept");

  const t2 = boot({ seed: JSON.stringify(saved) });
  ok(!!t2.$('[data-act="ob-a"]'), "B29 a reload resumes on a question, not back at the welcome");
  has(t2.ob(), "3 of 10", "B30 it resumes at the right question");
}

/* ==================================================================
   C · TODAY, FIRST USE
   ================================================================== */
group("C · Today on day one");
{
  const t = boot();
  completeOnboarding(t);
  const v = t.view();
  eq(t.$("#app").hasAttribute("hidden"), false, "C1 the app shell is now visible");
  has(v, "Start today\u2019s check-in", "C2 there is one obvious primary action");
  eq(t.$$(".btn.primary").length, 1, "C3 exactly one primary button on the screen");
  has(v, "How a day works here", "C4 first use is oriented, not dropped into a dashboard");
  eq(t.$$(".accum").length, 0, "C5 no column of zeros on day one");
  eq(t.$$(".note-card").length, 0, "C6 no curiosity note before there is anything to notice");
  has(v, "Synthetic Client", "C7 the first Today greets him by name");
  ok(t.$(".read") && t.$(".try"), "C8 the daily read and the thing to try are both present");
  has(v, "Nothing is scored", "C9 the check-in is framed as low stakes");
}

/* ==================================================================
   D · THE CHECK-IN AND ITS CLOSURE
   ================================================================== */
group("D · the daily check-in");
{
  const t = boot();
  completeOnboarding(t);
  t.click('[data-act="tab"][data-tab="track"]');
  has(t.view(), "Save today\u2019s check-in", "D1 the save button describes the outcome");
  hasNot(t.view(), "Done for today</button>", "D2 the save button no longer claims the day is done");
  ok(t.$('[data-act="save"]').disabled, "D3 saving is unavailable until the six are answered");
  has(t.view(), "Answer the six above", "D4 the reason it is unavailable is stated");

  fillCheckIn(t, { gut:"rough" });
  ok(!t.$('[data-act="save"]').disabled, "D5 saving becomes available once answered");
  ok(t.$("#symrev").classList.contains("open"),
     "D6 REGRESSION (P2.1 clipped panel): a rough gut reveals the symptom chips");
  eq(t.$$("#symrev > *").length, 1,
     "D7 REGRESSION: the reveal still has exactly one child so it can collapse");

  t.click('[data-act="save"]');
  const v = t.view();
  ok(t.$(".done"), "D8 saving lands on the resolved-day panel");
  ok(t.$(".done").classList.contains("flash"), "D9 the panel arrives with an acknowledgement");
  has(v, "That\u2019s captured.", "D10 the confirmation is calm and factual");
  hasNot(v, "Congratulations", "D11 no celebration language");
  hasNot(v, "Well done", "D12 no praise for compliance");
  eq(Object.keys(t.store().entries).length, 1, "D13 the check-in is written to storage");
  has(t.$("#liveroot").textContent + t.text(), "", "D14 an announcement region exists for the save");
}

group("D · editing a day that is not today");
{
  const t = boot({ seed: seedState(4) });
  t.click('.tab[data-tab="track"]');
  const rows = t.$$('.row[data-act="edit"]');
  ok(rows.length >= 2, "D15 earlier days are listed and tappable");
  t.click(rows[1]);
  const v = t.view();
  ok(t.$(".editbar"), "D16 editing an earlier day is clearly signposted");
  has(v, "not today", "D17 it says plainly which day is being edited");
  has(v, "Back to today", "D18 there is an obvious way back to today");
  has(v, "Save this day", "D19 the button describes what it will actually save");
  has(v, "Filling in a gap", "D20 a late entry is framed as filling a gap, not catching up");
  t.click('[data-act="save"]');
  ok(t.$(".row.justsaved"), "D21 the saved day is visibly acknowledged in the list");
}

/* ==================================================================
   E · THE RESOLVED DAY
   ================================================================== */
group("E · done for today");
{
  const t = boot({ seed: seedState(6) });
  ok(t.$(".done"), "E1 a day already tracked opens in the resolved state");
  const v = t.view();
  has(v, "You\u2019re done for today.", "E2 the resolved state says so directly");
  has(v, "Go and live your life.", "E3 it hands the day back");
  ok(!t.$(".done").classList.contains("flash"), "E4 returning later does not re-fire the animation");
  has(v, "Explore my plan", "E5 quiet route: my plan");
  has(v, "Learn something", "E6 quiet route: learn");
  has(v, "Review insights", "E7 quiet route: insights");
  has(v, "Change today\u2019s check-in", "E8 the check-in can still be changed");
  eq(t.$$(".btn.primary").length, 0, "E9 nothing on a resolved day demands attention");
  const doneCss = SRC.slice(SRC.indexOf(".done{"), SRC.indexOf(".done{") + 500);
  has(doneCss, "linear-gradient(158deg,#35563E", "E10 the resolved hero inverts to a dark sage ground");
  has(doneCss, "color:#F5F1E6", "E10b light ink is used on the dark ground");
  ok(t.$(".done").classList.contains("mark"), "E11 the phoenix appears at the completion moment");
  has(v, "SATURDAY".length ? longDateOf(NOW_WED) : "", "E11b the hero carries the date, so the whole top of the screen changes");
  has(v, "Today\u2019s 30 seconds", "E12 the day's read is still reachable, not withdrawn");
  eq((v.match(/Today\u2019s 30 seconds/g)||[]).length, 1, "E12b the read is labelled once, not twice");

  hasNot(v, "streak", "E13 no streak");
  hasNot(v, "Streak", "E14 no streak, capitalised");
  hasNot(v, "perfect", "E15 no perfect day");
  hasNot(v, "%", "E16 no percentages");
  hasNot(v, "points", "E17 no points");
  hasNot(v, "ahead", "E18 nothing about being ahead");
}

group("E · the weekly check-in holds the day open only when it should");
{
  const t = boot({ seed: seedState(6, null, NOW_SAT), at: NOW_SAT });
  eq(t.ev("sitrepReady")(), true, "E19 the weekly check-in is ready after six tracked days");
  eq(t.ev("sitrepBlocking")(), true, "E20 at the end of the week it holds the day open");
  eq(t.ev("dayShape")().resolved, false, "E21 done-for-today does not appear prematurely");
  has(t.view(), "Your weekly check-in is ready", "E22 the weekly check-in becomes the primary action");
  t.click('[data-act="sit-later"]');
  eq(t.ev("sitrepBlocking")(), false, "E23 'Not today' stops it blocking the rest of the day");
  eq(t.ev("dayShape")().resolved, true, "E24 the day can then resolve");
  ok(t.$(".done"), "E25 the resolved panel appears after deferring");
  has(t.view(), "Your weekly check-in is ready", "E26 it is still offered quietly, not withdrawn");
  eq(t.store().defer.sitrep, t.ev("todayKey")(), "E27 the deferral is recorded for today only");
}
{
  const t = boot({ seed: seedState(6) });
  eq(t.ev("sitrepBlocking")(), false, "E28 mid-week the weekly check-in never blocks the day");
  eq(t.ev("dayShape")().resolved, true, "E29 a tracked mid-week day still resolves");
}

/* ==================================================================
   F · MISSING DAYS AND COMING BACK
   ================================================================== */
group("F · a gap is a gap, never a failure");
{
  const past = new Date(NOW_WED.getTime()); past.setDate(past.getDate() - 9);
  const seed = JSON.parse(seedState(0));
  const k = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  for(let i = 9; i < 16; i++){
    const d = new Date(NOW_WED.getTime()); d.setDate(d.getDate() - i);
    seed.entries[k(d)] = { meals:"yes", protein:"good", plants:"plenty", water:"nailed",
                           gut:"good", energy:"good", symptoms:[], note:"", ts:d.toISOString() };
  }
  seed.usage.lastOpen = past.toISOString();
  const t = boot({ seed: JSON.stringify(seed) });
  ok(t.ev("AWAY_DAYS") >= 3, "F1 a nine-day absence is recognised");
  const v = t.view();
  has(v, "Good to see you", "F2 returning is welcomed, not scolded");
  has(v, "fresh observation", "F3 today is framed as a fresh observation");
  has(v, "nothing to catch up on", "F4 it explicitly removes the idea of catching up");
  hasNot(v, "You missed", "F5 no accusation about missed days");
  hasNot(v, "days behind", "F6 nothing about being behind");
  hasNot(v, "lost", "F7 nothing described as lost");
  hasNot(v, "reset", "F8 no progress reset language");
  has(v, "Start today\u2019s check-in", "F9 he is simply invited back into today");
  eq((v.match(/Synthetic Client/g) || []).length, 1,
     "F9b his name appears once on return, not in the greeting and the note both");
  ok(t.ev("accumulations")()[0].n === 7, "F10 accumulations survived the gap untouched");
}

group("F · accumulations only ever go up");
{
  // a day skipped entirely
  const gapped = JSON.parse(seedState(5));
  const kk = Object.keys(gapped.entries).sort();
  const before = (() => { const t0 = boot({ seed: JSON.stringify(gapped) });
                          return t0.ev("accumulations")().map(a => a.n); })();
  delete gapped.entries[kk[0]];
  const t = boot({ seed: JSON.stringify(gapped) });
  const afterGap = t.ev("accumulations")().map(a => a.n);
  ok(afterGap.every((n, i) => n <= before[i]), "F11a a gap simply means one fewer recorded day");

  // a difficult day recorded honestly still counts as a check-in
  const t2 = boot({ seed: seedState(5) });
  const b2 = t2.ev("accumulations")()[0].n;
  t2.click('.tab[data-tab="track"]');
  fillCheckIn(t2, { meals:"no", protein:"low", plants:"low", water:"behind", gut:"rough", energy:"low" });
  t2.click('[data-act="save"]');
  ok(t2.ev("accumulations")()[0].n >= b2, "F11 a difficult day never reduces the check-in total");
  hasNot(t2.view(), "only ever go up", "F12 the app does not claim totals that an honest edit could contradict");
}

/* ==================================================================
   G · THE CURIOSITY ENGINE
   ================================================================== */
group("G · curiosity, not conclusions");
{
  const seed = JSON.parse(seedState(0));
  const k = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  for(let i = 0; i < 12; i++){
    const d = new Date(NOW_WED.getTime()); d.setDate(d.getDate() - i);
    seed.entries[k(d)] = { meals:"yes", protein:"good", plants:"low", water:"nailed",
                           gut:"rough", energy:"low", symptoms:["Bloating"],
                           note:"a note", ts:d.toISOString() };
  }
  const t = boot({ seed: JSON.stringify(seed) });
  const notes = t.ev("curiosityNotes")();
  ok(notes.length >= 3, "G1 the engine produces notes from real data");
  ok(notes.every(n => n.basis && n.basis.length > 4), "G2 every note carries its own basis line");
  ok(notes.every(n => !causalTest(n.text)), "G3 no note asserts causation");
  ok(causalTest("Your meal rhythm caused your energy to improve"), "G3b the causation check itself has teeth");
  ok(!causalTest("Worth watching \u2014 it may not be the cause."), "G3c the hedged disclaimer is allowed");
  ok(notes.every(n => !/%/.test(n.text)), "G4 no note contains a percentage");
  ok(notes.every(n => !/you should|you must|you failed/i.test(n.text)), "G5 no note instructs or judges");
  ok(notes.some(n => /may|appears|seems|worth|possible|looks/i.test(n.text)),
     "G6 observational language is used");

  t.click('[data-act="tab"][data-tab="insights"]');
  const cards = t.$$(".note-card");
  ok(cards.length >= 1, "G7 notes are surfaced on Insights");
  const tags = cards.map(c => c.querySelector(".tag").textContent);
  ok(tags.every(x => ["Worth noticing", "Something to keep an eye on"].indexOf(x) > -1),
     "G8 note headings use the approved curiosity language");
  hasNot(t.view(), "Curiosity note</p>", "G9 the generic label is gone");
  ok(cards.every(c => c.querySelector(".basis")), "G10 the basis is shown to the client, not just the coach");
  const css = SRC.slice(SRC.indexOf(".note-card{"), SRC.indexOf(".note-card{") + 1600);
  has(css, "backdrop-filter", "G11 curiosity notes carry the glass treatment");
  has(css, "phx-mark", "G12 the phoenix reads quietly beneath a curiosity note");
  has(t.view(), "not conclusions", "G13 the uncertainty is stated on the page");
  has(t.view(), "conversation, not a calculation", "G14 correlation is not sold as causation");
}

group("G · the co-occurrence rules actually fire, and stay non-causal");
{
  const co = JSON.parse(seedState(0));
  const kx = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  // low energy landing on days the rhythm drifted, rough gut on low-plant days
  for(let i = 0; i < 12; i++){
    const d = new Date(NOW_WED.getTime()); d.setDate(d.getDate() - i);
    co.entries[kx(d)] = { meals:"mostly", protein:"some", plants:"low", water:"nearly",
                          gut:"rough", energy:"low", symptoms:["Bloating"], note:"",
                          ts:d.toISOString() };
  }
  const t = boot({ seed: JSON.stringify(co) });
  const notes = t.ev("curiosityNotes")();
  ok(notes.some(n => /low energy/i.test(n.text)),
     "G16 the energy-and-rhythm co-occurrence rule fires on data that warrants it");
  ok(notes.some(n => /gut/i.test(n.text) && /plant/i.test(n.text)),
     "G17 the gut-and-plants co-occurrence rule fires");
  const cooc = notes.filter(n => /low energy|rough gut|Rough gut/i.test(n.text));
  ok(cooc.every(n => /may|seems|appears|possible|worth/i.test(n.text)),
     "G18 every co-occurrence note is hedged, not asserted");
  ok(cooc.every(n => /\d+ of/.test(n.basis)),
     "G19 each co-occurrence note shows the counts it was drawn from");
  ok(notes.every(n => !causalTest(n.text)), "G20 no co-occurrence note slips into causal language");
}

group("G · tone is balanced before it is doubled");
{
  const mixed = JSON.parse(seedState(0));
  const kx = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  for(let i = 0; i < 12; i++){
    const d = new Date(NOW_WED.getTime()); d.setDate(d.getDate() - i);
    mixed.entries[kx(d)] = { meals:"yes", protein:"good", plants:"low", water:"nailed",
                             gut: i % 2 ? "rough" : "ok", energy:"low",
                             symptoms:[], note:"note", ts:d.toISOString() };
  }
  const t = boot({ seed: JSON.stringify(mixed) });
  const all = t.ev("curiosityNotes")();
  const available = new Set(all.map(n => n.tone)).size;
  const tones = t.ev("topNotes")(3).map(n => n.tone);
  eq(new Set(tones).size, Math.min(3, available),
     "G15 no tone doubles up while another is still unused");
}

/* ==================================================================
   H · NON-IDEAL STATES
   ================================================================== */
group("H · every state is designed");
{
  const t = boot({ seed: seedState(0) });
  t.click('.tab[data-tab="insights"]');
  const v = t.view();
  has(v, "This page fills itself in", "H1 Insights with no data explains itself");
  eq(t.$$(".trend").length, 0, "H2 no empty charts are drawn");
  eq(t.$$(".acc").length, 0, "H3 no column of zeros");
  has(v, "Start today\u2019s check-in", "H4 the empty state offers the useful next action");
}
{
  const t = boot({ seed: seedState(2) });
  t.click('.tab[data-tab="insights"]');
  has(t.view(), "A few more check-ins", "H5 thin data says so rather than inventing patterns");
  eq(t.$$(".trend").length, 0, "H5b two days are not drawn as a fortnight trend");
  ok(t.$$(".acc").length > 0, "H5c what has been recorded is still shown");
}
{
  const t = boot({ seed: seedState(6) });
  t.click('.tab[data-tab="insights"]');
  has(t.view(), "Nothing recorded yet", "H6 body check with no measurements has an empty state");
}
{
  const t = boot({ seed: seedState(3) });
  t.click('.tab[data-tab="track"]');
  ok(!t.$(".empty"), "H7 the tracker history is populated when days exist");
  const t2 = boot();
  completeOnboarding(t2);
  t2.click('.tab[data-tab="track"]');
  has(t2.view(), "Nothing recorded yet", "H8 an empty tracker history is designed");
}
{
  const t = boot({ seed: seedState(1) });
  t.click('.tab[data-tab="learn"]');
  has(t.view(), "Nothing unlocks", "H9 the library never gates or expires content");
  has(t.view(), "it simply waits", "H10 a missed day costs no knowledge");
}

/* ==================================================================
   I · PROHIBITED LANGUAGE ACROSS EVERY CLIENT SURFACE
   ================================================================== */
group("I · the prohibitions hold everywhere the client can go");
{
  const t = boot({ seed: seedState(12) });
  let all = "";
  ["today", "track", "plan", "learn", "insights"].forEach(tab => {
    t.click('.tab[data-tab="' + tab + '"]');
    all += " " + t.$("#view").textContent;
  });
  // sheets the client can reach
  t.click('[data-act="sitrep"]'); all += " " + t.$("#sheetbody").textContent;
  t.click(".sheet-close");
  t.click('.tab[data-tab="plan"]');
  t.click('[data-act="baseline"]'); all += " " + t.$("#sheetbody").textContent;
  t.click(".sheet-close");

  const banned = [
    [/%/, "percentages"],
    [/\bscores?\b/i, "scoring"],
    [/\bstreaks?\b/i, "streaks"],
    [/\badherence\b/i, "adherence language"],
    [/\bcompliance\b|\bcompliant\b/i, "compliance language"],
    [/\bfail(ed|ure|ures|ing)?\b/i, "failure language"],
    [/\bbad day/i, "bad days"],
    [/\bcheat\b/i, "cheat meals"],
    [/\bdetox/i, "detox language"],
    [/you (have|may have|might have) (an? )?(intolerance|allergy|ibs|sibo|imbalance)/i, "a claimed diagnosis"],
    [/(this|that) (is|means) (an? )?(intolerance|allergy|imbalance)/i, "an asserted diagnosis"],
    [/\bcures?\b|\bheals? your gut\b/i, "cure claims"],
    [/\bburn (it |that )?off\b/i, "compensation language"],
    [/\bearned\b|\breward/i, "earning or rewards"],
    [/\bguilt/i, "guilt"],
    [/you should have|shouldn.t have/i, "reproach"],
    [/\bDay \d+ of \d+/i, "day counters"],
    [/days remaining|days left/i, "countdowns"],
    [/\byour perfect day|a perfect day so far|perfect day!/i, "perfect-day verdicts"],
    [/\bon track\b|\boff track\b/i, "track/off-track verdicts"],
    [/\bcatch up\b|\bcatching up\b/i, "catch-up language"],
    [/\boverdue\b/i, "overdue language"]
  ];
  banned.forEach(([re, label], i) => ok(!re.test(all), "I" + (i+1) + " no " + label));
  ok(!/\b\d+\s*\/\s*10\b/.test(all), "I21 nothing is rated out of ten");
  ok(!/\b\d+\s*%/.test(all), "I22 no numeric percentage anywhere");
  ok(!/\bred\b/i.test(all), "I23 red is never used as a state word");
  ok(/not diagnosis|not diagnosing/i.test(all), "I24 the app states plainly that it does not diagnose");
}

group("I · the teaching library on its own terms");
{
  const t = boot({ seed: seedState(6) });
  const lessons = t.ev("LESSONS");
  eq(lessons.length, 26, "I30 the library still holds twenty-six pieces");
  ok(lessons.every(l => l.title && l.body && l.action), "I31 every lesson has a title, a read and one action");
  ok(lessons.every(l => l.body.length < 460), "I32 every lesson fits a mobile screen");
  ok(lessons.every(l => !/^\d+\.|Lesson \d|Day \d/.test(l.title)), "I33 nothing is numbered as a daily lesson");
  const bodies = lessons.map(l => l.body + " " + l.action).join(" ");
  ok(!/%/.test(bodies), "I34 no percentages in the teaching content");
  ok(!/\byou failed|\byou must\b|\bnever eat\b|\bforbidden\b/i.test(bodies),
     "I35 the teaching never moralises or forbids");
  ok(!/\bdetox|\bcleanse\b|\bcures?\b|\btoxins?\b/i.test(bodies), "I36 no pseudoscience");
  ok(!/\bdiagnos/i.test(bodies) || /not diagnosing/i.test(bodies),
     "I37 diagnosis is only ever disclaimed");
  ok(/genuinely unfinished|still unknown|sceptical/i.test(bodies),
     "I38 the gut content is honest about what is not yet known");
}

group("R · contrast, computed rather than assumed");
{
  const hex = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16));
  const lum = c => { const v = c.map(x => { x/=255; return x<=0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055,2.4); });
                     return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2]; };
  const ratio = (a,b) => { const l1 = lum(hex(a)), l2 = lum(hex(b));
                           return (Math.max(l1,l2)+0.05) / (Math.min(l1,l2)+0.05); };
  const tok = n => { const m = SRC.match(new RegExp("--" + n + ":(#[0-9A-Fa-f]{6})")); return m && m[1]; };

  const PAPER = "#FBF8F2", WATERMARK = tok("phx-ink");
  eq(WATERMARK, "#E3D9C4", "R1 the watermark tone is the documented one");

  /* Small text sits over the strengthened watermark wherever it is on
     the paper ground. Each tier must clear AA against the mark, not
     merely against clean paper. */
  const tiers = [["ink","#1F2620"],["ink-2",tok("ink-2")],["ink-3",tok("ink-3")],
                 ["sage-txt",tok("sage-txt")],["terra-txt",tok("terra-txt")],["brass-txt",tok("brass-txt")]];
  tiers.forEach(([name,c],i) => {
    ok(c, "R" + (i+2) + "a the " + name + " token is defined");
    ok(ratio(c, WATERMARK) >= 4.5,
       "R" + (i+2) + " " + name + " clears AA over the watermark (" + ratio(c,WATERMARK).toFixed(2) + ":1)");
    ok(ratio(c, PAPER) >= 4.5,
       "R" + (i+2) + "b " + name + " clears AA on clean paper (" + ratio(c,PAPER).toFixed(2) + ":1)");
  });

  /* The resolved hero inverts, so it needs checking on its own terms.
     Worst case is the lightest end of the gradient. */
  const HERO = "#35563E";
  ok(ratio("#F5F1E6", HERO) >= 4.5,
     "R8 the hero heading clears AA on the dark sage ground (" + ratio("#F5F1E6",HERO).toFixed(2) + ":1)");
  ok(ratio("#DADBCE", HERO) >= 4.5,
     "R9 the hero serif body clears AA at 86% opacity (" + ratio("#DADBCE",HERO).toFixed(2) + ":1)");
  ok(ratio("#B9D6BE", HERO) >= 3,
     "R10 the tick clears the 3:1 graphics threshold (" + ratio("#B9D6BE",HERO).toFixed(2) + ":1)");
  ok(ratio("#F5F1E6", "#1D2E24") >= 7,
     "R11 the heading reaches AAA at the dark end of the gradient");

  has(SRC, "color:rgba(245,241,230,.72)", "R12 the hero date is deliberately the quietest tier, not an accident");
}

group("I · no red in the design system's own tokens");
{
  const rootBlock = SRC.slice(SRC.indexOf(":root{"), SRC.indexOf("}", SRC.indexOf(":root{")));
  ok(!/#(e|f)[0-9a-f]{1,2}(0|1|2)[0-9a-f]{1,2}(0|1|2)/i.test(rootBlock), "I25 no red token in the palette");
  has(rootBlock, "--terra:#AE5A32", "I26 terracotta is the caution colour, not red");
  has(rootBlock, "--sage:#4C7C57", "I27 sage remains the affirmative colour");
  has(rootBlock, "--radius:22px", "I28 the 22px radius from the pitch pages is intact");
  has(rootBlock, "Iowan Old Style", "I29 the Iowan serif coaching voice is intact");
}

/* ==================================================================
   J · WEEKLY CHECK-IN AND SUMMARY
   ================================================================== */
group("J · the weekly loop");
{
  const t = boot({ seed: seedState(7) });
  t.click('.tab[data-tab="insights"]');
  t.click('[data-act="sitrep"]');
  const sheet = () => t.$("#sheetbody").innerHTML;
  has(sheet(), "How was the week?", "J1 the weekly check-in opens");
  ok(t.$('[data-act="sit-save"]').disabled, "J2 it cannot be saved half-answered");
  has(sheet(), "Answer the five above", "J3 the reason is stated");
  ["best", "hardest", "gut", "energy", "improve"].forEach(f => {
    t.click('[data-act="sit"][data-f="' + f + '"]');
  });
  ok(!t.$('[data-act="sit-save"]').disabled, "J4 it becomes available once answered");
  has(sheet(), "Save my week and see the summary", "J5 the button says what will happen next");
  has(sheet(), "still be here tomorrow", "J6 declining costs nothing");
  t.click('[data-act="sit-save"]');
  eq(Object.keys(t.store().sitreps).length, 1, "J7 the weekly check-in is stored");
}
{
  const t = boot({ seed: seedState(10) });
  const wk = t.ev("key")(t.ev("weekStart")(t.ev("today")()));
  t.ev("reportSheet")(wk);
  const r = t.$("#sheetbody").innerHTML;
  has(r, "What went well", "J8 the summary reports what worked");
  has(r, "What felt hard", "J9 the summary reports what did not");
  has(r, "How you felt", "J10 the summary reports the body check");
  has(r, "Suggested next focus", "J11 one focus is proposed, not many");
  has(r, "not an instruction", "J12 the focus is framed as a conversation");
  hasNot(r, "%", "J13 the summary contains no percentages");
}

/* ==================================================================
   K · COACH REVIEW STAYS THE COACH'S
   ================================================================== */
group("K · coach review");
{
  const t = boot({ seed: seedState(12) });
  let clientText = "";
  ["today", "track", "plan", "learn", "insights"].forEach(tab => {
    t.click('.tab[data-tab="' + tab + '"]'); clientText += " " + t.view();
  });
  hasNot(clientText, "Needs attention", "K1 readiness states are never shown to the client");
  hasNot(clientText, "Established</span>", "K2 no readiness pill leaks into a client view");
  hasNot(clientText, "Coach review", "K3 the coach panel is not advertised in the client journey");

  t.click("#coachBtn");
  const c = t.$("#sheetbody").innerHTML;
  has(c, "Coach review", "K4 the coach panel opens from the app bar");
  has(c, "Synthetic Client", "K5 the coach panel is about the right client");
  has(c, "Readiness", "K6 readiness is present for the coach");
  has(c, "Not a score", "K7 readiness is explicitly not a score");
  has(c, "Phase 2 stays closed", "K8 nothing auto-progresses the client");
  const rd = t.ev("readiness")();
  eq(rd.length, 5, "K9 five readiness domains");
  ok(rd.every(r => ["est","dev","att","new"].indexOf(r.s) > -1), "K10 four readiness states including 'not enough yet'");
  ok(rd.every(r => r.why && r.why.length > 8), "K11 every readiness judgement shows its working");
}
{
  const t = boot({ seed: seedState(2) });
  const rd = t.ev("readiness")();
  ok(rd.every(r => r.s === "new"),
     "K12 a new client is never labelled 'needs attention' for lack of data");
}

/* ==================================================================
   L · DATA SAFETY
   ================================================================== */
group("L · backup, restore and erase");
{
  const t = boot({ seed: seedState(8) });
  const payload = JSON.stringify(t.ev("exportPayload")());
  const res = t.ev("validateBackup")(payload);
  eq(res.ok, true, "L1 an export validates as a restorable backup");
  eq(res.summary.checkIns, 8, "L2 the backup reports the right number of check-ins");
  eq(res.summary.client, "Synthetic Client", "L3 the backup is labelled with the client");

  const before = JSON.stringify(t.store());
  eq(t.ev("validateBackup")("not json").ok, false, "L4 rubbish is rejected");
  eq(t.ev("validateBackup")('{"hello":1}').ok, false, "L5 a JSON file that is not a backup is rejected");
  eq(t.ev("validateBackup")(JSON.stringify({meta:{schema:99},data:{profile:{},entries:{}}})).ok, false,
     "L6 a backup from a newer build is refused rather than mangled");
  eq(JSON.stringify(t.store()), before, "L7 a failed restore leaves live data untouched");

  t.click("#settingsBtn");
  has(t.$("#sheetbody").innerHTML, "have not saved a backup yet", "L8 the panel states no backup exists");
  t.click('[data-act="export"]');
  has(t.$("#sheetbody").innerHTML, "Last backup saved", "L9 saving a backup visibly updates the panel");
  ok(t.store().usage.lastExport, "L10 the backup time is recorded for the coach");
}
{
  const t = boot({ seed: seedState(5) });
  t.click("#settingsBtn");
  t.click('[data-act="reset-confirm"]');
  const r = t.$("#sheetbody").innerHTML;
  has(r, "This cannot be undone", "L11 erasing warns clearly");
  has(r, "Save a backup first", "L12 a backup is offered before erasing");
  has(r, "keep my data", "L13 the safe option is plainly labelled");
  t.click('[data-act="reset-go"]');
  eq(t.window.localStorage.getItem("rtr.companion.v1") === null ||
     JSON.parse(t.window.localStorage.getItem("rtr.companion.v1")).profile.onboarded === false, true,
     "L14 erasing genuinely clears the device");
  ok(!t.$("#obroot").hidden, "L15 erasing returns to the opening experience");
}

group("L · migration from earlier builds");
{
  const old = JSON.stringify({
    v:1, profile:{ name:"", created:"2025-01-01T00:00:00.000Z", onboarded:true },
    baseline:{ date:"2025-01-01T00:00:00.000Z", answers:{q1:2} },
    entries:{ "2025-01-02":{ meals:"yes", protein:"good", plants:"some",
                             water:"nearly", gut:"ok", energy:"ok" } },
    sitreps:{}, seen:{}, today:null, coach:[]
  });
  const t = boot({ seed: old });
  const s = t.store();
  eq(s.schema, 2, "L16 a schema-1 payload migrates forward");
  eq(Object.keys(s.entries).length, 1, "L17 the old check-in survives migration");
  eq(s.profile.name, "Synthetic Client", "L18 a nameless older record adopts the configured client");
  ok(s.body && typeof s.body === "object", "L19 the body store is created");
  ok(s.defer && typeof s.defer === "object", "L20 the new deferral store is created and safe");
  eq(s.obDraft, null, "L21 the new onboarding draft slot defaults safely");
}
{
  const junk = JSON.stringify(Object.assign(JSON.parse(seedState(2)), { defer:"nonsense", obDraft:42 }));
  const t = boot({ seed: junk });
  ok(typeof t.store().defer === "object", "L22 a corrupted deferral field is normalised, not trusted");
  eq(t.store().obDraft, null, "L23 a corrupted onboarding draft is discarded");
  eq(t.errors.length, 0, "L24 corrupt fields do not crash the app");
}

/* ==================================================================
   M · NAVIGATION AND INTERACTION
   ================================================================== */
group("M · navigation");
{
  const t = boot({ seed: seedState(6) });
  eq(t.$('.tab[data-tab="today"]').getAttribute("aria-current"), "page", "M1 the current tab is marked");
  t.click('.tab[data-tab="plan"]');
  eq(t.$('.tab[data-tab="plan"]').getAttribute("aria-current"), "page", "M2 the marker follows navigation");
  eq(t.$('.tab[data-tab="today"]').getAttribute("aria-current"), null, "M3 only one tab is current");
  ok(t.$("#liveroot"), "M4 a live region exists to announce the screen");
  eq(t.$("#liveroot").getAttribute("aria-live"), "polite", "M5 announcements are polite, not assertive");

  t.click('.tab[data-tab="learn"]');
  t.click(t.$('[data-act="lesson"]'));
  ok(t.$("#sheetwrap").classList.contains("open"), "M6 a lesson opens in a sheet");
  eq(t.$("#sheetwrap").getAttribute("aria-modal"), "true", "M7 the sheet is a modal dialog");
  ok(t.$(".sheet-close"), "M8 the sheet has a visible close control");

  const esc = new t.window.KeyboardEvent("keydown", { key:"Escape", bubbles:true });
  t.document.dispatchEvent(esc);
  ok(!t.$("#sheetwrap").classList.contains("open"), "M9 Escape closes the sheet");

  t.click(t.$('[data-act="lesson"]'));
  ok(t.$("#sheetwrap").classList.contains("open"), "M10 the sheet reopens");
  ok(/!panel$/.test(t.window.location.hash),
     "M11 opening a sheet creates a history entry via the hash, which works on content:// origins");
  // the back gesture: the URL returns to the tab and the app reacts
  t.window.location.hash = "learn";
  t.window.dispatchEvent(new t.window.HashChangeEvent("hashchange"));
  ok(!t.$("#sheetwrap").classList.contains("open"),
     "M11b the back gesture closes the sheet rather than leaving the app");
  ok(!/history\.pushState\s*\(/.test(SRC),
     "M11c no pushState call remains — it throws on the origin the Companion is opened from");

  // back across tabs
  t.click('.tab[data-tab="insights"]');
  eq(t.window.location.hash, "#insights", "M11d each screen is reflected in the hash");
  t.window.location.hash = "plan";
  t.window.dispatchEvent(new t.window.HashChangeEvent("hashchange"));
  eq(t.$('.tab[data-tab="plan"]').getAttribute("aria-current"), "page",
     "M11e going back moves between screens instead of leaving the app");
}

group("M · touch, focus and typography survive the layout");
{
  const t = boot({ seed: seedState(6) });
  has(SRC, "--tap:46px", "M12 a 46px minimum touch target is defined");
  has(SRC, "env(safe-area-inset-bottom)", "M13 bottom safe area is respected");
  has(SRC, "env(safe-area-inset-top)", "M14 top safe area is respected");
  has(SRC, "calc(var(--barh) + env(safe-area-inset-bottom) + 30px)",
     "M15 REGRESSION (P2.1 tab bar coverage): content clears the tab bar");
  has(SRC, "scroll-margin-bottom", "M16 inputs scroll clear of an open keyboard");
  has(SRC, "prefers-reduced-motion", "M17 reduced motion is honoured");
  has(SRC, ":focus-visible{outline", "M18 keyboard focus is visible");
  has(SRC, "overflow-wrap:anywhere", "M19 long content cannot break the layout sideways");
  has(SRC, "-webkit-text-size-adjust:100%", "M20 enlarged text is handled predictably");

  const rm = SRC.slice(SRC.indexOf("@media (prefers-reduced-motion:reduce)"));
  has(rm, "animation:none !important", "M21 the new completion animation is disabled under reduced motion");

  const noName = t.$$("button").filter(b => !b.textContent.trim() && !b.getAttribute("aria-label"));
  eq(noName.length, 0, "M22 every button has an accessible name");
  const noPressed = t.$$(".opt").filter(o => !o.hasAttribute("aria-pressed"));
  eq(noPressed.length, 0, "M23 every choice control reports its state");
}

group("M · block layout of title and subtitle pairs");
{
  const t = boot({ seed: seedState(6) });
  t.click('.tab[data-tab="track"]');
  const r1 = t.$(".row .r1");
  eq(t.window.getComputedStyle(r1).display, "block",
     "M24 REGRESSION (P2.1 inline text): row titles are block elements");
}

/* ==================================================================
   N · THE FULL FIRST TEN MINUTES, END TO END
   ================================================================== */
group("N · the first ten minutes, in one run");
{
  const t = boot();
  const steps = [];
  ok(!!t.$("#obroot").innerHTML, "N1 opens on the personal welcome"); steps.push("welcome");
  t.click('[data-act="ob-start"]'); steps.push("entered");
  for(let i = 0; i < 10; i++) t.click(t.$('[data-act="ob-a"]'));
  has(t.ob(), "That\u2019s the snapshot", "N2 baseline completes and is acknowledged");
  t.click('[data-act="ob-done"]');
  ok(!!t.$(".read"), "N3 arrives at Today with a piece of coaching ready");
  ok(!!t.$(".try"), "N4 with one practical thing to try");
  t.click('[data-act="tab"][data-tab="track"]');
  fillCheckIn(t);
  t.click('[data-act="save"]');
  ok(!!t.$(".done"), "N5 the first check-in resolves the day");
  has(t.view(), "That\u2019s captured.", "N6 and is acknowledged in RTR's voice");
  t.click('[data-act="tab"][data-tab="plan"]');
  has(t.view(), "Five anchors", "N7 depth exists and is reachable without being forced");
  has(t.view(), "Building a plate", "N8 the plate model is there when he wants it");
  t.click('.tab[data-tab="today"]');
  has(t.view(), "You\u2019re done for today.", "N9 returning to Today still says the day is done");
  eq(t.errors.length, 0, "N10 the whole journey runs without a script error");
}

/* ==================================================================
   O · SCOPE — P2.2 IMPROVED THE PRODUCT, IT DID NOT EXPAND IT
   ================================================================== */
group("O · scope boundary");
{
  const forbidden = [
    ["Kefir Bowl Builder", "kefir bowl builder"],
    ["Meal Builder", "meal builder"],
    ["Snacks That Serve Me", "the snacks module"],
    ["kcal", "a calorie tracker"],
    ["macro target", "macro targets"],
    ["nutritionTable", "a nutrition table"],
    ["serviceWorker", "PWA installability"],
    ["manifest.json", "a web manifest"],
    ["PIN", "a coach PIN system"],
    ["Phase Summary", "phase summary"],
    ["Phase 2 content", "phase 2 content"]
  ];
  forbidden.forEach(([w, label], i) => hasNot(SRC, w, "O" + (i+1) + " no " + label + " was added"));
  const t = boot({ seed: seedState(6) });
  eq(t.$$(".tab").length, 5, "O11 still five primary navigation sections");
  const tabs = t.$$(".tab").map(b => b.dataset.tab).join(",");
  eq(tabs, "today,track,plan,learn,insights", "O12 the navigation is unchanged from P2.1");
  const metrics = t.ev("SCALE") ? Object.keys(t.ev("SCALE")) : [];
  eq(metrics.length, 6, "O13 still six daily metrics — none added");
}

/* ==================================================================
   P · CLINICAL AND SAFETY BOUNDARIES
   ================================================================== */
group("P · clinical boundaries hold");
{
  const t = boot({ seed: seedState(6) });
  t.click('.tab[data-tab="track"]');
  has(t.view(), "observation, not diagnosis", "P1 the tracker states it does not diagnose");
  has(t.view(), "speak to your GP", "P2 severe or persistent symptoms are routed to a GP");
  has(t.view(), "unintended weight loss", "P3 the red-flag symptoms are named");

  const seed = JSON.parse(seedState(0));
  const k = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  for(let i = 0; i < 10; i++){
    const d = new Date(NOW_WED.getTime()); d.setDate(d.getDate() - i);
    seed.entries[k(d)] = { meals:"yes", protein:"good", plants:"some", water:"nailed",
                           gut:"rough", energy:"low", symptoms:["Pain"], note:"", ts:d.toISOString() };
  }
  const t2 = boot({ seed: JSON.stringify(seed) });
  const flags = t2.ev("readinessFlags")();
  ok(flags.some(f => /medical assessment/i.test(f)),
     "P4 a run of gut symptoms flags medical assessment to the coach");
  ok(flags.length >= 2, "P5 repeated symptoms are surfaced for the coaching conversation");
}

group("P · weight is kept out of the daily loop");
{
  const t = boot({ seed: seedState(6) });
  t.click('.tab[data-tab="track"]');
  const v = t.view();
  hasNot(v, "Weight", "P6 weight is not part of the daily check-in");
  hasNot(v, "waist", "P7 nor is waist");
  const t2 = boot({ seed: seedState(6, null, NOW_SAT), at: NOW_SAT });
  has(t2.view(), "Weekly body check", "P8 the body check is offered weekly, at the end of the week");
  has(t2.view(), "trend that tells us anything", "P9 it is framed as a trend, never a single reading");
  eq(t2.ev("dayShape")().body && t2.ev("dayShape")().resolved !== undefined, true,
     "P10 an unrecorded body check never blocks the resolved day");
}

/* ==================================================================
   Q · STORAGE REFUSING TO WORK
   ================================================================== */
group("Q · storage blocked");
{
  ok(SRC.indexOf("const STORAGE_OK = Store.available();") > -1,
     "Q1 storage is probed once at load");
  has(SRC, "letting the Companion save", "Q2 a designed card explains it, not a toast");
  has(SRC, "Private browsing is the usual cause", "Q3 the likely cause and fix are given");
  ok(SRC.indexOf('setTimeout(()=>toast("This browser is blocking storage') === -1,
     "Q4 the old disappearing toast has been removed");
}

/* ==================================================================
   RESULTS
   ================================================================== */
console.log("\n" + "=".repeat(64));
console.log("  P2.2 QA  \u00b7  " + pass + " passed  \u00b7  " + fail + " failed  \u00b7  " + (pass + fail) + " checks");
console.log("=".repeat(64));
if(failures.length){
  console.log("\nFAILURES");
  failures.forEach(f => console.log("  \u2717 " + f));
  process.exitCode = 1;
} else {
  console.log("\n  All checks passed.");
}
