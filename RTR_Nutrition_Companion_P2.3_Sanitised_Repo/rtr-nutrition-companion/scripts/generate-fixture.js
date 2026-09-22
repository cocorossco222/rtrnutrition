#!/usr/bin/env node
"use strict";
/* Deterministic, entirely synthetic contract fixture. Never seed this from
   a real client export or case history. */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "packages", "contract", "fixtures", "demo-three-weeks.json");
const dates = [
  "2026-08-17","2026-08-18","2026-08-19","2026-08-20","2026-08-21",
  "2026-08-24","2026-08-25","2026-08-26","2026-08-27","2026-08-28",
  "2026-08-31","2026-09-01","2026-09-02","2026-09-03","2026-09-04"
];
const patterns = [
  {meals:"mostly",protein:"some",plants:"some",water:"nearly",gut:"ok",energy:"ok"},
  {meals:"yes",protein:"good",plants:"some",water:"nailed",gut:"good",energy:"good"},
  {meals:"mostly",protein:"good",plants:"plenty",water:"nearly",gut:"good",energy:"ok"}
];
const entries = {};
dates.forEach((d,i) => {
  const p = patterns[i % patterns.length];
  entries[d] = {...p, symptoms:[], note:i===4 ? "Synthetic note for contract coverage." : "", ts:d+"T18:30:00.000Z"};
});

const payload = {
  meta:{
    product:"RTR Nutrition Companion", phase:"Phase 1 · Stabilise", client:"Synthetic Fixture",
    schema:2, app:"p2.3", exported:"2026-09-04T20:00:00.000Z",
    counts:{checkIns:dates.length,bodyChecks:2,weeklyCheckIns:2}
  },
  data:{
    schema:2, v:1,
    profile:{name:"Synthetic Fixture",created:"2026-08-17T08:00:00.000Z",onboarded:true},
    obDraft:null,
    baseline:{date:"2026-08-17T08:00:00.000Z",answers:{q1:2,q2:3,q3:2,q4:3,q5:2,q6:3,q7:2,q8:3,q9:2,q10:3}},
    entries,
    body:{
      "2026-08-23":{weightKg:80,waistCm:90,weightUnit:"kg",waistUnit:"cm",ts:"2026-08-23T09:00:00.000Z",updated:"2026-08-23T09:00:00.000Z"},
      "2026-08-30":{weightKg:79.5,waistCm:89.5,weightUnit:"kg",waistUnit:"cm",ts:"2026-08-30T09:00:00.000Z",updated:"2026-08-30T09:00:00.000Z"}
    },
    sitreps:{
      "2026-08-17":{week:"2026-08-17",best:"water",bestText:"Synthetic weekly reflection A.",hardest:"plants",hardText:"Synthetic weekly reflection B.",gut:"mixed",energy:"updown",improve:"plants",ts:"2026-08-23T19:00:00.000Z"},
      "2026-08-24":{week:"2026-08-24",best:"protein",bestText:"Synthetic weekly reflection C.",hardest:"snacks",hardText:"Synthetic weekly reflection D.",gut:"good",energy:"good",improve:"meals",ts:"2026-08-30T19:00:00.000Z"}
    },
    seen:{hydration:"2026-09-04T08:00:00.000Z"},
    today:{date:"2026-09-04",lessonId:"hydration"},
    coach:[{ts:"2026-08-31T10:00:00.000Z",action:"Continue Stabilise",note:"Synthetic coach note."}],
    prefs:{weightUnit:"kg",waistUnit:"cm"},
    usage:{opens:12,firstOpen:"2026-08-17T08:00:00.000Z",lastOpen:"2026-09-04T20:00:00.000Z",views:{today:12,track:15}},
    insightLog:[{d:"2026-09-04",text:"Synthetic curiosity note for contract coverage.",tone:"neutral"}],
    reportLog:[], defer:{}, phase:{key:"stabilise",name:"Stabilise",locked:true}
  }
};

fs.writeFileSync(OUT, JSON.stringify(payload,null,2)+"\n");
console.log("wrote " + path.relative(process.cwd(),OUT));
