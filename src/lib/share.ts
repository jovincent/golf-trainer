// ---- Social sharing — immutable snapshots --------------------------------------
// A share is a self-contained snapshot of a round / session / combine, frozen at
// share time. The public page never touches the DB or the live profile, so a
// shared card keeps showing the same numbers even if the user later edits or
// deletes the source. Each builder also pre-computes the "hero" values the
// templates show big, so the public renderer stays dumb.

import type { Session, Shot } from "../types";
import type { Round } from "./course";
import { scoreName } from "./course";
import { aggregateByClub, mean } from "./stats";
import {
  combineScore, gradeLabel, stationLabel,
  type CombineResult,
} from "./combine";

export type ShareKind = "round" | "session" | "combine" | "stats";

export interface ShareEnvelope {
  kind: ShareKind;
  player: string;
  createdAt: number;
  data: RoundShareData | SessionShareData | CombineShareData | StatsShareData;
}

// ---- Round (scorecard) ---------------------------------------------------------

export interface RoundShareData {
  course: string;
  playedAt: number;
  par: number;
  strokes: number;
  vsPar: number;
  holes: { number: number; par: number; strokes: number }[];
  counts: { eagles: number; birdies: number; pars: number; bogeys: number; others: number };
  girPct: number | null;
  firPct: number | null;
  avgPutts: number | null;
  best: { number: number; label: string } | null; // best hole vs par
}

export function buildRoundShare(round: Round, course: string, player: string): ShareEnvelope {
  const holes = round.holes.map((h) => ({ number: h.number, par: h.par, strokes: h.strokes }));
  const counts = { eagles: 0, birdies: 0, pars: 0, bogeys: 0, others: 0 };
  let best: { number: number; diff: number } | null = null;
  for (const h of round.holes) {
    const d = h.strokes - h.par;
    if (d <= -2) counts.eagles++;
    else if (d === -1) counts.birdies++;
    else if (d === 0) counts.pars++;
    else if (d === 1) counts.bogeys++;
    else counts.others++;
    if (!best || d < best.diff) best = { number: h.number, diff: d };
  }

  let girY = 0, girT = 0, firY = 0, firT = 0, putts = 0, puttsT = 0;
  for (const h of round.holes) {
    if (typeof h.gir === "boolean") { girT++; if (h.gir) girY++; }
    if (h.fairwayHit === true || h.fairwayHit === false) { firT++; if (h.fairwayHit) firY++; }
    if (typeof h.putts === "number") { putts += h.putts; puttsT++; }
  }

  const data: RoundShareData = {
    course,
    playedAt: round.startedAt,
    par: round.coursePar,
    strokes: round.totalStrokes,
    vsPar: round.totalStrokes - round.coursePar,
    holes,
    counts,
    girPct: girT ? (girY / girT) * 100 : null,
    firPct: firT ? (firY / firT) * 100 : null,
    avgPutts: puttsT ? putts / puttsT : null,
    best: best ? { number: best.number, label: scoreName(round.holes[best.number - 1]?.strokes ?? 0, round.holes[best.number - 1]?.par ?? 0) } : null,
  };
  return { kind: "round", player, createdAt: Date.now(), data };
}

// ---- Session (practice) --------------------------------------------------------

export interface SessionShareData {
  label: string;
  playedAt: number;
  balls: number;
  clubsUsed: number;
  totalCarry: number;            // sum of carries (m)
  longest: { carry: number; total: number; club: string } | null;
  bestSmash: { smash: number; club: string } | null;
  topBallSpeed: { speed: number; club: string } | null;
  bars: { club: string; carry: number; n: number }[]; // long → short
}

