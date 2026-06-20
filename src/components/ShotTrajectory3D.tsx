import type { Shot } from "../types";

/**
 * 3D shot view — dependency-free SVG with a real pinhole camera.
 *
 * A stripped-back schematic: the only things drawn are the dispersion corridors
 * (green ≤5 % / amber 5–8 % of distance), the distance grid, and the ball-flight
 * arc — no sky/ground/scenery. The camera sits behind, above and slightly to the
 * left of the tee looking down the line, so a shot reads as a clear parabola and
 * the grid/corridors recede to a vanishing point.
 *
 * The scale is fixed for the whole session (derived from the longest shot), so the
 * view never jumps between shots — a short wedge simply lands nearer than a drive.
 */

const W = 480, H = 380;   // SVG viewBox
const CX = W / 2;         // screen centre x
const CY = 138;           // vanishing-point screen-y (a ground point at infinity projects here)
const Z_IN = 0.05;        // ≤5 %  → green corridor   (lateral half-width as % of distance)
const Z_OUT = 0.08;       // 5–8 % → amber band

type V = { x: number; y: number; z: number };
type P = { sx: number; sy: number };
type Project = (x: number, y: number, z: number) => P;

const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V, b: V): V => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a: V): V => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

/**
 * Build a pinhole camera for a session whose longest shot is `Yland` metres.
 * World coords: x = lateral (+right), y = downrange, z = height (all metres).
 */
function makeCamera(Yland: number): Project {
  const eye: V = { x: -0.07 * Yland, y: -0.40 * Yland, z: 0.22 * Yland }; // behind-above-left
  const target: V = { x: 0.07 * Yland, y: 0.52 * Yland, z: 0.05 * Yland };
  const f = norm(sub(target, eye));               // forward (view) axis
  const r = norm(cross(f, { x: 0, y: 0, z: 1 }));  // screen-right axis
  const u = cross(r, f);                           // screen-up axis

  const toCam = (x: number, y: number, z: number) => {
    const rel = sub({ x, y, z }, eye);
    return { cx: dot(rel, r), cy: dot(rel, u), cz: dot(rel, f) };
  };
  const focal = 2.5 * Yland;  // ∝ scene depth → same framing for any session distance

  return (x, y, z) => {
    const c = toCam(x, y, z);
    const d = Math.max(c.cz, 0.01);  // depth (avoid divide-by-zero behind the camera)
    return { sx: CX + (focal * c.cx) / d, sy: CY - (focal * c.cy) / d };
  };
}

