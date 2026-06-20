import { useEffect, useRef, useState } from "react";
import { Users, TrendingUp, Crosshair, Gauge } from "lucide-react";
import {
  Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { api, type Profile } from "../lib/api";
import { aggregateByClub, type ClubAgg } from "../lib/stats";
import { applyFlight } from "../lib/flight";
import type { Session, Shot, Club } from "../types";

// ─── Palette ─────────────────────────────────────────────────────────────────
const COLORS = ["#2F8F5B", "#2F8FA6", "#C68A14", "#C2603A"];

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 12, border: "1px solid rgba(0,0,0,.06)",
  fontFamily: "Manrope, sans-serif", fontSize: 13,
  boxShadow: "0 4px 16px rgba(0,0,0,.08)",
};

// ─── Shot generation ──────────────────────────────────────────────────────────
function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mkId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface ClubTarget {
  carry:     number;   // mean carry (m)
  carrySd:   number;   // shot-to-shot SD (m)
  offlineSd: number;   // lateral SD (m)
  ball:      number;   // ball speed (km/h)
  smash:     number;   // smash factor
  launch:    number;   // launch angle (deg)
  backSpin:  number;   // rpm
  attack:    number;   // attack angle (deg)
}

/** Build one shot with gaussian noise around target stats. sim:true so applyFlight skips. */
function makeShot(club: Club, t: ClubTarget, ts: number): Shot {
  const carry      = clamp(t.carry + gauss() * t.carrySd, t.carry * 0.6, t.carry * 1.35);
  const offlineM   = gauss() * t.offlineSd;
  const ballSpeed  = clamp(t.ball  + gauss() * 2.5,  t.ball  * 0.88, t.ball  * 1.12);
  const smashFactor = clamp(t.smash + gauss() * 0.012, 1.10, 1.50);
  const clubSpeed   = ballSpeed / smashFactor;
  const total       = carry * (club === "Dr" ? 1.12 : 1.05);
  const launchAngle = t.launch + gauss() * 0.6;
  const backSpin    = clamp(t.backSpin + gauss() * 180, t.backSpin * 0.7, t.backSpin * 1.3);
  const clubPath    = gauss() * 2.2;
  const faceToPath  = gauss() * 1.6;
  const clubFace    = clubPath + faceToPath;
  const sideSpin    = faceToPath * 90 + gauss() * 90;
  const spinAxis    = clamp(sideSpin / 110, -24, 24);
  const launchDir   = clubFace * (club === "Dr" ? 0.80 : 0.85) + clubPath * (club === "Dr" ? 0.20 : 0.15);
  const apex        = carry * (0.18 + launchAngle / 210);
  const carryDev    = offlineM * 0.93;
  const attackAngle = t.attack + gauss() * 1.0;

  return {
    id: mkId(),
    ts,
    club,
    ballSpeed, clubSpeed, smashFactor,
    launchAngle, launchDir,
    attackAngle, clubPath, clubFace, faceToPath,
    backSpin, sideSpin: clamp(sideSpin, -14000, 14000), spinAxis,
    carry, total, apex,
    offlineM, carryDeviation: carryDev,
    sim: true,
  };
}

function buildSession(
  name: string, idx: number, startedAt: number,
  targets: Partial<Record<Club, ClubTarget>>,
  shotsPerClub: number,
): Session {
  const shots: Shot[] = [];
  let t = startedAt;
  for (const [club, target] of Object.entries(targets) as [Club, ClubTarget][]) {
    for (let k = 0; k < shotsPerClub; k++) {
      shots.push(makeShot(club, target, t));
      t += 20_000;
    }
  }
  return {
    id: `demo_${name}_s${idx}_${startedAt}`,
    startedAt,
    endedAt: startedAt + 90 * 60_000,
    label: new Date(startedAt).toLocaleDateString("fr-FR", {
      weekday: "short", day: "numeric", month: "short",
    }),
    shots,
  };
}

// ─── Per-player club targets ─────────────────────────────────────────────────

