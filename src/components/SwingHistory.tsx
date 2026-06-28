import { useEffect, useState } from "react";
import { Images, Trash2, Film } from "lucide-react";
import { api, type SwingRecord } from "../lib/api";
import { useStore } from "../store";
import { SwingReportGrid, SwingChecksList } from "./SwingReport";

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleString("en-US", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Recorded swings for the active profile: video clip + its pose analysis. */
export function SwingHistory() {
  const profileId = useStore((s) => s.profileId);
  const [swings, setSwings] = useState<SwingRecord[] | null>(null);

  useEffect(() => {
    let alive = true;
    api.listSwings(profileId).then((s) => alive && setSwings(s)).catch(() => alive && setSwings([]));
    return () => { alive = false; };
  }, [profileId]);

  async function remove(id: string) {
    setSwings((s) => s?.filter((x) => x.id !== id) ?? null);
    api.deleteSwing(id).catch(() => {});
  }

  if (!swings || swings.length === 0) return null; // nothing recorded yet → stay out of the way

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
        <h3 className="font-display text-base flex items-center gap-2">
          <Film className="w-4 h-4 text-teal" /> Swing recordings
        </h3>
        <span className="metric text-xs text-ink/40">{swings.length}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 p-3">
        {swings.map((sw) => (
          <div key={sw.id} className="rounded-xl border border-black/5 bg-panel/30 overflow-hidden">
            {sw.hasMedia ? (
              <img
                src={api.swingMediaUrl(sw.id)}
                alt="Address, top and contact key frames"
                loading="lazy"
                className="w-full bg-ink/90 object-contain"
              />
            ) : (
              <div className="w-full aspect-video bg-ink/90 grid place-items-center text-white/40 text-xs gap-1.5">
                <Images className="w-5 h-5" /> data only · no key frames
              </div>
            )}

            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm">
                  <span className="font-semibold">{fmtDate(sw.ts)}</span>
                  {sw.club && <span className="metric ml-2 text-[11px] font-semibold rounded-full px-2 py-0.5 bg-royal/10 text-royal">{sw.club}</span>}
                </div>
                <button
                  onClick={() => remove(sw.id)}
                  title="Delete this swing"
                  aria-label="Delete swing"
                  className="p-1.5 rounded-lg text-ink/25 hover:text-terracotta hover:bg-terracotta/10 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {sw.report ? (
                <>
                  <SwingReportGrid report={sw.report} compact />
                  {sw.report.checks && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <SwingChecksList checks={sw.report.checks} />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-ink/40">No analysis saved.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
