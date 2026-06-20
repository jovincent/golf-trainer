import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, "fairway.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at   INTEGER,
    label      TEXT NOT NULL,
    profile_id TEXT REFERENCES profiles(id)
  );
  CREATE TABLE IF NOT EXISTS shots (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    ts              INTEGER NOT NULL,
    club            TEXT NOT NULL,
    ball_speed      REAL, club_speed REAL, smash REAL,
    launch_angle    REAL, launch_dir REAL, attack_angle REAL,
    club_path       REAL, club_face REAL, face_to_path REAL,
    backspin        REAL, sidespin REAL, spin_axis REAL,
    carry           REAL, total REAL, apex REAL,
    offline_m       REAL, carry_deviation REAL,
    sim             INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_shots_session ON shots(session_id);

  CREATE TABLE IF NOT EXISTS rounds (
    id              TEXT PRIMARY KEY,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    course_par      INTEGER NOT NULL,
    total_strokes   INTEGER NOT NULL,
    total_mulligans INTEGER NOT NULL,
    holes           TEXT NOT NULL,
    profile_id      TEXT REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS combines (
    id         TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at   INTEGER,
    score      REAL NOT NULL,
    stations   TEXT NOT NULL,
    profile_id TEXT REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS shares (
    token      TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,
    player     TEXT NOT NULL,
    data       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// Migration: add profile_id to pre-existing tables (no-op if already present).
try { db.exec("ALTER TABLE sessions ADD COLUMN profile_id TEXT REFERENCES profiles(id)"); } catch {}
try { db.exec("ALTER TABLE rounds ADD COLUMN profile_id TEXT REFERENCES profiles(id)"); } catch {}

// Seed default profile and migrate orphaned data on first run.
{
  const noProfiles = db.prepare("SELECT COUNT(*) as n FROM profiles").get().n === 0;
  if (noProfiles) {
    const id = `profile_${Date.now()}`;
    db.prepare("INSERT INTO profiles (id, name, created_at) VALUES (?, ?, ?)").run(id, "Joueur 1", Date.now());
    db.prepare("UPDATE sessions SET profile_id = ? WHERE profile_id IS NULL").run(id);
    db.prepare("UPDATE rounds SET profile_id = ? WHERE profile_id IS NULL").run(id);
  }
}

// camelCase (app) ↔ column (db). Single source of truth for shot fields.
const SHOT_MAP = [
  ["id", "id"], ["ts", "ts"], ["club", "club"],
  ["ballSpeed", "ball_speed"], ["clubSpeed", "club_speed"], ["smashFactor", "smash"],
  ["launchAngle", "launch_angle"], ["launchDir", "launch_dir"], ["attackAngle", "attack_angle"],
  ["clubPath", "club_path"], ["clubFace", "club_face"], ["faceToPath", "face_to_path"],
  ["backSpin", "backspin"], ["sideSpin", "sidespin"], ["spinAxis", "spin_axis"],
  ["carry", "carry"], ["total", "total"], ["apex", "apex"],
  ["offlineM", "offline_m"], ["carryDeviation", "carry_deviation"],
];

const insertShotStmt = db.prepare(
  `INSERT OR REPLACE INTO shots
     (${SHOT_MAP.map(([, c]) => c).join(", ")}, session_id, sim)
   VALUES (${SHOT_MAP.map(() => "?").join(", ")}, ?, ?)`,
);

function rowToShot(r) {
  const shot = {};
  for (const [k, c] of SHOT_MAP) shot[k] = r[c];
  shot.sim = !!r.sim;
  return shot;
}

function insertShot(sessionId, shot) {
  const vals = SHOT_MAP.map(([k]) => (k === "club" ? shot[k] : shot[k] ?? null));
  insertShotStmt.run(...vals, sessionId, shot.sim ? 1 : 0);
}

// ---- Public API -------------------------------------------------------------

export function listSessions(profileId) {
  const sessions = profileId
    ? db.prepare("SELECT * FROM sessions WHERE profile_id = ? ORDER BY started_at DESC").all(profileId)
    : db.prepare("SELECT * FROM sessions ORDER BY started_at DESC").all();
  const shotStmt = db.prepare("SELECT * FROM shots WHERE session_id = ? ORDER BY ts ASC");
  return sessions.map((s) => ({
    id: s.id,
    startedAt: s.started_at,
    endedAt: s.ended_at ?? undefined,
    label: s.label,
    shots: shotStmt.all(s.id).map(rowToShot),
  }));
}

const insertSessionStmt = db.prepare(
  "INSERT OR REPLACE INTO sessions (id, started_at, ended_at, label, profile_id) VALUES (?, ?, ?, ?, ?)",
);

/** Create (or replace) a session, optionally with a batch of shots. */
export function createSession(session) {
  const tx = db.prepare("BEGIN");
  try {
    tx.run();
    insertSessionStmt.run(session.id, session.startedAt, session.endedAt ?? null, session.label, session.profileId ?? null);
    for (const shot of session.shots ?? []) insertShot(session.id, shot);
    db.prepare("COMMIT").run();
  } catch (e) {
    db.prepare("ROLLBACK").run();
    throw e;
  }
}

export function appendShot(sessionId, shot) {
  insertShot(sessionId, shot);
}

export function endSession(id, endedAt) {
  db.prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").run(endedAt, id);
}

export function deleteShot(shotId) {
  db.prepare("DELETE FROM shots WHERE id = ?").run(shotId);
}

export function deleteSession(id) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

export function clearSessions() {
  db.exec("DELETE FROM shots; DELETE FROM sessions;");
}

// ---- Rounds (course scorecards) --------------------------------------------

export function listRounds(profileId) {
  const rows = profileId
    ? db.prepare("SELECT * FROM rounds WHERE profile_id = ? ORDER BY started_at DESC").all(profileId)
    : db.prepare("SELECT * FROM rounds ORDER BY started_at DESC").all();
  return rows.map((r) => ({
      id: r.id,
      startedAt: r.started_at,
      endedAt: r.ended_at ?? undefined,
      coursePar: r.course_par,
      totalStrokes: r.total_strokes,
      totalMulligans: r.total_mulligans,
      holes: JSON.parse(r.holes),
    }));
}

export function createRound(round) {
  db.prepare(
    `INSERT OR REPLACE INTO rounds
       (id, started_at, ended_at, course_par, total_strokes, total_mulligans, holes, profile_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    round.id, round.startedAt, round.endedAt ?? null, round.coursePar,
    round.totalStrokes, round.totalMulligans, JSON.stringify(round.holes ?? []),
    round.profileId ?? null,
  );
}

// ---- Profiles ---------------------------------------------------------------

export function listProfiles() {
  return db.prepare("SELECT * FROM profiles ORDER BY created_at ASC").all()
    .map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}

export function createProfile(name) {
  const id = `profile_${Date.now()}`;
  db.prepare("INSERT INTO profiles (id, name, created_at) VALUES (?, ?, ?)").run(id, name, Date.now());
  return { id, name, createdAt: Date.now() };
}

export function updateProfile(id, name) {
  db.prepare("UPDATE profiles SET name = ? WHERE id = ?").run(name, id);
}

export function deleteProfile(id) {
  const sessionIds = db.prepare("SELECT id FROM sessions WHERE profile_id = ?").all(id).map((r) => r.id);
  for (const sid of sessionIds) db.prepare("DELETE FROM shots WHERE session_id = ?").run(sid);
  db.prepare("DELETE FROM sessions WHERE profile_id = ?").run(id);
  db.prepare("DELETE FROM rounds WHERE profile_id = ?").run(id);
  db.prepare("DELETE FROM combines WHERE profile_id = ?").run(id);
  db.prepare("DELETE FROM profiles WHERE id = ?").run(id);
}

export function deleteRound(id) {
  db.prepare("DELETE FROM rounds WHERE id = ?").run(id);
}

// ---- Combines (standardized skill tests) -------------------------------------

export function listCombines(profileId) {
  const rows = profileId
    ? db.prepare("SELECT * FROM combines WHERE profile_id = ? ORDER BY started_at DESC").all(profileId)
    : db.prepare("SELECT * FROM combines ORDER BY started_at DESC").all();
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at ?? undefined,
    score: r.score,
    stations: JSON.parse(r.stations),
  }));
}

export function createCombine(c) {
  db.prepare(
    `INSERT OR REPLACE INTO combines (id, started_at, ended_at, score, stations, profile_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(c.id, c.startedAt, c.endedAt ?? null, c.score, JSON.stringify(c.stations ?? []), c.profileId ?? null);
}

export function deleteCombine(id) {
  db.prepare("DELETE FROM combines WHERE id = ?").run(id);
}

// ---- Shares (public snapshots) -----------------------------------------------

export function createShare(share) {
  db.prepare(
    "INSERT OR REPLACE INTO shares (token, kind, player, data, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(share.token, share.kind, share.player, JSON.stringify(share.data ?? {}), share.createdAt);
}

export function getShare(token) {
  const r = db.prepare("SELECT * FROM shares WHERE token = ?").get(token);
  if (!r) return null;
  return { kind: r.kind, player: r.player, createdAt: r.created_at, data: JSON.parse(r.data) };
}