/** Boubou — bon joueur hcp ~5 */
const BOUBOU: Partial<Record<Club, ClubTarget>> = {
  Dr:   { carry: 245, carrySd: 8,  offlineSd: 4.5, ball: 232, smash: 1.47, launch: 11.5, backSpin: 2400,  attack:  2.5 },
  "3W": { carry: 225, carrySd: 7,  offlineSd: 4.5, ball: 215, smash: 1.45, launch: 12.5, backSpin: 3100,  attack: -1.5 },
  "5W": { carry: 210, carrySd: 7,  offlineSd: 4.0, ball: 202, smash: 1.43, launch: 13.5, backSpin: 3700,  attack: -2.0 },
  Hy:   { carry: 190, carrySd: 6,  offlineSd: 4.0, ball: 192, smash: 1.41, launch: 14.5, backSpin: 4200,  attack: -2.5 },
  "5i": { carry: 175, carrySd: 6,  offlineSd: 3.5, ball: 174, smash: 1.40, launch: 16.0, backSpin: 5000,  attack: -3.0 },
  "6i": { carry: 162, carrySd: 5,  offlineSd: 3.0, ball: 163, smash: 1.39, launch: 17.5, backSpin: 5600,  attack: -3.3 },
  "7i": { carry: 145, carrySd: 5,  offlineSd: 3.0, ball: 152, smash: 1.38, launch: 19.0, backSpin: 6200,  attack: -3.6 },
  "8i": { carry: 133, carrySd: 5,  offlineSd: 2.5, ball: 141, smash: 1.37, launch: 21.0, backSpin: 6900,  attack: -3.9 },
  "9i": { carry: 120, carrySd: 4,  offlineSd: 2.5, ball: 130, smash: 1.36, launch: 24.0, backSpin: 7700,  attack: -4.2 },
  PW:   { carry: 105, carrySd: 4,  offlineSd: 2.0, ball: 118, smash: 1.34, launch: 27.0, backSpin: 8500,  attack: -4.5 },
  GW:   { carry:  88, carrySd: 4,  offlineSd: 2.0, ball: 103, smash: 1.32, launch: 30.0, backSpin: 9100,  attack: -4.8 },
  SW:   { carry:  72, carrySd: 3,  offlineSd: 2.0, ball:  90, smash: 1.28, launch: 33.0, backSpin: 9700,  attack: -5.0 },
};

/** Annemarie — débutante hcp ~28 */
const ANNEMARIE: Partial<Record<Club, ClubTarget>> = {
  Dr:   { carry: 155, carrySd: 22, offlineSd: 16, ball: 148, smash: 1.25, launch: 14.0, backSpin: 3500,  attack:  0.5 },
  "3W": { carry: 140, carrySd: 20, offlineSd: 15, ball: 135, smash: 1.24, launch: 14.5, backSpin: 4200,  attack: -1.0 },
  Hy:   { carry: 122, carrySd: 18, offlineSd: 14, ball: 118, smash: 1.22, launch: 16.0, backSpin: 5100,  attack: -2.0 },
  "5i": { carry: 105, carrySd: 17, offlineSd: 13, ball: 106, smash: 1.21, launch: 18.0, backSpin: 5800,  attack: -2.5 },
  "7i": { carry:  88, carrySd: 16, offlineSd: 12, ball:  89, smash: 1.19, launch: 22.0, backSpin: 6900,  attack: -3.0 },
  "9i": { carry:  70, carrySd: 14, offlineSd: 11, ball:  72, smash: 1.17, launch: 27.0, backSpin: 8300,  attack: -3.5 },
  PW:   { carry:  58, carrySd: 12, offlineSd: 10, ball:  62, smash: 1.15, launch: 30.0, backSpin: 9000,  attack: -4.0 },
  SW:   { carry:  42, carrySd: 10, offlineSd:  9, ball:  46, smash: 1.12, launch: 36.0, backSpin: 10000, attack: -4.5 },
};

