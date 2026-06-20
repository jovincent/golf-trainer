import type { Club, LaunchMonitorAdapter, Shot } from "../types";
import { AdapterEmitter, shotId } from "./base";

/** Plausible mid-handicap baselines (metric) per club. */
interface Profile {
  ball: number;   // km/h
  smash: number;
  launch: number; // deg
  spin: number;   // rpm backspin
  carry: number;  // m
  attack: number; // deg angle of attack (+ up, − down)
}
const PROFILES: Record<Club, Profile> = {
  Dr: { ball: 210, smash: 1.45, launch: 13, spin: 2600, carry: 205, attack: 2.5 },
  "3W": { ball: 195, smash: 1.43, launch: 13, spin: 3300, carry: 185, attack: -1.5 },
  "5W": { ball: 185, smash: 1.41, launch: 14, spin: 3900, carry: 172, attack: -2.5 },
  Hy: { ball: 178, smash: 1.40, launch: 15, spin: 4300, carry: 162, attack: -3 },
  "3i": { ball: 172, smash: 1.38, launch: 15, spin: 4500, carry: 155, attack: -3 },
  "4i": { ball: 165, smash: 1.37, launch: 16, spin: 4900, carry: 147, attack: -3.3 },
  "5i": { ball: 158, smash: 1.36, launch: 17, spin: 5300, carry: 140, attack: -3.6 },
  "6i": { ball: 150, smash: 1.34, launch: 18, spin: 5800, carry: 132, attack: -3.9 },
  "7i": { ball: 142, smash: 1.33, launch: 20, spin: 6400, carry: 123, attack: -4.2 },
  "8i": { ball: 133, smash: 1.32, launch: 22, spin: 7100, carry: 113, attack: -4.4 },
  "9i": { ball: 124, smash: 1.31, launch: 25, spin: 7900, carry: 102, attack: -4.6 },
  PW: { ball: 115, smash: 1.29, launch: 28, spin: 8700, carry: 92, attack: -4.8 },
  GW: { ball: 104, smash: 1.27, launch: 31, spin: 9300, carry: 80, attack: -5 },
  SW: { ball: 92, smash: 1.24, launch: 34, spin: 9800, carry: 66, attack: -5.2 },
  LW: { ball: 78, smash: 1.20, launch: 38, spin: 10200, carry: 50, attack: -5.4 },
};

/** Tour-professional baselines (Tiger-level) — higher speeds, longer carries,
 *  purer contact and lower iron spin than the mid-handicap PROFILES above. */
const PRO_PROFILES: Record<Club, Profile> = {
  Dr: { ball: 270, smash: 1.49, launch: 11, spin: 2500, carry: 270, attack: 3 },
  "3W": { ball: 250, smash: 1.48, launch: 11, spin: 3200, carry: 245, attack: -1 },
  "5W": { ball: 238, smash: 1.47, launch: 12, spin: 3700, carry: 230, attack: -2 },
  Hy: { ball: 228, smash: 1.46, launch: 13, spin: 4000, carry: 215, attack: -2.5 },
  "3i": { ball: 220, smash: 1.45, launch: 13, spin: 4200, carry: 205, attack: -2.8 },
  "4i": { ball: 212, smash: 1.44, launch: 14, spin: 4500, carry: 195, attack: -3 },
  "5i": { ball: 204, smash: 1.43, launch: 15, spin: 5000, carry: 185, attack: -3.2 },
  "6i": { ball: 195, smash: 1.42, launch: 16, spin: 5500, carry: 175, attack: -3.5 },
  "7i": { ball: 185, smash: 1.41, launch: 17, spin: 6200, carry: 165, attack: -3.8 },
  "8i": { ball: 174, smash: 1.39, launch: 19, spin: 7000, carry: 153, attack: -4 },
  "9i": { ball: 162, smash: 1.38, launch: 21, spin: 7800, carry: 140, attack: -4.2 },
  PW: { ball: 150, smash: 1.36, launch: 24, spin: 8800, carry: 128, attack: -4.5 },
  GW: { ball: 135, smash: 1.33, launch: 27, spin: 9500, carry: 112, attack: -4.8 },
  SW: { ball: 118, smash: 1.30, launch: 30, spin: 10200, carry: 95, attack: -5 },
  LW: { ball: 100, smash: 1.26, launch: 34, spin: 10800, carry: 75, attack: -5.2 },
};

/** Box-Muller gaussian, mean 0 sd 1. */
function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const jitter = (base: number, sdPct: number) => base * (1 + gauss() * sdPct);

