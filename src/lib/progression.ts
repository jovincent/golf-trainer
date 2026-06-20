import type { Club, Session } from "../types";
import { mean, sd } from "./stats";

export interface SessionPoint {
  sessionId: string;
  date: number;
  label: string;       // short date for axis
  n: number;
  carry: number;       // mean carry for the club that session
  smash: number;
  dispersion: number;  // offline sd that session
}

/**
 * One point per session (oldest → newest) for a given club. Only sessions where
 * the club was actually hit appear. Drives the progression chart.
 */
export function clubProgression(sessions: Session[], club: Club): SessionPoint[] {
  return [...sessions]
    .sort((a, b) => a.startedAt - b.startedAt)
    .flatMap((sess) => {
      const cs = sess.shots.filter((s) => s.club === club);
      if (!cs.length) return [];
      return [{
        sessionId: sess.id,
        date: sess.startedAt,
        label: new Date(sess.startedAt).toLocaleDateString("en-US", {
          day: "2-digit", month: "2-digit",
        }),
        n: cs.length,
        carry: mean(cs.map((s) => s.carry)),
        smash: mean(cs.map((s) => s.smashFactor)),
        dispersion: sd(cs.map((s) => s.offlineM)),
      }];
    });
}

/** Which clubs have data across these sessions, long → short. */
export function clubsWithHistory(sessions: Session[]): Club[] {
  const set = new Set<Club>();
  sessions.forEach((s) => s.shots.forEach((sh) => set.add(sh.club)));
  return [...set];
}
