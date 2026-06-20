import { useEffect, useRef, useState } from "react";
import { Gauge, Radio, Target, Trophy, Trash2, RotateCcw, ChevronRight, Share2 } from "lucide-react";
import { useStore } from "../store";
import { ClubSelector } from "../components/ClubSelector";
import { api } from "../lib/api";
import { ShareModal } from "../components/ShareModal";
import { buildCombineShare, type ShareEnvelope } from "../lib/share";
import { usePlayerName } from "../lib/usePlayerName";
import {
  STATIONS, BALLS_PER_STATION, TOTAL_BALLS,
  scoreShot, combineScore, gradeLabel, stationLabel, suggestedClubs,
  type CombineResult, type CombineStationResult,
} from "../lib/combine";

type Phase = "idle" | "running" | "done";

export function Combine() {
  const { adapterId, conn, simHit, connect } = useStore();
  const lastShot = useStore((s) => s.current?.shots[0]);
  const clubArmed = useStore((s) => s.clubArmed);
  const selectedClub = useStore((s) => s.selectedClub);
  const setLockClub = useStore((s) => s.setLockClub);
  const profileId = useStore((s) => s.profileId);
  const player = usePlayerName();
  const [share, setShare] = useState<ShareEnvelope | null>(null);
  const connected = conn.status === "connected";

  // Same club stays armed across balls; the player switches when the station changes.
  useEffect(() => {
    setLockClub(true);
    return () => setLockClub(false);
  }, [setLockClub]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [stations, setStations] = useState<CombineStationResult[]>([]);
  const [history, setHistory] = useState<CombineResult[]>([]);
  const startedAtRef = useRef(0);
  const lastIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    api.listCombines(profileId).then(setHistory).catch(() => {});
  }, [profileId]);

  // Baseline so a pre-existing shot isn't consumed on mount.
  useEffect(() => { lastIdRef.current = useStore.getState().current?.shots[0]?.id; }, []);

  const ballsDone = stations.reduce((n, s) => n + s.shots.length, 0);
  const stationIdx = Math.min(Math.floor(ballsDone / BALLS_PER_STATION), STATIONS.length - 1);
  const target = STATIONS[stationIdx];
  const ballInStation = ballsDone % BALLS_PER_STATION;

  useEffect(() => {
    if (phase !== "running") return;
    if (!lastShot || lastShot.id === lastIdRef.current) return;
    lastIdRef.current = lastShot.id;
    const result = scoreShot(target, lastShot);
    setStations((prev) => {
      const next = prev.map((s) => ({ ...s, shots: [...s.shots] }));
      let cur = next[next.length - 1];
      if (!cur || cur.shots.length >= BALLS_PER_STATION) {
        cur = { target, shots: [] };
        next.push(cur);
      }
      cur.shots.push(result);
      return next;
    });
  }, [lastShot, phase, target]);

  // Finish + persist once the last ball is in.
  useEffect(() => {
    if (phase !== "running" || ballsDone < TOTAL_BALLS) return;
    const result: CombineResult = {
      id: `combine_${startedAtRef.current}`,
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      score: combineScore(stations),
      stations,
    };
    api.saveCombine({ ...result, profileId }).catch((e) => console.warn("[combine] save failed:", e));
    setHistory((h) => [result, ...h]);
    setPhase("done");
  }, [ballsDone, phase, stations, profileId]);

  function start() {
    startedAtRef.current = Date.now();
    lastIdRef.current = useStore.getState().current?.shots[0]?.id;
    setStations([]);
    setPhase("running");
  }

  function abort() { setStations([]); setPhase("idle"); }

  async function removeCombine(id: string) {
    if (!confirm("Supprimer ce Combine ?")) return;
    await api.deleteCombine(id).catch(() => {});
    setHistory((h) => h.filter((c) => c.id !== id));
  }

  const score = combineScore(stations);
  const best = history.length ? Math.max(...history.map((c) => c.score)) : null;

  if (phase === "idle") {
    return (
      <div className="grid md:grid-cols-[340px_1fr] gap-4 items-start">
        <section className="card p-5 grid gap-4">
          <h2 className="font-display text-lg flex items-center gap-2">
            <Gauge className="w-5 h-5 text-fairway" /> Combine FlightLab
          </h2>
          <p className="text-sm text-ink/60 leading-relaxed">
            Test standardisé de <b>{TOTAL_BALLS} balles</b> : {BALLS_PER_STATION} balles sur chacune des{" "}
            {STATIONS.length} cibles ({STATIONS.filter((s) => s !== "driver").map(String).join(", ")} m, puis driver).
            Chaque balle est notée de 0 à 100 selon sa précision. Le score final est comparable
            entre joueurs et d'un test à l'autre — refais-le chaque mois pour mesurer ta progression.
          </p>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-panel rounded-xl px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-ink/45">Meilleur score</div>
              <div className="metric text-lg font-semibold text-fairway">{best != null ? best.toFixed(1) : "–"}</div>
            </div>
            <div className="bg-panel rounded-xl px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-ink/45">Tests passés</div>
              <div className="metric text-lg font-semibold">{history.length}</div>
            </div>
          </div>
          {!connected ? (
            <button onClick={() => connect()} className="w-full inline-flex items-center justify-center gap-2
              bg-fairway hover:bg-fairway-light text-white font-semibold rounded-xl px-5 py-3 transition">
              <Radio className="w-4 h-4" /> Connecter pour démarrer
            </button>
          ) : (
            <button onClick={start} className="w-full inline-flex items-center justify-center gap-2
              bg-ink hover:bg-ink/90 text-white font-semibold rounded-xl px-5 py-3 transition">
              <Trophy className="w-4 h-4" /> Démarrer le Combine
            </button>
          )}
        </section>

        <section className="card p-5 grid gap-3">
          <h3 className="text-[10px] uppercase tracking-widest text-ink/40">Historique des Combines</h3>
          {history.length === 0 ? (
            <p className="text-sm text-ink/40 py-6 text-center">
              Aucun Combine pour l'instant. Lance ton premier test pour établir ta référence.
            </p>
          ) : (
            <div className="grid gap-2">
              {history.map((c) => {
                const g = gradeLabel(c.score);
                const isBest = c.score === best;
                return (
                  <div key={c.id} className="group flex items-center gap-3 bg-panel rounded-xl px-4 py-3">
                    <div className={"metric text-xl font-bold " + g.color}>{c.score.toFixed(1)}</div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-2">
                        {g.label} {isBest && <span className="text-[10px] uppercase tracking-wide bg-gold/15 text-gold rounded px-1.5 py-0.5">record</span>}
                      </div>
                      <div className="text-xs text-ink/45">
                        {new Date(c.startedAt).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    {/* score bar */}
                    <div className="ml-auto hidden sm:block w-32 h-2 rounded-full bg-ink/10 overflow-hidden">
                      <div className="h-full rounded-full bg-fairway" style={{ width: `${Math.min(100, c.score)}%` }} />
                    </div>
                    <button onClick={() => setShare(buildCombineShare(c, player))} aria-label="Partager ce Combine"
                      className="ml-auto sm:ml-0 p-1.5 rounded text-ink/0 group-hover:text-ink/25 hover:!text-fairway hover:bg-fairway/10 transition">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeCombine(c.id)} aria-label="Supprimer ce Combine"
                      className="p-1.5 rounded text-ink/0 group-hover:text-ink/25 hover:!text-terracotta hover:bg-terracotta/10 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        {share && <ShareModal envelope={share} onClose={() => setShare(null)} />}
      </div>
    );
  }

  // running / done
  const g = gradeLabel(score);
  return (
    <>
    <div className="grid md:grid-cols-[340px_1fr] gap-4 items-start">
      <div className="grid gap-3">
        <section className="card p-5 grid gap-3">
          <h2 className="font-display text-lg flex items-center gap-2">
            <Gauge className="w-5 h-5 text-fairway" /> Combine · balle {Math.min(ballsDone + 1, TOTAL_BALLS)}/{TOTAL_BALLS}
          </h2>

          {phase === "running" ? (
            <div className="bg-fairway/10 rounded-xl px-4 py-3 grid gap-1">
              <div className="text-[10px] uppercase tracking-wide text-fairway/70">Cible actuelle</div>
              <div className="flex items-baseline gap-2">
                <span className="metric text-3xl font-bold text-fairway">{stationLabel(target)}</span>
                <span className="text-sm text-fairway/70">balle {ballInStation + 1}/{BALLS_PER_STATION}</span>
              </div>
              <div className="text-xs text-ink/50">Clubs suggérés : {suggestedClubs(target)}</div>
            </div>
          ) : (
            <div className="bg-gold/10 rounded-xl px-4 py-3 text-center grid gap-1">
              <div className="text-[10px] uppercase tracking-wide text-gold/80">Combine terminé !</div>
              <div className={"metric text-4xl font-bold " + g.color}>{score.toFixed(1)}</div>
              <div className="text-sm font-semibold text-ink/70">Niveau {g.label}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Tile label="Score moyen" value={ballsDone ? score.toFixed(1) : "–"} accent />
            <Tile label="Stations" value={`${Math.min(stationIdx + (phase === "done" ? 1 : 0), STATIONS.length)}/${STATIONS.length}`} />
          </div>

          {phase === "running" && connected && (
            <div className="grid gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-ink/45">
                Club {clubArmed ? `· ${selectedClub}` : "— à choisir"}
              </span>
              <ClubSelector />
            </div>
          )}

          {phase === "running" && (
            adapterId === "simulator" && connected ? (
              <button onClick={simHit} disabled={!clubArmed}
                className="w-full inline-flex items-center justify-center gap-2 bg-ink hover:bg-ink/90 text-white
                font-semibold rounded-xl px-5 py-3 transition disabled:opacity-50 disabled:cursor-not-allowed">
                <Target className="w-4 h-4" /> {clubArmed ? `Frapper (${stationLabel(target)})` : "Choisis un club"}
              </button>
            ) : connected ? (
              <p className="text-sm text-ink/50">{clubArmed ? "Frappe ta balle — le R10 l'enverra." : "Choisis le club avant de frapper."}</p>
            ) : (
              <button onClick={() => connect()} className="w-full inline-flex items-center justify-center gap-2
                bg-fairway hover:bg-fairway-light text-white font-semibold rounded-xl px-5 py-3 transition">
                <Radio className="w-4 h-4" /> Reconnecter
              </button>
            )
          )}

          {phase === "done" && (
            <button onClick={() => setShare(buildCombineShare(
              { id: `combine_${startedAtRef.current}`, startedAt: startedAtRef.current, score, stations }, player,
            ))} className="inline-flex items-center justify-center gap-2 text-sm font-semibold
              rounded-xl px-3 py-2.5 bg-fairway hover:bg-fairway-light text-white transition">
              <Share2 className="w-4 h-4" /> Partager mon score
            </button>
          )}
          <button onClick={abort} className="inline-flex items-center justify-center gap-2 text-sm font-semibold
            rounded-lg px-3 py-2 bg-panel text-ink/60 hover:bg-ink/5 transition">
            <RotateCcw className="w-4 h-4" /> {phase === "done" ? "Nouveau Combine" : "Abandonner"}
          </button>
        </section>
      </div>

      <section className="card p-5 grid gap-3">
        <h3 className="text-[10px] uppercase tracking-widest text-ink/40">Détail par station</h3>
        <div className="grid gap-1.5">
          {STATIONS.map((t, i) => {
            const st = stations[i];
            const active = phase === "running" && i === stationIdx;
            const avg = st && st.shots.length
              ? st.shots.reduce((a, s) => a + s.score, 0) / st.shots.length : null;
            return (
              <div key={i} className={"flex items-center gap-3 rounded-xl px-4 py-2.5 " +
                (active ? "bg-fairway/10 ring-1 ring-fairway/30" : st ? "bg-panel" : "bg-panel/40")}>
                <span className={"metric text-sm font-semibold w-16 " + (active ? "text-fairway" : "text-ink/70")}>
                  {stationLabel(t)}
                </span>
                <div className="flex gap-1.5">
                  {Array.from({ length: BALLS_PER_STATION }, (_, k) => {
                    const sh = st?.shots[k];
                    return (
                      <span key={k} title={sh ? `${sh.club} · ${sh.carry.toFixed(0)} m carry · ${Math.abs(sh.offline).toFixed(1)} m ${sh.offline < 0 ? "G" : "D"}` : undefined}
                        className={"metric text-xs rounded-md px-2 py-1 min-w-[34px] text-center " +
                          (sh == null ? "bg-ink/5 text-ink/25"
                            : sh.score >= 70 ? "bg-fairway/15 text-fairway font-semibold"
                            : sh.score >= 40 ? "bg-teal/15 text-teal font-semibold"
                            : "bg-terracotta/15 text-terracotta font-semibold")}>
                        {sh == null ? "·" : sh.score}
                      </span>
                    );
                  })}
                </div>
                <span className="ml-auto metric text-sm font-bold text-ink/80">
                  {avg != null ? avg.toFixed(0) : ""}
                </span>
                {active && <ChevronRight className="w-4 h-4 text-fairway" />}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-ink/35">
          Cibles fixes : score sur l'erreur combinée distance + latéral (0 pt à 25 % d'erreur).
          Driver : 100 pts dans un couloir de ±10 m, −4 pts par mètre au-delà.
        </p>
      </section>
    </div>

    {share && <ShareModal envelope={share} onClose={() => setShare(null)} />}
    </>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-panel rounded-xl px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink/45">{label}</div>
      <div className={"metric text-lg font-semibold " + (accent ? "text-fairway" : "text-ink")}>{value}</div>
    </div>
  );
}