/**
 * Pure shot generator for a club. Reused by the live adapter and by demo-history
 * seeding. `skill` (0..1) nudges quality up — higher = more smash, tighter
 * dispersion, slightly more carry — so seeded history can show progression.
 */
export function simulateShot(club: Club, skill = 0.5, pro = false): Omit<Shot, "club"> {
  const p = (pro ? PRO_PROFILES : PROFILES)[club];
  const lift = 1 + (skill - 0.5) * 0.06;        // ±3% carry across the skill range
  const tighten = 1 - (skill - 0.5) * 0.6;      // better skill → less dispersion

  // Occasional genuine mishit (chunk / thin / toe): worse players miss more.
  const mishit = Math.random() < 0.13 * (1.3 - skill);
  const smashPenalty = mishit ? 0.80 + Math.random() * 0.07 : 1; // ~0.80–0.87×
  const carryPenalty = mishit ? 0.50 + Math.random() * 0.25 : 1; // comes up short
  const missScatter = mishit ? 2.6 : 1;                          // sprays offline

  const rad = (d: number) => (d * Math.PI) / 180;
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

  // ---- Club delivery -------------------------------------------------------
  const attackAngle = p.attack + gauss() * 1.1 * (mishit ? 2.2 : 1);
  const clubPath = gauss() * 2.8 * tighten * missScatter;        // + = in-to-out (right)
  const faceToPath = gauss() * 2.0 * tighten * missScatter;      // + = face open to path
  const clubFace = clubPath + faceToPath;                        // relative to target

  // ---- Strike quality ------------------------------------------------------
  const smashFactor = Math.min(1.5, jitter(p.smash + (skill - 0.5) * 0.04, 0.015) * smashPenalty);
  const ballSpeed = jitter(p.ball * lift, 0.03) * (mishit ? smashPenalty : 1);
  const clubSpeed = ballSpeed / smashFactor;

  // ---- Ball flight (new ball-flight laws: start ≈ mostly face) -------------
  const faceWeight = club === "Dr" ? 0.8 : 0.85;
  const launchDir = clubFace * faceWeight + clubPath * (1 - faceWeight) + gauss() * 0.4;
  const launchAngle =
    (jitter(p.launch, 0.08) + attackAngle * 0.35) * (mishit ? 0.85 + Math.random() * 0.4 : 1);
  const backSpin = jitter(p.spin, 0.07);
  const sideSpin = faceToPath * 95 + gauss() * 110;              // face-to-path drives curve
  const spinAxis = clamp(sideSpin / 110, 24);                   // deg tilt

  // ---- Carry / total / shape ----------------------------------------------
  const carry = Math.max(5, jitter(p.carry * lift, 0.045) * carryPenalty);
  const rollFactor = club === "Dr" ? 0.12 : 0.04 + (p.carry > 150 ? 0.03 : 0);
  const total = carry * (1 + rollFactor);
  const apex = carry * (0.18 + launchAngle / 220);
  const carryDeviation = carry * Math.sin(rad(launchDir)) + sideSpin * 0.0038;
  const offlineM = total * Math.sin(rad(launchDir)) + sideSpin * 0.004; // total deviation

  return {
    id: shotId(),
    ts: Date.now(),
    ballSpeed, clubSpeed, smashFactor, launchAngle, launchDir,
    attackAngle, clubPath, clubFace, faceToPath,
    backSpin, sideSpin, spinAxis, carry, total, apex, offlineM, carryDeviation,
    sim: true,
  };
}

/**
 * Generates realistic shots on demand. Fully interchangeable with the real R10
 * adapter — lets the entire app run with no hardware.
 */
export class SimulatorAdapter extends AdapterEmitter implements LaunchMonitorAdapter {
  readonly id = "simulator";
  readonly displayName = "Simulateur";
  private club: Club = "7i";
  private timer?: number;

  isSupported() {
    return true;
  }

  /** The store tells the sim which club is selected so numbers stay coherent. */
  setClub(club: Club) {
    this.club = club;
  }

  async connect() {
    this.setState({ status: "connecting" });
    await new Promise((r) => setTimeout(r, 350));
    this.setState({ status: "connected", deviceName: "Simulateur de practice" });
  }

  async disconnect() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = undefined;
    this.setState({ status: "disconnected", deviceName: undefined });
  }

  /** Emit one simulated shot for the current club — at tour-professional level. */
  hit() {
    if (this.state.status !== "connected") return;
    this.emitShot(simulateShot(this.club, 0.92, true));
  }
}