const SESSIONS = 3;   // sessions per player
const REPS     = 12;  // shots per club per session  (3×12 = 36/club → stable stats)
const DAY      = 86_400_000;

async function seedPlayer(
  name: string,
  targets: Partial<Record<Club, ClubTarget>>,
  existingId?: string,
): Promise<string> {
  if (existingId) await api.deleteProfile(existingId);
  const profile = await api.createProfile(name);
  const now = Date.now();
  const sessions: Session[] = Array.from({ length: SESSIONS }, (_, i) =>
    buildSession(name, i, now - (SESSIONS - i) * 20 * DAY, targets, REPS)
  );
  await api.bulkSessions(sessions, profile.id);
  return profile.id;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────
async function fetchAggs(profileId: string): Promise<ClubAgg[]> {
  const sessions = await api.listSessions(profileId);
  const shots = sessions.flatMap((s) => s.shots.map((sh) => applyFlight(sh)));
  return aggregateByClub(shots);
}

// ─── Radar normalization ──────────────────────────────────────────────────────
const RADAR_AXES = [
  { key: "distance",   label: "Distance",    min: 60,  max: 220, invert: false, unit: " m" },
  { key: "smash",      label: "Smash",       min: 1.10, max: 1.52, invert: false, unit: "" },
  { key: "vitesse",    label: "Vitesse",     min: 60,  max: 210, invert: false, unit: " km/h" },
  { key: "regularite", label: "Régularité",  min: 0,   max: 26,  invert: true,  unit: " m σ" },
  { key: "precision",  label: "Précision",   min: 0,   max: 20,  invert: true,  unit: " m σ" },
] as const;

type RadarKey = (typeof RADAR_AXES)[number]["key"];

function normalize(val: number, min: number, max: number, invert: boolean): number {
  const pct = (val - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, pct));
  return Math.round((invert ? 1 - clamped : clamped) * 100);
}

function buildRadarScores(aggs: ClubAgg[], commonClubs: Set<string>): Record<RadarKey, number> | null {
  const filtered = commonClubs.size ? aggs.filter((a) => commonClubs.has(a.club as string)) : aggs;
  if (!filtered.length) return null;
  const avg = (fn: (a: ClubAgg) => number) => filtered.reduce((s, a) => s + fn(a), 0) / filtered.length;
  return {
    distance:   normalize(avg((a) => a.carry),     60,  220, false),
    smash:      normalize(avg((a) => a.smash),     1.10, 1.52, false),
    vitesse:    normalize(avg((a) => a.ball),      60,  210, false),
    regularite: normalize(avg((a) => a.carrySd),   0,   26, true),
    precision:  normalize(avg((a) => a.offlineSd), 0,   20, true),
  };
}

// ─── Club order ───────────────────────────────────────────────────────────────
const CLUB_ORDER = [
  "Dr","3W","5W","7W","2H","3H","4H","5H",
  "2i","3i","4i","5i","6i","7i","8i","9i","PW","GW","SW","LW",
];
const sortClubs = (clubs: string[]) =>
  [...clubs].sort((a, b) => {
    const ia = CLUB_ORDER.indexOf(a), ib = CLUB_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });

