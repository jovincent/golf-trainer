import { Fragment, type ReactNode } from "react";
import {
  formatDate,
  type RoundShareData, type SessionShareData, type CombineShareData, type StatsShareData,
} from "../../lib/share";

// ── Shared frame ──────────────────────────────────────────────────────────────
// Every share card is the same branded poster: yellow liseré, navy header with
// the FlightLab wordmark + context, a body, and a footer CTA. `data-share-card`
// marks the printable region (see the @media print rule in index.css).

function ShareFrame({ eyebrow, context, player, ts, accent = "fairway", children }: {
  eyebrow: string; context: string; player: string; ts: number;
  accent?: "fairway" | "gold" | "teal"; children: ReactNode;
}) {
  return (
    <div data-share-card
      className="w-[560px] max-w-full bg-surface rounded-[20px] overflow-hidden lisere-top"
      style={{ boxShadow: "var(--shadow-soft)", border: "1px solid var(--border-card)" }}
    >
      <header className="bg-ink text-white px-7 pt-7 pb-6 relative overflow-hidden">
        {/* soft accent glow */}
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-20"
          style={{ background: `radial-gradient(circle, rgb(var(--c-${accent})) 0%, transparent 70%)` }} />
        <div className="flex items-center gap-2.5 relative">
          <div className="w-8 h-8 rounded-lg bg-royal grid place-items-center text-white font-extrabold text-xs tracking-tight">FL</div>
          <span className="text-base font-extrabold tracking-tight">Flight<span className="serif">Lab</span></span>
          <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-white/55 font-semibold">{eyebrow}</span>
        </div>
        <div className="mt-5 relative">
          <div className="text-2xl font-display font-semibold leading-tight">{context}</div>
          <div className="text-sm text-white/55 mt-0.5">{player} · {formatDate(ts)}</div>
        </div>
      </header>
      <main className="px-7 py-6 grid gap-5">{children}</main>
      <footer className="px-7 py-3.5 flex items-center justify-between text-[11px] text-ink/45"
        style={{ borderTop: "1px solid var(--border-card)", background: "rgb(var(--c-panel) / .4)" }}>
        <span className="font-semibold text-ink/60">Généré avec FlightLab</span>
        <span>Analyse de swing &amp; entraînement golf connecté</span>
      </footer>
    </div>
  );
}

function StatTile({ label, value, sub, color = "text-ink" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-panel rounded-xl px-3 py-2.5 text-center">
      <div className="text-[9px] uppercase tracking-wide text-ink/45 mb-1">{label}</div>
      <div className={"metric text-xl font-bold leading-none " + color}>{value}</div>
      {sub && <div className="text-[10px] text-ink/40 mt-0.5">{sub}</div>}
    </div>
  );
}

const vsParColor = (d: number) => (d < 0 ? "text-fairway" : d === 0 ? "text-teal" : "text-terracotta");
const vsParLabel = (d: number) => (d === 0 ? "PAR" : d > 0 ? `+${d}` : `${d}`);

// ── Round (scorecard) ─────────────────────────────────────────────────────────

