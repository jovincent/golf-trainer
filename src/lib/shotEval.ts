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
  "5W": { launch: [11, 16],  spin: [3200, 4200],  attack: [-3.5, 0],   smash: [1.37, 1.41] },
  Hy:   { launch: [12, 17],  spin: [3500, 4600],  attack: [-4, -1],    smash: [1.36, 1.40] },
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
