import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { useUnits } from "../lib/useUnits";
import type { Shot } from "../types";

// ── Rating ──────────────────────────────────────────────────────────────────
interface Rating {
  stars:  1 | 2 | 3;
  emoji:  string;
  label:  string;
  color:  string;     // CSS hex
  bg:     string;     // tailwind bg class
}

function rateShot(shot: Shot): Rating {
  const pct = Math.abs(shot.offlineM) / Math.max(1, shot.carry);
  if (pct < 0.05) return { stars: 3, emoji: "🎯", label: "Bullseye!",  color: "#2F8F5B", bg: "bg-emerald-50" };
  if (pct < 0.08) return { stars: 2, emoji: "😊", label: "Nice shot!",       color: "#C68A14", bg: "bg-amber-50"   };
                  return { stars: 1, emoji: "💪", label: "Keep it up!", color: "#C2603A", bg: "bg-orange-50" };
}

// ── Stars ────────────────────────────────────────────────────────────────────
function Stars({ n, color }: { n: 1 | 2 | 3; color: string }) {
  return (
    <div className="flex gap-1 justify-center">
      {[1, 2, 3].map((i) => (
        <svg key={i} width="28" height="28" viewBox="0 0 24 24" fill={i <= n ? color : "#E5E7EB"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

// ── Direction bar ─────────────────────────────────────────────────────────────
// Shows where the ball landed laterally. The bar spans ±maxM metres.
function DirectionBar({ offlineM, carry }: { offlineM: number; carry: number }) {
  const U = useUnits();
  const maxM   = Math.max(20, Math.abs(offlineM) * 1.4);        // at least ±20 m visible
  const pct    = Math.abs(offlineM) / Math.max(1, carry);
  const dotColor = pct < 0.05 ? "#2F8F5B" : pct < 0.08 ? "#C68A14" : "#C2603A";

  // Position of the ball dot: 50% = centre, clamped to 5%–95%
  const pos = Math.max(5, Math.min(95, 50 + (offlineM / maxM) * 50));

  const dirText = Math.abs(offlineM) < 1
    ? "Straight!"
    : offlineM < 0
    ? `${U.fd(Math.abs(offlineM), 1)} left`
    : `${U.fd(offlineM, 1)} right`;

  return (
    <div className="w-full select-none">
      {/* Labels */}
      <div className="flex justify-between text-xs font-mono text-ink/40 mb-1 px-1">
        <span>← left</span>
        <span className="font-semibold" style={{ color: dotColor }}>{dirText}</span>
        <span>right →</span>
      </div>

      {/* Track */}
      <div className="relative h-6 rounded-full bg-panel overflow-visible mx-1">
        {/* Green center zone (5% of carry) */}
        <div
          className="absolute top-0 bottom-0 rounded-full opacity-30"
          style={{
            left:  `${50 - (0.05 * carry / maxM) * 50}%`,
            right: `${50 - (0.05 * carry / maxM) * 50}%`,
            background: "#2F8F5B",
          }}
        />
        {/* Orange zone (5–8%) */}
        <div
          className="absolute top-0 bottom-0 opacity-20"
          style={{
            left:  `${50 - (0.08 * carry / maxM) * 50}%`,
            right: `${50 - (0.05 * carry / maxM) * 50}%`,
            background: "#C68A14",
          }}
        />
        <div
          className="absolute top-0 bottom-0 opacity-20"
          style={{
            left:  `${50 + (0.05 * carry / maxM) * 50}%`,
            right: `${50 - (0.08 * carry / maxM) * 50}%`,
            background: "#C68A14",
          }}
        />
        {/* Centre tick */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-ink/15 rounded-full" />
        {/* Ball dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full shadow-md border-2 border-white transition-all duration-500"
          style={{ left: `calc(${pos}% - 12px)`, background: dotColor }}
        />
      </div>
    </div>
  );
}

// ── Hero: last shot ───────────────────────────────────────────────────────────
function ShotHero({ shot, isRecord }: { shot: Shot; isRecord: boolean }) {
  const U = useUnits();
  const r = rateShot(shot);

  return (
    <div
      key={shot.id}
      className={`card p-6 text-center transition-all ${r.bg}`}
      style={{ border: `2px solid ${r.color}40` }}
    >
      {isRecord && (
        <div
          className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3"
          style={{ background: r.color, color: "#fff" }}
        >
          🏆 New record!
        </div>
      )}

      {/* Emoji */}
      <div className="text-6xl mb-2 leading-none">{r.emoji}</div>

      {/* Carry */}
      <div className="font-mono font-bold leading-none mb-1" style={{ fontSize: "4.5rem", color: r.color }}>
        {U.d(shot.carry)} {U.distUnit}
      </div>
      <div className="text-sm text-ink/40 mb-3">distance</div>

      {/* Stars */}
      <Stars n={r.stars} color={r.color} />
      <div className="font-display text-xl font-semibold mt-2" style={{ color: r.color }}>
        {r.label}
      </div>

      {/* Direction bar */}
      <div className="mt-5">
        <DirectionBar offlineM={shot.offlineM} carry={shot.carry} />
      </div>

      {/* Sub-metrics */}
      <div className="mt-4 flex justify-center gap-6 text-sm">
        <div>
          <div className="text-ink/40 text-xs">Power</div>
          <div className="metric font-semibold">{shot.smashFactor.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-ink/40 text-xs">Ball speed</div>
          <div className="metric font-semibold">{U.fs(shot.ballSpeed)}</div>
        </div>
        <div>
          <div className="text-ink/40 text-xs">Club</div>
          <div className="metric font-semibold">{shot.club}</div>
        </div>
      </div>
    </div>
  );
}

// ── Mini card (history) ───────────────────────────────────────────────────────
function MiniCard({ shot, index }: { shot: Shot; index: number }) {
  const U = useUnits();
  const r = rateShot(shot);
  const dir = Math.abs(shot.offlineM) < 1 ? "↑" : shot.offlineM < 0 ? "←" : "→";
  return (
    <div
      className="card p-3 text-center"
      style={{ border: `1px solid ${r.color}30`, background: `${r.color}08` }}
    >
      <div className="text-[10px] text-ink/30 mb-0.5">#{index}</div>
      <div className="text-lg font-mono font-bold" style={{ color: r.color }}>
        {U.d(shot.carry)}
      </div>
      <div className="text-[10px] text-ink/40 mb-1">{U.distUnit}</div>
      <div className="text-base">{r.emoji}</div>
      <div className="text-xs text-ink/40">{dir}</div>
    </div>
  );
}

// ── Waiting card ──────────────────────────────────────────────────────────────
function Waiting() {
  return (
    <div className="card p-10 text-center">
      <div className="text-7xl mb-4">🏌️</div>
      <div className="font-display text-2xl font-semibold text-ink/60 mb-2">
        Hit a ball!
      </div>
      <div className="text-sm text-ink/40">
        Your results will show up here after each shot.
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function Junior() {
  const U          = useUnits();
  const current    = useStore((s) => s.current);
  const adapterId  = useStore((s) => s.adapterId);
  const simHit     = useStore((s) => s.simHit);
  const conn       = useStore((s) => s.conn);
  const shots      = current?.shots ?? [];
  const lastShot   = shots[0];
  const history    = shots.slice(1);

  const isSimulator  = adapterId === "simulator";
  const isConnected  = conn.status === "connected";

  // Track personal best (carry) for the session
  const bestCarry   = shots.length ? Math.max(...shots.map((s) => s.carry)) : 0;
  const prevBestRef = useRef(0);
  const [isRecord, setIsRecord] = useState(false);

  useEffect(() => {
    if (!lastShot) return;
    const newBest = lastShot.carry > prevBestRef.current + 0.5;
    setIsRecord(newBest);
    if (newBest) prevBestRef.current = lastShot.carry;
  }, [lastShot?.id]);

  return (
    <div className="grid gap-4">
      {/* Header ─────────────────────────────────── */}
      <div className="card px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Junior Mode 🏌️</h1>
          <p className="text-sm text-ink/50">
            {shots.length === 0
              ? "No ball hit yet"
              : `${shots.length} ball${shots.length > 1 ? "s" : ""} hit`}
          </p>
        </div>
        {bestCarry > 0 && (
          <div className="text-right">
            <div className="text-[11px] text-ink/40 uppercase tracking-wide">Best carry</div>
            <div className="metric text-2xl font-bold text-gold">{U.fd(bestCarry)}</div>
          </div>
        )}
      </div>

      {/* Last shot or waiting ────────────────────── */}
      {lastShot
        ? <ShotHero key={lastShot.id} shot={lastShot} isRecord={isRecord} />
        : <Waiting />}

      {/* Simulator fire button ──────────────────── */}
      {isSimulator && isConnected && (
        <button
          onClick={simHit}
          className="w-full py-5 rounded-2xl font-display text-xl font-bold text-white transition active:scale-95"
          style={{ background: "linear-gradient(135deg, #2F8F5B 0%, #3DAE7B 100%)", boxShadow: "0 4px 20px #2F8F5B40" }}
        >
          ⛳ Hit a ball!
        </button>
      )}

      {/* History grid ───────────────────────────── */}
      {history.length > 0 && (
        <div>
          <h2 className="font-display text-sm text-ink/40 uppercase tracking-widest mb-2 px-1">
            Previous balls
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {history.map((s, i) => (
              <MiniCard key={s.id} shot={s} index={shots.length - 1 - i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