export function RoundCard({ player, d }: { player: string; d: RoundShareData }) {
  const front = d.holes.filter((h) => h.number <= 9);
  const back = d.holes.filter((h) => h.number > 9);
  const breakdown = [
    { k: "Eagles", v: d.counts.eagles, c: "text-gold bg-gold/10" },
    { k: "Birdies", v: d.counts.birdies, c: "text-fairway bg-fairway/10" },
    { k: "Pars", v: d.counts.pars, c: "text-teal bg-teal/10" },
    { k: "Bogeys", v: d.counts.bogeys, c: "text-ink/70 bg-panel" },
    { k: "+", v: d.counts.others, c: "text-terracotta bg-terracotta/10" },
  ].filter((b) => b.v > 0);

  return (
    <ShareFrame eyebrow="Carte de score" context={d.course} player={player} ts={d.playedAt} accent="fairway">
      {/* Hero */}
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Score total</div>
        <div className="flex items-end justify-center gap-3 mt-1">
          <span className="serif text-7xl font-semibold leading-none text-ink" style={{ fontStyle: "normal" }}>{d.strokes}</span>
          <span className={"mb-2 metric text-2xl font-bold " + vsParColor(d.vsPar)}>{vsParLabel(d.vsPar)}</span>
        </div>
        <div className="text-sm text-ink/50 mt-1">Par {d.par} · {d.holes.length} trous</div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        {d.girPct != null && <StatTile label="Greens régul." value={`${Math.round(d.girPct)}%`} color="text-fairway" />}
        {d.firPct != null && <StatTile label="Fairways" value={`${Math.round(d.firPct)}%`} color="text-teal" />}
        {d.avgPutts != null && <StatTile label="Putts / trou" value={d.avgPutts.toFixed(1)} />}
      </div>

      {/* Breakdown pills */}
      {breakdown.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {breakdown.map((b) => (
            <span key={b.k} className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold " + b.c}>
              {b.v} <span className="text-xs font-medium opacity-70">{b.k}</span>
            </span>
          ))}
        </div>
      )}

      {/* Mini scorecard */}
      {d.holes.length > 0 && (
        <div className="grid gap-2">
          <NineRow label="Aller" holes={front} />
          {back.length > 0 && <NineRow label="Retour" holes={back} />}
        </div>
      )}
    </ShareFrame>
  );
}

function NineRow({ label, holes }: { label: string; holes: { number: number; par: number; strokes: number }[] }) {
  const strokes = holes.reduce((a, h) => a + h.strokes, 0);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-card)" }}>
      <div className="grid items-center text-center" style={{ gridTemplateColumns: `54px repeat(${holes.length}, 1fr) 44px` }}>
        <Cell className="text-[9px] uppercase tracking-wide text-ink/45 bg-panel/60 justify-start pl-2.5">{label}</Cell>
        {holes.map((h) => <Cell key={h.number} className="text-[10px] text-ink/40 bg-panel/60">{h.number}</Cell>)}
        <Cell className="text-[9px] uppercase text-ink/45 bg-panel/60">Tot</Cell>
      </div>
      <div className="grid items-center text-center" style={{ gridTemplateColumns: `54px repeat(${holes.length}, 1fr) 44px` }}>
        <Cell className="text-[10px] text-ink/45 justify-start pl-2.5">Score</Cell>
        {holes.map((h) => {
          const d = h.strokes - h.par;
          const c = d < 0 ? "text-fairway font-bold" : d === 0 ? "text-ink/70" : d === 1 ? "text-terracotta" : "text-terracotta font-bold";
          return <Cell key={h.number} className={"metric text-sm " + c}>{h.strokes}</Cell>;
        })}
        <Cell className="metric text-sm font-bold text-ink">{strokes}</Cell>
      </div>
    </div>
  );
}

function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"py-1.5 flex items-center justify-center " + className}>{children}</div>;
}

// ── Session (practice) ────────────────────────────────────────────────────────

