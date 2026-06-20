import { Target, Crosshair, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { ClubSelector } from "../components/ClubSelector";
import { ShotData } from "../components/ShotData";
import { evaluateShot, ratingColor } from "../lib/shotEval";
import { CLUB_LABELS, type Shot } from "../types";

// Big at-a-glance numbers for the shot just hit.
function HeroStat({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="bg-panel rounded-xl px-3 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-ink/45">{label}</div>
      <div className={"metric text-2xl sm:text-3xl font-bold leading-tight " + (cls ?? "text-ink")}>{value}</div>
      {sub && <div className="text-[11px] text-ink/40 mt-0.5">{sub}</div>}
    </div>
  );
}

function HeroStats({ shot }: { shot: Shot }) {
  const c = evaluateShot(shot).ratings;
  const off = shot.offlineM;
  const offDir = Math.abs(off) < 1 ? "m · droit" : `m · ${off < 0 ? "gauche" : "droite"}`;
  return (
    <section className="card p-4">
      <h3 className="text-[10px] uppercase tracking-widest text-ink/40 mb-3">Dernier coup · {shot.club}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <HeroStat label="Vitesse club" value={shot.clubSpeed.toFixed(0)} sub="km/h" />
        <HeroStat label="Vitesse balle" value={shot.ballSpeed.toFixed(0)} sub="km/h" cls="text-teal" />
        <HeroStat label="Smash" value={shot.smashFactor.toFixed(2)} cls={ratingColor(c.smash)} />
        <HeroStat label="Distance" value={shot.carry.toFixed(0)} sub={`carry · ${shot.total.toFixed(0)} m total`} cls="text-royal" />
        <HeroStat label="Écart latéral" value={Math.abs(off).toFixed(1)} sub={offDir}
          cls={Math.abs(off) > 12 ? "text-terracotta" : "text-ink"} />
      </div>
    </section>
  );
}

export function LiveSession() {
  const { adapterId, conn, current, selectedClub, clubArmed, simHit, endSession, deleteShot } = useStore();
  const shots = current?.shots ?? [];
  const last = shots[0];
  const connected = conn.status === "connected";

  return (
    <div className="grid gap-4">
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-ink flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-fairway" /> Club en main
          </h2>
          <span className="text-sm text-ink/50">{CLUB_LABELS[selectedClub]}</span>
        </div>
        <ClubSelector />

        {!clubArmed && connected && (
          <p className="mt-3 text-sm font-semibold text-gold flex items-center gap-1.5">
            <Crosshair className="w-4 h-4" /> Choisis le club du prochain coup pour l'enregistrer correctement.
          </p>
        )}

        {adapterId === "simulator" && (
          <button
            onClick={simHit}
            disabled={!connected || !clubArmed}
            title={!clubArmed ? "Choisis d'abord un club" : undefined}
            className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2
                       bg-ink hover:bg-ink/90 text-white font-semibold rounded-xl px-6 py-3
                       transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Target className="w-4 h-4" /> Frapper une balle
          </button>
        )}
      </section>

      {last ? (
        <>
          <HeroStats shot={last} />
          <ShotData shot={last} />
        </>
      ) : (
        <section className="card p-8 text-center text-ink/40">
          {connected
            ? "Prêt. Frappe ta première balle pour voir les chiffres apparaître."
            : "Connecte une source pour démarrer une séance."}
        </section>
      )}

      {shots.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <h3 className="font-display text-base">Séance en cours · {shots.length} balles</h3>
            <button
              onClick={endSession}
              className="text-xs font-semibold text-ink/60 hover:text-terracotta transition"
            >
              Terminer & enregistrer
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-ink/40 text-right">
                  <th className="text-left px-4 py-2">Club</th>
                  <th className="px-4 py-2">Carry <span className="text-ink/30 normal-case">(m)</span></th>
                  <th className="px-4 py-2">Total <span className="text-ink/30 normal-case">(m)</span></th>
                  <th className="px-4 py-2">Balle <span className="text-ink/30 normal-case">(km/h)</span></th>
                  <th className="px-4 py-2">Smash</th>
                  <th className="px-4 py-2">AoA <span className="text-ink/30 normal-case">(°)</span></th>
                  <th className="px-4 py-2">Path <span className="text-ink/30 normal-case">(°)</span></th>
                  <th className="px-4 py-2">Face <span className="text-ink/30 normal-case">(°)</span></th>
                  <th className="px-4 py-2">Spin <span className="text-ink/30 normal-case">(rpm)</span></th>
                  <th className="px-4 py-2">Écart <span className="text-ink/30 normal-case">(m)</span></th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="metric">
                {shots.map((s) => {
                  const c = evaluateShot(s).ratings;
                  return (
                  <tr key={s.id} className="text-right border-t border-black/[0.03] hover:bg-panel/50">
                    <td className="text-left px-4 py-2 font-semibold">{s.club}</td>
                    <td className="px-4 py-2">{s.carry.toFixed(0)}</td>
                    <td className="px-4 py-2 text-ink/60">{s.total.toFixed(0)}</td>
                    <td className="px-4 py-2">{s.ballSpeed.toFixed(0)}</td>
                    <td className={"px-4 py-2 font-semibold " + ratingColor(c.smash)}>{s.smashFactor.toFixed(2)}</td>
                    <td className={"px-4 py-2 " + ratingColor(c.attack)}>{s.attackAngle >= 0 ? "+" : "−"}{Math.abs(s.attackAngle).toFixed(1)}°</td>
                    <td className={"px-4 py-2 " + ratingColor(c.clubPath)}>{Math.abs(s.clubPath).toFixed(1)}{s.clubPath < 0 ? "L" : "R"}</td>
                    <td className={"px-4 py-2 " + ratingColor(c.faceToPath)}>{Math.abs(s.clubFace).toFixed(1)}{s.clubFace < 0 ? "L" : "R"}</td>
                    <td className={"px-4 py-2 " + ratingColor(c.spin)}>{s.backSpin.toFixed(0)}</td>
                    <td className={"px-4 py-2 " + (Math.abs(s.offlineM) > 12 ? "text-terracotta" : "text-ink/60")}>
                      {Math.abs(s.offlineM).toFixed(1)}{s.offlineM < 0 ? "L" : "R"}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => current && deleteShot(current.id, s.id)}
                        title="Supprimer ce tir"
                        className="p-1.5 rounded-lg text-ink/25 hover:text-terracotta hover:bg-terracotta/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
