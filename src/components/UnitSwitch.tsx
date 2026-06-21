import { useStore } from "../store";

// Global metric ⇄ imperial (m / yd · km/h / mph) switch shown in the header.
export function UnitSwitch() {
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);
  return (
    <div className="inline-flex rounded-lg overflow-hidden ring-1 ring-black/10 text-[11px] font-bold">
      {(["metric", "imperial"] as const).map((u) => (
        <button
          key={u}
          onClick={() => setUnits(u)}
          aria-label={u === "metric" ? "Metres" : "Yards"}
          aria-pressed={units === u}
          className={"px-2 py-1 transition " + (units === u ? "bg-ink text-white" : "text-ink/45 hover:bg-ink/5")}
        >
          {u === "metric" ? "m" : "yd"}
        </button>
      ))}
    </div>
  );
}