/** Sample a ground edge whose lateral offset is `latOf(y)`, tee → `yEnd`. */
function edgePts(project: Project, yEnd: number, latOf: (y: number) => number, N = 20): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= N; i++) { const y = (i / N) * yEnd; pts.push(project(latOf(y), y, 0)); }
  return pts;
}
const ptsStr = (pts: P[]) => pts.map((p) => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(" ");
/** Filled ground band between two edges (outer reversed to close the polygon). */
const band = (inner: P[], outer: P[]) => ptsStr([...inner, ...[...outer].reverse()]);

/**
 * Reconstruct the flight path. The carry arc peaks ~56 % downrange
 * (z = apex·sin(π·t^1.18)) and curves laterally with x = cDev·t^1.7; a straight
 * ground roll then runs from the carry point to the total point. Inputs are
 * coerced to finite numbers so one bad shot can't break its own arc.
 */
function flightPoints(shot: Shot, project: Project) {
  const num = (v: number | undefined, d: number) => (Number.isFinite(v) ? (v as number) : d);
  const carry = Math.max(1, num(shot.carry, 1));
  const total = Math.max(carry, num(shot.total, carry));
  const apex = Math.max(2, num(shot.apex, carry * 0.14));
  const cDev = num(shot.carryDeviation ?? shot.offlineM, 0);
  const off = num(shot.offlineM, cDev);
  const N = 48;
  const air: P[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    air.push(project(cDev * Math.pow(t, 1.7), carry * t, apex * Math.sin(Math.PI * Math.pow(t, 1.18))));
  }
  return { air, rollA: project(cDev, carry, 0), rollB: project(off, total, 0) };
}

const toPath = (pts: P[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`).join(" ");
const pathLen = (pts: P[]) =>
  pts.reduce((s, p, i) => (i ? s + Math.hypot(p.sx - pts[i - 1].sx, p.sy - pts[i - 1].sy) : 0), 0);

/**
 * @param shots  The session's shots, newest first. `shots[0]` is the bright
 *               animated arc; the next few are faint ghosts; the whole set fixes
 *               the camera scale (longest shot).
 */
export function ShotTrajectory3D({ shots = [] }: { shots?: Shot[] }) {
  const shot = shots[0];
  const ghosts = shots.slice(1, 6);

  // Fixed session scale (NaN-safe: a bad value can't poison Math.max → NaN everywhere).
  const totals = shots.map((s) => s.total).filter(Number.isFinite);
  const maxTotal = totals.length ? Math.max(...totals) : 0;
  const Yland = Math.max(60, maxTotal * 1.06);
  const RAIL = Math.max(12, Z_OUT * Yland * 1.4); // distance-grid half-width (just past the 8 % band)
  const project = makeCamera(Yland);

  const in5L = edgePts(project, Yland, (y) => -Z_IN * y);
  const in5R = edgePts(project, Yland, (y) => Z_IN * y);
  const out8L = edgePts(project, Yland, (y) => -Z_OUT * y);
  const out8R = edgePts(project, Yland, (y) => Z_OUT * y);

  const marks: number[] = [];
  for (let m = 50; m <= maxTotal + 1; m += 50) marks.push(m);
  const lbl5 = project(Z_IN * Yland * 0.92, Yland * 0.92, 0);
  const lbl8 = project(Z_OUT * Yland * 0.92, Yland * 0.92, 0);
  const tee = project(0, 0, 0);
  const far = project(0, Yland, 0);

  const fp = shot ? flightPoints(shot, project) : null;
  const len = fp ? pathLen(fp.air) : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 420 }}>
      <defs>
        <linearGradient id="trail3d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E5DA4" />
          <stop offset="1" stopColor="#6f9bd6" />
        </linearGradient>
      </defs>

      {/* dispersion corridors */}
      <polygon points={band(in5L, out8L)} fill="#e8c074" fillOpacity={0.4} />
      <polygon points={band(in5R, out8R)} fill="#e8c074" fillOpacity={0.4} />
      <polygon points={band(in5L, in5R)} fill="#86cf90" fillOpacity={0.5} />

      {/* distance grid — cross-lines span just past the 8 % band, labelled in metres */}
      {marks.map((m) => {
        const a = project(-RAIL, m, 0), b = project(RAIL, m, 0);
        return (
          <g key={m}>
            <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke="#16294D" strokeOpacity={0.16} strokeWidth={1} />
            <text x={b.sx + 4} y={b.sy + 3} fontSize={9} fontFamily="JetBrains Mono" fill="#16294D" fillOpacity={0.5}>{m}</text>
          </g>
        );
      })}

      {/* corridor edges + labels */}
      <polyline points={ptsStr(out8L)} fill="none" stroke="#b07d12" strokeOpacity={0.6} strokeWidth={1.2} />
      <polyline points={ptsStr(out8R)} fill="none" stroke="#b07d12" strokeOpacity={0.6} strokeWidth={1.2} />
      <polyline points={ptsStr(in5L)} fill="none" stroke="#2a6b41" strokeOpacity={0.65} strokeWidth={1.2} />
      <polyline points={ptsStr(in5R)} fill="none" stroke="#2a6b41" strokeOpacity={0.65} strokeWidth={1.2} />
      <text x={lbl5.sx + 2} y={lbl5.sy - 2} fontSize={9} fontFamily="JetBrains Mono" fill="#1f5e36">5%</text>
      <text x={lbl8.sx + 2} y={lbl8.sy - 2} fontSize={9} fontFamily="JetBrains Mono" fill="#8a5e0c">8%</text>

      {/* centre target line */}
      <line x1={tee.sx} y1={tee.sy} x2={far.sx} y2={far.sy} stroke="#16294D" strokeOpacity={0.22} strokeDasharray="5 6" strokeWidth={1} />

      {/* ghost arcs (previous shots) */}
      {ghosts.map((g, i) => (
        <path key={g.id ?? i} d={toPath(flightPoints(g, project).air)} fill="none" stroke="#2E5DA4" strokeOpacity={0.14} strokeWidth={1.5} strokeLinecap="round" />
      ))}

      {/* current shot: carry arc (animated) + a thin roll segment to total */}
      {fp && (
        <g>
          <line x1={fp.rollA.sx} y1={fp.rollA.sy} x2={fp.rollB.sx} y2={fp.rollB.sy} stroke="#2E5DA4" strokeOpacity={0.45} strokeWidth={2} strokeDasharray="2 3" />
          <path key={shot!.id} d={toPath(fp.air)} fill="none" stroke="url(#trail3d)" strokeWidth={4} strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={len}>
            <animate attributeName="stroke-dashoffset" from={len} to="0" dur="0.7s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
          </path>
        </g>
      )}

      {/* caption */}
      {shot ? (
        <text x={12} y={H - 10} fontSize={12} fontFamily="JetBrains Mono" fill="#16294D" fillOpacity={0.7}>
          {shot.club} · {shot.carry.toFixed(0)} m carry · {shot.total.toFixed(0)} m total · apex {shot.apex.toFixed(0)} m
        </text>
      ) : (
        <text x={CX} y={H / 2} textAnchor="middle" fontSize={13} fontFamily="Manrope" fill="#16294D" fillOpacity={0.4}>
          Hit a ball to see the 3D flight
        </text>
      )}
    </svg>
  );
}
