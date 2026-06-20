import { CLUBS, type Club, type Shot } from "../types";

// Fallback reference ball speed (km/h) per club — a mid-handicap baseline, used
// only for clubs the player has too few shots of (cold start).
const REF_BALL: Record<Club, number> = {
  Dr: 210, "3W": 195, "5W": 185, Hy: 178, "3i": 172, "4i": 165, "5i": 158,
  "6i": 150, "7i": 142, "8i": 133, "9i": 124, PW: 115, GW: 104, SW: 92, LW: 78,
};

const MIN_SAMPLES = 4;     // shots needed to trust a personal centroid
const DEFAULT_SPREAD = 9;  // km/h, cold-start spread

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Personal per-club model learnt from the player's own shots: a robust ball-speed
 * centroid (median) and spread (MAD) per club. This adapts to *this* player's
 * swing speed, so a naturally fast (or slow) player isn't constantly mis-flagged.
 */
export interface ClubModel {
  centers: Partial<Record<Club, { median: number; spread: number; n: number }>>;
}

export function buildClubModel(shots: Shot[]): ClubModel {
  const byClub = new Map<Club, number[]>();
  for (const s of shots) {
    const arr = byClub.get(s.club) ?? [];
    arr.push(s.ballSpeed);
    byClub.set(s.club, arr);
  }
  const centers: ClubModel["centers"] = {};
  for (const [club, arr] of byClub) {
    const med = median(arr);
    const mad = median(arr.map((x) => Math.abs(x - med)));
    centers[club] = { median: med, spread: Math.max(8, 1.4826 * mad || 8), n: arr.length };
  }
  return { centers };
}

export interface Suspicion {
  suspicious: boolean;
  expected: Club;   // the club the player actually hits at this ball speed
  gap: number;      // clubs apart (tagged vs expected)
  diff: number;     // ball speed − the tagged club's centre (km/h)
}

/**
 * Nearest-centroid check against the player's own model (k-means-style with fixed
 * club labels). A shot is suspect when it sits far from its tagged club's personal
 * cluster *and* clearly inside another club's cluster two or more positions away —
 * i.e. the metrics say a different club than the one recorded.
 */
export function clubSuspicion(shot: Shot, model?: ClubModel): Suspicion {
  const center = (c: Club) => {
    const m = model?.centers[c];
    return m && m.n >= MIN_SAMPLES ? m.median : REF_BALL[c];
  };
  const spread = (c: Club) => {
    const m = model?.centers[c];
    return m && m.n >= MIN_SAMPLES ? m.spread : DEFAULT_SPREAD;
  };

  let expected: Club = shot.club, bd = Infinity;
  for (const c of CLUBS) {
    const d = Math.abs(center(c) - shot.ballSpeed);
    if (d < bd) { bd = d; expected = c; }
  }

  const taggedDist = Math.abs(shot.ballSpeed - center(shot.club));
  const expectedDist = Math.abs(shot.ballSpeed - center(expected));
  const z = taggedDist / spread(shot.club);                  // distance in personal spreads
  const gap = Math.abs(CLUBS.indexOf(shot.club) - CLUBS.indexOf(expected));

  const suspicious =
    gap >= 2 &&
    z > 2.5 &&                                               // far from its own cluster
    taggedDist - expectedDist > spread(shot.club) * 0.9;     // clearly closer to another

  return { suspicious, expected, gap, diff: shot.ballSpeed - center(shot.club) };
}
