import { create } from "zustand";
import type {
  AdapterState, Club, LaunchMonitorAdapter, Session, Shot,
} from "./types";
import { SimulatorAdapter, simulateShot } from "./adapters/simulator";
import { GarminR10Adapter } from "./adapters/garminR10";
import { CLUBS } from "./types";
import { api } from "./lib/api";
import { playSuccess, playError } from "./lib/sounds";
import { applyFlight } from "./lib/flight";

const LEGACY_KEY = "fairway-lab/sessions/v1";
const PROFILE_KEY = "fairway-lab/active-profile";

function readStoredProfileId(): string | null {
  try { return localStorage.getItem(PROFILE_KEY); } catch { return null; }
}

function readLegacy(): Session[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

const warn = (e: unknown) => console.warn("[fairway-lab] persistence error:", e);

// Serialises writes for the active session so the session row is created before
// its shots are appended, and shot order is preserved.
let writeChain: Promise<unknown> = Promise.resolve();
let persistedSessionId: string | null = null;
let currentSessionOwner: string | null = null; // profile the live session is filed under
let prevRealProfileId: string | null = null;   // profile to restore when leaving the simulator

// Adapter instances live outside React state (they hold BLE handles).
const simulator = new SimulatorAdapter();
const garmin = new GarminR10Adapter();
/** Exposed so the UI can show the R10 BLE diagnostic log. */
export const garminAdapter = garmin;
const adapters: Record<string, LaunchMonitorAdapter> = {
  [simulator.id]: simulator,
  [garmin.id]: garmin,
};

interface AppState {
  adapterId: string;
  adapter: LaunchMonitorAdapter;
  conn: AdapterState;
  selectedClub: Club;
  clubArmed: boolean;      // a club must be (re)chosen before each shot is recorded
  lockClub: boolean;       // practice mode: keep the club armed for the whole set (same club ×N)
  loaded: boolean;
  current?: Session;       // live session in progress
  sessions: Session[];     // persisted history (current excluded until ended)
  profileId: string | null;
  simProfileId: string | null; // shots from the simulator are filed under this ("Tiger Woods")

  setAdapter: (id: string) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setClub: (club: Club) => void;
  setLockClub: (locked: boolean) => void;
  updateShotClub: (sessionId: string, shotId: string, club: Club) => void;
  setProfile: (id: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  startSession: () => void;
  endSession: () => void;
  deleteShot: (sessionId: string, shotId: string) => void;
  deleteSession: (id: string) => void;
  clearHistory: () => void;
  seedDemo: () => void;
  recomputeAll: () => void;
  simHit: () => void;
  // internal
  _ingest: (shot: Omit<Shot, "club">) => void;
}

export const useStore = create<AppState>((set, get) => {
  // Wire the active adapter's events into the store. Re-bound on adapter change.
  let unbind: Array<() => void> = [];
  function bind(adapter: LaunchMonitorAdapter) {
    unbind.forEach((u) => u());
    unbind = [
      adapter.onState((conn) => set({ conn })),
      adapter.onShot((shot) => get()._ingest(shot)),
    ];
    set({ conn: adapter.getState() });
  }
  bind(simulator);

  return {
    adapterId: simulator.id,
    adapter: simulator,
    conn: simulator.getState(),
    selectedClub: "7i",
    clubArmed: false,
    lockClub: false,
    loaded: false,
    current: undefined,
    sessions: [],
    profileId: readStoredProfileId(),
    simProfileId: null,

    setAdapter: (id) => {
      const adapter = adapters[id];
      if (!adapter) return;
      get().adapter.disconnect();
      bind(adapter);
      set({ adapterId: id, adapter });
    },

    connect: async () => {
      await get().adapter.connect();
      if (get().adapter.getState().status !== "connected") return;
      // Simulator = play as Tiger Woods: switch the displayed profile.
      const sim = get().simProfileId;
      if (get().adapterId === "simulator" && sim && get().profileId !== sim) {
        prevRealProfileId = get().profileId;
        await get().setProfile(sim);
      }
      if (!get().current) get().startSession();
    },

    disconnect: async () => {
      await get().adapter.disconnect();
      // Leaving the simulator: restore the profile shown before.
      const sim = get().simProfileId;
      if (get().adapterId === "simulator" && sim && get().profileId === sim && prevRealProfileId) {
        const back = prevRealProfileId;
        prevRealProfileId = null;
        await get().setProfile(back);
      }
    },

    setClub: (club) => {
      simulator.setClub(club);
      set({ selectedClub: club, clubArmed: true });
    },

    setLockClub: (locked) => set({ lockClub: locked }),

    // Re-tag a shot's club (manual correction): recompute distances with the new
    // club and persist via INSERT OR REPLACE (appendShot upserts by shot id).
    updateShotClub: (sessionId, shotId, club) => {
      const recompute = (sh: Shot): Shot => applyFlight({ ...sh, club });
      const cur = get().current;
      if (cur && cur.id === sessionId) {
        const shot = cur.shots.find((s) => s.id === shotId);
        if (!shot) return;
        const updated = recompute(shot);
        writeChain = writeChain.then(() => api.appendShot(sessionId, updated)).catch(warn);
        set({ current: { ...cur, shots: cur.shots.map((s) => (s.id === shotId ? updated : s)) } });
        return;
      }
      let updated: Shot | undefined;
      const sessions = get().sessions.map((s) => {
        if (s.id !== sessionId) return s;
        return { ...s, shots: s.shots.map((sh) => (sh.id === shotId ? (updated = recompute(sh)) : sh)) };
      });
      if (updated) api.appendShot(sessionId, updated).catch(warn);
      set({ sessions });
    },

    setProfile: async (id) => {
      try { localStorage.setItem(PROFILE_KEY, id); } catch {}
      set({ profileId: id, sessions: [], loaded: false });
      await get().loadSessions();
    },

    // Load history from the DB; one-time migration of any localStorage data.
    loadSessions: async () => {
      const profileId = get().profileId;
      try {
        let sessions = await api.listSessions(profileId);
        if (!sessions.length) {
          const legacy = readLegacy();
          if (legacy.length) {
            await api.bulkSessions(legacy);
            localStorage.removeItem(LEGACY_KEY);
            sessions = await api.listSessions();
            console.info(`[fairway-lab] migrated ${legacy.length} session(s) from localStorage → SQLite`);
          }
        }
        // Recompute distances from raw metrics with the current model (history
        // stays intact — only the derived carry/total/apex are refreshed).
        const recomputed = sessions.map((se) => ({ ...se, shots: se.shots.map(applyFlight) }));
        set({ sessions: recomputed, loaded: true });
      } catch (e) {
        warn(e);
        set({ loaded: true }); // degrade: app still works from memory
      }
    },

    startSession: () => {
      // In-memory only; the DB row is created lazily on the first shot, so empty
      // "connect-but-no-shots" sessions never hit the database.
      const session: Session = {
        id: `sess_${Date.now()}`,
        startedAt: Date.now(),
        label: new Date().toLocaleString("en-US", {
          weekday: "short", day: "numeric", month: "short",
          hour: "2-digit", minute: "2-digit",
        }),
        shots: [],
      };
      set({ current: session });
    },

    endSession: () => {
      const cur = get().current;
      if (!cur) return;
      if (cur.shots.length) {
        const ended: Session = { ...cur, endedAt: Date.now() };
        writeChain = writeChain.then(() => api.endSession(ended.id, ended.endedAt!)).catch(warn);
        // Only surface it in the current view if it belongs to the viewed profile
        // (simulator sessions are filed under Tiger Woods, not the active profile).
        if (currentSessionOwner === get().profileId) {
          set({ sessions: [ended, ...get().sessions] });
        }
      }
      persistedSessionId = null;
      currentSessionOwner = null;
      set({ current: undefined });
    },

    deleteShot: (sessionId, shotId) => {
      // Live session: remove in memory, chain the delete after pending writes.
      const cur = get().current;
      if (cur && cur.id === sessionId) {
        writeChain = writeChain.then(() => api.deleteShot(sessionId, shotId)).catch(warn);
        set({ current: { ...cur, shots: cur.shots.filter((s) => s.id !== shotId) } });
        return;
      }
      // Saved session: drop the shot; if the session is now empty, remove it too.
      const sessions = get().sessions.map((s) =>
        s.id === sessionId ? { ...s, shots: s.shots.filter((sh) => sh.id !== shotId) } : s,
      );
      const target = sessions.find((s) => s.id === sessionId);
      if (target && target.shots.length === 0) {
        api.deleteSession(sessionId).catch(warn);
        set({ sessions: sessions.filter((s) => s.id !== sessionId) });
      } else {
        api.deleteShot(sessionId, shotId).catch(warn);
        set({ sessions });
      }
    },

    deleteSession: (id) => {
      api.deleteSession(id).catch(warn);
      set({ sessions: get().sessions.filter((s) => s.id !== id) });
    },

    clearHistory: () => {
      api.clearSessions().catch(warn);
      set({ sessions: [] });
    },

    seedDemo: () => {
      const DAY = 86_400_000;
      const set_ = ["Dr", "7i", "PW", "5i", "9i"] as const;
      const now = Date.now();
      const demo: Session[] = [];
      const NUM = 6;
      for (let i = 0; i < NUM; i++) {
        // Oldest first; skill ramps 0.38 → 0.66 to create a visible trend.
        const daysAgo = (NUM - i) * 5;
        const startedAt = now - daysAgo * DAY;
        const skill = 0.38 + (i / (NUM - 1)) * 0.28;
        const shots = set_.flatMap((club) => {
          const reps = 8 + Math.floor(Math.random() * 5);
          return Array.from({ length: reps }, (_, k) => ({
            ...simulateShot(club as (typeof CLUBS)[number], skill),
            club: club as (typeof CLUBS)[number],
            ts: startedAt + k * 25_000,
          }));
        });
        demo.push({
          id: `demo_${i}_${startedAt}`,
          startedAt,
          endedAt: startedAt + 30 * 60_000,
          label: new Date(startedAt).toLocaleDateString("en-US", {
            weekday: "short", day: "numeric", month: "short",
          }),
          shots,
        });
      }
      api.bulkSessions(demo, get().profileId).catch(warn);
      set({ sessions: [...demo.reverse(), ...get().sessions] });
    },

    // Re-derive all distances with the current flight model (after switching it).
    recomputeAll: () => {
      const cur = get().current;
      set({
        sessions: get().sessions.map((se) => ({ ...se, shots: se.shots.map(applyFlight) })),
        current: cur ? { ...cur, shots: cur.shots.map(applyFlight) } : undefined,
      });
    },

    simHit: () => simulator.hit(),

    _ingest: (raw) => {
      const club = get().selectedClub;
      // Real (R10) shots: recompute distances from raw metrics with the current
      // model + per-club trim. Simulator shots keep their generated values.
      const shot: Shot = applyFlight({ ...raw, club });
      let cur = get().current;
      if (!cur) {
        get().startSession();
        cur = get().current!;
      }
      // Simulator shots are filed under the pro "Tiger Woods" profile; real shots
      // under the active profile.
      const ownerId = get().adapterId === "simulator" ? get().simProfileId : get().profileId;
      // Lazily create the DB row on the first shot, then append (order-safe).
      if (persistedSessionId !== cur.id) {
        persistedSessionId = cur.id;
        currentSessionOwner = ownerId;
        const { id, startedAt, label } = cur;
        writeChain = writeChain.then(() => api.createSession({ id, startedAt, label, profileId: ownerId })).catch(warn);
      }
      writeChain = writeChain.then(() => api.appendShot(cur!.id, shot)).catch((e) => { warn(e); playError(); });
      // Disarm so the next shot's club is (re)chosen — unless locked (practice:
      // the player hits a whole set with the same club).
      set({ current: { ...cur, shots: [shot, ...cur.shots] }, clubArmed: get().lockClub });
      playSuccess(); // shot validated & recorded
    },
  };
});

// Kick off the initial load from the database.
useStore.getState().loadSessions();

// Ensure the simulator's pro profile ("Tiger Woods") exists, then remember its id.
const SIM_PROFILE_NAME = "Tiger Woods";
api.listProfiles()
  .then(async (ps) => {
    const found = ps.find((p) => p.name === SIM_PROFILE_NAME);
    const prof = found ?? (await api.createProfile(SIM_PROFILE_NAME));
    useStore.setState({ simProfileId: prof.id });
  })
  .catch((e) => console.warn("[fairway-lab] could not ensure Tiger Woods profile:", e));

/** All shots ever recorded (history + live), newest first. */
export function allShots(s: AppState): Shot[] {
  const hist = s.sessions.flatMap((sess) => sess.shots);
  const live = s.current?.shots ?? [];
  return [...live, ...hist];
}
