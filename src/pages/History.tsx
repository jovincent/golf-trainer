import { useState } from "react";
import { Download, Trash2, Sparkles, ChevronDown, ChevronRight, Calendar, Share2, Filter, ArrowDownWideNarrow } from "lucide-react";
import { useStore } from "../store";
import { shotsToCsv, downloadText } from "../lib/export";
import { mean } from "../lib/stats";
import { CLUBS, CLUB_LABELS, type Club, type Session, type Shot } from "../types";
import { ShareModal } from "../components/ShareModal";
import { SwingHistory } from "../components/SwingHistory";
import { buildSessionShare, type ShareEnvelope } from "../lib/share";
import { usePlayerName } from "../lib/usePlayerName";
import { useUnits } from "../lib/useUnits";

export function History() {
  const { sessions, deleteSession, deleteShot, clearHistory, seedDemo } = useStore();
  const player = usePlayerName();
  const [share, setShare] = useState<ShareEnvelope | null>(null);
  const allShots = sessions.flatMap((s) => s.shots);

  // Club filter: when any club is selected, keep only matching shots and hide
  // sessions left empty. Model above stays built from the full, unfiltered set.
  const [clubFilter, setClubFilter] = useState<Set<Club>>(new Set());
  const [sort, setSort] = useState<"session" | SortKey>("session");
  const clubsInHistory = CLUBS.filter((c) => allShots.some((s) => s.club === c));
  const filtering = clubFilter.size > 0;
  // Flatten when a club filter is on OR a metric sort is chosen (cross-session ranking).
  const flat = filtering || sort !== "session";
  const effSort: SortKey = sort === "session" ? "date" : sort;
  const toggleClub = (c: Club) =>
    setClubFilter((prev) => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const shownSessions = filtering
    ? sessions
        .map((s) => ({ ...s, shots: s.shots.filter((sh) => clubFilter.has(sh.club)) }))
        .filter((s) => s.shots.length > 0)
    : sessions;
  const shownShots = shownSessions.flatMap((s) => s.shots);

  const chip = (on: boolean) =>
    "metric text-xs font-semibold rounded-lg px-2.5 py-1 transition " +
    (on ? "bg-ink text-white" : "bg-panel text-ink/55 hover:bg-ink/10");

  return (
    <div className="grid gap-4">
      <section className="card p-4 flex flex-wrap items-center gap-2">
        <Calendar className="w-5 h-5 text-teal" />
        <div className="mr-auto">
          <h2 className="font-display text-lg leading-tight">History</h2>
          <p className="text-sm text-ink/50">
            {flat ? (
              <>
                {shownShots.length} shot{shownShots.length > 1 ? "s" : ""}
                {filtering && <span className="text-fairway font-semibold"> · filtered {[...clubFilter].join(" · ")}</span>}
                {sort !== "session" && <span className="text-teal font-semibold"> · sorted by {SORTS[effSort].label.toLowerCase()}</span>}
              </>
            ) : (
              <>{shownSessions.length} session{shownSessions.length > 1 ? "s" : ""} · {shownShots.length} balls</>
            )}
          </p>
        </div>
        <button
          onClick={() => downloadText("fairway-lab.csv", shotsToCsv(shownShots))}
          disabled={!shownShots.length}
          className="inline-flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2
                     bg-panel hover:bg-ink/5 text-ink/70 transition disabled:opacity-40"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button
          onClick={seedDemo}
          className="inline-flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2
                     bg-teal/10 hover:bg-teal/20 text-teal transition"
        >
          <Sparkles className="w-4 h-4" /> Demo data
        </button>
        {sessions.length > 0 && (
          <button
            onClick={() => {
              if (confirm("Clear all history?")) clearHistory();
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2
                       text-terracotta hover:bg-terracotta/10 transition"
          >
            <Trash2 className="w-4 h-4" /> Clear all
          </button>
        )}
      </section>

      {clubsInHistory.length > 0 && (
        <section className="card p-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-ink/40 font-semibold mr-1 inline-flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Club
          </span>
          <button onClick={() => setClubFilter(new Set())} className={chip(!filtering)}>All</button>
          {clubsInHistory.map((c) => (
            <button key={c} onClick={() => toggleClub(c)} className={chip(clubFilter.has(c))} title={CLUB_LABELS[c]}>
              {c}
            </button>
          ))}
          <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink/40 font-semibold">
            <ArrowDownWideNarrow className="w-3.5 h-3.5" /> Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "session" | SortKey)}
              className="font-sans text-xs normal-case tracking-normal font-medium text-ink/70 bg-panel rounded-lg px-2 py-1 border border-black/5 outline-none"
            >
              <option value="session">By session</option>
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <option key={k} value={k}>{SORTS[k].label}</option>
              ))}
            </select>
          </label>
        </section>
      )}

      <SwingHistory />

      {sessions.length === 0 ? (
        <div className="card p-8 text-center text-ink/40">
          No sessions recorded. Finish a session from the Session tab, or click
          <span className="text-teal font-semibold"> Demo data</span> to explore the app.
        </div>
      ) : shownSessions.length === 0 ? (
        <div className="card p-8 text-center text-ink/40">
          No shots with this filter. <button onClick={() => setClubFilter(new Set())} className="text-fairway font-semibold">Reset</button>
        </div>
      ) : flat ? (
        // Flat mode (club filter and/or metric sort): no session grouping.
        <ClubShotList
          entries={shownSessions.flatMap((s) => s.shots.map((shot) => ({ shot, sessionId: s.id })))}
          sortKey={effSort}
        />
      ) : (
        <div className="grid gap-2">
          {shownSessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              onShare={() => setShare(buildSessionShare(s, player))}
              onDelete={() => deleteSession(s.id)}
              onDeleteShot={(shotId) => deleteShot(s.id, shotId)}
            />
          ))}
        </div>
      )}

      {share && <ShareModal envelope={share} onClose={() => setShare(null)} />}
    </div>
  );
}

