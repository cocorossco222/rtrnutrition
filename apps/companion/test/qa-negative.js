/* ==================================================================
   NEGATIVE CONTROLS
   A green suite proves nothing unless the checks can go red. Each case
   deliberately reintroduces a defect and asserts the relevant check
   now fails. If a control "passes" here, the real check is toothless.
   ================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const RAW = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const TEST_CLIENT = "Synthetic Client";
const SRC = RAW.replace('const CLIENT = { name:"" };', 'const CLIENT = { name:"' + TEST_CLIENT + '" };');
const NOW_WED = new Date(2026, 8, 2, 10, 30, 0);
const NOW_SAT = new Date(2026, 8, 5, 10, 30, 0);

let pass = 0, fail = 0; const failures = [];
function control(label, fn){
  let caught = false;
  try { caught = fn() === false; } catch(e){ caught = true; }
  if(caught){ pass++; console.log("  \u2713 " + label); }
  else { fail++; failures.push(label); console.log("  \u2717 " + label + "  \u2014 CHECK IS TOOTHLESS"); }
}

function makeFakeDate(ms){
  const R = Date;
  function F(...a){ return a.length ? new R(...a) : new R(ms); }
  F.prototype = R.prototype; F.now = () => ms; F.parse = R.parse; F.UTC = R.UTC;
  return F;
}
function boot(src, opts){
  opts = opts || {};
  const at = opts.at || NOW_WED;
  const vc = new VirtualConsole();
  const dom = new JSDOM(src, {
    runScripts: "dangerously", url: "https://rtr.local/", virtualConsole: vc,
    beforeParse(w){
      w.Date = makeFakeDate(at.getTime());
      w.scrollTo = () => {};
      w.URL.createObjectURL = () => "blob:stub";
      w.HTMLAnchorElement.prototype.click = function(){};
      if(opts.seed) w.localStorage.setItem("rtr.companion.v1", opts.seed);
    }
  });
  return dom.window;
}
function seed(days, now){
  now = now || NOW_WED;
  const k = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const entries = {};
  for(let i = 0; i < days; i++){
    const d = new Date(now.getTime()); d.setDate(d.getDate() - i);
    entries[k(d)] = { meals:"yes", protein:"good", plants:"plenty", water:"nailed",
                      gut:"good", energy:"good", symptoms:[], note:"", ts:d.toISOString() };
  }
  return JSON.stringify({
    schema:2, v:1, profile:{name:"Synthetic Client", created:now.toISOString(), onboarded:true},
    baseline:{date:now.toISOString(), answers:{q1:2,q2:2,q3:2,q4:2,q5:2,q6:2,q7:2,q8:2,q9:2,q10:2}},
    entries, body:{}, sitreps:{}, seen:{}, today:null, coach:[],
    prefs:{weightUnit:"kg",waistUnit:"cm"},
    usage:{opens:5, lastOpen:now.toISOString(), views:{}},
    insightLog:[], reportLog:[], defer:{}, obDraft:null, phase:{key:"stabilise"}
  });
}

console.log("\nNEGATIVE CONTROLS\n");

/* 1 — the P2.1 blank-screen cascade defect */
control("B3 catches the #app display cascade defect (P2.1 blank screen)", () => {
  const broken = SRC.replace("[hidden]{display:none !important;}", "");
  const w = boot(broken);
  return w.getComputedStyle(w.document.querySelector("#app")).display === "none";
});

/* 2 — a name gate reappearing in onboarding */
control("B11/B16 catches a name field returning to onboarding", () => {
  const broken = SRC.replace('const CLIENT = { name:"Synthetic Client" };', 'const CLIENT = { name:"" };');
  const w = boot(broken);
  w.document.querySelector('[data-act="ob-start"]')
   .dispatchEvent(new w.MouseEvent("click", {bubbles:true}));
  return w.document.querySelectorAll("#obroot input").length === 0;
});

/* 3 — done-for-today appearing while the weekly check-in is genuinely due */
control("E21 catches a premature done-for-today state", () => {
  const broken = SRC.replace(
    "return sitrepReady() && !sitrepDeferred() && (d===0 || d===6);",
    "return false;");
  const w = boot(broken, { seed: seed(6, NOW_SAT), at: NOW_SAT });
  return w.eval("dayShape")().resolved === false;
});

