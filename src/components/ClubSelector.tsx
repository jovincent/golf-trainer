import { CLUBS, CLUB_LABELS } from "../types";
import { useStore } from "../store";

export function ClubSelector() {
  const { selectedClub, clubArmed, setClub } = useStore();
  return (
    <div className="flex flex-wrap gap-1.5">
      {CLUBS.map((c) => {
        const sel = c === selectedClub;
        const armed = sel && clubArmed;
        return (
          <button
            key={c}
            onClick={() => setClub(c)}
            title={CLUB_LABELS[c]}
            className={
              "metric text-sm rounded-lg px-3 py-1.5 border transition " +
              (armed
                ? "bg-ink text-white border-ink"
                : sel
                ? "bg-surface text-ink border-ink border-dashed" // last club, not re-confirmed
                : "bg-surface text-ink/70 border-black/5 hover:border-ink/20")
            }
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
