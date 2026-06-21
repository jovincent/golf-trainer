import { useState } from "react";
import { Share2, Download } from "lucide-react";
import {
  BarChart, Bar, ErrorBar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LabelList, ScatterChart, Scatter, ReferenceLine, CartesianGrid, ZAxis, Legend, Customized,
} from "recharts";
import { useStore, allShots } from "../store";
import { aggregateByClub, type ClubAgg } from "../lib/stats";
import { ShareModal } from "../components/ShareModal";
import { buildStatsShare, type ShareEnvelope } from "../lib/share";
import { usePlayerName } from "../lib/usePlayerName";
import { useUnits } from "../lib/useUnits";
import { downloadText } from "../lib/export";

// Stable colour per club (long → short).
const PALETTE = [
  "#4A6FA5", "#2F8F5B", "#2F8FA6", "#C68A14", "#C2603A",
  "#3DAE7B", "#5B7FB8", "#6FCF97", "#A6792F", "#8A5BB8",
  "#1F6F45", "#D08A4A", "#2C6E8F", "#9FB04A", "#B85B7A",
];
const colorFor = (i: number) => PALETTE[i % PALETTE.length];

const tooltip = {
  borderRadius: 12,
  border: "1px solid #eef3fb",
  fontFamily: "Manrope",
} as const;
const tick = { fontFamily: "JetBrains Mono", fontSize: 11, fill: "rgb(var(--c-ink))" } as const;