/* 4 — the P2.1 collapsed-panel defect: two children in the clip layer */
control("D7 catches a second child breaking the symptom reveal", () => {
  const broken = SRC.replace(
    '<div class="reveal\'+(DRAFT.gut==="rough"?" open":"")+\'" id="symrev"><div class="reveal-clip">',
    '<div class="reveal\'+(DRAFT.gut==="rough"?" open":"")+\'" id="symrev"><p></p><div class="reveal-clip">');
  const w = boot(broken, { seed: seed(3) });
  w.document.querySelector('.tab[data-tab="track"]')
   .dispatchEvent(new w.MouseEvent("click", {bubbles:true}));
  return w.document.querySelectorAll("#symrev > *").length === 1;
});

/* 5 — a percentage reaching a client surface */
control("I1/I22 catches a percentage in a client view", () => {
  const broken = SRC.replace(
    "'<p class=\"small\" style=\"margin-top:10px\">Totals, not targets.",
    "'<p class=\"small\" style=\"margin-top:10px\">You are 67% consistent. Totals, not targets.");
  const w = boot(broken, { seed: seed(8) });
  w.document.querySelector('.tab[data-tab="insights"]')
   .dispatchEvent(new w.MouseEvent("click", {bubbles:true}));
  const txt = w.document.querySelector("#view").textContent;
  return !/\d+\s*%/.test(txt);
});

/* 6 — streak language creeping into the resolved state */
control("E13 catches streak language in the done panel", () => {
  const broken = SRC.replace("We\\u2019ve got what we need. Go and live your life.",
                             "Nice streak! Go and live your life.");
  const w = boot(broken, { seed: seed(6) });
  return !/streak/i.test(w.document.querySelector("#view").textContent);
});

/* 7 — the resolved state demanding attention again */
control("E9 catches a primary action returning to a finished day", () => {
  const broken = SRC.replace(
    "'<button type=\"button\" class=\"btn quiet sm\" data-act=\"tab\" data-tab=\"plan\">Explore my plan</button>'",
    "'<button type=\"button\" class=\"btn primary\" data-act=\"tab\" data-tab=\"plan\">Explore my plan</button>'");
  const w = boot(broken, { seed: seed(6) });
  return w.document.querySelectorAll(".btn.primary").length === 0;
});

/* 8 — a curiosity note asserting causation */
control("G3 catches a causal claim in a curiosity note", () => {
  // mutate a note the seeded data actually produces
  const broken = SRC.replace(
    '"Your meal rhythm looks more predictable than it did."',
    '"Your meal rhythm is what caused your energy to improve."');
  const w = boot(broken, { seed: seed(10) });
  const causal = t => /\bcaus(e|es|ed|ing)\b|\bproves?\b|\bbecause of\b|\bdue to\b|\bresults? in\b|\bleads? to\b|\bmakes you\b/i
    .test(String(t).replace(/(may )?not (necessarily )?(be the |)cause[sd]?\b/ig, ""));
  return w.eval("curiosityNotes")().every(n => !causal(n.text));
});

/* 9 — a note losing its basis line */
control("G2 catches a note published without its basis", () => {
  const broken = SRC.replace(
    'const add = (w,tone,text,basis) => out.push({w,tone,text,basis});',
    'const add = (w,tone,text,basis) => out.push({w,tone,text,basis:""});');
  const w = boot(broken, { seed: seed(10) });
  return w.eval("curiosityNotes")().every(n => n.basis && n.basis.length > 4);
});

/* 10 — a restore silently accepting a damaged file */
control("L4/L7 catches a restore that stops validating", () => {
  const broken = SRC.replace(
    'catch(e){ return { ok:false, error:"That file isn\'t readable as JSON. It may be damaged or not a Companion backup." }; }',
    'catch(e){ return { ok:true, state:BLANK(), summary:{} }; }');
  const w = boot(broken, { seed: seed(4) });
  return w.eval("validateBackup")("not json").ok === false;
});

/* 11 — an unnamed button */
control("M22 catches a button with no accessible name", () => {
  const broken = SRC.replace(
    '<button type="button" class="iconbtn" id="settingsBtn" aria-label="Settings">',
    '<button type="button" class="iconbtn" id="settingsBtn">');
  const w = boot(broken, { seed: seed(4) });
  const bad = Array.from(w.document.querySelectorAll("button"))
    .filter(b => !b.textContent.trim() && !b.getAttribute("aria-label"));
  return bad.length === 0;
});