export function SessionCard({ player, d }: { player: string; d: SessionShareData }) {
  const maxCarry = d.bars.length ? Math.max(...d.bars.map((b) => b.carry)) : 1;
  return (
    <ShareFrame eyebrow="Séance d'entraînement" context={d.label} player={player} ts={d.playedAt} accent="teal">
      {/* Hero — longest shot */}
      {d.longest && (
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Coup le plus long</div>
          <div className="flex items-end justify-center gap-2 mt-1">
            <span className="serif text-7xl font-semibold leading-none text-fairway" style={{ fontStyle: "normal" }}>{Math.round(d.longest.carry)}</span>
            <span className="mb-3 text-2xl font-display text-ink/40">m</span>
          </div>
          <div className="text-sm text-ink/50 mt-1">
            <span className="font-bold text-ink/70">{d.longest.club}</span> · {Math.round(d.longest.total)} m total
          </div>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Balles" value={`${d.balls}`} />
        <StatTile label="Distance cumul." value={`${(d.totalCarry / 1000).toFixed(1)} km`} color="text-teal" />
        {d.bestSmash && <StatTile label="Smash max" value={d.bestSmash.smash.toFixed(2)} sub={d.bestSmash.club} color="text-gold" />}
        {d.topBallSpeed && <StatTile label="V. balle max" value={`${Math.round(d.topBallSpeed.speed)}`} sub="km/h" color="text-fairway" />}
      </div>

      {/* Club carry bars */}
      {d.bars.length > 0 && (
        <div className="grid gap-1.5">
          <div className="text-[9px] uppercase tracking-wide text-ink/45">Carry moyen par club</div>
          {d.bars.map((b) => (
            <div key={b.club} className="flex items-center gap-2.5">
              <span className="font-display text-sm font-bold text-ink/70 w-9 shrink-0">{b.club}</span>
              <div className="flex-1 h-5 rounded-md bg-panel overflow-hidden">
                <div className="h-full rounded-md bg-gradient-to-r from-fairway to-teal flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(14, (b.carry / maxCarry) * 100)}%` }}>
                  <span className="metric text-[11px] font-bold text-white">{Math.round(b.carry)}</span>
                </div>
              </div>
              <span className="text-[10px] text-ink/35 w-7 shrink-0 text-right">×{b.n}</span>
            </div>
          ))}
        </div>
      )}
    </ShareFrame>
  );
}

// ── Combine ───────────────────────────────────────────────────────────────────

export function CombineCard({ player, d }: { player: string; d: CombineShareData }) {
  const gradeColor =
    d.score >= 85 ? "text-gold" : d.score >= 70 ? "text-fairway" : d.score >= 55 ? "text-teal" : "text-ink";
  return (
    <ShareFrame eyebrow="Combine FlightLab" context="Test standardisé" player={player} ts={d.playedAt} accent="gold">
      {/* Hero — score /100 */}
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Score Combine</div>
        <div className="flex items-end justify-center gap-2 mt-1">
          <span className={"serif text-7xl font-semibold leading-none " + gradeColor} style={{ fontStyle: "normal" }}>{d.score.toFixed(1)}</span>
          <span className="mb-3 text-xl font-display text-ink/30">/100</span>
        </div>
        <div className={"inline-block mt-2 rounded-full px-4 py-1 text-sm font-bold " +
          gradeColor + " " + (d.score >= 85 ? "bg-gold/10" : d.score >= 70 ? "bg-fairway/10" : d.score >= 55 ? "bg-teal/10" : "bg-panel")}>
          Niveau {d.grade}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Balles" value={`${d.balls}`} />
        <StatTile label="Stations" value={`${d.stations.length}`} />
        {d.best && <StatTile label="Meilleure cible" value={d.best.label} sub={`${Math.round(d.best.avg)} pts`} color="text-fairway" />}
      </div>

      {/* Station bars */}
      {d.stations.length > 0 && (
        <div className="grid gap-1.5">
          <div className="text-[9px] uppercase tracking-wide text-ink/45">Score par station</div>
          {d.stations.map((s) => {
            const c = s.avg >= 70 ? "from-fairway to-teal" : s.avg >= 40 ? "from-teal to-teal" : "from-terracotta to-gold";
            return (
              <div key={s.label} className="flex items-center gap-2.5">
                <span className="metric text-xs font-semibold text-ink/60 w-12 shrink-0">{s.label}</span>
                <div className="flex-1 h-4 rounded bg-panel overflow-hidden">
                  <div className={"h-full rounded bg-gradient-to-r " + c} style={{ width: `${Math.max(4, s.avg)}%` }} />
                </div>
                <span className="metric text-xs font-bold text-ink/70 w-7 shrink-0 text-right">{Math.round(s.avg)}</span>
              </div>
            );
          })}
        </div>
      )}
    </ShareFrame>
  );
}

// ── Stats (all-time bag) ──────────────────────────────────────────────────────

export function StatsCard({ player, d }: { player: string; d: StatsShareData }) {
  const maxCarry = d.bars.length ? Math.max(...d.bars.map((b) => b.carry)) : 1;
  return (
    <ShareFrame eyebrow="Statistiques" context="Profil de jeu complet" player={player} ts={d.generatedAt} accent="teal">
      {/* Hero — longest club average */}
      {d.topClub && (
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Club le plus long · {d.topClub.club}</div>
          <div className="flex items-end justify-center gap-2 mt-1">
            <span className="serif text-7xl font-semibold leading-none text-fairway" style={{ fontStyle: "normal" }}>{Math.round(d.topClub.carry)}</span>
            <span className="mb-3 text-2xl font-display text-ink/40">m</span>
          </div>
          <div className="text-sm text-ink/50 mt-1">
            carry moyen · smash {d.topClub.smash.toFixed(2)} · {Math.round(d.topClub.ball)} km/h
          </div>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Balles" value={`${d.balls}`} />
        <StatTile label="Clubs" value={`${d.clubs}`} />
        <StatTile label="Smash moyen" value={d.avgSmash.toFixed(2)} color="text-gold" />
        {d.tightest && <StatTile label="Plus régulier" value={d.tightest.club} sub={`±${d.tightest.sd.toFixed(1)} m`} color="text-teal" />}
      </div>

      {/* Per-club breakdown: carry (with inline bar) + speeds, smash, dispersion % */}
      {d.bars.length > 0 && (
        <div className="grid gap-1">
          <div className="text-[9px] uppercase tracking-wide text-ink/45">Détail par club</div>
          <div className="grid items-center gap-x-2 text-right"
            style={{ gridTemplateColumns: "26px 1.6fr 0.9fr 0.9fr 0.8fr 0.9fr" }}>
            {/* header */}
            <span className="text-[8px] uppercase tracking-wide text-ink/40 text-left">Club</span>
            <span className="text-[8px] uppercase tracking-wide text-ink/40">Carry</span>
            <span className="text-[8px] uppercase tracking-wide text-ink/40">V.club</span>
            <span className="text-[8px] uppercase tracking-wide text-ink/40">V.balle</span>
            <span className="text-[8px] uppercase tracking-wide text-ink/40">Smash</span>
            <span className="text-[8px] uppercase tracking-wide text-ink/40">Disp.</span>
            {d.bars.map((b) => (
              <Fragment key={b.club}>
                <span className="font-display text-xs font-bold text-ink/80 text-left">{b.club}</span>
                <div className="relative h-4 rounded bg-panel overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-fairway/30 to-teal/30"
                    style={{ width: `${Math.max(12, (b.carry / maxCarry) * 100)}%` }} />
                  <span className="absolute inset-0 flex items-center justify-end pr-1.5 metric text-[11px] font-bold text-fairway">{Math.round(b.carry)}</span>
                </div>
                <span className="metric text-[11px] text-ink/60">{Math.round(b.clubSpeed)}</span>
                <span className="metric text-[11px] text-teal">{Math.round(b.ballSpeed)}</span>
                <span className="metric text-[11px] text-gold">{b.smash.toFixed(2)}</span>
                <span className="metric text-[11px] text-ink/60">{b.dispPct.toFixed(1)}%</span>
              </Fragment>
            ))}
          </div>
          <p className="text-[8px] text-ink/35 mt-0.5">Carry en m · vitesses en km/h · Disp. = dispersion latérale (% du carry)</p>
        </div>
      )}
    </ShareFrame>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function ShareCard({ kind, player, data }: {
  kind: string; player: string; data: unknown;
}) {
  if (kind === "round") return <RoundCard player={player} d={data as RoundShareData} />;
  if (kind === "session") return <SessionCard player={player} d={data as SessionShareData} />;
  if (kind === "combine") return <CombineCard player={player} d={data as CombineShareData} />;
  if (kind === "stats") return <StatsCard player={player} d={data as StatsShareData} />;
  return <div className="card p-6 text-ink/50">Type de partage inconnu.</div>;
}
