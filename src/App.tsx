import { useEffect, useRef, useState } from "react";
import { Activity, Calendar, Gauge, LayoutDashboard, Flag, Target, Users, UserCircle, ChevronDown, Plus, Trash2, Pencil, Star, Video } from "lucide-react";
import { ConnectionBar } from "./components/ConnectionBar";
import { UnitSwitch } from "./components/UnitSwitch";
import { LiveSession } from "./pages/LiveSession";
import { Course } from "./pages/Course";
import { Practice } from "./pages/Practice";
import { Stats } from "./pages/Stats";
import { History } from "./pages/History";
import { Compare } from "./pages/Compare";
import { Junior } from "./pages/Junior";
import { Combine } from "./pages/Combine";
import { Swing } from "./pages/Swing";
import { useStore } from "./store";
import { api, type Profile } from "./lib/api";

const TABS = [
  { id: "live", label: "Session", icon: Activity, el: <LiveSession /> },
  { id: "course", label: "Course", icon: Flag, el: <Course /> },
  { id: "practice", label: "Practice", icon: Target, el: <Practice /> },
  { id: "combine", label: "Combine", icon: Gauge, el: <Combine /> },
  { id: "swing", label: "Swing", icon: Video, el: <Swing /> },
  { id: "stats", label: "Stats", icon: LayoutDashboard, el: <Stats /> },
  { id: "history", label: "History", icon: Calendar, el: <History /> },
  { id: "compare", label: "Compare",  icon: Users, el: <Compare /> },
  { id: "junior",  label: "Junior ⭐", icon: Star,  el: <Junior /> },
] as const;

function ProfileSelector() {
  const profileId = useStore((s) => s.profileId);
  const setProfile = useStore((s) => s.setProfile);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listProfiles().then((ps) => {
      setProfiles(ps);
      if (ps.length && !profileId) setProfile(ps[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (adding) setTimeout(() => inputRef.current?.focus(), 0); }, [adding]);
  useEffect(() => { if (editingId) setTimeout(() => editRef.current?.focus(), 0); }, [editingId]);

  const active = profiles.find((p) => p.id === profileId) ?? profiles[0];

  async function add() {
    if (!newName.trim()) return;
    const p = await api.createProfile(newName.trim());
    setProfiles((ps) => [...ps, p]);
    setNewName(""); setAdding(false);
    setProfile(p.id);
  }

  async function rename(id: string) {
    if (!editName.trim() || editName.trim() === profiles.find((p) => p.id === id)?.name) {
      setEditingId(null); return;
    }
    await api.updateProfile(id, editName.trim());
    setProfiles((ps) => ps.map((p) => p.id === id ? { ...p, name: editName.trim() } : p));
    setEditingId(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this profile and all its data?")) return;
    await api.deleteProfile(id);
    const next = profiles.filter((p) => p.id !== id);
    setProfiles(next);
    if (profileId === id && next.length) setProfile(next[0].id);
  }

  if (!profiles.length) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Change player"
        aria-expanded={open}
        className="flex items-center gap-1.5 text-sm font-medium text-ink/70 hover:text-ink transition rounded-lg px-2 py-1 hover:bg-panel"
      >
        <UserCircle className="w-4 h-4 shrink-0" />
        <span className="max-w-[120px] truncate">{active?.name ?? "…"}</span>
        <ChevronDown className="w-3 h-3 shrink-0 text-ink/40" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setAdding(false); setNewName(""); }} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-surface rounded-xl min-w-[180px] overflow-hidden"
            style={{ boxShadow: "var(--shadow-soft)", border: "1px solid var(--border-card)" }}
          >
            {profiles.map((p) => (
              <div key={p.id} className={"group flex items-center gap-1 px-3 py-2 hover:bg-panel " + (p.id === profileId ? "bg-fairway/5" : "")}>
                {editingId === p.id ? (
                  <input
                    ref={editRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") rename(p.id); if (e.key === "Escape") setEditingId(null); }}
                    onBlur={() => rename(p.id)}
                    className="flex-1 text-sm bg-panel rounded-lg px-2 py-0.5 border border-fairway/40 outline-none min-w-0"
                  />
                ) : (
                  <button
                    className={"flex-1 text-left text-sm font-medium truncate " + (p.id === profileId ? "text-fairway" : "text-ink/80")}
                    onClick={() => { setProfile(p.id); setOpen(false); }}
                  >
                    {p.name}
                  </button>
                )}
                {editingId !== p.id && (
                  <button
                    onClick={() => { setEditingId(p.id); setEditName(p.name); }}
                    className="p-1 rounded text-ink/0 group-hover:text-ink/25 hover:!text-teal hover:bg-teal/10 transition shrink-0"
                    title="Rename"
                    aria-label={`Rename ${p.name}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {profiles.length > 1 && editingId !== p.id && (
                  <button
                    onClick={() => remove(p.id)}
                    className="p-1 rounded text-ink/0 group-hover:text-ink/20 hover:!text-terracotta hover:bg-terracotta/10 transition shrink-0"
                    title="Delete this profile"
                    aria-label={`Delete profile ${p.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--border-card)" }}>
              {adding ? (
                <div className="flex items-center gap-1 px-3 py-2">
                  <input
                    ref={inputRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
                    placeholder="Player name"
                    className="flex-1 text-sm bg-panel rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-fairway/50 min-w-0"
                    style={{ border: "1px solid var(--border-card)" }}
                  />
                  <button onClick={add} className="text-xs font-semibold text-fairway shrink-0 px-1">OK</button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink/50 hover:bg-panel hover:text-ink/80 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> New player
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("live");
  const sessions = useStore((s) => s.sessions);
  const live = useStore((s) => s.current?.shots.length ?? 0);
  const totalShots = live + sessions.reduce((acc, s) => acc + s.shots.length, 0);
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="min-h-screen">
      <header className="lisere-top border-b border-ink/10 bg-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-royal grid place-items-center text-white font-extrabold text-sm tracking-tight">
            FL
          </div>
          <h1 className="text-lg leading-none font-extrabold tracking-tight">
            Flight<span className="serif text-royal">Lab</span>
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <UnitSwitch />
            <ProfileSelector />
            <div className="text-right pl-2">
              <div className="metric text-sm font-semibold">{totalShots}</div>
              <div className="text-[11px] text-ink/40">balls</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 grid gap-4">
        <ConnectionBar />

        <nav className="flex gap-1 overflow-x-auto -mx-1 px-1" role="tablist" aria-label="Main navigation">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                role="tab"
                aria-selected={on}
                className={
                  "inline-flex items-center gap-2 text-sm font-medium rounded-xl px-4 py-2 transition whitespace-nowrap " +
                  (on ? "bg-ink text-white" : "text-ink/60 hover:bg-panel")
                }
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </nav>

        {active.el}

        <footer className="text-center text-[11px] text-ink/30 py-6">
          FlightLab v1.0 · Data stored locally · Simulator to test without hardware
        </footer>
      </main>
    </div>
  );
}
