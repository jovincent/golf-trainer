// One-off importer for Garmin "DrivingRange" CSV exports.
// The exports carry the launch metrics but leave carry/total/apex/deviation
// EMPTY — we fill them with the app's own flight model (applyFlight), then save
// the shots as session(s) under a profile via the running API.
//
//   node scripts/importGarmin.mjs            # dry-run: parse + compute, print summary
//   node scripts/importGarmin.mjs --commit   # also POST to the API

import { readFileSync } from "node:fs";

// applyFlight reads localStorage for the model selector → shim before import.
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { applyFlight } = await import("../src/lib/flight.ts");

const API = process.env.API || `http://localhost:${process.env.API_PORT || 4141}`;
const COMMIT = process.argv.includes("--commit");

// Deterministic session/shot ids (from timestamps) make re-running idempotent —
// the first two files simply REPLACE their existing rows.
const FILES = [
  { path: "/Users/jonathanvincent/Downloads/DrivingRange-2026-06-15 11:58:01 +0000.csv", tag: "Driver" },
  { path: "/Users/jonathanvincent/Downloads/DrivingRange-2026-06-15 11:57:13 +0000.csv", tag: "Fers / hybride" },
  { path: "/Users/jonathanvincent/Downloads/DrivingRange-2026-06-15 12:29:44 +0000.csv", tag: "Practice mixte" },
];

const CLUB_MAP = {
  "Driver": "Dr", "Bois 3": "3W", "Bois 5": "5W", "Bois 7": "5W",
  "Hybride 2": "Hy", "Hybride 3": "Hy", "Hybride 4": "Hy", "Hybride 5": "Hy", "Hybride": "Hy",
  "Fer 3": "3i", "Fer 4": "4i", "Fer 5": "5i", "Fer 6": "6i", "Fer 7": "7i", "Fer 8": "8i", "Fer 9": "9i",
  "Pitching Wedge": "PW", "Pitch": "PW", "Pitching": "PW", "PW": "PW",
  "Gap Wedge": "GW", "Gap": "GW", "Sand Wedge": "SW", "Sand": "SW", "Lob Wedge": "LW", "Lob": "LW",
};

const num = (v) => { v = (v ?? "").trim(); if (v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function parseTs(s) {
  const m = (s ?? "").trim().match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, dd, MM, yyyy, h, mi, se] = m;
  return new Date(+yyyy, +MM - 1, +dd, +h, +mi, +se).getTime();
}

// Column indices (0-based) in the Garmin export.
const COL = {
  date: 0, clubType: 4, clubSpeed: 5, attack: 6, path: 7, face: 8, f2p: 9,
  ball: 10, smash: 11, launch: 12, dir: 13, back: 14, side: 15, spinAxis: 18,
};

function parseFile(path) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const rows = [];
  for (let i = 2; i < lines.length; i++) {            // skip header + units rows
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const c = line.split(",");
    if (c.length < 19) continue;
    const club = CLUB_MAP[(c[COL.clubType] ?? "").trim()];
    const ball = num(c[COL.ball]);
    const ts = parseTs(c[COL.date]);
    if (!club || ball == null || ts == null) continue; // not a usable shot
    rows.push({
      ts, club, ball,
      clubSpeed: num(c[COL.clubSpeed]), smash: num(c[COL.smash]),
      launch: num(c[COL.launch]), dir: num(c[COL.dir]),
      back: num(c[COL.back]), side: num(c[COL.side]),
      attack: num(c[COL.attack]), path: num(c[COL.path]),
      face: num(c[COL.face]), f2p: num(c[COL.f2p]), spinAxis: num(c[COL.spinAxis]),
    });
  }
  return rows;
}

// Per-club means (over present values) to fill the few missing launch/spin/speed.
function clubMeans(rows, key) {
  const by = new Map();
  for (const r of rows) if (r[key] != null) (by.get(r.club) ?? by.set(r.club, []).get(r.club)).push(r[key]);
  const out = new Map();
  for (const [club, xs] of by) out.set(club, mean(xs));
  return out;
}

