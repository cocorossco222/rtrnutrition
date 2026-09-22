"use strict";
/* ==================================================================
   Tooling canary.

   Several checks in qa.js assert computed styles — most importantly
   B3, the P2.1 blank-screen regression, which requires #app to compute
   to display:none during onboarding. That is only meaningful if the
   test DOM implements the CSS cascade properly.

   jsdom 26.1.0 does not. It resolves by source order alone, ignoring
   both !important and specificity: whichever matching rule comes last
   wins. In the Companion, #app{display:flex} is declared after
   [hidden]{display:none !important}, so jsdom 26 computes flex and B3
   fails — on CSS that is correct and was verified on a real device.

   The first draft of this canary put the rules in the opposite order.
   That case passes on jsdom 26 by accident, so the canary could not
   fail: toothless. The cases below are the app's real ordering plus a
   pure-specificity case, and both fail on a source-order-only cascade.

   If this fails: restore the pinned jsdom version in
   apps/companion/package.json. Do not change the app's CSS.
   ================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const version = require("jsdom/package.json").version;

function display(css){
  const dom = new JSDOM("<style>" + css + "</style><div id='app' hidden></div>", { pretendToBeVisual: true });
  return dom.window.getComputedStyle(dom.window.document.getElementById("app")).display;
}

test("!important beats a later, more specific rule (the Companion's actual order)", () => {
  assert.equal(display("[hidden]{display:none !important}#app{display:flex}"), "none",
    "jsdom " + version + " ignores !important when a later rule matches. " +
    "B3 (blank-screen regression) cannot be trusted. Restore the pinned jsdom version.");
});

test("specificity beats source order when neither is !important", () => {
  assert.equal(display("#app{display:flex}[hidden]{display:none}"), "flex",
    "jsdom " + version + " resolves by source order, not specificity. " +
    "Computed-style assertions in qa.js cannot be trusted. Restore the pinned jsdom version.");
});

test("jsdom is pinned to an exact version", () => {
  const spec = require("../package.json").devDependencies.jsdom;
  assert.match(spec, /^\d+\.\d+\.\d+$/,
    "jsdom must be pinned exactly (found '" + spec + "'): a version range let a broken cascade in once already");
});