function BullseyeChart({ aggs }: { aggs: ClubAgg[] }) {
  const U = useUnits();
  const [activeClub, setActiveClub] = useState<string>(aggs[0]?.club ?? "");
  const agg = aggs.find((a) => a.club === activeClub);
  if (!agg || !agg.clean.length) return null;

  const points = agg.clean.map((s) => ({ x: s.offlineM, y: s.carry - agg.carry }));
  const meanOffline = points.reduce((s, p) => s + p.x, 0) / points.length;

  // Concentric rings as % of mean carry — aligned with dispersion zones
  const r1m = agg.carry * 0.05;   // 5 % — vert
  const r2m = agg.carry * 0.08;   // 8 % — orange
  const r3m = agg.carry * 0.12;   // 12 % — outer reference

  const rings = [
    { r: r1m, pct: 5,  stroke: "#2F8F5B90", fill: "#2F8F5B0E", sw: 1.5 },
    { r: r2m, pct: 8,  stroke: "#C68A1470", fill: "none",       sw: 1.5 },
    { r: r3m, pct: 12, stroke: "#C2603A40", fill: "none",       sw: 1   },
  ];

  // Scale so the outer ring always fits, expand if data points are farther
  const dataMax = points.length
    ? Math.max(...points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))
    : 0;
  const maxR = Math.max(r3m * 1.15, dataMax * 1.05);

  const W = 280, H = 280, cx = W / 2, cy = H / 2, PAD = 22;
  const sc = (cx - PAD) / maxR;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1.5">
        {aggs.map((a) => (
          <button key={a.club} onClick={() => setActiveClub(a.club)}
            className={"text-xs font-semibold metric rounded-full px-2.5 py-1 transition " +
              (a.club === activeClub ? "bg-ink text-white" : "bg-panel text-ink/60 hover:bg-ink/10")}>
            {a.club}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-6 items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[260px] shrink-0">
          {/* Filled zones */}
          <circle cx={cx} cy={cy} r={r3m * sc} fill="#C2603A08" />
          <circle cx={cx} cy={cy} r={r2m * sc} fill="#C68A1410" />
          <circle cx={cx} cy={cy} r={r1m * sc} fill="#2F8F5B10" />
          {/* Ring strokes + % labels */}
          {rings.map(({ r, pct, stroke, sw }) => (
            <g key={pct}>
              <circle cx={cx} cy={cy} r={r * sc} fill="none" stroke={stroke} strokeWidth={sw} />
              <text x={cx + r * sc + 2} y={cy - 3}
                fontSize={7.5} fontFamily="JetBrains Mono" fill={stroke} fillOpacity={0.8}>
                {pct}%
              </text>
              <text x={cx + r * sc + 2} y={cy + 8}
                fontSize={7} fontFamily="JetBrains Mono" fill={stroke} fillOpacity={0.55}>
                {U.d(r, 1)}{U.distUnit}
              </text>
            </g>
          ))}
          {/* Axes */}
          <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke="rgb(var(--c-ink))" strokeOpacity={0.08} />
          <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke="rgb(var(--c-ink))" strokeOpacity={0.08} />
          {/* Mean drift line */}
          {Math.abs(meanOffline) > 0.5 && (
            <line x1={cx + meanOffline * sc} y1={PAD} x2={cx + meanOffline * sc} y2={H - PAD}
              stroke="#2F8FA6" strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.65} />
          )}
          {/* Data points colored by zone */}
          {points.map((p, i) => {
            const d = Math.hypot(p.x, p.y);
            const fill = d <= r1m ? "#2F8F5B" : d <= r2m ? "#C68A14" : "#C2603A";
            return <circle key={i} cx={cx + p.x * sc} cy={cy - p.y * sc} r={4.5} fill={fill} fillOpacity={0.75} />;
          })}
          {/* Crosshair center */}
          <circle cx={cx} cy={cy} r={3} fill="rgb(var(--c-ink))" />
          <line x1={cx - 7} y1={cy} x2={cx + 7} y2={cy} stroke="rgb(var(--c-ink))" strokeWidth={1} />
          <line x1={cx} y1={cy - 7} x2={cx} y2={cy + 7} stroke="rgb(var(--c-ink))" strokeWidth={1} />
          {/* Direction labels */}
          <text x={PAD + 2} y={cy + 11} fontSize={8} fontFamily="Manrope" fill="rgb(var(--c-ink))" fillOpacity={0.3}>◀ L</text>
          <text x={W - PAD - 2} y={cy + 11} fontSize={8} fontFamily="Manrope" fill="rgb(var(--c-ink))" fillOpacity={0.3} textAnchor="end">R ▶</text>
          <text x={cx + 3} y={PAD + 10} fontSize={8} fontFamily="Manrope" fill="rgb(var(--c-ink))" fillOpacity={0.3}>▲ Long</text>
          <text x={cx + 3} y={H - PAD - 2} fontSize={8} fontFamily="Manrope" fill="rgb(var(--c-ink))" fillOpacity={0.3}>▼ Short</text>
        </svg>
        <div className="grid gap-2 min-w-[140px]">
          <div className="bg-panel rounded-xl px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-ink/45">Avg carry</div>
            <div className="metric text-lg font-semibold text-ink">{U.d(agg.carry, 0)} {U.distUnit}</div>
          </div>
          <div className="bg-panel rounded-xl px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-ink/45">Avg drift</div>
            <div className={"metric text-lg font-semibold " + (meanOffline > 1.5 ? "text-terracotta" : meanOffline < -1.5 ? "text-teal" : "text-fairway")}>
              {meanOffline > 0 ? "+" : ""}{U.d(meanOffline, 1)} {U.distUnit}
            </div>
            <div className="text-[10px] text-ink/40 mt-0.5">
              {meanOffline > 2 ? "fade tendency" : meanOffline < -2 ? "draw tendency" : "centered"}
            </div>
          </div>
          <div className="bg-panel rounded-xl px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-ink/45">Lateral dispersion ±</div>
            <div className="metric text-lg font-semibold text-teal">{U.d(agg.offlineSd, 1)} {U.distUnit}</div>
          </div>
          <div className="bg-panel rounded-xl px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-ink/45">Carry consistency ±</div>
            <div className="metric text-lg font-semibold text-gold">{U.d(agg.carrySd, 1)} {U.distUnit}</div>
          </div>
          <div className="flex flex-col gap-1 pt-1 text-[11px] text-ink/55">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-fairway inline-block shrink-0" /> ≤ 5% carry</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gold inline-block shrink-0" /> 5 – 8%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-terracotta inline-block shrink-0" /> &gt; 8%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const DISP_WARN = 0.08;

function DispersionZones({ xAxisMap, yAxisMap, yHi, xMax, disp, dispWarn }: any) {
  const xa = xAxisMap && (Object.values(xAxisMap)[0] as any);
  const ya = yAxisMap && (Object.values(yAxisMap)[0] as any);
  if (!xa?.scale || !ya?.scale) return null;

  const px = (v: number) => xa.scale(v);
  const py = (v: number) => ya.scale(v);

  const x0 = px(0), yBot = py(0), yTop = py(yHi);
  const xLeft = px(-xMax), xRight = px(xMax);
  const gR = px(disp * yHi), gL = px(-disp * yHi);
  const oR = px(dispWarn * yHi), oL = px(-dispWarn * yHi);

  const pts = (coords: [number, number][]) => coords.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <g>
      {/* Red right */}
      <polygon points={pts([[x0, yBot], [oR, yTop], [xRight, yTop], [xRight, yBot]])} fill="#C2603A" fillOpacity={0.10} />
      {/* Red left */}
      <polygon points={pts([[x0, yBot], [oL, yTop], [xLeft, yTop], [xLeft, yBot]])} fill="#C2603A" fillOpacity={0.10} />
      {/* Orange right */}
      <polygon points={pts([[x0, yBot], [gR, yTop], [oR, yTop]])} fill="#C68A14" fillOpacity={0.16} />
      {/* Orange left */}
      <polygon points={pts([[x0, yBot], [gL, yTop], [oL, yTop]])} fill="#C68A14" fillOpacity={0.16} />
      {/* Green center */}
      <polygon points={pts([[x0, yBot], [gL, yTop], [gR, yTop]])} fill="#2F8F5B" fillOpacity={0.16} />
    </g>
  );
}

/**
 * Custom scatter dot: circle + arrow showing the approximate landing trajectory.
 *
 * Physics: a ball curving along a circular arc that starts at 0° and ends at
 * (offlineM, carry) has a tangent angle at landing ≈ 2 × atan2(offline, carry).
 * The arrow points in that direction (i.e. where the ball was heading as it hit
 * the ground), giving an intuitive "spin effect" indicator per shot.
 *
 * SVG axes: +x = right, +y = DOWN (so chart-up = -y in SVG).
 */
function SpinArrowDot({ cx, cy, fill, payload }: any) {
  if (cx == null || cy == null) return null;
  const offline = payload?.x ?? 0;
  const carry   = Math.max(1, payload?.y ?? 1);

  // Landing trajectory angle (radians, positive = rightward deviation)
  const angle = 2 * Math.atan2(offline, carry);
  const sinA = Math.sin(angle), cosA = Math.cos(angle);

  // Unit vector in landing direction (SVG: dy is negated because SVG y is down)
  const ux =  sinA;
  const uy = -cosA; // chart-up = SVG-up = negative SVG y

  // Arrow geometry: tail 5 px behind centre, tip 10 px ahead
  const TAIL = 5, TIP = 10;
  const x1 = cx - ux * TAIL,  y1 = cy - uy * TAIL;  // tail
  const x2 = cx + ux * TIP,   y2 = cy + uy * TIP;   // tip

  // Arrowhead: small isoceles triangle at the tip
  const HEAD_LEN = 4.5, HEAD_HALF = 2.2;
  const px = -uy, py = ux;   // perpendicular unit
  const hx1 = x2 - HEAD_LEN * ux + HEAD_HALF * px;
  const hy1 = y2 - HEAD_LEN * uy + HEAD_HALF * py;
  const hx2 = x2 - HEAD_LEN * ux - HEAD_HALF * px;
  const hy2 = y2 - HEAD_LEN * uy - HEAD_HALF * py;

  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill={fill} fillOpacity={0.80} />
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={fill} strokeWidth={1.6} strokeOpacity={0.90}
        strokeLinecap="round"
      />
      <polygon
        points={`${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}`}
        fill={fill} fillOpacity={0.90}
      />
    </g>
  );
}