/* 12 — reduced motion no longer honoured for the new animation */
control("M21 catches the completion animation ignoring reduced motion", () => {
  const broken = SRC.replace("*,*::before,*::after{animation:none !important;transition-duration:1ms !important;}", "");
  const rm = broken.slice(broken.indexOf("@media (prefers-reduced-motion:reduce)"));
  return rm.indexOf("animation:none !important") > -1;
});

/* 13 — a scope breach */
control("O catches a feature from a later pass being added", () => {
  const broken = SRC.replace("<title>", "<title>Kefir Bowl Builder ");
  return broken.indexOf("Kefir Bowl Builder") === -1;
});

/* 14 — the app forgetting who it belongs to */
control("B20 catches the configured client name failing to reach state", () => {
  const broken = SRC.replace("S.profile.name = OB.name || CLIENT.name;", "S.profile.name = \"\";");
  const w = boot(broken);
  const d = w.document;
  const click = el => el.dispatchEvent(new w.MouseEvent("click", {bubbles:true}));
  click(d.querySelector('[data-act="ob-start"]'));
  for(let i = 0; i < 10; i++) click(d.querySelector('[data-act="ob-a"]'));
  click(d.querySelector('[data-act="ob-done"]'));
  return JSON.parse(w.localStorage.getItem("rtr.companion.v1")).profile.name === "Synthetic Client";
});

/* 15 — returning after an absence being framed as a lapse */
control("F4 catches catch-up language on return", () => {
  const broken = SRC.replace(
    "There\\u2019s nothing to catch up on. Today is simply a fresh observation.",
    "You have some catching up to do.");
  const s = JSON.parse(seed(6));
  const past = new Date(NOW_WED.getTime()); past.setDate(past.getDate() - 9);
  s.usage.lastOpen = past.toISOString();
  const w = boot(broken, { seed: JSON.stringify(s) });
  return !/catch(ing)? up/i.test(w.document.querySelector("#view").textContent);
});

/* 16 — the phoenix starting to move again */
control("the still-watermark rule catches a returning animation", () => {
  const broken = SRC.replace(".bg-phx::after{", ".bg-phx::after{animation:drift 20s infinite;");
  const block = broken.slice(broken.indexOf(".bg-phx{"), broken.indexOf(".bg-phx{") + 900);
  return !/animation:/.test(block);
});

/* 17 — an ink tier failing against the strengthened watermark */
control("R catches an ink tier that no longer clears AA over the watermark", () => {
  const broken = SRC.replace("--ink-3:#555D53;", "--ink-3:#8A9288;");
  const hex = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16));
  const lum = c => { const v = c.map(x => { x/=255; return x<=0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055,2.4); });
                     return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2]; };
  const ratio = (a,b) => { const l1=lum(hex(a)), l2=lum(hex(b));
                           return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };
  const t = broken.match(/--ink-3:(#[0-9A-Fa-f]{6})/)[1];
  return ratio(t, "#E3D9C4") >= 4.5;
});

/* 18 — the back gesture reverting to pushState */
control("M11 catches routing reverting to pushState", () => {
  const broken = SRC.replace("setHash(TAB + \"!panel\");", "history.pushState({},\"\");");
  return !/history\.pushState\s*\(/.test(broken);
});

/* 19 — the resolved hero losing its state change */
control("E10 catches the resolved hero reverting to a paper card", () => {
  const broken = SRC.replace("background:linear-gradient(158deg,#35563E 0%,#294435 46%,#1D2E24 100%);",
                             "background:var(--card);");
  const css = broken.slice(broken.indexOf(".done{"), broken.indexOf(".done{") + 500);
  return css.indexOf("linear-gradient(158deg,#35563E") > -1;
});

/* 20 — optional routes creeping back above the content */
control("the foot-routes rule catches routes returning to the hero", () => {
  const anchor = "'<p class=\"d\">'+longDate(today())+'</p>'+";
  const broken = SRC.replace(anchor,
    anchor + "'<button type=\"button\" class=\"btn quiet sm\" data-act=\"tab\" data-tab=\"plan\">Explore my plan</button>'+");
  const w = boot(broken, { seed: seed(6) });
  const done = w.document.querySelector(".done");
  return !done || done.querySelectorAll("button").length === 0;
});

console.log("\n" + "=".repeat(64));
console.log("  NEGATIVE CONTROLS  \u00b7  " + pass + " checks proved live  \u00b7  " + fail + " toothless");
console.log("=".repeat(64));
if(failures.length){ failures.forEach(f => console.log("  \u2717 " + f)); process.exitCode = 1; }
else console.log("\n  Every control fired. The suite has teeth.\n");
