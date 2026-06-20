// Validate the flight model against a Garmin export that HAS measured carry/
// total/apex, then report per-club bias so we can recalibrate.
//   node scripts/validateModel.mjs [file.csv]

import { readFileSync } from "node:fs";
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { applyFlight } = await import("../src/lib/flight.ts");

const FILE = process.argv[2] || "/Users/jonathanvincent/Downloads/DrivingRange-2026-06-15 12:29:44 +0000.csv";

const CLUB_MAP = {
  "Driver": "Dr", "Bois 3": "3W", "Bois 5": "5W",
  "Hybride 2": "Hy", "Hybride 3": "Hy", "Hybride 4": "Hy", "Hybride 5": "Hy", "Hybride": "Hy",
  "Fer 3": "3i", "Fer 4": "4i", "Fer 5": "5i", "Fer 6": "6i", "Fer 7": "7i", "Fer 8": "8i", "Fer 9": "9i",
  "Pitching Wedge": "PW", "Pitch": "PW", "Pitching": "PW", "PW": "PW", "Gap Wedge": "GW", "Sand Wedge": "SW", "Lob Wedge": "LW",
};
const num = (v) => { v = (v ?? "").trim(); if (v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

const COL = { date: 0, clubType: 4, clubSpeed: 5, ball: 10, smash: 11, launch: 12, dir: 13, back: 14, side: 15, spinAxis: 18, apex: 19, carry: 20, total: 23 };

// Clean-strike smash floor per club (exclude mishits from the fit).
const SMASH_FLOOR = { Dr: 1.35, "3W": 1.33, "5W": 1.32, Hy: 1.33, "7i": 1.30, PW: 1.20, GW: 1.18, SW: 1.12 };

const lines = readFileSync(FILE, "utf8").split(/\r?\n/);
const shots = [];
for (let i = 2; i < lines.length; i++) {
  const c = lines[i].split(",");
  if (c.length < 24) continue;
  const club = CLUB_MAP[(c[COL.clubType] ?? "").trim()];
  const ball = num(c[COL.ball]), carry = num(c[COL.carry]);
  if (!club || ball == null || carry == null) continue;
  shots.push({
    club, ball, smash: num(c[COL.smash]),
    launch: num(c[COL.launch]) ?? 15, dir: num(c[COL.dir]) ?? 0,
    back: num(c[COL.back]) ?? 3000, side: num(c[COL.side]) ?? 0, spinAxis: num(c[COL.spinAxis]) ?? 0,
    mCarry: carry, mTotal: num(c[COL.total]), mApex: num(c[COL.apex]),
  });
}

function predict(s) {
  return applyFlight({
    id: "x", ts: 0, club: s.club, ballSpeed: s.ball, clubSpeed: s.ball / (s.smash || 1.4),
    smashFactor: s.smash ?? 1.4, launchAngle: s.launch, launchDir: s.dir, attackAngle: 0,
    clubPath: 0, clubFace: 0, faceToPath: 0, backSpin: s.back, sideSpin: s.side, spinAxis: s.spinAxis,
    carry: 0, total: 0, apex: 0, offlineM: 0, carryDeviation: 0, sim: false,
  });
}

const byClub = new Map();
for (const s of shots) (byClub.get(s.club) ?? byClub.set(s.club, []).get(s.club)).push(s);

console.log(`Validation sur ${shots.length} tirs mesurés · modèle "calibrated"\n`);
console.log("club  n(clean)  carry mes.  carry préd.  biais   MAE   RMSE   ratio(med)   apex mes/préd");
const allErr = [];
const fit = {};
for (const [club, ss] of byClub) {
  const clean = ss.filter((s) => (s.smash ?? 0) >= (SMASH_FLOOR[club] ?? 1.2));
  const use = clean.length >= 3 ? clean : ss;
  const rows = use.map((s) => {
    const p = predict(s);
    return { mCarry: s.mCarry, pCarry: p.carry, mApex: s.mApex, pApex: p.apex, mTotal: s.mTotal, pTotal: p.total };
  });
  const err = rows.map((r) => r.pCarry - r.mCarry);
  allErr.push(...err);
  const ratio = median(rows.map((r) => r.mCarry / r.pCarry));
  fit[club] = ratio;
  const mae = mean(err.map(Math.abs)), rmse = Math.sqrt(mean(err.map((e) => e * e)));
  const apexM = mean(rows.map((r) => r.mApex).filter((v) => v != null));
  const apexP = mean(rows.map((r) => r.pApex));
  console.log(
    `${club.padEnd(4)} ${String(use.length).padStart(4)}/${String(ss.length).padEnd(3)}` +
    `  ${mean(rows.map((r) => r.mCarry)).toFixed(1).padStart(8)} m` +
    `  ${mean(rows.map((r) => r.pCarry)).toFixed(1).padStart(8)} m` +
    `  ${(mean(err) >= 0 ? "+" : "") + mean(err).toFixed(1).padStart(5)}` +
    `  ${mae.toFixed(1).padStart(4)}  ${rmse.toFixed(1).padStart(4)}` +
    `   ×${ratio.toFixed(3)}` +
    `   ${apexM.toFixed(1)}/${apexP.toFixed(1)} m`,
  );
}
const mae = mean(allErr.map(Math.abs)), rmse = Math.sqrt(mean(allErr.map((e) => e * e)));
console.log(`\nGLOBAL carry  MAE ${mae.toFixed(2)} m · RMSE ${rmse.toFixed(2)} m · biais ${(mean(allErr) >= 0 ? "+" : "") + mean(allErr).toFixed(2)} m`);

// Suggested new per-club trim = current_trim × ratio (GLOBAL kept at 0.9).
const TRIM = { Dr: 1.0, "3W": 1.05, "5W": 1.05, Hy: 1.02, "3i": 0.96, "4i": 0.95, "5i": 0.93, "6i": 0.92, "7i": 0.92, "8i": 0.92, "9i": 0.92, PW: 0.93, GW: 0.93, SW: 0.93, LW: 0.93 };
console.log("\nTRIM suggéré (= TRIM actuel × ratio médian) :");
for (const club of Object.keys(fit)) {
  console.log(`  ${club.padEnd(4)} ${TRIM[club].toFixed(3)} → ${(TRIM[club] * fit[club]).toFixed(3)}`);
}
