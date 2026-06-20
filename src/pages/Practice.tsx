import { useEffect, useRef, useState } from "react";
import { Target, Radio, RotateCcw, Trophy } from "lucide-react";
import { useStore } from "../store";
import { ClubSelector } from "../components/ClubSelector";
import { ShotTrajectory3D } from "../components/ShotTrajectory3D";
import { applyShot, distToPin, type Hole } from "../lib/course";

interface Attempt { rx: number; ry: number; prox: number; club: string; dist: number }

// Straight, hazard-free practice hole with a target green at distance D.
const practiceHole = (D: number): Hole => ({
  number: 0, par: 3, fairwayHalf: 40, greenRadius: 8, obHalf: 200,
  centerline: [{ x: 0, y: 0 }, { x: 0, y: D }], hazards: [], wind: { wx: 0, wy: 0 },
});

export function Practice() {
  const { adapterId, conn, simHit, connect } = useStore();
  const sessionShots = useStore((s) => s.current?.shots);
  const lastShot = sessionShots?.[0];
  const clubArmed = useStore((s) => s.clubArmed);
  const selectedClub = useStore((s) => s.selectedClub);
  const setLockClub = useStore((s) => s.setLockClub);
  const connected = conn.status === "connected";

  // Practice = same club for the whole set: arm once, stay armed across all balls.
  useEffect(() => {
    setLockClub(true);
    return () => setLockClub(false);
  }, [setLockClub]);

  const [target, setTarget] = useState(120);
  const [random, setRandom] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [challenge, setChallenge] = useState<number | null>(null); // balls remaining
  const lastIdRef = useRef<string | undefined>(undefined);
  const targetRef = useRef(target);
  targetRef.current = target;

  // baseline so a pre-existing shot isn't consumed on mount
  useEffect(() => { lastIdRef.current = useStore.getState().current?.shots[0]?.id; }, []);

  useEffect(() => {
    if (!lastShot || lastShot.id === lastIdRef.current) return;
    if (challenge !== null && challenge <= 0) return;
    lastIdRef.current = lastShot.id;
    const D = targetRef.current;
    const h = practiceHole(D);
    const res = applyShot({ x: 0, y: 0 }, lastShot, { x: 0, y: D }, "tee", h);
    const prox = distToPin(res.ball, h);
    setAttempts((a) => [{ rx: res.ball.x, ry: res.ball.y - D, prox, club: lastShot.club, dist: D }, ...a]);
    if (challenge !== null) setChallenge((c) => (c ?? 0) - 1);
    if (random) setTarget(60 + Math.round(Math.random() * 120));
  }, [lastShot, random, challenge]);

  const shown = challenge !== null ? attempts.slice(0, 10 - Math.max(0, challenge)) : attempts;
  const proxArr = shown.map((a) => a.prox);
  const best = proxArr.length ? Math.min(...proxArr) : 0;
  const avg = proxArr.length ? proxArr.reduce((x, y) => x + y, 0) / proxArr.length : 0;
  const within3 = proxArr.filter((p) => p <= 3).length;
  const onGreen = proxArr.filter((p) => p <= 8).length;
  const challengeDone = challenge !== null && challenge <= 0;

  function reset() { setAttempts([]); setChallenge(null); }
  function startChallenge() { setAttempts([]); setChallenge(10); setRandom(false); }

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
      <div className="grid gap-3">
        <section className="card p-5 grid gap-3">
          <h2 className="font-display text-lg flex items-center gap-2"><Target className="w-5 h-5 text-fairway" /> Targeted practice</h2>

          {challenge === null ? (
            <>
              <label className="grid gap-1 text-sm text-ink/60">
                <span className="flex justify-between">Target distance <b className="metric">{target} m</b></span>
                <input type="range" min={40} max={200} step={5} value={target} disabled={random}
                  onChange={(e) => setTarget(Number(e.target.value))} className="accent-fairway disabled:opacity-40" />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink/60 cursor-pointer select-none">
                <input type="checkbox" checked={random} onChange={(e) => setRandom(e.target.checked)} className="accent-fairway" />
                Random distance each ball
              </label>
            </>
          ) : (
            <div className="bg-gold/10 rounded-xl px-3 py-2 text-sm text-gold flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              {challengeDone ? "Challenge complete!" : `Closest-to-pin challenge · ${challenge} ball${challenge > 1 ? "s" : ""} left`}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Tile label="Balls" value={`${shown.length}`} />
            <Tile label="Closest" value={proxArr.length ? `${best.toFixed(1)} m` : "–"} accent="fairway" />
            <Tile label="Avg proximity" value={proxArr.length ? `${avg.toFixed(1)} m` : "–"} />
            <Tile label="≤ 3 m" value={`${within3}/${shown.length}`} />
            <Tile label="On green" value={`${onGreen}/${shown.length}`} accent="teal" />
            <Tile label="GIR %" value={shown.length ? `${Math.round((onGreen / shown.length) * 100)} %` : "–"} />
          </div>

          {connected && !challengeDone && (
            <div className="grid gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-ink/45">
                {challenge !== null ? "Challenge club" : "Set club"} {clubArmed ? `· ${selectedClub}` : "— to pick"}
              </span>
              <ClubSelector />
            </div>
          )}

          {!connected ? (
            <button onClick={() => connect()} className="w-full inline-flex items-center justify-center gap-2
              bg-fairway hover:bg-fairway-light text-white font-semibold rounded-xl px-5 py-3 transition">
              <Radio className="w-4 h-4" /> Connect to hit
            </button>
          ) : adapterId === "simulator" && !challengeDone ? (
            <button onClick={simHit} disabled={!clubArmed}
              title={!clubArmed ? "Pick a club first" : undefined}
              className="w-full inline-flex items-center justify-center gap-2
              bg-ink hover:bg-ink/90 text-white font-semibold rounded-xl px-5 py-3 transition
              disabled:opacity-50 disabled:cursor-not-allowed">
              <Target className="w-4 h-4" /> {clubArmed ? "Hit" : "Pick a club"} {random && clubArmed ? `(${target} m)` : ""}
            </button>
          ) : !challengeDone ? (
            <p className="text-sm text-ink/50">{clubArmed ? "Hit your ball — the R10 will send it." : "Pick a club before hitting."}</p>
          ) : null}

          <div className="flex gap-2">
            <button onClick={startChallenge} className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold
              rounded-lg px-3 py-2 bg-gold/10 text-gold hover:bg-gold/20 transition">
              <Trophy className="w-4 h-4" /> 10-ball challenge
            </button>
            <button onClick={reset} className="inline-flex items-center justify-center gap-2 text-sm font-semibold
              rounded-lg px-3 py-2 bg-panel text-ink/60 hover:bg-ink/5 transition">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <section className="card p-4">
          <ShotTrajectory3D shot={lastShot} ghosts={(sessionShots ?? []).slice(1, 6)} />
          <p className="text-[11px] text-ink/35 text-center mt-2">3D flight · down-the-line view</p>
        </section>
        <section className="card p-4">
          <DispersionTarget attempts={shown} />
          <p className="text-[11px] text-ink/35 text-center mt-2">Target view · flag at center, rings at 3 / 6 / 8 m</p>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: "fairway" | "teal" }) {
  return (
    <div className="bg-panel rounded-xl px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink/45">{label}</div>
      <div className={"metric text-lg font-semibold " + (accent === "fairway" ? "text-fairway" : accent === "teal" ? "text-teal" : "text-ink")}>{value}</div>
    </div>
  );
}

function DispersionTarget({ attempts }: { attempts: Attempt[] }) {
  const S = 320, C = S / 2;
  const maxR = Math.max(12, ...attempts.map((a) => Math.hypot(a.rx, a.ry) + 2));
  const scale = (C - 16) / maxR;
  const ring = (m: number) => m * scale;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full" style={{ maxHeight: 420 }}>
      <rect x={0} y={0} width={S} height={S} rx={12} fill="#eef3ef" />
      <circle cx={C} cy={C} r={ring(8)} fill="#7ccb97" fillOpacity={0.5} />
      {[8, 6, 3].map((m) => (
        <circle key={m} cx={C} cy={C} r={ring(m)} fill="none" stroke="#16294D" strokeOpacity={0.2} strokeDasharray="3 4" />
      ))}
      {/* crosshair */}
      <line x1={C - 10} y1={C} x2={C + 10} y2={C} stroke="#16294D" strokeOpacity={0.4} />
      <line x1={C} y1={C - 10} x2={C} y2={C + 10} stroke="#16294D" strokeOpacity={0.4} />
      {/* landings (y up = long) */}
      {attempts.map((a, i) => (
        <circle key={i} cx={C + a.rx * scale} cy={C - a.ry * scale} r={i === 0 ? 5 : 3.5}
          fill={i === 0 ? "#C2603A" : "#2F8F5B"} fillOpacity={i === 0 ? 0.95 : 0.6} />
      ))}
      {/* flag */}
      <line x1={C} y1={C} x2={C} y2={C - 16} stroke="#16294D" strokeWidth={1.5} />
      <path d={`M ${C} ${C - 16} l 10 4 l -10 4 z`} fill="#C2603A" />
    </svg>
  );
}
