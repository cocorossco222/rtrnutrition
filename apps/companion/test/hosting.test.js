"use strict";
/* ==================================================================
   Hosting and iPhone checks (P2.3).

   Opening the HTML file directly does not work reliably on an iPhone,
   so the Companion is now hosted. These checks cover what hosting adds
   and the decisions made on purpose — including what was left out.
   ================================================================== */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const HEAD = HTML.slice(0, HTML.indexOf("</head>"));

/* Width, height and colour type straight from a PNG's IHDR chunk. */
function png(file){
  const b = fs.readFileSync(path.join(DIR, file));
  assert.equal(b.toString("latin1", 1, 4), "PNG", file + " is not a PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colourType: b[25] };
}

test("the head declares everything iOS needs for a proper Home Screen app", () => {
  [
    '<link rel="manifest" href="manifest.webmanifest">',
    '<link rel="apple-touch-icon" href="icons/icon-180.png">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="Companion">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    'viewport-fit=cover'
  ].forEach(tag => assert.ok(HEAD.includes(tag), "missing: " + tag));
});

test("every asset the head references is relative, so hosting is origin-agnostic", () => {
  const refs = [...HEAD.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
  assert.ok(refs.length >= 3);
  refs.forEach(r => {
    assert.ok(!/^\//.test(r) && !/^https?:/.test(r), r + " is absolute; it would break at /rtr-nutrition-companion/");
    assert.ok(fs.existsSync(path.join(DIR, r)), r + " does not exist");
  });
});

test("the manifest is valid and its icons match what it declares", () => {
  const m = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.webmanifest"), "utf8"));
  assert.equal(m.display, "standalone");
  assert.equal(m.start_url, "./", "start_url must stay relative");
  assert.equal(m.scope, "./");
  assert.ok(m.short_name && m.short_name.length <= 12, "short_name must fit under a Home Screen icon");
  assert.ok(m.icons.some(i => i.purpose === "maskable"), "a maskable icon is required for Android");
  m.icons.forEach(i => {
    const [w, h] = i.sizes.split("x").map(Number);
    const p = png(i.src);
    assert.deepEqual([p.w, p.h], [w, h], i.src + " is not " + i.sizes);
  });
});

test("the Apple touch icon is 180px and fully opaque", () => {
  /* iOS renders any transparency in a touch icon as black. PNG colour
     type 2 is RGB with no alpha channel at all. */
  const p = png("icons/icon-180.png");
  assert.deepEqual([p.w, p.h], [180, 180]);
  assert.equal(p.colourType, 2, "the touch icon has an alpha channel; iOS will show black corners");
});

test("iOS before 15.4 gets a viewport-height floor instead of no height", () => {
  ["#app{min-height:100vh;min-height:100dvh;", ".ob{position:relative;z-index:1;min-height:100vh;min-height:100dvh;"]
    .forEach(rule => assert.ok(HTML.includes(rule), "missing vh fallback: " + rule));
});

test("erasing clears only the Companion's key — the origin is shared", () => {
  /* The Companion owns one namespaced storage key. Even on a dedicated
     production origin it must not clear unrelated browser storage. */
  assert.ok(!/localStorage\.clear\s*\(/.test(HTML), "localStorage.clear() would wipe other apps on the shared origin");
  assert.ok(HTML.includes("clear(){ try{ localStorage.removeItem(KEY); }"), "Store.clear must remove only KEY");
  assert.match(HTML, /const KEY = "rtr\.companion\.v1";/, "the storage key must stay namespaced");
});

test("no service worker yet, on purpose", () => {
  /* A service worker is the right long-term offline shell, but a badly
     versioned one can pin a client to an old build indefinitely. It
     belongs in its own pass with its own device test, not bundled in
     with first hosting. See docs/adr/0003-host-on-netlify.md. */
  assert.ok(!/serviceWorker\s*\.\s*register/.test(HTML));
});

test("the version stamp marks the hosted build", () => {
  assert.match(HTML, /const APP_VERSION = "p2\.3";/);
});
