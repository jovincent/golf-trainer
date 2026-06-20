// 18-hole course simulation: dogleg geometry (polyline centreline), hazards
// (sand / water / OB), zone-based putting, and a seeded course generator.
// Pure logic — the UI (Course.tsx) owns the round state machine.

export interface Vec { x: number; y: number }

export type HazardType = "sand" | "water";
export interface Hazard { type: HazardType; cx: number; cy: number; r: number }

export interface Hole {
  number: number;
  par: number;
  name?: string;         // optional hole name (real courses, e.g. "Road", "Tom Morris")
  island?: boolean;      // island green — everything but the green and tee apron is water
  fairwayHalf: number;   // m, half-width of fairway corridor
  greenRadius: number;   // m
  obHalf: number;        // m, beyond this lateral distance from centreline = OB
  centerline: Vec[];     // tee … pin (≥2 points; bends for doglegs)
  hazards: Hazard[];
  wind: { wx: number; wy: number }; // m/s components (wy + = toward the pin)
}

export type Lie =
  | "tee" | "fairway" | "rough" | "sand" | "green" | "water" | "ob" | "holed";

export const LIE_LABEL: Record<Lie, string> = {
  tee: "Départ", fairway: "Fairway", rough: "Rough", sand: "Bunker",
  green: "Green", water: "Eau", ob: "Hors-limite", holed: "Dans le trou",
};

/** Full-swing distance penalty by lie. Bunker −10 %, rough −15 %. */
export const LIE_MULT: Record<Lie, number> = {
  tee: 1, fairway: 1, rough: 0.85, sand: 0.9, green: 1, water: 1, ob: 1, holed: 1,
};

// ---- Geometry ---------------------------------------------------------------

export const teeOf = (h: Hole): Vec => h.centerline[0];
export const pinOf = (h: Hole): Vec => h.centerline[h.centerline.length - 1];
export const distToPin = (p: Vec, h: Hole) => {
  const pin = pinOf(h);
  return Math.hypot(p.x - pin.x, p.y - pin.y);
};

export function pathLength(line: Vec[]) {
  let d = 0;
  for (let i = 1; i < line.length; i++) d += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
  return d;
}

/** Distance from point p to segment a→b. */
function segDist(p: Vec, a: Vec, b: Vec) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const wx = p.x - a.x, wy = p.y - a.y;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/** Min lateral distance from p to the centreline polyline. */
export function lateralOffset(p: Vec, line: Vec[]) {
  let m = Infinity;
  for (let i = 1; i < line.length; i++) m = Math.min(m, segDist(p, line[i - 1], line[i]));
  return m;
}

/** x of the centreline at a given y (linear interpolation between waypoints). */
export function centerXAt(line: Vec[], y: number) {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if ((y >= a.y && y <= b.y) || (y <= a.y && y >= b.y)) {
      const t = b.y === a.y ? 0 : (y - a.y) / (b.y - a.y);
      return a.x + t * (b.x - a.x);
    }
  }
  return line[line.length - 1].x;
}

/** Radius of the dry tee apron on an island hole (short grass around the tee). */
export const teeApronRadius = (h: Hole) => h.fairwayHalf + 6;

export function classifyLie(p: Vec, h: Hole): Lie {
  if (distToPin(p, h) <= h.greenRadius) return "green";
  if (h.island) {
    // Island: only the green and a small tee apron are dry — the rest is water.
    const tee = teeOf(h);
    if (Math.hypot(p.x - tee.x, p.y - tee.y) <= teeApronRadius(h)) return "fairway";
    return "water";
  }
  for (const hz of h.hazards) {
    if (Math.hypot(p.x - hz.cx, p.y - hz.cy) <= hz.r) return hz.type;
  }
  const lat = lateralOffset(p, h.centerline);
  return lat <= h.fairwayHalf ? "fairway" : "rough"; // no out-of-bounds
}

/** Short descriptor: "Par 4 · 360 m · dogleg droite · 2 bunkers · eau". */
export function describeHole(h: Hole): string {
  const parts: string[] = [`Par ${h.par}`, `${Math.round(pathLength(h.centerline))} m`];
  if (h.island) parts.push("green en île");
  if (h.centerline.length > 2) parts.push(pinOf(h).x >= 0 ? "dogleg droite" : "dogleg gauche");
  const sand = h.hazards.filter((z) => z.type === "sand").length;
  if (sand) parts.push(`${sand} bunker${sand > 1 ? "s" : ""}`);
  if (h.hazards.some((z) => z.type === "water")) parts.push("eau");
  return parts.join(" · ");
}

