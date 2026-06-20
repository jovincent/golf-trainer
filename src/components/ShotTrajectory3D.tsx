import type { Shot } from "../types";

// Dependency-free pseudo-3D "down-the-line" shot view: a fairway receding to the
// horizon, with the ball's flight arc rising into the sky, curving with sidespin,
// and a shadow tracking it on the grass. Reconstructed from the shot's carry /
// apex / lateral metrics and projected with a simple perspective camera.

const W = 480, H = 380;
const HOR = 150;          // horizon screen-y
const GNEAR = 372;        // near ground screen-y
const CX = W / 2;
const PXM_LAT = 5.0;      // px per metre, lateral (near plane)
const PXM_H = 13.0;       // px per metre, height (near plane, slightly exaggerated)
const HP = 0.32;          // far-compression: smaller = flatter horizon pull
const CORRIDOR = 22;      // fairway half-width drawn (m)
const YAW = 58;           // camera yaw (px the centreline drifts by at the horizon)
                          // — viewing slightly off-line so the arc reads as a 3D
                          //   curve instead of overlapping itself on a straight shot.

type P = { sx: number; sy: number; gy: number; shrink: number };

function project(x: number, y: number, z: number, Ymax: number): P {
  const d = Math.min(1, Math.max(0, y / Ymax));
  const sd = d / (d + (1 - d) * HP);             // perspective depth 0..1
  const gy = GNEAR + (HOR - GNEAR) * sd;          // ground line at this depth
  const shrink = 1 - 0.9 * sd;                    // near wide → far narrow
  const baseX = CX + YAW * sd;                    // centreline drifts with depth (yaw)
  return { sx: baseX + x * PXM_LAT * shrink, sy: gy - z * PXM_H * shrink, gy, shrink };
}

// Build the flight arc (carry parabola-ish peaking ~56% downrange) + ground roll.
function flightPoints(shot: Shot, Ymax: number) {
  const carry = Math.max(1, shot.carry);
  const total = Math.max(carry, shot.total);
  const apex = Math.max(2, shot.apex || carry * 0.14);
  const cDev = shot.carryDeviation ?? shot.offlineM ?? 0;
  const off = shot.offlineM ?? cDev;
  const N = 48;
  const air: P[] = [];
  const shadow: P[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = carry * t;
    const z = apex * Math.sin(Math.PI * Math.pow(t, 1.18));
    const x = cDev * Math.pow(t, 1.7);
    air.push(project(x, y, z, Ymax));
    shadow.push(project(x, y, 0, Ymax));
  }
  // ground roll from carry → total
  const rollA = project(cDev, carry, 0, Ymax);
  const rollB = project(off, total, 0, Ymax);
  return { air, shadow, rollA, rollB, apexIdx: Math.round(0.56 * N) };
}

