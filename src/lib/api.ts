import type { Session, Shot } from "../types";
import type { Round } from "./course";
import type { CombineResult } from "./combine";
import type { ShareEnvelope, ShareKind } from "./share";

const BASE = "/api";

async function req(path: string, init?: RequestInit) {
  const res = await fetch(BASE + path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export interface Profile { id: string; name: string; createdAt: number }

export const api = {
  // ---- Profiles ---------------------------------------------------------------
  listProfiles: (): Promise<Profile[]> => req("/profiles"),

  createProfile: (name: string): Promise<Profile> =>
    req("/profiles", { method: "POST", body: JSON.stringify({ name }) }),

  updateProfile: (id: string, name: string) =>
    req(`/profiles/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),

  deleteProfile: (id: string) => req(`/profiles/${id}`, { method: "DELETE" }),

  // ---- Sessions ---------------------------------------------------------------
  listSessions: (profileId?: string | null): Promise<Session[]> =>
    req(`/sessions${profileId ? `?profileId=${encodeURIComponent(profileId)}` : ""}`),

  createSession: (s: Pick<Session, "id" | "startedAt" | "label"> & { shots?: Shot[]; profileId?: string | null }) =>
    req("/sessions", { method: "POST", body: JSON.stringify(s) }),

  bulkSessions: (sessions: Session[], profileId?: string | null) =>
    req("/sessions/bulk", { method: "POST", body: JSON.stringify({ sessions, profileId }) }),

  appendShot: (sessionId: string, shot: Shot) =>
    req(`/sessions/${sessionId}/shots`, { method: "POST", body: JSON.stringify(shot) }),

  endSession: (id: string, endedAt: number) =>
    req(`/sessions/${id}`, { method: "PATCH", body: JSON.stringify({ endedAt }) }),

  deleteShot: (sessionId: string, shotId: string) =>
    req(`/sessions/${sessionId}/shots/${shotId}`, { method: "DELETE" }),

  deleteSession: (id: string) => req(`/sessions/${id}`, { method: "DELETE" }),

  clearSessions: () => req("/sessions", { method: "DELETE" }),

  // ---- Rounds -----------------------------------------------------------------
  listRounds: (profileId?: string | null): Promise<Round[]> =>
    req(`/rounds${profileId ? `?profileId=${encodeURIComponent(profileId)}` : ""}`),

  saveRound: (r: Round & { profileId?: string | null }) =>
    req("/rounds", { method: "POST", body: JSON.stringify(r) }),

  deleteRound: (id: string) => req(`/rounds/${id}`, { method: "DELETE" }),

  // ---- Combines (standardized skill tests) --------------------------------------
  listCombines: (profileId?: string | null): Promise<CombineResult[]> =>
    req(`/combines${profileId ? `?profileId=${encodeURIComponent(profileId)}` : ""}`),

  saveCombine: (c: CombineResult & { profileId?: string | null }) =>
    req("/combines", { method: "POST", body: JSON.stringify(c) }),

  deleteCombine: (id: string) => req(`/combines/${id}`, { method: "DELETE" }),

  // ---- Shares (public snapshots) ------------------------------------------------
  createShare: (envelope: ShareEnvelope): Promise<{ token: string }> =>
    req("/shares", { method: "POST", body: JSON.stringify(envelope) }),

  getShare: (token: string): Promise<{ kind: ShareKind; player: string; createdAt: number; data: unknown }> =>
    req(`/shares/${encodeURIComponent(token)}`),
};
