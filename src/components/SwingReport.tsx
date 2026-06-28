import type { SwingMetrics, SwingReport } from "../lib/pose";

/** Right / Left-handed toggle (picks the lead side for the metrics). */
export function HandednessToggle({ rightHanded, onChange }: { rightHanded: boolean; onChange: (rh: boolean) => void }) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden ring-1 ring-black/10 text-[11px] font-bold shrink-0">
      {([["Right", true], ["Left", false]] as const).map(([lbl, rh]) => (
        <button key={lbl} onClick={() => onChange(rh)}
          className={"px-2.5 py-1 transition " + (rightHanded === rh ? "bg-ink text-white" : "text-ink/45 hover:bg-ink/5")}>
          {lbl}-handed
        </button>
      ))}
    </div>
  );
}

export function SwingStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="bg-panel rounded-xl px-3 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-ink/45">{label}</div>
      <div className={"metric text-xl font-bold leading-tight " + (tone ?? "text-ink")}>{value}</div>
      {hint && <div className="text-[11px] text-ink/40 mt-0.5">{hint}</div>}
    </div>
  );
}

/** Live posture angles (updates every frame). */
export function SwingLiveMetrics({ live }: { live: SwingMetrics | null }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <SwingStat label="Spine lean" value={live ? `${live.spineAngle.toFixed(0)}°` : "—"} hint="from vertical" />
      <SwingStat label="Shoulder tilt" value={live ? `${live.shoulderTilt.toFixed(0)}°` : "—"} hint="from level" />
      <SwingStat label="Hip tilt" value={live ? `${live.hipTilt.toFixed(0)}°` : "—"} hint="from level" />
      <SwingStat label="Lead knee" value={live ? `${live.kneeFlex.toFixed(0)}°` : "—"} hint="flex" />
    </div>
  );
}

/** Tempo / head / posture summary for one analysed swing. */
export function SwingReportGrid({ report: r, compact = false }: { report: SwingReport; compact?: boolean }) {
  const tempo = r.tempoRatio > 0 ? `${r.tempoRatio.toFixed(1)} : 1` : "—";
  const tempoTone = r.tempoRatio >= 2.3 && r.tempoRatio <= 3.7 ? "text-fairway" : "text-gold";
  const headTone = r.headMovement < 6 ? "text-fairway" : r.headMovement < 12 ? "text-gold" : "text-terracotta";
  const spineTone = r.spineRange < 8 ? "text-fairway" : r.spineRange < 16 ? "text-gold" : "text-terracotta";
  return (
    <div className={"grid gap-2 " + (compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
      <SwingStat label="Tempo (back : down)" value={tempo} hint="pros ≈ 3 : 1" tone={tempoTone} />
      <SwingStat label="Head movement" value={`${r.headMovement.toFixed(1)}%`} hint="of frame" tone={headTone} />
      <SwingStat label="Posture change" value={`${r.spineRange.toFixed(0)}°`} hint="spine, lower = steadier" tone={spineTone} />
      {!compact && <SwingStat label="Backswing" value={`${(r.backswingMs / 1000).toFixed(2)} s`} />}
      {!compact && <SwingStat label="Downswing" value={`${(r.downswingMs / 1000).toFixed(2)} s`} />}
      {!compact && <SwingStat label="Max shoulder tilt" value={`${r.maxShoulderTilt.toFixed(0)}°`} />}
      {!compact && <SwingStat label="Frames" value={`${r.frames.length}`} />}
      {!compact && <SwingStat label="Swing length" value={`${((r.backswingMs + r.downswingMs) / 1000).toFixed(2)} s`} />}
    </div>
  );
}