// ── Inline metric pill ────────────────────────────────────────────────────────
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] text-ink/40 uppercase tracking-wide leading-none mb-0.5 truncate">{label}</span>
      <span className="metric text-sm font-semibold text-ink/80 truncate">{value}</span>
    </div>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────
// Average carry + total per club for a set of shots (long → short club order).
function carryByClub(shots: Shot[]): { club: Club; n: number; avg: number; avgTotal: number }[] {
  const byClub = new Map<Club, Shot[]>();
  for (const s of shots) {
    const arr = byClub.get(s.club) ?? [];
    arr.push(s);
    byClub.set(s.club, arr);
  }
  return CLUBS.filter((c) => byClub.has(c)).map((club) => {
    const arr = byClub.get(club)!;
    return { club, n: arr.length, avg: mean(arr.map((s) => s.carry)), avgTotal: mean(arr.map((s) => s.total)) };
  });
}

type HoverState = { s: Shot; x: number; y: number } | null;
type ShotEntry = { shot: Shot; sessionId: string };

// Flat-list sort options. Metrics sort best-first (desc); date sorts newest-first.
type SortKey = "date" | "carry" | "ball" | "club" | "smash";
const SORTS: Record<SortKey, { label: string; cmp: (a: ShotEntry, b: ShotEntry) => number }> = {
  date:  { label: "Date",          cmp: (a, b) => b.shot.ts - a.shot.ts },
  carry: { label: "Carry",         cmp: (a, b) => b.shot.carry - a.shot.carry },
  ball:  { label: "Ball speed",    cmp: (a, b) => b.shot.ballSpeed - a.shot.ballSpeed },
  club:  { label: "Club speed",    cmp: (a, b) => b.shot.clubSpeed - a.shot.clubSpeed },
  smash: { label: "Smash",         cmp: (a, b) => b.shot.smashFactor - a.shot.smashFactor },
};