export function buildSessionShare(session: Session, player: string): ShareEnvelope {
  const shots = session.shots;
  const aggs = aggregateByClub(shots);
  const pick = (arr: Shot[], key: (s: Shot) => number): Shot | null =>
    arr.length ? arr.reduce((best, s) => (key(s) > key(best) ? s : best)) : null;

  const longShot = pick(shots, (s) => s.carry);
  const smashShot = pick(shots, (s) => s.smashFactor);
  const speedShot = pick(shots, (s) => s.ballSpeed);

  const data: SessionShareData = {
    label: session.label,
    playedAt: session.startedAt,
    balls: shots.length,
    clubsUsed: aggs.length,
    totalCarry: shots.reduce((a, s) => a + s.carry, 0),
    longest: longShot ? { carry: longShot.carry, total: longShot.total, club: longShot.club } : null,
    bestSmash: smashShot ? { smash: smashShot.smashFactor, club: smashShot.club } : null,
    topBallSpeed: speedShot ? { speed: speedShot.ballSpeed, club: speedShot.club } : null,
    bars: aggs.map((a) => ({ club: a.club, carry: a.carry, n: a.n })),
  };
  return { kind: "session", player, createdAt: Date.now(), data };
}

// ---- Combine -------------------------------------------------------------------

export interface CombineShareData {
  playedAt: number;
  score: number;
  grade: string;
  balls: number;
  stations: { label: string; avg: number }[];
  best: { label: string; avg: number } | null;
}

export function buildCombineShare(combine: CombineResult, player: string): ShareEnvelope {
  const score = combine.score || combineScore(combine.stations);
  const stations = combine.stations.map((s) => ({
    label: stationLabel(s.target),
    avg: s.shots.length ? s.shots.reduce((a, x) => a + x.score, 0) / s.shots.length : 0,
  }));
  const balls = combine.stations.reduce((n, s) => n + s.shots.length, 0);
  const best = stations.length ? stations.reduce((b, s) => (s.avg > b.avg ? s : b)) : null;

  const data: CombineShareData = {
    playedAt: combine.startedAt,
    score,
    grade: gradeLabel(score).label,
    balls,
    stations,
    best,
  };
  return { kind: "combine", player, createdAt: Date.now(), data };
}

// ---- Stats (all-time bag profile) ----------------------------------------------

export interface StatsShareData {
  generatedAt: number;
  balls: number;
  clubs: number;
  topClub: { club: string; carry: number; smash: number; ball: number } | null;
  bestSmash: { smash: number; club: string } | null;
  avgSmash: number;
  tightest: { club: string; sd: number } | null; // most consistent club
  // Per-club breakdown, long → short. dispPct = lateral dispersion as % of carry.
  bars: {
    club: string; carry: number; sd: number; n: number;
    clubSpeed: number; ballSpeed: number; smash: number; dispPct: number;
  }[];
}

export function buildStatsShare(shots: Shot[], player: string): ShareEnvelope {
  const aggs = aggregateByClub(shots);
  const clean = aggs.flatMap((a) => a.clean);
  const topClub = aggs.length ? aggs.reduce((b, a) => (a.carry > b.carry ? a : b)) : null;
  const smashShot = shots.length ? shots.reduce((b, s) => (s.smashFactor > b.smashFactor ? s : b)) : null;
  const tight = aggs.filter((a) => a.nClean >= 3);
  const tightest = tight.length ? tight.reduce((b, a) => (a.carrySd < b.carrySd ? a : b)) : null;

  const data: StatsShareData = {
    generatedAt: Date.now(),
    balls: shots.length,
    clubs: aggs.length,
    topClub: topClub ? { club: topClub.club, carry: topClub.carry, smash: topClub.smash, ball: topClub.ball } : null,
    bestSmash: smashShot ? { smash: smashShot.smashFactor, club: smashShot.club } : null,
    avgSmash: clean.length ? mean(clean.map((s) => s.smashFactor)) : 0,
    tightest: tightest ? { club: tightest.club, sd: tightest.carrySd } : null,
    bars: aggs.map((a) => ({
      club: a.club, carry: a.carry, sd: a.carrySd, n: a.n,
      clubSpeed: a.clean.length ? mean(a.clean.map((s) => s.clubSpeed)) : a.ball / (a.smash || 1),
      ballSpeed: a.ball,
      smash: a.smash,
      dispPct: a.carry > 0 ? (a.offlineSd / a.carry) * 100 : 0,
    })),
  };
  return { kind: "stats", player, createdAt: Date.now(), data };
}

// ---- Helpers -------------------------------------------------------------------

export function shareUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/s/${token}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
