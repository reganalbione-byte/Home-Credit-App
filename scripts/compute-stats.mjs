#!/usr/bin/env node
// Stream-parse application_train.csv from Kaggle Home Credit Default Risk
// and emit aggregated statistics to src/lib/kaggleStats.json.
//
// Run from homecredit-ais/ root: `node scripts/compute-stats.mjs`

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, '../../application_train.csv');
const OUT_PATH = resolve(__dirname, '../src/lib/kaggleStats.json');

function parseCSVLine(line) {
  const out = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(field); field = '';
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}

const t0 = Date.now();
const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });

let header = null;
let idx = null;
const eduMap = new Map();
const incMap = new Map();
const regMap = new Map();
const occMap = new Map();
let totalRows = 0, totalDefaults = 0;
let unemployedCount = 0;
let extSum = 0, extCount = 0;
let extSumDefault = 0, extCountDefault = 0;
let stage1 = 0, stage2 = 0, stage3 = 0;
let processed = 0;

for await (const line of rl) {
  if (!header) {
    header = parseCSVLine(line);
    idx = {
      TARGET: header.indexOf('TARGET'),
      AMT_INCOME_TOTAL: header.indexOf('AMT_INCOME_TOTAL'),
      AMT_CREDIT: header.indexOf('AMT_CREDIT'),
      NAME_INCOME_TYPE: header.indexOf('NAME_INCOME_TYPE'),
      NAME_EDUCATION_TYPE: header.indexOf('NAME_EDUCATION_TYPE'),
      OCCUPATION_TYPE: header.indexOf('OCCUPATION_TYPE'),
      DAYS_EMPLOYED: header.indexOf('DAYS_EMPLOYED'),
      REGION_RATING_CLIENT: header.indexOf('REGION_RATING_CLIENT'),
      EXT_SOURCE_2: header.indexOf('EXT_SOURCE_2'),
    };
    continue;
  }
  const cols = parseCSVLine(line);
  if (cols.length < 30) continue;
  const target = +cols[idx.TARGET];
  const income = +cols[idx.AMT_INCOME_TOTAL];
  const credit = +cols[idx.AMT_CREDIT];
  const incType = cols[idx.NAME_INCOME_TYPE] || 'Unknown';
  const edu = cols[idx.NAME_EDUCATION_TYPE] || 'Unknown';
  const occ = cols[idx.OCCUPATION_TYPE] || 'Unknown';
  const daysEmp = +cols[idx.DAYS_EMPLOYED];
  const regRating = +cols[idx.REGION_RATING_CLIENT];
  const extStr = cols[idx.EXT_SOURCE_2];
  const ext = extStr === '' ? NaN : +extStr;

  totalRows++;
  if (target === 1) totalDefaults++;

  const bump = (m, k) => {
    if (!m.has(k)) m.set(k, { t: 0, d: 0 });
    const v = m.get(k); v.t++; if (target === 1) v.d++;
  };
  bump(eduMap, edu);
  bump(incMap, incType);
  bump(regMap, String(regRating));
  bump(occMap, occ);

  if (daysEmp === 365243) unemployedCount++;

  if (!Number.isNaN(ext)) {
    extSum += ext; extCount++;
    if (target === 1) { extSumDefault += ext; extCountDefault++; }
  }

  // PSAK 71 stage approximation (no DPD data in application_train, so we proxy):
  //   Stage 3 (credit-impaired)         = TARGET = 1 (already in default)
  //   Stage 2 (significant risk increase) = non-default but EXT_SOURCE_2 < 0.3 OR credit/income > 8
  //   Stage 1 (performing)              = rest
  if (target === 1) stage3++;
  else {
    const dtiProxy = income > 0 ? credit / income : Infinity;
    if ((!Number.isNaN(ext) && ext < 0.3) || dtiProxy > 8) stage2++;
    else stage1++;
  }

  processed++;
  if (processed % 50000 === 0) {
    process.stdout.write(`  ...${processed.toLocaleString()} rows\n`);
  }
}

const round = (x, d = 4) => +x.toFixed(d);
const pct = (a, b) => (b ? round((a / b) * 100, 2) : 0);

const mapToObj = (m) =>
  Object.fromEntries(
    [...m.entries()].map(([k, v]) => [k, { count: v.t, defaults: v.d, defaultRate: pct(v.d, v.t) }])
  );

const stats = {
  generated: new Date().toISOString(),
  source: 'application_train.csv (Kaggle Home Credit Default Risk)',
  totalRows,
  totalDefaults,
  overallDefaultRate: pct(totalDefaults, totalRows),
  unemploymentRate: pct(unemployedCount, totalRows),
  avgExtScoreAll: round(extSum / extCount, 4),
  avgExtScoreDefault: round(extSumDefault / extCountDefault, 4),
  defaultRateByEducation: mapToObj(eduMap),
  defaultRateByIncomeType: mapToObj(incMap),
  defaultRateByRegionRating: Object.fromEntries(
    [...regMap.entries()]
      .sort((a, b) => +a[0] - +b[0])
      .map(([k, v]) => [k, { count: v.t, defaults: v.d, defaultRate: pct(v.d, v.t) }])
  ),
  defaultRateByOccupation: mapToObj(occMap),
  psak71Stages: {
    stage1: {
      count: stage1,
      pct: pct(stage1, totalRows),
      description: 'Performing — 12-month ECL',
      eclRate: 1.0,
    },
    stage2: {
      count: stage2,
      pct: pct(stage2, totalRows),
      description: 'Significant Increase in Credit Risk — lifetime ECL',
      eclRate: 5.0,
    },
    stage3: {
      count: stage3,
      pct: pct(stage3, totalRows),
      description: 'Credit-Impaired — lifetime ECL',
      eclRate: 45.0,
    },
  },
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(stats, null, 2));
const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nDone in ${dt}s. ${totalRows.toLocaleString()} rows. Output: src/lib/kaggleStats.json`);
console.log(`Overall default rate: ${stats.overallDefaultRate}%`);
console.log(`PSAK 71 — Stage 1: ${stats.psak71Stages.stage1.pct}% | Stage 2: ${stats.psak71Stages.stage2.pct}% | Stage 3: ${stats.psak71Stages.stage3.pct}%`);
