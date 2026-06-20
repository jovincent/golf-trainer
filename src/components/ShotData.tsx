import type { Shot } from "../types";
import { evaluateShot, ratingColor } from "../lib/shotEval";
import { CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Full per-shot data readout — every field the Garmin R10 reports, grouped.
 * Metric units (m / km/h). Values are colour-coded by the per-shot decision
 * tree, with a good/to-fix summary. Updates whenever `shot` changes.
 */

const lr = (v: number, dp = 1, unit = "°") =>
  `${Math.abs(v).toFixed(dp)}${unit}${v < 0 ? "L" : "R"}`;
const signed = (v: number, dp = 1, unit = "°") =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(dp)}${unit}`;
const devAngle = (offset: number, dist: number) =>
  dist > 0 ? (Math.atan2(offset, dist) * 180) / Math.PI : 0;

interface Item {
  label: string;
  value: string;
  accent?: "ink" | "fairway" | "teal" | "gold" | "terracotta";
  cls?: string; // explicit colour (overrides accent) — used by the rating colours
}
const ACCENT: Record<NonNullable<Item["accent"]>, string> = {
  ink: "text-ink", fairway: "text-fairway", teal: "text-teal",
  gold: "text-gold", terracotta: "text-terracotta",
};

function Group({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="card overflow-hidden">
      <h3 className="text-[10px] uppercase tracking-widest text-ink/40 px-4 pt-3 pb-1">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="px-4 py-2.5 border-t border-black/[0.04]">
            <div className="text-[11px] text-ink/45">{it.label}</div>
            <div className={"metric text-xl font-semibold leading-tight " + (it.cls ?? ACCENT[it.accent ?? "ink"])}>
              {it.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ShotData({ shot }: { shot: Shot }) {
  const carryDev = shot.carryDeviation ?? shot.offlineM;
  const spinRate = Math.hypot(shot.backSpin, shot.sideSpin);
  const ev = evaluateShot(shot);
  const c = ev.ratings;

  return (
    <div className="grid gap-3">
      {(ev.good.length > 0 || ev.bad.length > 0) && (
        <section className="card p-4 grid gap-2">
          <h3 className="text-[10px] uppercase tracking-widest text-ink/40">Analyse du coup ({shot.club})</h3>
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

      <Group
        title="Distances"
        items={[
          { label: "Distance totale", value: `${shot.total.toFixed(0)} m` },
          { label: "Carry", value: `${shot.carry.toFixed(0)} m`, accent: "fairway" },
          { label: "Hauteur (apex)", value: `${shot.apex.toFixed(0)} m` },
        ]}
      />

      <Group
        title="Déviation"
        items={[
          { label: "Déviation totale", value: lr(devAngle(shot.offlineM, shot.total)), accent: "terracotta" },
          { label: "Déviation totale", value: lr(shot.offlineM, 0, " m") },
          { label: "Déviation carry", value: lr(devAngle(carryDev, shot.carry)) },
          { label: "Déviation carry", value: lr(carryDev, 0, " m") },
        ]}
      />

      <Group
        title="Livraison du club"
        items={[
          { label: "Angle de lancement", value: `${shot.launchAngle.toFixed(1)}°`, cls: ratingColor(c.launch) },
          { label: "Direction de lancement", value: lr(shot.launchDir) },
          { label: "Angle d'attaque", value: signed(shot.attackAngle), cls: ratingColor(c.attack) },
          { label: "Club Path", value: lr(shot.clubPath), cls: ratingColor(c.clubPath) },
          { label: "Club Face", value: lr(shot.clubFace) },
          { label: "Face to Path", value: lr(shot.faceToPath), cls: ratingColor(c.faceToPath) },
        ]}
      />

      <Group
        title="Spin"
        items={[
          { label: "Spin total", value: `${spinRate.toFixed(0)} rpm` },
          { label: "Backspin", value: `${shot.backSpin.toFixed(0)} rpm`, cls: ratingColor(c.spin) },
          { label: "Sidespin", value: lr(shot.sideSpin, 0, " rpm") },
          { label: "Axe de spin", value: lr(shot.spinAxis) },
        ]}
      />

      <Group
        title="Vitesses"
        items={[
          { label: "Vitesse balle", value: `${shot.ballSpeed.toFixed(0)} km/h`, accent: "teal" },
          { label: "Vitesse club", value: `${shot.clubSpeed.toFixed(0)} km/h` },
          { label: "Smash", value: shot.smashFactor.toFixed(2), cls: ratingColor(c.smash) },
        ]}
      />
    </div>
  );
}