// ─── Radar ───────────────────────────────────────────────────────────────────
function RadarComparison({ profiles, aggsMap }: { profiles: Profile[]; aggsMap: Map<string, ClubAgg[]> }) {
  const profilesWithData = profiles.filter((p) => (aggsMap.get(p.id) ?? []).length > 0);
  const commonClubs: Set<string> = profilesWithData.reduce<Set<string>>((acc, p, i) => {
    const clubs = new Set<string>((aggsMap.get(p.id) ?? []).map((a) => a.club as string));
    if (i === 0) return clubs;
    for (const c of acc) { if (!clubs.has(c)) acc.delete(c); }
    return acc;
  }, new Set<string>());

  const scores = profiles.map((p) => buildRadarScores(aggsMap.get(p.id) ?? [], commonClubs));
  if (scores.every((s) => s === null)) return null;

  const data = RADAR_AXES.map((axis) => {
    const entry: Record<string, string | number> = { subject: axis.label };
    profiles.forEach((p, i) => { const sc = scores[i]; if (sc) entry[p.name] = sc[axis.key]; });
    return entry;
  });

  const rawData = RADAR_AXES.map((axis) => {
    const entry: Record<string, string> = { subject: axis.label };
    profiles.forEach((p) => {
      const all  = aggsMap.get(p.id) ?? [];
      const aggs = commonClubs.size ? all.filter((a) => commonClubs.has(a.club as string)) : all;
      if (!aggs.length) return;
      const avg = (fn: (a: ClubAgg) => number) => aggs.reduce((s, a) => s + fn(a), 0) / aggs.length;
      let raw: number;
      switch (axis.key) {
        case "distance":   raw = avg((a) => a.carry); break;
        case "smash":      raw = avg((a) => a.smash); break;
        case "vitesse":    raw = avg((a) => a.ball);  break;
        case "regularite": raw = avg((a) => a.carrySd); break;
        case "precision":  raw = avg((a) => a.offlineSd); break;
      }
      entry[p.name] = raw!.toFixed(axis.key === "smash" ? 2 : 1) + axis.unit;
    });
    return entry;
  });

  if (commonClubs.size > 0) {
    const clubList = sortClubs([...commonClubs]);
    // append a footnote to the subtitle
    data[0].__clubs = clubList.join(" · ");
  }

  return (
    <section className="card p-5">
      <h3 className="font-display text-base mb-0.5">Profil global</h3>
      <p className="text-sm text-ink/45 mb-1">
        Score 0–100 par dimension · clubs communs :&nbsp;
        <span className="metric font-semibold text-ink/60">{sortClubs([...commonClubs]).join(" · ") || "—"}</span>
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-4 mt-3">
        <div style={{ width: 300, height: 280, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} margin={{ top: 12, right: 28, bottom: 12, left: 28 }}>
              <PolarGrid stroke="rgba(0,0,0,.06)" />
              <PolarAngleAxis dataKey="subject"
                tick={{ fontFamily: "Manrope, sans-serif", fontSize: 12, fill: "rgba(18,24,20,.55)" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              {profiles.map((p, i) => (
                <Radar key={p.id} name={p.name} dataKey={p.name}
                  stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.12} strokeWidth={2}
                  dot={{ r: 3, fill: COLORS[i % COLORS.length], strokeWidth: 0 }} />
              ))}
              <Legend wrapperStyle={{ fontFamily: "Manrope, sans-serif", fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 min-w-0 w-full">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-ink/35 text-right border-b border-black/5">
                <th className="text-left py-1.5 pr-3">Dimension</th>
                {profiles.map((p, i) => (
                  <th key={p.id} className="py-1.5 px-2" style={{ color: COLORS[i % COLORS.length] }}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="metric">
              {rawData.map((row, ri) => {
                const axis = RADAR_AXES[ri];
                const vals = profiles.map((p) => scores[profiles.indexOf(p)]?.[axis.key] ?? -1);
                const maxVal = Math.max(...vals);
                return (
                  <tr key={axis.key} className="text-right border-t border-black/[0.03]">
                    <td className="text-left py-1.5 pr-3 text-ink/55 text-xs">{axis.label}</td>
                    {profiles.map((p, i) => {
                      const isLeader = vals[i] === maxVal && vals.filter(v => v === maxVal).length === 1;
                      return (
                        <td key={p.id} className={"py-1.5 px-2 text-xs " + (isLeader ? "font-bold" : "text-ink/55")}
                          style={isLeader ? { color: COLORS[i % COLORS.length] } : {}}>
                          {row[p.name] ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {profiles.map((p, i) => {
              const sc = scores[i];
              if (!sc) return null;
              const total = Math.round(Object.values(sc).reduce((s, v) => s + v, 0) / RADAR_AXES.length);
              return (
                <div key={p.id} className="rounded-xl px-3 py-2 flex items-center justify-between"
                  style={{ background: COLORS[i % COLORS.length] + "14" }}>
                  <span className="text-xs font-semibold" style={{ color: COLORS[i % COLORS.length] }}>{p.name}</span>
                  <span className="metric text-lg font-bold" style={{ color: COLORS[i % COLORS.length] }}>
                    {total}<span className="text-xs font-normal opacity-60">/100</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Spider (radar) chart per metric — one axis per club ───────────────────────
function RadarBlock({ title, subtitle, data, profiles, domain, formatter = (v: number) => `${v}`, height = 380 }: {
  title: string; subtitle: string; data: Record<string, string | number>[];
  profiles: Profile[]; domain?: [number | string, number | string];
  formatter?: (v: number) => string; height?: number;
}) {
  return (
    <section className="card p-5">
      <h3 className="font-display text-base mb-0.5">{title}</h3>
      <p className="text-sm text-ink/45 mb-4">{subtitle}</p>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 16, right: 40, bottom: 16, left: 40 }}>
            <PolarGrid stroke="rgba(0,0,0,.07)" />
            <PolarAngleAxis dataKey="club"
              tick={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, fill: "rgba(18,24,20,.6)" }} />
            <PolarRadiusAxis domain={domain ?? [0, "auto"]} tick={false} axisLine={false} />
            {profiles.map((p, i) => (
              <Radar key={p.id} name={p.name} dataKey={p.name}
                stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]}
                fillOpacity={0.14} strokeWidth={2}
                dot={{ r: 2.5, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
                isAnimationActive={false} />
            ))}
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, name: string) => [formatter(v), name]} />
            <Legend wrapperStyle={{ fontFamily: "Manrope, sans-serif", fontSize: 12, paddingTop: 8 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ─── Comparison table ─────────────────────────────────────────────────────────
function CompareTable({ clubs, profiles, aggsMap }: {
  clubs: string[]; profiles: Profile[]; aggsMap: Map<string, ClubAgg[]>;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
        <Crosshair className="w-4 h-4 text-teal" />
        <h3 className="font-display text-base">Carry moyen par club · m</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink/40 text-right border-b border-black/5">
              <th className="text-left px-4 py-2 font-medium">Club</th>
              {profiles.map((p, i) => (
                <th key={p.id} className="px-3 py-2 font-semibold" style={{ color: COLORS[i % COLORS.length] }}>{p.name}</th>
              ))}
              {profiles.length >= 2 && <th className="px-3 py-2 font-medium text-ink/30">Δ</th>}
            </tr>
          </thead>
          <tbody className="metric">
            {clubs.map((club) => {
              const vals = profiles.map((p) => aggsMap.get(p.id)?.find((a) => a.club === club)?.carry ?? null);
              const defined = vals.filter((v): v is number => v != null);
              const maxVal  = defined.length ? Math.max(...defined) : null;
              const delta   = defined.length >= 2 ? Math.max(...defined) - Math.min(...defined) : null;
              return (
                <tr key={club} className="text-right border-t border-black/[0.03] hover:bg-panel/50 transition">
                  <td className="text-left px-4 py-2 font-semibold text-ink/80">{club}</td>
                  {profiles.map((p, i) => {
                    const v = vals[i];
                    const isMax = v != null && v === maxVal && defined.length > 1;
                    return (
                      <td key={p.id} className={"px-3 py-2 " + (isMax ? "font-bold" : "text-ink/55")}
                        style={isMax ? { color: COLORS[i % COLORS.length] } : {}}>
                        {v != null ? v.toFixed(0) : <span className="text-ink/25">—</span>}
                      </td>
                    );
                  })}
                  {profiles.length >= 2 && (
                    <td className="px-3 py-2 text-ink/30">
                      {delta != null ? `+${delta.toFixed(0)}` : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Summary cards ────────────────────────────────────────────────────────────
function SummaryCards({ profiles, aggsMap }: { profiles: Profile[]; aggsMap: Map<string, ClubAgg[]> }) {
  const stats = profiles.map((p, i) => {
    const aggs = aggsMap.get(p.id) ?? [];
    if (!aggs.length) return null;
    const avg = (fn: (a: ClubAgg) => number) => aggs.reduce((s, a) => s + fn(a), 0) / aggs.length;
    return { p, i, avgSmash: avg((a) => a.smash), avgDisp: avg((a) => a.offlineSd), avgReg: avg((a) => a.carrySd), drCarry: aggs.find((a) => a.club === "Dr")?.carry ?? null };
  }).filter(Boolean) as Array<{ p: Profile; i: number; avgSmash: number; avgDisp: number; avgReg: number; drCarry: number | null }>;
  if (!stats.length) return null;

  const leader = <K extends keyof typeof stats[0]>(key: K, lower = false) =>
    [...stats].sort((a, b) => lower ? (a[key] as number) - (b[key] as number) : (b[key] as number) - (a[key] as number))[0];

  const smashL = leader("avgSmash"), dispL = leader("avgDisp", true), regL = leader("avgReg", true);
  const drL = stats.filter(s => s.drCarry != null).sort((a, b) => (b.drCarry ?? 0) - (a.drCarry ?? 0))[0];

  const Card = ({ icon: Icon, label, value, sub, color }: { icon: typeof TrendingUp; label: string; value: string; sub: string; color: string }) => (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: color + "18" }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-ink/40 mb-0.5">{label}</div>
        <div className="font-semibold text-sm leading-tight" style={{ color }}>{value}</div>
        <div className="text-xs text-ink/40 truncate">{sub}</div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {drL && <Card icon={TrendingUp} label="Driver le plus long" value={`${drL.drCarry!.toFixed(0)} m`} sub={drL.p.name} color={COLORS[drL.i % COLORS.length]} />}
      <Card icon={Gauge}     label="Meilleur smash factor" value={smashL.avgSmash.toFixed(2)} sub={smashL.p.name} color={COLORS[smashL.i % COLORS.length]} />
      <Card icon={Crosshair} label="Plus précis (dérive)"  value={`±${dispL.avgDisp.toFixed(1)} m`} sub={dispL.p.name} color={COLORS[dispL.i % COLORS.length]} />
      <Card icon={TrendingUp} label="Plus régulier (carry)" value={`±${regL.avgReg.toFixed(1)} m`} sub={regL.p.name} color={COLORS[regL.i % COLORS.length]} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function Compare() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aggsMap, setAggsMap] = useState<Map<string, ClubAgg[]>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [initializing, setInitializing] = useState(false);
  const initRan = useRef(false); // guard against React StrictMode double-fire

  // Load profiles & auto-seed Boubou/Annemarie if they don't exist
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    (async () => {
      const ps = await api.listProfiles().catch(() => [] as Profile[]);
      setProfiles(ps);
      setSelected(new Set(ps.slice(0, 4).map(p => p.id)));

      const hasBoubou    = ps.some(p => p.name.toLowerCase() === "boubou");
      const hasAnnemarie = ps.some(p => p.name.toLowerCase() === "annemarie");
      if (hasBoubou && hasAnnemarie) return;

      setInitializing(true);
      try {
        const existing = (name: string) => ps.find(p => p.name.toLowerCase() === name.toLowerCase());
        const ids: string[] = [];
        if (!hasBoubou)    ids.push(await seedPlayer("Boubou",    BOUBOU,    existing("Boubou")?.id));
        if (!hasAnnemarie) ids.push(await seedPlayer("Annemarie", ANNEMARIE, existing("Annemarie")?.id));

        const fresh = await api.listProfiles();
        setProfiles(fresh);
        setSelected(new Set(fresh.slice(0, 4).map(p => p.id)));
      } catch (e) {
        console.error("Seeding failed:", e);
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  // Fetch aggs for newly selected profiles
  useEffect(() => {
    for (const id of selected) {
      if (!aggsMap.has(id) && !loading.has(id)) {
        setLoading(l => new Set([...l, id]));
        fetchAggs(id)
          .then(aggs => setAggsMap(m => new Map([...m, [id, aggs]])))
          .catch(() => setAggsMap(m => new Map([...m, [id, []]])))
          .finally(() => setLoading(l => { const n = new Set(l); n.delete(id); return n; }));
      }
    }
  }, [selected]);

  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const selectedProfiles = profiles.filter(p => selected.has(p.id));
  const allClubs = sortClubs([...new Set(selectedProfiles.flatMap(p => (aggsMap.get(p.id) ?? []).map(a => a.club)))]);

  function buildData(field: keyof ClubAgg, dp = 1) {
    return allClubs.map(club => {
      const entry: Record<string, string | number> = { club };
      for (const p of selectedProfiles) {
        const agg = aggsMap.get(p.id)?.find(a => a.club === club);
        if (agg) entry[p.name] = +((agg[field] as number).toFixed(dp));
      }
      return entry;
    });
  }

  const hasData = selectedProfiles.some(p => (aggsMap.get(p.id) ?? []).length > 0);

  return (
    <div className="grid gap-4">
      {/* ── Profile picker ────────────────────────────────────────── */}
      <section className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-teal" />
          <h2 className="font-display text-lg leading-none">Comparer les joueurs</h2>
          {initializing && (
            <span className="ml-2 text-xs text-ink/40 flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-ink/20 border-t-ink/50 animate-spin" />
              Génération des profils…
            </span>
          )}
        </div>
        {profiles.length === 0 ? (
          <p className="text-sm text-ink/45">Aucun profil trouvé.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profiles.map((p, i) => {
              const on    = selected.has(p.id);
              const color = COLORS[i % COLORS.length];
              return (
                <button key={p.id} onClick={() => toggle(p.id)}
                  className={"inline-flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2 transition border-2 select-none " +
                    (on ? "text-white border-transparent" : "bg-panel text-ink/40 border-transparent")}
                  style={on ? { backgroundColor: color } : { borderColor: color + "40" }}
                >
                  {p.name}
                  {loading.has(p.id) && <span className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" />}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Empty ─────────────────────────────────────────────────── */}
      {!hasData && !initializing && (
        <div className="card p-10 text-center text-ink/40 text-sm">
          Sélectionne au moins un joueur ayant des séances enregistrées.
        </div>
      )}
      {initializing && !hasData && (
        <div className="card p-10 text-center text-ink/40 text-sm animate-pulse">
          Génération des données de démo…
        </div>
      )}

      {hasData && (
        <>
          {selectedProfiles.length >= 2 && <SummaryCards profiles={selectedProfiles} aggsMap={aggsMap} />}
          {selectedProfiles.length >= 1 && <RadarComparison profiles={selectedProfiles} aggsMap={aggsMap} />}
          <RadarBlock title="Carry par club" subtitle="Moyenne des 30 % meilleurs tirs · mètres · plus loin = plus grand"
            data={buildData("carry")} profiles={selectedProfiles} formatter={v => `${v} m`} />
          {allClubs.length > 0 && <CompareTable clubs={allClubs} profiles={selectedProfiles} aggsMap={aggsMap} />}
          <RadarBlock title="Smash factor par club" subtitle="Ratio vitesse balle / vitesse club · plus grand = mieux"
            data={buildData("smash", 2)} profiles={selectedProfiles} domain={[1, 1.5]} formatter={v => v.toFixed(2)} />
          <RadarBlock title="Régularité carry (σ)" subtitle="Écart-type du carry · polygone plus petit = plus régulier"
            data={buildData("carrySd")} profiles={selectedProfiles} formatter={v => `±${v} m`} />
          <RadarBlock title="Dispersion latérale (σ)" subtitle="Écart-type de la dérive · polygone plus petit = plus précis"
            data={buildData("offlineSd")} profiles={selectedProfiles} formatter={v => `±${v} m`} />
        </>
      )}
    </div>
  );
}