function buildSession(rows, label, tag) {
  rows.sort((a, b) => a.ts - b.ts);
  const launchM = clubMeans(rows, "launch");
  const speedM = clubMeans(rows, "clubSpeed");
  const backM = clubMeans(rows, "back");

  let filledLaunch = 0, filledSpeed = 0, filledBack = 0;
  const shots = rows.map((r, i) => {
    let launch = r.launch;
    if (launch == null) { launch = launchM.get(r.club) ?? 15; filledLaunch++; }
    let back = r.back;
    if (back == null) { back = backM.get(r.club) ?? 3000; filledBack++; }
    let clubSpeed = r.clubSpeed;
    if (clubSpeed == null && r.smash) clubSpeed = r.ball / r.smash;
    if (clubSpeed == null) { clubSpeed = speedM.get(r.club) ?? r.ball / 1.4; filledSpeed++; }
    let smash = r.smash ?? (clubSpeed ? r.ball / clubSpeed : 1.4);

    const raw = {
      id: `garmin_${r.ts}_${i}`,
      ts: r.ts,
      club: r.club,
      ballSpeed: r.ball,
      clubSpeed,
      smashFactor: smash,
      launchAngle: launch,
      launchDir: r.dir ?? 0,
      attackAngle: r.attack ?? 0,
      clubPath: r.path ?? 0,
      clubFace: r.face ?? 0,
      faceToPath: r.f2p ?? 0,
      backSpin: back,
      sideSpin: r.side ?? 0,
      spinAxis: r.spinAxis ?? 0,
      carry: 0, total: 0, apex: 0, offlineM: 0, carryDeviation: 0,
      sim: false,
    };
    return applyFlight(raw); // fills carry/total/apex/offlineM/carryDeviation
  });

  const startedAt = shots[0].ts;
  const endedAt = shots[shots.length - 1].ts;
  return {
    session: { id: `garmin_${startedAt}`, startedAt, endedAt, label, shots },
    meta: { tag, filledLaunch, filledSpeed, filledBack },
  };
}

const frDate = (ts) =>
  new Date(ts).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

// ---- run ----
const profiles = await (await fetch(`${API}/api/profiles`)).json();
const jonathan = profiles.find((p) => p.name === "Jonathan");
if (!jonathan) { console.error("Profil 'Jonathan' introuvable"); process.exit(1); }

const built = FILES.map(({ path, tag }) => {
  const rows = parseFile(path);
  if (!rows.length) return null;
  const label = `${frDate(rows[0].ts)} · ${tag}`;
  return buildSession(rows, label, tag);
}).filter(Boolean);

console.log(`Profil cible : ${jonathan.name} (${jonathan.id})\n`);
for (const { session, meta } of built) {
  const byClub = new Map();
  for (const s of session.shots) (byClub.get(s.club) ?? byClub.set(s.club, []).get(s.club)).push(s);
  console.log(`■ ${session.label}  —  ${session.shots.length} balles`);
  for (const [club, ss] of byClub) {
    const c = mean(ss.map((s) => s.carry)), t = mean(ss.map((s) => s.total));
    const bs = mean(ss.map((s) => s.ballSpeed)), sm = mean(ss.map((s) => s.smashFactor));
    console.log(`   ${club.padEnd(3)} ×${String(ss.length).padStart(2)}  carry ${c.toFixed(0).padStart(3)} m · total ${t.toFixed(0).padStart(3)} m · ball ${bs.toFixed(0)} km/h · smash ${sm.toFixed(2)}`);
  }
  const fills = [];
  if (meta.filledLaunch) fills.push(`${meta.filledLaunch} angle(s) de tir`);
  if (meta.filledSpeed) fills.push(`${meta.filledSpeed} vitesse(s) club`);
  if (meta.filledBack) fills.push(`${meta.filledBack} backspin`);
  if (fills.length) console.log(`   (estimé par moyenne club : ${fills.join(", ")})`);
  console.log("");
}

if (!COMMIT) { console.log("DRY-RUN — relancer avec --commit pour enregistrer."); process.exit(0); }

const res = await fetch(`${API}/api/sessions/bulk`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sessions: built.map((b) => b.session), profileId: jonathan.id }),
});
console.log(res.ok ? `✅ Enregistré : ${built.length} séance(s) sous ${jonathan.name}.` : `❌ Échec (${res.status})`);