export interface ShotResult {
  ball: Vec;       // resting position after the shot
  lie: Lie;        // lie to play the next shot from
  penalty: number; // penalty strokes added (water / OB)
  event: Lie;      // what happened (for the log)
  landing: Vec;    // where the ball actually flew to (for the trail)
}

/** Resolve a full swing aimed at `aim`, applying lie penalty and hazards. */
export function applyShot(
  ball: Vec,
  shot: { total: number; offlineM: number },
  aim: Vec,
  lie: Lie,
  h: Hole,
): ShotResult {
  const dx = aim.x - ball.x, dy = aim.y - ball.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  // Wind: along-component scales carry (head/tail), cross-component drifts the ball.
  const w = h.wind ?? { wx: 0, wy: 0 };
  const along = w.wx * ux + w.wy * uy;
  const cross = w.wx * px + w.wy * py;
  const advance = shot.total * LIE_MULT[lie] * (1 + along * 0.012);
  const off = shot.offlineM + cross * (advance / 100) * 1.4;
  const to = { x: ball.x + ux * advance + px * off, y: ball.y + uy * advance + py * off };
  const landLie = classifyLie(to, h);

  if (landLie === "water") {
    // Drop on the last dry point before the hazard, +1.
    let drop = ball;
    for (let t = 0.95; t > 0; t -= 0.05) {
      const pp = { x: ball.x + (to.x - ball.x) * t, y: ball.y + (to.y - ball.y) * t };
      const l = classifyLie(pp, h);
      if (l !== "water" && l !== "ob") { drop = pp; break; }
    }
    return { ball: drop, lie: classifyLie(drop, h), penalty: 1, event: "water", landing: to };
  }
  return { ball: to, lie: landLie, penalty: 0, event: landLie, landing: to };
}

// ---- Putting (two concentric zones) -----------------------------------------

export const GREEN_ZONES = { onePutt: 3 };
/** On the green: 2 putts, except inside 3 m → 1 putt. */
export function puttsForDistance(d: number): number {
  return d <= GREEN_ZONES.onePutt ? 1 : 2;
}

// ---- Scoring ----------------------------------------------------------------

export function scoreName(strokes: number, par: number): string {
  if (strokes === 1) return "Trou en un !";
  const diff = strokes - par;
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double bogey";
  return `+${diff}`;
}

// ---- Scorecard types --------------------------------------------------------

export interface HoleScore {
  number: number; par: number; strokes: number; putts: number; mulligans: number;
  gir?: boolean;           // green reached in regulation (≤ par−2 strokes)
  fairwayHit?: boolean | null; // tee shot in fairway (null on par 3)
  penalties?: number;      // penalty strokes (water / OB)
}
export interface Round {
  id: string; startedAt: number; endedAt?: number;
  coursePar: number; totalStrokes: number; totalMulligans: number;
  holes: HoleScore[];
}

export interface CourseStats {
  rounds: number;
  avgStrokes: number; bestStrokes: number; avgVsPar: number;
  girPct: number; firPct: number; avgPutts: number; avgPenalties: number;
  handicap: number | null;
}

/** Aggregate analytics across saved rounds. */
export function roundStats(rounds: Round[]): CourseStats | null {
  if (!rounds.length) return null;
  const n = rounds.length;
  const totals = rounds.map((r) => r.totalStrokes);
  const avgStrokes = totals.reduce((a, b) => a + b, 0) / n;
  const bestStrokes = Math.min(...totals);
  const avgVsPar = rounds.reduce((a, r) => a + (r.totalStrokes - r.coursePar), 0) / n;

  let girY = 0, girT = 0, firY = 0, firT = 0, putts = 0, pen = 0;
  for (const r of rounds) for (const h of r.holes) {
    if (typeof h.gir === "boolean") { girT++; if (h.gir) girY++; }
    if (h.fairwayHit === true || h.fairwayHit === false) { firT++; if (h.fairwayHit) firY++; }
    putts += h.putts ?? 0;
    pen += h.penalties ?? 0;
  }
  // Handicap ≈ mean of the best half of the last 8 rounds' differentials.
  const recent = [...rounds].slice(0, 8).map((r) => r.totalStrokes - r.coursePar).sort((a, b) => a - b);
  const keep = recent.slice(0, Math.max(1, Math.ceil(recent.length / 2)));
  const handicap = keep.length ? keep.reduce((a, b) => a + b, 0) / keep.length : null;

  return {
    rounds: n, avgStrokes, bestStrokes, avgVsPar,
    girPct: girT ? (girY / girT) * 100 : 0,
    firPct: firT ? (firY / firT) * 100 : 0,
    avgPutts: putts / n, avgPenalties: pen / n, handicap,
  };
}

