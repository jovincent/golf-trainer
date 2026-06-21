// Per-shot decision tree: given the club + measured values, rate each metric
// good / ok / bad and produce plain-language "what's good / what to fix".

import type { Club, Shot } from "../types";

export type Rating = "good" | "ok" | "bad";

// Ideal launch window per club (the "good" band). Launch angle ° rises and spin
// climbs from driver → wedge; angle of attack goes from hitting up (driver) to a
// descending strike (irons/wedges). Smash = [okMin, goodMin] (contact quality).
interface Ideal {
  launch: [number, number];  // deg
  spin: [number, number];    // rpm backspin
  attack: [number, number];  // deg (+ up)
  smash: [number, number];   // [okMin, goodMin]
}
// Smash bands [okMin, goodMin] follow the published typical-smash-by-club table:
// being inside the typical range = "pur", just below = "correct", well below =
// "décentré". Missing clubs are interpolated between the table's anchor clubs.
const IDEAL: Record<Club, Ideal> = {
  Dr:   { launch: [12, 16],  spin: [2000, 3000],  attack: [0, 5],      smash: [1.41, 1.45] },
  "3W": { launch: [10, 15],  spin: [2800, 3800],  attack: [-3, 1],     smash: [1.38, 1.42] },
  "4W": { launch: [10, 15],  spin: [2900, 3900],  attack: [-3, 1],     smash: [1.37, 1.41] },
  "5W": { launch: [11, 16],  spin: [3200, 4200],  attack: [-3.5, 0],   smash: [1.37, 1.41] },
  "7W": { launch: [11, 16],  spin: [3300, 4300],  attack: [-3.5, 0],   smash: [1.36, 1.40] },
  Hy:   { launch: [12, 17],  spin: [3500, 4600],  attack: [-4, -1],    smash: [1.36, 1.40] },
  "1i": { launch: [11, 16],  spin: [3000, 4100],  attack: [-3, 0],     smash: [1.35, 1.39] },
  "2i": { launch: [12, 17],  spin: [3400, 4500],  attack: [-3.5, -1],  smash: [1.34, 1.38] },
  "3i": { launch: [13, 18],  spin: [3800, 4900],  attack: [-4, -1.5],  smash: [1.34, 1.38] },
  "4i": { launch: [14, 19],  spin: [4200, 5300],  attack: [-4, -2],    smash: [1.33, 1.37] },
  "5i": { launch: [15, 20],  spin: [4600, 5800],  attack: [-4.5, -2],  smash: [1.31, 1.35] },
  "6i": { launch: [16, 21],  spin: [5200, 6400],  attack: [-4.5, -2.5],smash: [1.29, 1.33] },
  "7i": { launch: [17, 23],  spin: [5800, 7000],  attack: [-5, -2.5],  smash: [1.26, 1.30] },
  "8i": { launch: [19, 25],  spin: [6600, 7900],  attack: [-5, -3],    smash: [1.24, 1.28] },
  "9i": { launch: [22, 28],  spin: [7400, 8800],  attack: [-5.5, -3],  smash: [1.21, 1.25] },
  PW:   { launch: [24, 31],  spin: [8200, 9600],  attack: [-6, -3],    smash: [1.16, 1.20] },
  GW:   { launch: [26, 33],  spin: [8800, 10400], attack: [-6, -3.5],  smash: [1.13, 1.17] },
  SW:   { launch: [28, 36],  spin: [9200, 11000], attack: [-6, -4],    smash: [1.09, 1.13] },
  LW:   { launch: [30, 40],  spin: [9500, 11800], attack: [-6.5, -4],  smash: [1.05, 1.09] },
};

// How far beyond the "good" band still counts as "ok" (per metric).
const OK_MARGIN = { launch: 4, spin: 1200, attack: 3 };

interface Ranges {
  smash: [number, number];
  launch: [number, number, number, number];
  spin: [number, number, number, number];
  attack: [number, number, number, number];
}
function rangesFor(club: Club): Ranges {
  const i = IDEAL[club];
  const widen = (g: [number, number], m: number): [number, number, number, number] =>
    [g[0], g[1], g[0] - m, g[1] + m];
  return {
    smash: i.smash,
    launch: widen(i.launch, OK_MARGIN.launch),
    spin: widen(i.spin, OK_MARGIN.spin),
    attack: widen(i.attack, OK_MARGIN.attack),
  };
}

const band = (v: number, [gLo, gHi, oLo, oHi]: [number, number, number, number]): Rating =>
  v >= gLo && v <= gHi ? "good" : v >= oLo && v <= oHi ? "ok" : "bad";
const smashRate = (v: number, [okMin, goodMin]: [number, number]): Rating =>
  v >= goodMin ? "good" : v >= okMin ? "ok" : "bad";
const absBand = (v: number, good: number, ok: number): Rating =>
  Math.abs(v) <= good ? "good" : Math.abs(v) <= ok ? "ok" : "bad";

export interface ShotEval {
  ratings: Partial<Record<"smash" | "launch" | "spin" | "attack" | "faceToPath" | "clubPath", Rating>>;
  good: string[];
  bad: string[];
}

const lr = (v: number) => (v >= 0 ? "right" : "left");