// ── One shot row (reused by the per-session view and the flat club-filter view) ──
function ShotRow({ shot: s, badge, onUpdateClub, onDeleteShot, setHover }: {
  shot: Shot; badge: string;
  onUpdateClub: (club: Club) => void; onDeleteShot: () => void; setHover: (h: HoverState) => void;
}) {
  const U = useUnits();
  const absOff = Math.abs(s.offlineM);
  const offDir = absOff < 1 ? null : s.offlineM < 0 ? "← L" : "R →";
  const offRatio = absOff / Math.max(1, s.carry);
  const offColor = absOff < 1 ? "text-fairway" : offRatio < 0.05 ? "text-fairway" : offRatio < 0.08 ? "text-gold" : "text-terracotta";
  const offBg = absOff < 1 ? "bg-fairway/10" : offRatio < 0.05 ? "bg-fairway/10" : offRatio < 0.08 ? "bg-gold/10" : "bg-terracotta/10";

  return (
    <div
      className="group grid gap-x-3 items-center px-4 py-3 hover:bg-panel/40 transition cursor-help"
      style={{ gridTemplateColumns: "2.5rem 7.5rem 1fr 5rem 2.5rem" }}
      onMouseEnter={(e) => setHover({ s, x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setHover({ s, x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHover(null)}
    >
      {/* badge + Club (editable) */}
      <div className="flex flex-col items-start gap-0.5">
        <span className="text-[10px] text-ink/30 leading-none metric">{badge}</span>
        <select
          value={s.club}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdateClub(e.target.value as Club)}
          title="Change this shot's club"
          className="font-display text-sm font-bold rounded-md pl-1 pr-0.5 py-0.5 border border-transparent text-ink/80 hover:border-ink/15 bg-surface cursor-pointer outline-none"
        >
          {CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Carry + total — same size, side by side */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col leading-none">
          <span className="metric text-2xl font-bold text-ink">{U.d(s.carry)}</span>
          <span className="text-[10px] text-ink/40">{U.distUnit} carry</span>
        </div>
        <div className="flex flex-col leading-none">
          <span className="metric text-2xl font-bold text-ink/60">{U.d(s.total)}</span>
          <span className="text-[10px] text-ink/40">{U.distUnit} total</span>
        </div>
      </div>

      {/* Secondary metrics — 3×2 grid */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
        <Metric label="Club spd"  value={`${U.s(s.clubSpeed)} ${U.speedUnit}`} />
        <Metric label="Ball spd" value={`${U.s(s.ballSpeed)} ${U.speedUnit}`} />
        <Metric label="Smash"    value={s.smashFactor.toFixed(2)} />
        <Metric label="Apex"     value={`${U.d(s.apex)} ${U.distUnit}`} />
        <Metric label="Backspin" value={`${(s.backSpin ?? 0).toFixed(0)} rpm`} />
        <Metric label="Launch" value={`${(s.launchAngle ?? 0).toFixed(1)}°`} />
      </div>

      {/* Offline badge */}
      <div className={`flex flex-col items-center justify-center rounded-xl px-2 py-1.5 self-center ${offBg}`}>
        <span className={`metric text-base font-bold leading-none ${offColor}`}>
          {absOff < 1 ? "—" : `${U.d(absOff, 1)} ${U.distUnit}`}
        </span>
        <span className={`text-[10px] font-semibold mt-0.5 ${offColor}`}>{offDir ?? "straight"}</span>
      </div>

      {/* Delete */}
      <button
        onClick={onDeleteShot}
        title="Delete this shot"
        className="p-1.5 rounded-lg text-ink/20 hover:text-terracotta hover:bg-terracotta/10 transition opacity-0 group-hover:opacity-100 justify-self-center"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function PerClubSummary({ shots }: { shots: Shot[] }) {
  const U = useUnits();
  return (
    <div className="px-4 py-3 border-b border-black/5 bg-panel/20">
      <div className="text-[10px] uppercase tracking-widest text-ink/40 font-semibold mb-2">Avg carry / total by club</div>
      <div className="flex flex-wrap gap-2">
        {carryByClub(shots).map(({ club, n, avg, avgTotal }) => (
          <div key={club} className="flex items-baseline gap-1.5 rounded-lg bg-surface border border-black/5 px-2.5 py-1.5">
            <span className="text-sm font-bold text-ink/80 font-display">{club}</span>
            <span className="metric text-sm font-semibold text-ink">{U.d(avg)}</span>
            <span className="metric text-xs text-ink/45">/ {U.d(avgTotal)} {U.distUnit}</span>
            <span className="text-[10px] text-ink/35">×{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShotTableHeader({ firstCol }: { firstCol: string }) {
  return (
    <div className="grid gap-x-3 px-4 py-2 bg-panel/40" style={{ gridTemplateColumns: "2.5rem 7.5rem 1fr 5rem 2.5rem" }}>
      <span className="text-[10px] uppercase tracking-wide text-ink/40 font-semibold">{firstCol}</span>
      <span className="text-[10px] uppercase tracking-wide text-ink/40 font-semibold">Carry · total</span>
      <span className="text-[10px] uppercase tracking-wide text-ink/40 font-semibold">Metrics</span>
      <span className="text-[10px] uppercase tracking-wide text-ink/40 font-semibold text-right">Offline</span>
      <span />
    </div>
  );
}

// ── Flat list of shots — no session grouping; sortable by date / speed / smash ──
function ClubShotList({ entries, sortKey }: {
  entries: ShotEntry[]; sortKey: SortKey;
}) {
  const updateShotClub = useStore((s) => s.updateShotClub);
  const deleteShot = useStore((s) => s.deleteShot);
  const [hover, setHover] = useState<HoverState>(null);
  const sorted = [...entries].sort((SORTS[sortKey] ?? SORTS.date).cmp);

  return (
    <div className="card overflow-hidden">
      {hover && <ShotPopover shot={hover.s} x={hover.x} y={hover.y} />}
      <PerClubSummary shots={sorted.map((e) => e.shot)} />
      <ShotTableHeader firstCol="Date" />
      <div className="divide-y divide-black/[0.04]">
        {sorted.map(({ shot, sessionId }) => (
          <ShotRow
            key={shot.id}
            shot={shot}
            badge={new Date(shot.ts).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })}
            onUpdateClub={(club) => updateShotClub(sessionId, shot.id, club)}
            onDeleteShot={() => deleteShot(sessionId, shot.id)}
            setHover={setHover}
          />
        ))}
      </div>
    </div>
  );
}

function SessionRow({ session, onShare, onDelete, onDeleteShot }: {
  session: Session; onShare: () => void; onDelete: () => void; onDeleteShot: (shotId: string) => void;
}) {
  const updateShotClub = useStore((s) => s.updateShotClub);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ s: Shot; x: number; y: number } | null>(null);
  const shots = session.shots;
  const clubs = [...new Set(shots.map((s) => s.club))];

  return (
    <div className="card overflow-hidden">
      {/* ── Session header ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-panel/40 transition"
      >
        {open ? <ChevronDown className="w-4 h-4 text-ink/40" /> : <ChevronRight className="w-4 h-4 text-ink/40" />}
        <div className="mr-auto">
          <div className="font-semibold text-sm capitalize">{session.label}</div>
          <div className="text-xs text-ink/40 metric">
            {shots.length} ball{shots.length > 1 ? "s" : ""} · {clubs.join(" · ")}
          </div>
        </div>
        <div className="text-right">
          <div className="metric text-sm font-semibold">{clubs.length}</div>
          <div className="text-[11px] text-ink/40">club{clubs.length > 1 ? "s" : ""}</div>
        </div>
        <span
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="ml-2 p-2 rounded-lg text-ink/30 hover:text-fairway hover:bg-fairway/10 transition"
          title="Share session"
        >
          <Share2 className="w-4 h-4" />
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-2 rounded-lg text-ink/30 hover:text-terracotta hover:bg-terracotta/10 transition"
          title="Delete session"
        >
          <Trash2 className="w-4 h-4" />
        </span>
      </button>

      {/* ── Shot list ── */}
      {open && hover && <ShotPopover shot={hover.s} x={hover.x} y={hover.y} />}
      {open && (
        <div className="border-t border-black/5">
          <PerClubSummary shots={shots} />
          <ShotTableHeader firstCol="N°" />
          <div className="divide-y divide-black/[0.04]">
            {shots.map((s, idx) => (
              <ShotRow
                key={s.id}
                shot={s}
                badge={`#${shots.length - idx}`}
                onUpdateClub={(club) => updateShotClub(session.id, s.id, club)}
                onDeleteShot={() => onDeleteShot(s.id)}
                setHover={setHover}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hover popover (full detail) ───────────────────────────────────────────────
function ShotPopover({ shot, x, y }: { shot: Shot; x: number; y: number }) {
  const U = useUnits();
  const num = (v: number | undefined, dp = 1, unit = "") => (v == null ? "—" : `${v.toFixed(dp)}${unit}`);
  const lr = (v: number | undefined, dp = 1, unit = "") =>
    v == null ? "—" : `${Math.abs(v).toFixed(dp)}${unit}${v < 0 ? " L" : " R"}`;
  // Distance/speed helpers that convert to the active display unit, preserving the
  // "—" / "L · R" formatting of the raw helpers above.
  const dist = (v: number | undefined, dp = 1) => (v == null ? "—" : `${U.d(v, dp)} ${U.distUnit}`);
  const distLr = (v: number | undefined, dp = 1) =>
    v == null ? "—" : `${U.d(Math.abs(v), dp)} ${U.distUnit}${v < 0 ? " L" : " R"}`;
  const spd = (v: number | undefined, dp = 1) => (v == null ? "—" : `${U.s(v, dp)} ${U.speedUnit}`);
  const spinTotal = Math.hypot(shot.backSpin ?? 0, shot.sideSpin ?? 0);

  const rows: Array<[string, string]> = [
    ["Date", new Date(shot.ts).toLocaleString("en-US")],
    ["Club", shot.club],
    ["Ball speed", spd(shot.ballSpeed)],
    ["Club speed", spd(shot.clubSpeed)],
    ["Smash factor", num(shot.smashFactor, 2)],
    ["Launch angle", num(shot.launchAngle, 1, "°")],
    ["Launch direction", lr(shot.launchDir, 1, "°")],
    ["Attack angle", num(shot.attackAngle, 1, "°")],
    ["Club path", lr(shot.clubPath, 1, "°")],
    ["Club face", lr(shot.clubFace, 1, "°")],
    ["Face to path", lr(shot.faceToPath, 1, "°")],
    ["Backspin", num(shot.backSpin, 0, " rpm")],
    ["Sidespin", lr(shot.sideSpin, 0, " rpm")],
    ["Total spin", `${spinTotal.toFixed(0)} rpm`],
    ["Spin axis", lr(shot.spinAxis, 1, "°")],
    ["Carry", dist(shot.carry)],
    ["Total", dist(shot.total)],
    ["Apex", dist(shot.apex)],
    ["Total deviation", distLr(shot.offlineM)],
    ["Carry deviation", distLr(shot.carryDeviation)],
    ["Source", shot.sim ? "Simulator" : "Garmin R10"],
  ];

  const left = Math.min(x + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 300);
  const top  = Math.min(y + 16, (typeof window !== "undefined" ? window.innerHeight : 800) - 460);

  return (
    <div
      className="fixed z-50 w-[290px] card p-4 pointer-events-none shadow-soft"
      style={{ left, top }}
    >
      <div className="text-[10px] uppercase tracking-widest text-ink/40 mb-2 font-semibold">
        Full detail · {shot.club}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 min-w-0">
            <span className="text-[11px] text-ink/45 truncate shrink">{k}</span>
            <span className="metric text-[12px] font-semibold text-right shrink-0">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
