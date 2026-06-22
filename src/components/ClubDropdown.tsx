import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { CLUBS, CLUB_LABELS, type Club } from "../types";
import { useStore } from "../store";
import { useUnits } from "../lib/useUnits";
import { aggregateByClub } from "../lib/stats";

// Bag sections — derived from CLUBS so it stays in sync (wedges end in "W" too).
const WEDGES: Club[] = ["PW", "GW", "SW", "LW"];
const isWedge = (c: Club) => WEDGES.includes(c);
const GROUPS: { label: string; clubs: Club[] }[] = [
  { label: "Woods",  clubs: CLUBS.filter((c) => c === "Dr" || (c.endsWith("W") && !isWedge(c))) },
  { label: "Hybrid", clubs: CLUBS.filter((c) => c === "Hy") },
  { label: "Irons",  clubs: CLUBS.filter((c) => c.endsWith("i")) },
  { label: "Wedges", clubs: CLUBS.filter(isWedge) },
];

/** A small rounded club badge. */
function Badge({ club, active }: { club: Club; active?: boolean }) {
  return (
    <span className={"metric grid place-items-center rounded-lg shrink-0 font-extrabold leading-none " +
      (active ? "bg-fairway text-white" : "bg-fairway/10 text-fairway")}
      style={{ width: 40, height: 40, fontSize: 16 }}>
      {club}
    </span>
  );
}

/**
 * Polished club picker as a dropdown. The trigger shows the club in hand + its
 * typical carry; the popover lists every club grouped by bag section with each
 * club's average carry, the active one ticked.
 */
export function ClubDropdown() {
  const { selectedClub, setClub } = useStore();
  const sessions = useStore((s) => s.sessions);
  const current = useStore((s) => s.current);
  const U = useUnits();
  const [open, setOpen] = useState(false);

  // Average carry per club across the player's whole history.
  const carryByClub = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of aggregateByClub([...(current?.shots ?? []), ...sessions.flatMap((s) => s.shots)])) {
      m.set(a.club, a.carry);
    }
    return m;
  }, [current, sessions]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const selCarry = carryByClub.get(selectedClub);

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={"w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition " +
          (open ? "border-fairway/40 bg-panel/70" : "border-black/5 bg-panel/40 hover:bg-panel/70")}
      >
        <Badge club={selectedClub} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-ink/40">Club in hand</div>
          <div className="font-display text-lg leading-tight truncate">{CLUB_LABELS[selectedClub]}</div>
          <div className="text-xs text-ink/50">
            {selCarry != null
              ? <>avg carry <b className="text-ink/70 metric">{U.fd(selCarry)}</b></>
              : "no history for this club yet"}
          </div>
        </div>
        <ChevronDown className={"w-5 h-5 text-ink/40 shrink-0 transition-transform " + (open ? "rotate-180" : "")} />
      </button>

      {/* Popover */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full mt-2 z-20 rounded-2xl bg-surface overflow-hidden max-h-[58vh] overflow-y-auto"
            style={{ boxShadow: "var(--shadow-soft)", border: "1px solid var(--border-card)" }}
          >
            {GROUPS.map((g) => g.clubs.length > 0 && (
              <div key={g.label}>
                <div className="sticky top-0 px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink/40 font-semibold bg-panel/80 backdrop-blur border-b border-black/[0.04]">
                  {g.label}
                </div>
                {g.clubs.map((c) => {
                  const sel = c === selectedClub;
                  const carry = carryByClub.get(c);
                  return (
                    <button
                      key={c}
                      role="option"
                      aria-selected={sel}
                      onClick={() => { setClub(c); setOpen(false); }}
                      className={"w-full flex items-center gap-3 px-3 py-2 text-left transition " +
                        (sel ? "bg-fairway/[0.08]" : "hover:bg-panel/60")}
                    >
                      <Badge club={c} active={sel} />
                      <span className={"flex-1 text-sm truncate " + (sel ? "font-semibold text-fairway" : "text-ink/80")}>
                        {CLUB_LABELS[c]}
                      </span>
                      <span className="metric text-xs text-ink/45 shrink-0">
                        {carry != null ? U.fd(carry) : "—"}
                      </span>
                      {sel && <Check className="w-4 h-4 text-fairway shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
