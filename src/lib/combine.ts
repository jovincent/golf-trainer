import type { Club, Shot } from "../types";

// ---- FlightLab Combine — standardized skill test ------------------------------
// 10 stations (9 fixed distances + driver), 3 balls each = 30 balls.
// Each ball is scored 0–100; the Combine score is the average. Scores are
// comparable across players and across time because targets never change.

export const BALLS_PER_STATION = 3;

/** Station target in metres; "driver" is scored on accuracy in a corridor. */
export type StationTarget = number | "driver";

export const STATIONS: StationTarget[] = [45, 60, 75, 90, 105, 120, 140, 160, 180, "driver"];

export const TOTAL_BALLS = STATIONS.length * BALLS_PER_STATION;

export interface CombineShotResult {
  shotId: string;
  club: Club;
  carry: number;   // m
  total: number;   // m
  offline: number; // m, lateral at the relevant landing point
  score: number;   // 0–100
}

export interface CombineStationResult {
  target: StationTarget;
  shots: CombineShotResult[];
}

export interface CombineResult {
  id: string;
  startedAt: number;
  endedAt?: number;
  score: number; // average of all shot scores, 0–100
  stations: CombineStationResult[];
}

export function stationLabel(t: StationTarget): string {
  return t === "driver" ? "Driver" : `${t} m`;
}

/**
 * Score one ball against a station.
 * Distance stations: combined radial error (carry long/short + lateral at carry),
 * relative to the target distance — 25 % relative error or more scores 0.
 * Driver: full points inside a 10 m half-width corridor, −4 pts per extra metre.
 */
export function scoreShot(target: StationTarget, shot: Shot): CombineShotResult {
  let score: number;
  let offline: number;
  if (target === "driver") {
    offline = shot.offlineM;
    score = Math.max(0, Math.round(100 - Math.max(0, Math.abs(offline) - 10) * 4));
  } else {
    offline = shot.carryDeviation;
    const err = Math.hypot(shot.carry - target, offline);
    score = Math.max(0, Math.round(100 * (1 - err / target / 0.25)));
  }
  return { shotId: shot.id, club: shot.club, carry: shot.carry, total: shot.total, offline, score };
}

export function combineScore(stations: CombineStationResult[]): number {
  const all = stations.flatMap((s) => s.shots.map((x) => x.score));
  if (!all.length) return 0;
  return Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10;
}

export function gradeLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Tour", color: "text-gold" };
  if (score >= 70) return { label: "Élite", color: "text-fairway" };
  if (score >= 55) return { label: "Avancé", color: "text-teal" };
  if (score >= 40) return { label: "Intermédiaire", color: "text-ink" };
  return { label: "En progression", color: "text-ink/60" };
}

/** Suggested club for a station, to guide the player (informational only). */
export function suggestedClubs(t: StationTarget): string {
  if (t === "driver") return "Driver";
  if (t <= 50) return "SW / LW";
  if (t <= 65) return "GW / SW";
  if (t <= 80) return "PW / GW";
  if (t <= 95) return "9i / PW";
  if (t <= 110) return "8i / 9i";
  if (t <= 125) return "7i / 8i";
  if (t <= 145) return "6i / 7i";
  if (t <= 165) return "5i / 6i";
  return "Bois / hybride / fer long";
}
