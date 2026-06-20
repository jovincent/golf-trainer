import type { Club, Shot } from "../types";
import { CLUBS } from "../types";

export const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/**
 * Mean of the best `frac` of values — a "representative best", NOT the single
 * top shot. At least 2 values define it (when available), so one freak strike
 * can't set your "optimal" number.
 */
export const topMean = (xs: number[], frac = 0.3) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.min(s.length, Math.max(2, Math.round(s.length * frac)));
  return mean(s.slice(s.length - k));
};

/**
 * Mishit detection = multivariate outlier detection per club. We cluster a
 * club's shots in feature space (smash, carry, deviation, launch, spin), using a
 * ROBUST centre (median) and ROBUST scale (MAD) per feature, then score each
 * shot's distance to that cluster (an RMS robust z-score — a diagonal, robust
 * Mahalanobis). Shots too far from the cluster are outliers = mishits.
 *
 * The reference is the cluster itself, so a consistent bias (e.g. you always
 * fade 15 m right) is "in cluster" and not flagged — only genuinely off shots
 * are. Median/MAD are robust, so the mishits don't move the cluster.
 */
export const MISHIT = {
  minN: 5,            // need a few balls before a cluster is meaningful
  threshold: 2.2,     // RMS robust-z beyond this → outlier
  maxFrac: 0.4,       // never flag more than this share of a club's shots
};

/**
 * Features that define a clean strike. `lowOnly` features (smash) only count
 * when BELOW the cluster — a great strike (high smash) is never a mishit.
 */
const MISHIT_FEATURES: Array<{ get: (s: Shot) => number; lowOnly?: boolean }> = [
  { get: (s) => s.smashFactor, lowOnly: true }, // contact quality (low = bad)
  { get: (s) => s.carry },                      // distance consistency
  { get: (s) => s.offlineM },                   // trajectory dispersion
  { get: (s) => s.launchAngle },                // strike consistency
  { get: (s) => s.backSpin },                   // strike consistency
  { get: (s) => s.sideSpin },                   // curve / dispersion
];

/**
 * Split a club's shots into clean strikes and mishits via cluster-distance.
 * Works on real R10 data too (no "miss" flag exists). Never empties the clean
 * set, and caps the share it will flag.
 */
export function detectMishits(shots: Shot[]): { clean: Shot[]; mishits: Shot[] } {
  if (shots.length < MISHIT.minN) return { clean: shots, mishits: [] };

  // Robust centre (median) + scale (1.4826·MAD, with a relative floor) per feature.
  const stats = MISHIT_FEATURES.map((f) => {
    const xs = shots.map(f.get);
    const med = median(xs);
    const mad = median(xs.map((x) => Math.abs(x - med)));
    const scale = Math.max(1.4826 * mad, Math.abs(med) * 0.04, 1e-6);
    return { f, med, scale };
  });

  // Distance of each shot to the cluster centre (RMS of robust z-scores).
  const dist = shots.map((s) => {
    let sumSq = 0;
    for (const { f, med, scale } of stats) {
      let z = (f.get(s) - med) / scale;
      if (f.lowOnly) z = Math.max(0, -z); // penalise only the low side
      sumSq += z * z;
    }
    return Math.sqrt(sumSq / stats.length);
  });

  // Flag those past the threshold, most-distant first, capped at maxFrac.
  const cap = Math.floor(shots.length * MISHIT.maxFrac);
  const flagged = new Set(
    shots
      .map((_, i) => i)
      .filter((i) => dist[i] > MISHIT.threshold)
      .sort((a, b) => dist[b] - dist[a])
      .slice(0, cap),
  );

  const clean: Shot[] = [];
  const mishits: Shot[] = [];
  shots.forEach((s, i) => (flagged.has(i) ? mishits : clean).push(s));
  return clean.length ? { clean, mishits } : { clean: shots, mishits: [] };
}

export interface ClubAgg {
  club: Club;
  n: number;            // total balls hit with this club
  nClean: number;       // balls counted in the stats below
  nMishit: number;      // identified mishits (counted, excluded from stats)
  carry: number;        // mean (clean only)
  carryOptimal: number; // representative-best (top-share mean, clean only)
  carryMed: number;
  total: number;
  ball: number;
  smash: number;
  spin: number;
  launch: number;
  carrySd: number;      // consistency
  offlineSd: number;    // dispersion (m)
  clean: Shot[];
  mishits: Shot[];
}

/**
 * Aggregate shots by club, long → short. All distance/quality stats are over
 * CLEAN shots only; mishits are detected, counted, and kept aside (not mixed in).
 */
export function aggregateByClub(shots: Shot[]): ClubAgg[] {
  const byClub = new Map<Club, Shot[]>();
  for (const s of shots) {
    const arr = byClub.get(s.club) ?? [];
    arr.push(s);
    byClub.set(s.club, arr);
  }
  return CLUBS.flatMap((club) => {
    const cs = byClub.get(club);
    if (!cs || !cs.length) return [];
    const { clean, mishits } = detectMishits(cs);
    return [{
      club,
      n: cs.length,
      nClean: clean.length,
      nMishit: mishits.length,
      carry: mean(clean.map((s) => s.carry)),
      carryOptimal: topMean(clean.map((s) => s.carry)),
      carryMed: median(clean.map((s) => s.carry)),
      total: mean(clean.map((s) => s.total)),
      ball: mean(clean.map((s) => s.ballSpeed)),
      smash: mean(clean.map((s) => s.smashFactor)),
      spin: mean(clean.map((s) => s.backSpin)),
      launch: mean(clean.map((s) => s.launchAngle)),
      carrySd: sd(clean.map((s) => s.carry)),
      offlineSd: sd(clean.map((s) => s.offlineM)),
      clean,
      mishits,
    }];
  });
}

export interface Gap {
  fromClub: Club;
  toClub: Club;
  gap: number;          // m, carry difference
  flag: "tight" | "ok" | "wide";
}

/** Carry gaps between consecutive clubs you actually hit. */
export function clubGaps(aggs: ClubAgg[]): Gap[] {
  const out: Gap[] = [];
  for (let i = 0; i < aggs.length - 1; i++) {
    const gap = aggs[i].carry - aggs[i + 1].carry;
    out.push({
      fromClub: aggs[i].club,
      toClub: aggs[i + 1].club,
      gap,
      flag: gap < 6 ? "tight" : gap > 18 ? "wide" : "ok",
    });
  }
  return out;
}
