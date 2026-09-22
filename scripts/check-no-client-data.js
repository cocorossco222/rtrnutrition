#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SKIP = new Set(["node_modules", ".git"]);
const problems = [];

function walk(dir){
  for(const e of fs.readdirSync(dir, {withFileTypes:true})){
    if(SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);
    if(e.isDirectory()){
      if(["client-data","private"].includes(e.name)) problems.push(rel + "/ — private/client-data directory");
      walk(full); continue;
    }
    if(/^RTR-Companion_.*\.json$/i.test(e.name)) problems.push(rel + " — Companion export filename");
    if(/\.(snap|dump)$/i.test(e.name) || /\.sql\.dump$/i.test(e.name)) problems.push(rel + " — data dump/snapshot");
    if(/^\.env(\..+)?$/.test(e.name) && e.name !== ".env.example") problems.push(rel + " — secrets file");

    if(e.name.endsWith(".json") && fs.statSync(full).size < 5 * 1024 * 1024){
      let j; try { j = JSON.parse(fs.readFileSync(full, "utf8")); } catch(_){ continue; }
      if(j && j.meta && j.meta.product === "RTR Nutrition Companion" && j.meta.client !== "Synthetic Fixture"){
        problems.push(rel + " — Companion export is not explicitly synthetic");
      }
    }
  }
}
walk(ROOT);

const app = fs.readFileSync(path.join(ROOT,"apps/companion/index.html"),"utf8");
if(!/const CLIENT = \{ name:"" \};/.test(app)) problems.push("apps/companion/index.html — public CLIENT name is not blank");

if(problems.length){
  console.error("Public-repository guard failed:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("public-repository guard passed");
