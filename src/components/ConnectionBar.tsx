import { useEffect, useRef, useState } from "react";
import { Bluetooth, Radio, Wifi, WifiOff, Loader2, AlertTriangle, Terminal, CheckCircle2, Ruler, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning } from "lucide-react";
import { Volume2, VolumeX } from "lucide-react";
import { useStore, garminAdapter } from "../store";
import type { R10Tilt } from "../adapters/garminR10";
import { soundsEnabled, setSoundsEnabled, playSuccess } from "../lib/sounds";
import { getFlightModel, setFlightModel, type FlightModel } from "../lib/flight";

export function ConnectionBar() {
  const { adapterId, setAdapter, conn, connect, disconnect } = useStore();
  const connected = conn.status === "connected";
  const connecting = conn.status === "connecting";

  return (
    <div className="grid gap-2">
    <div className="card px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-ink/50">Source</span>
        <select
          value={adapterId}
          onChange={(e) => setAdapter(e.target.value)}
          disabled={connected || connecting}
          className="font-sans text-sm bg-panel rounded-lg px-3 py-1.5 border border-black/5
                     disabled:opacity-60"
        >
          <option value="simulator">Simulateur</option>
          <option value="garmin-r10">Garmin Approach R10</option>
        </select>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {connecting ? (
          <Loader2 className="w-4 h-4 animate-spin text-teal" />
        ) : connected ? (
          <Wifi className="w-4 h-4 text-fairway" />
        ) : conn.status === "error" ? (
          <AlertTriangle className="w-4 h-4 text-terracotta" />
        ) : (
          <WifiOff className="w-4 h-4 text-ink/40" />
        )}
        <span className="metric text-ink/70">
          {connected ? conn.deviceName : connecting ? "Connexion…" : "Déconnecté"}
        </span>
      </div>

      {conn.status === "error" && (
        <div className="flex items-center gap-2 bg-terracotta/10 border border-terracotta/30 rounded-lg px-3 py-1.5 max-w-md">
          <span className="text-xs text-terracotta">{conn.error}</span>
          <button
            onClick={() => connect()}
            className="text-xs font-semibold text-terracotta underline whitespace-nowrap shrink-0"
          >
            Réessayer
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <FlightModelToggle />
        <SoundToggle />
        {!connected ? (
          <button
            onClick={() => connect()}
            disabled={connecting}
            className="inline-flex items-center gap-2 bg-fairway hover:bg-fairway-light
                       text-white text-sm font-semibold rounded-lg px-4 py-2 transition
                       disabled:opacity-60"
          >
            {adapterId === "garmin-r10" ? <Bluetooth className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
            Connecter
          </button>
        ) : (
          <button
            onClick={() => disconnect()}
            className="text-sm font-semibold rounded-lg px-4 py-2 bg-panel hover:bg-ink/5
                       text-ink/70 transition"
          >
            Déconnecter
          </button>
        )}
      </div>
    </div>
    {adapterId === "garmin-r10" && <R10Status />}
    {adapterId === "garmin-r10" && <R10Diagnostic />}
    </div>
  );
}

function FlightModelToggle() {
  const recomputeAll = useStore((s) => s.recomputeAll);
  const [m, setM] = useState<FlightModel>(getFlightModel());
  return (
    <select
      value={m}
      onChange={(e) => { const v = e.target.value as FlightModel; setM(v); setFlightModel(v); recomputeAll(); }}
      title="Modèle de calcul des distances"
      className="font-sans text-xs bg-panel rounded-lg px-2 py-1.5 border border-black/5 text-ink/70"
    >
      <option value="calibrated">Modèle : Calibré</option>
      <option value="truth">Modèle : TRUTH 🎯</option>
      <option value="physics">Modèle : Physique</option>
      <option value="regression">Modèle : Régression</option>
    </select>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(soundsEnabled());
  return (
    <button
      onClick={() => { const v = !on; setOn(v); setSoundsEnabled(v); if (v) playSuccess(); }}
      title={on ? "Sons activés" : "Sons coupés"}
      aria-label={on ? "Couper les sons" : "Activer les sons"}
      className="p-2 rounded-lg text-ink/50 hover:bg-panel transition"
    >
      {on ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
    </button>
  );
}

function BatteryBadge({ level }: { level: number }) {
  const Icon = level <= 15 ? BatteryWarning : level <= 35 ? BatteryLow : level <= 70 ? BatteryMedium : BatteryFull;
  const color = level <= 15 ? "text-terracotta" : level <= 35 ? "text-gold" : "text-fairway";
  return (
    <span className={"inline-flex items-center gap-1.5 text-sm font-semibold " + color} title="Batterie R10">
      <Icon className="w-4 h-4" /> {level}%
    </span>
  );
}

function R10Status() {
  const conn = useStore((s) => s.conn);
  const connected = conn.status === "connected";
  const [tilt, setTilt] = useState<R10Tilt | null>(() => garminAdapter.getTilt());
  const [cm, setCm] = useState(() => Math.round(garminAdapter.getTeeRange() * 100));
  const [battery, setBattery] = useState<number | null>(() => garminAdapter.getBattery());

  useEffect(() => {
    setTilt(garminAdapter.getTilt());
    setBattery(garminAdapter.getBattery());
    const offTilt = garminAdapter.onTilt((t) => setTilt(t));
    const offBatt = garminAdapter.onBattery((b) => setBattery(b));
    return () => { offTilt(); offBatt(); };
  }, []);

  return (
    <div className="card px-4 py-3 flex flex-wrap items-center gap-3">
      {connected && battery != null && <BatteryBadge level={battery} />}
      {/* tilt indicator */}
      {connected && tilt ? (
        tilt.level ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-2.5 py-1 bg-fairway/10 text-fairway">
            <CheckCircle2 className="w-4 h-4" /> R10 à plat
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-2.5 py-1 bg-terracotta/10 text-terracotta animate-pulse">
            <AlertTriangle className="w-4 h-4" /> R10 incliné — repose-le à plat
          </span>
        )
      ) : (
        <span className="inline-flex items-center gap-1.5 text-sm text-ink/40">
          <AlertTriangle className="w-4 h-4" /> Inclinaison : connecte le R10
        </span>
      )}
      {tilt && (
        <span className="metric text-xs text-ink/50">
          roll {tilt.roll.toFixed(1)}° · pitch {tilt.pitch.toFixed(1)}°
        </span>
      )}

      {/* tee range (R10 → ball) */}
      <label className="ml-auto flex items-center gap-2 text-sm text-ink/60">
        <Ruler className="w-4 h-4 text-ink/40" /> Distance R10 → balle
        <input
          type="number" min={50} max={600} step={1} value={cm}
          onChange={(e) => { const v = Number(e.target.value); setCm(v); if (v >= 50 && v <= 600) garminAdapter.setTeeRange(v / 100); }}
          className="w-20 font-mono text-sm bg-panel rounded-lg px-2 py-1 border border-black/5 text-right"
        />
        <span className="text-ink/40">cm</span>
      </label>
    </div>
  );
}

function R10Diagnostic() {
  const [lines, setLines] = useState<string[]>(() => garminAdapter.getDebug());
  const [open, setOpen] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines([...garminAdapter.getDebug()]);
    const off = garminAdapter.onDebug(() => setLines([...garminAdapter.getDebug()]));
    return off;
  }, []);
  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [lines]);

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs uppercase tracking-wide text-ink/50 hover:bg-panel/40">
        <Terminal className="w-3.5 h-3.5" /> Diagnostic R10 (Bluetooth) · {lines.length} lignes
        <span className="ml-auto">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div ref={boxRef} className="max-h-44 overflow-auto bg-ink/[0.03] border-t border-black/5 px-4 py-2 font-mono text-[11px] leading-relaxed text-ink/70">
          {lines.length === 0
            ? <div className="text-ink/35">En attente… clique « Connecter », choisis ton R10, puis frappe une balle.</div>
            : lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
