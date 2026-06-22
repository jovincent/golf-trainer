import { CLUBS, CLUB_LABELS, type Club } from "../types";
import { useStore } from "../store";

// Clubs split into the natural bag sections. Derived from CLUBS so it stays in
// sync if the set changes (wedges end in "W" too, so they're matched explicitly).
const WEDGES: Club[] = ["PW", "GW", "SW", "LW"];
const isWedge = (c: Club) => WEDGES.includes(c);
const GROUPS: { label: string; match: (c: Club) => boolean }[] = [
  { label: "Woods",  match: (c) => c === "Dr" || (c.endsWith("W") && !isWedge(c)) },
  { label: "Hybrid", match: (c) => c === "Hy" },
  { label: "Irons",  match: (c) => c.endsWith("i") },
  { label: "Wedges", match: isWedge },
];

/**
 * Club picker. `grouped` lays the clubs out in labelled bag sections (Woods /
 * Hybrid / Irons / Wedges) with larger, uniform-width targets — used by the
 * Session "Club in hand" panel. The default flat wrap is kept for compact spots.
 */
export function ClubSelector({ grouped = false }: { grouped?: boolean }) {
  const { selectedClub, clubArmed, setClub } = useStore();

  const Btn = (c: Club) => {
    const sel = c === selectedClub;
    const armed = sel && clubArmed;
    return (
      <button
        key={c}
        onClick={() => setClub(c)}
        title={CLUB_LABELS[c]}
        aria-pressed={sel}
        className={
          "metric rounded-lg border transition text-center " +
          (grouped ? "text-sm px-3 py-2 min-w-[2.75rem] " : "text-sm px-3 py-1.5 ") +
          (armed
            ? "bg-ink text-white border-ink shadow-sm"
            : sel
            ? "bg-fairway/10 text-fairway border-fairway font-semibold" // selected, awaiting confirm
            : "bg-surface text-ink/70 border-black/5 hover:border-ink/25 hover:bg-panel/60")
        }
      >
        {c}
      </button>
    );
  };

  if (!grouped) {
    return <div className="flex flex-wrap gap-1.5">{CLUBS.map(Btn)}</div>;
  }

  return (
    <div className="grid gap-2.5">
      {GROUPS.map((g) => {
        const clubs = CLUBS.filter(g.match);
        if (!clubs.length) return null;
        return (
          <div key={g.label} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-[10px] uppercase tracking-wider text-ink/35 font-semibold">
              {g.label}
            </span>
            <div className="flex flex-wrap gap-1.5">{clubs.map(Btn)}</div>
          </div>
        );
      })}
    </div>
  );
}
