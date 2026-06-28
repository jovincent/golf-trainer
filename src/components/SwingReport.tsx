import { Check, X } from "lucide-react";
import type { SwingMetrics, SwingChecks } from "../lib/pose";
import type { SwingReportSummary } from "../lib/api";

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

// Green (ideal) → amber → red (bad) ramp for the angle values.
const GR_RAMP: [number, [number, number, number]][] = [
  [0.0, [0xc2, 0x60, 0x3a]], // terracotta
  [0.5, [0xc9, 0xa2, 0x27]], // gold
  [1.0, [0x2f, 0x8f, 0x5b]], // fairway
];
function greenRed(q: number): string {
  const t = Math.max(0, Math.min(1, q));
  for (let i = 1; i < GR_RAMP.length; i++) {
    const [p1, c1] = GR_RAMP[i - 1], [p2, c2] = GR_RAMP[i];
    if (t <= p2) {
      const f = (t - p1) / (p2 - p1);
      const ch = (a: number, b: number) => Math.round(a + (b - a) * f);
      return `rgb(${ch(c1[0], c2[0])}, ${ch(c1[1], c2[1])}, ${ch(c1[2], c2[2])})`;
    }
  }
  return "rgb(47,143,91)";
}

/** Per-phase position checks (address / top / contact); angle values use a green→red ramp. */
export function SwingChecksList({ checks }: { checks: SwingChecks }) {
  const phases: [string, SwingChecks["address"]][] = [
    ["Address", checks.address], ["Top", checks.top], ["Contact", checks.contact],
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {phases.map(([label, items]) => (
        <div key={label}>
          <div className="text-[10px] uppercase tracking-widest text-ink/40 mb-1.5">{label}</div>
          <ul className="grid gap-1">
            {items.map((c, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs">
                {c.ok
                  ? <Check className="w-3.5 h-3.5 text-fairway shrink-0" />
                  : <X className="w-3.5 h-3.5 text-terracotta shrink-0" />}
                <span className={c.ok ? "text-ink/70" : "text-terracotta font-medium"}>{c.label}</span>
                {c.detail && (
                  <span className="metric ml-auto text-[11px] font-semibold pl-1" style={{ color: greenRed(c.quality) }}>
                    {c.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Tempo / head / posture summary for one analysed swing. */
export function SwingReportGrid({ report: r, compact = false }: { report: SwingReportSummary; compact?: boolean }) {
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
      {!compact && <SwingStat label="Swing length" value={`${((r.backswingMs + r.downswingMs) / 1000).toFixed(2)} s`} />}
    </div>
  );
}