const toPath = (pts: P[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`).join(" ");
const pathLen = (pts: P[]) => pts.reduce((s, p, i) => i ? s + Math.hypot(p.sx - pts[i - 1].sx, p.sy - pts[i - 1].sy) : 0, 0);

export function ShotTrajectory3D({ shot, ghosts = [] }: { shot?: Shot; ghosts?: Shot[] }) {
  const Ymax = shot ? Math.max(60, shot.total * 1.06) : 200;

  // Ground grid: fairway edges + distance cross-lines (recede to horizon).
  const edgeL = [project(-CORRIDOR, 0, 0, Ymax), project(-CORRIDOR, Ymax, 0, Ymax)];
  const edgeR = [project(CORRIDOR, 0, 0, Ymax), project(CORRIDOR, Ymax, 0, Ymax)];
  const marks: number[] = [];
  for (let m = 50; m < Ymax; m += 50) marks.push(m);

  const fp = shot ? flightPoints(shot, Ymax) : null;
  const len = fp ? pathLen(fp.air) : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 420 }}>
      <defs>
        <linearGradient id="sky3d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9cc6f0" />
          <stop offset="1" stopColor="#dcecfb" />
        </linearGradient>
        <linearGradient id="grass3d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f9e57" />
          <stop offset="1" stopColor="#3f7d3c" />
        </linearGradient>
        <linearGradient id="trail3d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#eaf3ff" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* sky + distant hills + grass */}
      <rect x={0} y={0} width={W} height={HOR + 1} fill="url(#sky3d)" />
      <path d={`M0 ${HOR} Q90 ${HOR - 34} 190 ${HOR - 6} T380 ${HOR - 20} T${W} ${HOR - 4} V${HOR} Z`}
        fill="#6f8f74" opacity={0.55} />
      <rect x={0} y={HOR} width={W} height={H - HOR} fill="url(#grass3d)" />

      {/* fairway corridor + distance lines */}
      <polygon
        points={`${edgeL[0].sx},${edgeL[0].sy} ${edgeL[1].sx},${edgeL[1].sy} ${edgeR[1].sx},${edgeR[1].sy} ${edgeR[0].sx},${edgeR[0].sy}`}
        fill="#69a861" fillOpacity={0.45} stroke="none" />
      {marks.map((m) => {
        const a = project(-CORRIDOR, m, 0, Ymax), b = project(CORRIDOR, m, 0, Ymax);
        return (
          <g key={m}>
            <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke="#ffffff" strokeOpacity={0.28} strokeWidth={1} />
            <text x={b.sx + 4} y={b.sy + 3} fontSize={8 * (0.5 + a.shrink * 0.5)} fontFamily="JetBrains Mono" fill="#ffffff" fillOpacity={0.6}>{m}</text>
          </g>
        );
      })}
      {/* target line */}
      {(() => { const a = project(0, 0, 0, Ymax), b = project(0, Ymax, 0, Ymax);
        return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke="#ffffff" strokeOpacity={0.25} strokeDasharray="5 6" strokeWidth={1} />; })()}
      {/* fairway edges */}
      <line x1={edgeL[0].sx} y1={edgeL[0].sy} x2={edgeL[1].sx} y2={edgeL[1].sy} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} />
      <line x1={edgeR[0].sx} y1={edgeR[0].sy} x2={edgeR[1].sx} y2={edgeR[1].sy} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1} />

      {/* ghost arcs (previous shots) */}
      {ghosts.slice(0, 5).map((g, i) => {
        const gp = flightPoints(g, Ymax);
        return <path key={g.id ?? i} d={toPath(gp.air)} fill="none" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={1.5} strokeLinecap="round" />;
      })}

      {fp && (
        <g>
          {/* shadow on the grass */}
          <path d={toPath(fp.shadow)} fill="none" stroke="#1c3a1c" strokeOpacity={0.28} strokeWidth={2} strokeLinecap="round" />
          <line x1={fp.rollA.sx} y1={fp.rollA.sy} x2={fp.rollB.sx} y2={fp.rollB.sy} stroke="#1c3a1c" strokeOpacity={0.28} strokeWidth={2} />
          {/* roll */}
          <line x1={fp.rollA.sx} y1={fp.rollA.sy} x2={fp.rollB.sx} y2={fp.rollB.sy} stroke="#e7f0ff" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="2 3" />
          {/* flight trail (animated draw, re-keyed per shot) */}
          <path key={shot!.id} d={toPath(fp.air)} fill="none" stroke="url(#trail3d)" strokeWidth={3.5} strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={len}>
            <animate attributeName="stroke-dashoffset" from={len} to="0" dur="0.7s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
          </path>
          {/* apex marker */}
          <circle cx={fp.air[fp.apexIdx].sx} cy={fp.air[fp.apexIdx].sy} r={2.5} fill="#ffffff" fillOpacity={0.9} />
          {/* landing ball + shadow */}
          <ellipse cx={fp.rollB.sx} cy={fp.rollB.sy} rx={4} ry={1.6} fill="#1c3a1c" fillOpacity={0.35} />
          <circle cx={fp.rollB.sx} cy={fp.rollB.sy - 2} r={3.2} fill="#ffffff" stroke="#C2603A" strokeWidth={1} />
        </g>
      )}

      {/* caption */}
      {shot ? (
        <text x={12} y={H - 12} fontSize={12} fontFamily="JetBrains Mono" fill="#ffffff" fillOpacity={0.92}>
          {shot.club} · {shot.carry.toFixed(0)} m carry · {shot.total.toFixed(0)} m total · apex {shot.apex.toFixed(0)} m
        </text>
      ) : (
        <text x={CX} y={H / 2} textAnchor="middle" fontSize={13} fontFamily="Manrope" fill="#ffffff" fillOpacity={0.8}>
          Hit a ball to see the 3D flight
        </text>
      )}
    </svg>
  );
}
