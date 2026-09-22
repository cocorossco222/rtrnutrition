#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "apps", "companion");
const OUT = path.join(ROOT, "dist", "companion");

fs.rmSync(OUT, {recursive:true, force:true});
fs.mkdirSync(path.join(OUT, "icons"), {recursive:true});
for(const file of ["index.html", "manifest.webmanifest"]){
  fs.copyFileSync(path.join(SRC,file), path.join(OUT,file));
}
for(const file of fs.readdirSync(path.join(SRC,"icons"))){
  if(file.endsWith(".png")) fs.copyFileSync(path.join(SRC,"icons",file), path.join(OUT,"icons",file));
}
console.log("staged static Companion in dist/companion");
