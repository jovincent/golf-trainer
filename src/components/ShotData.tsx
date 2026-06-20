import type { Shot } from "../types";
import { evaluateShot, ratingColor } from "../lib/shotEval";
import { CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Full per-shot readout in ONE steady, gridded panel (no per-group boxes):
 * big, colour-coded values that stay readable from across the room. Updates
 * whenever `shot` changes. A compact good/to-fix coaching strip sits above it.
 */

const lr = (v: number, dp = 1) => `${Math.abs(v).toFixed(dp)}${v < 0 ? "L" : "R"}`;
const signed = (v: number, dp = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(dp)}`;

interface Cell { label: string; value: string; unit?: string; cls?: string }

function MetricCell({ label, value, unit, cls }: Cell) {
  return (
    <div className="bg-surface px-3 py-3">
      <div className="text-[10px] uppercase tracking-wide text-ink/40 truncate">{label}</div>
      <div className="leading-none mt-1">
        <span className={"metric text-2xl font-bold " + (cls ?? "text-ink")}>{value}</span>
        {unit && <span className="text-[11px] font-medium text-ink/35 ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

export function ShotData({ shot }: { shot: Shot }) {
  const carryDev = shot.carryDeviation ?? shot.offlineM;
  const ev = evaluateShot(shot);
  const c = ev.ratings;

  const cells: Cell[] = [
    { label: "Carry", value: shot.carry.toFixed(0), unit: "m", cls: "text-fairway" },
    { label: "Total", value: shot.total.toFixed(0), unit: "m" },
    { label: "Apex", value: shot.apex.toFixed(0), unit: "m" },
    { label: "Ball speed", value: shot.ballSpeed.toFixed(0), unit: "km/h", cls: "text-teal" },
    { label: "Club speed", value: shot.clubSpeed.toFixed(0), unit: "km/h" },
    { label: "Smash", value: shot.smashFactor.toFixed(2), cls: ratingColor(c.smash) },
    { label: "Launch", value: shot.launchAngle.toFixed(1), unit: "°", cls: ratingColor(c.launch) },
    { label: "Attack", value: signed(shot.attackAngle), unit: "°", cls: ratingColor(c.attack) },
    { label: "Club path", value: lr(shot.clubPath), unit: "°", cls: ratingColor(c.clubPath) },
    { label: "Club face", value: lr(shot.clubFace), unit: "°" },
    { label: "Face to path", value: lr(shot.faceToPath), unit: "°", cls: ratingColor(c.faceToPath) },
    { label: "Backspin", value: shot.backSpin.toFixed(0), unit: "rpm", cls: ratingColor(c.spin) },
    { label: "Sidespin", value: lr(shot.sideSpin, 0), unit: "rpm" },
    { label: "Spin axis", value: lr(shot.spinAxis), unit: "°" },
    { label: "Offline", value: lr(shot.offlineM), unit: "m", cls: Math.abs(shot.offlineM) > 12 ? "text-terracotta" : "text-ink" },
    { label: "Carry dev.", value: lr(carryDev), unit: "m" },
  ];

  return (
    <div className="grid gap-3">
      {(ev.good.length > 0 || ev.bad.length > 0) && (
        <section className="card p-4 grid gap-1.5">
          <h3 className="text-[10px] uppercase tracking-widest text-ink/40">Shot analysis · {shot.club}</h3>
          {ev.bad.map((b, i) => (
            <div key={"b" + i} className="flex items-start gap-2 text-sm text-terracotta">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {b}
            </div>
          ))}
          {ev.good.map((g, i) => (
            <div key={"g" + i} className="flex items-start gap-2 text-sm text-fairway">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {g}
            </div>
          ))}
        </section>
      )}

      {/* One steady gridded panel — 16 cells, hairline separators via the 1px gap. */}
      <section className="card overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-px bg-ink/[0.06]">
          {cells.map((cell) => <MetricCell key={cell.label} {...cell} />)}
        </div>
      </section>
    </div>
  );
}