export function evaluateShot(shot: Shot): ShotEval {
  const r = rangesFor(shot.club);
  const ratings: ShotEval["ratings"] = {};
  const good: string[] = [];
  const bad: string[] = [];

  // Smash (contact quality) — only low is a problem.
  ratings.smash = smashRate(shot.smashFactor, r.smash);
  if (ratings.smash === "good") good.push(`Pure contact (smash ${shot.smashFactor.toFixed(2)})`);
  else if (ratings.smash === "bad") bad.push(`Off-center contact — low smash ${shot.smashFactor.toFixed(2)} (aim for the center of the face)`);

  // Launch angle.
  ratings.launch = band(shot.launchAngle, r.launch);
  if (ratings.launch === "good") good.push(`Ideal launch angle (${shot.launchAngle.toFixed(0)}°)`);
  else if (ratings.launch === "bad")
    bad.push(shot.launchAngle < r.launch[0]
      ? `Launch too low (${shot.launchAngle.toFixed(0)}°)`
      : `Launch too high (${shot.launchAngle.toFixed(0)}°)`);

  // Backspin.
  ratings.spin = band(shot.backSpin, r.spin);
  if (ratings.spin === "good") good.push(`Ideal backspin (${shot.backSpin.toFixed(0)} rpm)`);
  else if (ratings.spin === "bad")
    bad.push(shot.backSpin < r.spin[0]
      ? `Low backspin (${shot.backSpin.toFixed(0)} rpm) — lack of lift`
      : `High backspin (${shot.backSpin.toFixed(0)} rpm) — distance loss`);

  // Attack angle.
  ratings.attack = band(shot.attackAngle, r.attack);
  if (ratings.attack === "good") good.push(`Good angle of attack (${shot.attackAngle >= 0 ? "+" : ""}${shot.attackAngle.toFixed(1)}°)`);
  else if (ratings.attack === "bad")
    bad.push(shot.attackAngle < r.attack[2]
      ? `Attack too steep/descending (${shot.attackAngle.toFixed(1)}°)`
      : (shot.club === "Dr"
        ? `Downward strike with driver (${shot.attackAngle.toFixed(1)}°) — try to hit up on it`
        : `Attack too upward (${shot.attackAngle.toFixed(1)}°) — compress the ball`));

  // Face to path — drives the curve.
  ratings.faceToPath = absBand(shot.faceToPath, 2, 4);
  if (ratings.faceToPath === "good") good.push("Face nearly aligned with path (straight ball)");
  else if (ratings.faceToPath === "bad")
    bad.push(`Face ${shot.faceToPath >= 0 ? "open" : "closed"} by ${Math.abs(shot.faceToPath).toFixed(1)}° → curves ${lr(shot.faceToPath)}`);

  // Club path.
  ratings.clubPath = absBand(shot.clubPath, 3, 6);
  if (ratings.clubPath === "bad")
    bad.push(shot.clubPath >= 0
      ? `Very in-to-out path (+${shot.clubPath.toFixed(1)}°)`
      : `Very out-to-in path (${shot.clubPath.toFixed(1)}°) — slice tendency`);

  return { ratings, good, bad };
}

/** Tailwind text colour for a rating. */
export const ratingColor = (r?: Rating) =>
  r === "good" ? "text-fairway" : r === "bad" ? "text-terracotta" : r === "ok" ? "text-gold" : "text-ink";

// ── Continuous quality → colour (red = bad … blue = good) ─────────────────────
// Drives the live hero stats. `smash`, `launch` and `spin` are scored against the
// club's ideal window (so the colour depends on the club); `offline` is absolute
// (closer to the target line is better).

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 0 (bad) … 1 (good) quality for one hero metric, in the shot's club context. */
export function metricQuality(shot: Shot, metric: "smash" | "launch" | "spin" | "offline"): number {
  if (metric === "offline") return clamp01(1 - Math.abs(shot.offlineM) / 18);

  const r = rangesFor(shot.club);
  if (metric === "smash") {
    const [okMin, goodMin] = r.smash;        // [okMin, goodMin]
    const badLo = okMin - 0.08;              // clearly off-centre below here
    return clamp01((shot.smashFactor - badLo) / (goodMin - badLo));
  }

  // launch / spin: full quality inside the good band, fading to 0 two OK-margins out.
  const [gLo, gHi] = metric === "launch" ? r.launch : r.spin;
  const margin = metric === "launch" ? OK_MARGIN.launch : OK_MARGIN.spin;
  const v = metric === "launch" ? shot.launchAngle : shot.backSpin;
  const dist = v < gLo ? gLo - v : v > gHi ? v - gHi : 0;
  return clamp01(1 - dist / (2 * margin));
}

// Red → amber → teal → blue ramp (FlightLab palette).
const QUALITY_RAMP: Array<[number, [number, number, number]]> = [
  [0.0,  [0xc2, 0x60, 0x3a]], // terracotta — bad
  [0.35, [0xdb, 0x8a, 0x36]], // amber
  [0.6,  [0x3e, 0x8e, 0x7e]], // teal
  [1.0,  [0x2e, 0x5d, 0xa4]], // royal — good
];

/** Map a 0…1 quality to a CSS colour on the red→blue ramp. */
export function qualityColor(q: number): string {
  const t = clamp01(q);
  for (let i = 1; i < QUALITY_RAMP.length; i++) {
    const [p1, c1] = QUALITY_RAMP[i - 1];
    const [p2, c2] = QUALITY_RAMP[i];
    if (t <= p2) {
      const f = (t - p1) / (p2 - p1);
      const ch = (a: number, b: number) => Math.round(a + (b - a) * f);
      return `rgb(${ch(c1[0], c2[0])}, ${ch(c1[1], c2[1])}, ${ch(c1[2], c2[2])})`;
    }
  }
  const [, last] = QUALITY_RAMP[QUALITY_RAMP.length - 1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}