function aggsToCsv(aggs: ClubAgg[]): string {
  const cols: Array<[string, (a: ClubAgg) => string | number]> = [
    ["club", (a) => a.club], ["balls", (a) => a.n], ["clean", (a) => a.nClean], ["mishits", (a) => a.nMishit],
    ["carry_m", (a) => a.carry.toFixed(1)], ["optimal_m", (a) => a.carryOptimal.toFixed(1)], ["median_m", (a) => a.carryMed.toFixed(1)],
    ["total_m", (a) => a.total.toFixed(1)], ["ball_kmh", (a) => a.ball.toFixed(1)], ["smash", (a) => a.smash.toFixed(3)],
    ["backspin_rpm", (a) => a.spin.toFixed(0)], ["launch_deg", (a) => a.launch.toFixed(1)],
    ["carry_sd_m", (a) => a.carrySd.toFixed(1)], ["offline_sd_m", (a) => a.offlineSd.toFixed(1)],
  ];
  const header = cols.map(([h]) => h).join(",");
  return [header, ...aggs.map((a) => cols.map(([, f]) => f(a)).join(","))].join("\n");
}

export function Stats() {
  const shots = useStore(allShots);
  const aggs = aggregateByClub(shots);
  const player = usePlayerName();
  const U = useUnits();
  const [share, setShare] = useState<ShareEnvelope | null>(null);

  if (!aggs.length) {
    return (
      <div className="card p-8 text-center text-ink/40">
        No data yet. Hit some balls (or History → Demo data) to populate the charts.
      </div>
    );
  }

  const carryData = aggs.map((a) => ({ club: a.club, carry: Math.round(U.dv(a.carry)), sd: Math.round(U.dv(a.carrySd)) }));
  const smashData = aggs.map((a) => ({ club: a.club, smash: +a.smash.toFixed(2) }));
  const sdData = aggs.map((a) => ({ club: a.club, sd: +U.dv(a.carrySd).toFixed(1) }));

  // Dispersion grid: ticks every 5 m on both axes, domains rounded to 5 m.
  const cleanShots = aggs.flatMap((a) => a.clean);
  const ticks5 = (lo: number, hi: number) => { const t: number[] = []; for (let v = lo; v <= hi; v += 5) t.push(v); return t; };
  const yLo = 0; // length always starts at 0
  const yHi = cleanShots.length ? Math.ceil(Math.max(...cleanShots.map((s) => s.carry)) / 5) * 5 : 50;
  const DISP = 0.05;
  // x range must fit both the data and the ±8% cone at full length
  const maxOff = Math.max(1, ...cleanShots.map((s) => Math.abs(s.offlineM)));
  const xMax = Math.max(10, Math.ceil(Math.max(maxOff, DISP_WARN * yHi) / 5) * 5);
  const xTicks = ticks5(-xMax, xMax);
  const yTicks = ticks5(yLo, yHi);

  return (
    <div className="grid gap-4">
      {/* Header — share & export */}
      <section className="card p-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="font-display text-lg leading-tight">Stats</h2>
          <p className="text-sm text-ink/50">{shots.length} balls · {aggs.length} clubs</p>
        </div>
        <button
          onClick={() => downloadText("flightlab-stats.csv", aggsToCsv(aggs))}
          className="inline-flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2 bg-panel hover:bg-ink/5 text-ink/70 transition"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button
          onClick={() => setShare(buildStatsShare(shots, player))}
          className="inline-flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2 bg-fairway hover:bg-fairway-light text-white transition"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
      </section>

      {/* 1 — Carry moyen par club (± régularité) */}
      <section className="card p-5">
        <h2 className="font-display text-lg mb-1">Avg carry by club</h2>
        <p className="text-sm text-ink/50 mb-4">Error bars = ± consistency (std dev), mishits excluded.</p>
        <div style={{ height: Math.max(220, aggs.length * 38) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={carryData} layout="vertical" margin={{ left: 8, right: 48 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="club" width={40} tick={tick} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, n) => [n === "carry" ? `${v} ${U.distUnit}` : `±${v} ${U.distUnit}`, n === "carry" ? "Carry" : "Consistency"]}
                contentStyle={tooltip}
              />
              <Bar dataKey="carry" radius={[0, 5, 5, 0]} barSize={18}>
                {carryData.map((_, i) => <Cell key={i} fill={colorFor(i)} />)}
                <ErrorBar dataKey="sd" width={4} strokeWidth={1.5} stroke="#16294D" opacity={0.5} direction="x" />
                <LabelList dataKey="carry" position="right" formatter={(v: number) => `${v} ${U.distUnit}`} style={tick} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Détail par club */}
      <section className="card overflow-hidden">
        <h2 className="font-display text-base px-4 py-3 border-b border-black/5">Per-club detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-ink/40 text-right">
                <th className="text-left px-4 py-2">Club</th>
                <th className="px-3 py-2">Balls</th>
                <th className="px-3 py-2">Average</th>
                <th className="px-3 py-2">Optimal</th>
                <th className="px-3 py-2">Median</th>
                <th className="px-3 py-2">±</th>
              </tr>
            </thead>
            <tbody className="metric">
              {aggs.map((a) => (
                <tr key={a.club} className="text-right border-t border-black/[0.03]">
                  <td className="text-left px-4 py-1.5 font-semibold">{a.club}</td>
                  <td className="px-3 py-1.5 text-ink/50">{a.nClean}{a.nMishit ? <span className="text-terracotta"> +{a.nMishit}</span> : null}</td>
                  <td className="px-3 py-1.5 text-fairway font-semibold">{U.d(a.carry, 0)}</td>
                  <td className="px-3 py-1.5 text-gold">{U.d(a.carryOptimal, 0)}</td>
                  <td className="px-3 py-1.5 text-ink/60">{U.d(a.carryMed, 0)}</td>
                  <td className="px-3 py-1.5 text-teal">{U.d(a.carrySd, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-ink/40 px-4 py-2">Distances in {U.distUnit} · "+N" = mishits excluded · Optimal = average of best shots.</p>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        {/* 2 — Smash factor par club */}
        <section className="card p-5">
          <h2 className="font-display text-base mb-3">Smash factor by club</h2>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={smashData} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef3fb" vertical={false} />
                <XAxis dataKey="club" tick={tick} axisLine={false} tickLine={false} interval={0} />
                <YAxis domain={[1, 1.5]} tick={tick} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [v.toFixed(2), "Smash"]} contentStyle={tooltip} />
                <Bar dataKey="smash" radius={[5, 5, 0, 0]} barSize={16}>
                  {smashData.map((_, i) => <Cell key={i} fill={colorFor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 3 — Régularité (écart-type carry) par club */}
        <section className="card p-5">
          <h2 className="font-display text-base mb-3">Consistency by club (± carry)</h2>
          <p className="text-xs text-ink/45 mb-2">The shorter the bar, the more consistent you are.</p>
          <div style={{ height: 214 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sdData} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef3fb" vertical={false} />
                <XAxis dataKey="club" tick={tick} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={tick} axisLine={false} tickLine={false} unit={` ${U.distUnit}`} />
                <Tooltip formatter={(v: number) => [`±${v} ${U.distUnit}`, "Consistency"]} contentStyle={tooltip} />
                <Bar dataKey="sd" radius={[5, 5, 0, 0]} barSize={16} fill="#2F8FA6">
                  {sdData.map((_, i) => <Cell key={i} fill={colorFor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* 4 — Bullseye par club */}
      <section className="card p-5">
        <h2 className="font-display text-lg mb-1">Bullseye by club</h2>
        <p className="text-sm text-ink/50 mb-4">
          Centered on your average: x = lateral offset, y = carry offset. Center = perfect shot.
          {" "}<span className="text-teal font-semibold">Blue = average drift.</span>
        </p>
        <BullseyeChart aggs={aggs} />
      </section>

      {/* 5 — Pattern de dispersion (vue de dessus) */}
      <section className="card p-5">
        <h2 className="font-display text-lg mb-1">Dispersion pattern</h2>
        <p className="text-sm text-ink/50 mb-3">
          <span className="text-fairway font-semibold">green ≤ 5%</span> ·{" "}
          <span className="text-gold font-semibold">orange 5–8%</span> ·{" "}
          <span className="text-terracotta font-semibold">red &gt; 8%</span>{" "}
          of distance.
        </p>
        <div style={{ height: 760 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="#dde7f3" />
              <XAxis type="number" dataKey="x" name="offset" unit={` ${U.distUnit}`} domain={[-xMax, xMax]} ticks={xTicks} interval={0} tick={{ ...tick, fontSize: 10 }} tickFormatter={(v: number) => U.d(v, 0)} />
              <YAxis type="number" dataKey="y" name="carry" unit={` ${U.distUnit}`} domain={[yLo, yHi]} ticks={yTicks} interval={0} tick={tick} tickFormatter={(v: number) => U.d(v, 0)} />
              <ZAxis range={[45, 45]} />
              <Customized component={DispersionZones} yHi={yHi} xMax={xMax} disp={DISP} dispWarn={DISP_WARN} />
              <ReferenceLine x={0} stroke="#16294D" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={tooltip}
                formatter={(v: number) => `${U.d(v, 1)} ${U.distUnit}`}
              />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
              {aggs.map((a, i) => (
                <Scatter
                  key={a.club}
                  name={a.club}
                  data={a.clean.map((s) => ({ x: s.offlineM, y: s.carry }))}
                  fill={colorFor(i)}
                  shape={<SpinArrowDot />}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      {share && <ShareModal envelope={share} onClose={() => setShare(null)} />}
    </div>
  );
}