// ---- Seeded 18-hole course generator ----------------------------------------

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 18-hole, par-72 course. Same seed → same course. */
export function generateCourse(seed = 20260607): Hole[] {
  const rng = mulberry32(seed);
  const rand = (a: number, b: number) => a + rng() * (b - a);
  const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4]; // = 72
  const islandIdx = PARS.indexOf(3); // first par-3 → famous island green

  return PARS.map((par, i) => {
    const island = i === islandIdx;
    const length = island ? rand(120, 140) : par === 3 ? rand(100, 145) : par === 4 ? rand(260, 340) : rand(380, 450);
    const fairwayHalf = par === 3 ? 16 : 18;
    const greenRadius = island ? 12 : par === 3 ? 10 : 11;
    const obHalf = fairwayHalf + rand(20, 30);

    // Island holes are a straight forced carry — handle them up front.
    if (island) {
      const centerline: Vec[] = [{ x: 0, y: 0 }, { x: 0, y: length }];
      const wspeed = rand(0, 6);
      const wa = rng() * Math.PI * 2;
      return {
        number: i + 1, par, island, fairwayHalf, greenRadius, obHalf, centerline,
        hazards: [], wind: { wx: wspeed * Math.cos(wa), wy: wspeed * Math.sin(wa) },
      };
    }

    let centerline: Vec[];
    if (par !== 3 && rng() < 0.5) {
      const dir = rng() < 0.5 ? -1 : 1;
      const cornerY = length * rand(0.5, 0.62);
      centerline = [{ x: 0, y: 0 }, { x: 0, y: cornerY }, { x: dir * rand(22, 42), y: length }];
    } else {
      centerline = [{ x: 0, y: 0 }, { x: 0, y: length }];
    }
    const pin = centerline[centerline.length - 1];

    const hazards: Hazard[] = [];
    // 1–2 greenside bunkers, placed fully OUTSIDE the green (beside / short).
    const nb = 1 + (rng() < 0.5 ? 1 : 0);
    for (let b = 0; b < nb; b++) {
      const side = rng() < 0.5 ? -1 : 1;
      const r = rand(5, 8);
      const off = greenRadius + r + rand(1, 5);
      hazards.push({ type: "sand", cx: pin.x + side * off, cy: pin.y - rand(-4, 8), r });
    }
    // fairway bunker in the landing zone (par 4/5)
    if (par !== 3 && rng() < 0.55) {
      const ly = Math.min(length * 0.62, rand(200, 250));
      const side = rng() < 0.5 ? -1 : 1;
      hazards.push({ type: "sand", cx: centerXAt(centerline, ly) + side * rand(fairwayHalf * 0.5, fairwayHalf + 4), cy: ly, r: rand(7, 10) });
    }
    // water (~32 %): either a carry pond (on the centreline) or a lateral lake (beside fairway)
    if (rng() < 0.32) {
      if (rng() < 0.5) {
        // carry pond — centered on centreline, must fly over it
        const wy = par === 3
          ? length * rand(0.32, 0.52)
          : rand(length * 0.52, length * 0.75);
        hazards.push({ type: "water", cx: centerXAt(centerline, wy), cy: wy, r: rand(10, 15) });
      } else {
        // lateral lake — clearly outside the fairway corridor
        const wy = par === 3
          ? length * rand(0.25, 0.65)
          : rand(length * 0.30, length * 0.78);
        const side = rng() < 0.5 ? -1 : 1;
        hazards.push({ type: "water", cx: centerXAt(centerline, wy) + side * (fairwayHalf + rand(10, 22)), cy: wy, r: rand(14, 22) });
      }
    }

    const wspeed = rand(0, 7);
    const wa = rng() * Math.PI * 2;
    const wind = { wx: wspeed * Math.cos(wa), wy: wspeed * Math.sin(wa) };

    return { number: i + 1, par, fairwayHalf, greenRadius, obHalf, centerline, hazards, wind };
  });
}
