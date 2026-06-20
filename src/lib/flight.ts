// Ball-flight model: the R10 reports ball speed / launch / spin but NOT carry,
// so we integrate the trajectory (m·dv/dt = mg + F_D + F_L).
//
// Two selectable models (global setting), surfaced to users as:
//   "truth"   → "Réaliste"  — Euler engine, GLOBAL=0.926 + per-club trim,
//               calibrated against real Garmin R10 measured carries. The
//               everyday model: distances match what you'd see on a range.
//   "physics" → "Théorique" — textbook launch-monitor model (RK4, Cd≈0.225,
//               Cl=f(S)), pure wind-tunnel constants, no empirical calibration.

import type { Club, Shot } from "../types";

// ---- ball / air constants (shared) ----
const M = 0.0459, R = 0.02134;
const A = Math.PI * R * R, RHO = 1.225, G = 9.81;
const rad = (d: number) => (d * Math.PI) / 180;

export interface Flight {
  carry: number; total: number; apex: number; offlineM: number; carryDeviation: number;
}

// ---- global model selector ----
export type FlightModel = "physics" | "truth";
const MODEL_KEY = "fairway-lab/flight-model";
let model: FlightModel = (() => {
  try {
    return localStorage.getItem(MODEL_KEY) === "physics" ? "physics" : "truth";
  } catch { return "truth"; }
})();
export const getFlightModel = () => model;
export function setFlightModel(m: FlightModel) {
  model = m;
  try { localStorage.setItem(MODEL_KEY, m); } catch { /* ignore */ }
}

// "Réaliste" (truth) per-club trim. GLOBAL_T = 0.926 fitted to real Garmin R10
// measured carries; TRIM_T[Hy]=1.0 (absorbed into GLOBAL_T), other clubs scaled
// by (0.9 / GLOBAL_T) so the relative club gapping is preserved.
const GLOBAL_T = 0.926;
const _ratio = 0.9 / GLOBAL_T; // ≈ 0.972
const TRIM_T: Record<Club, number> = {
  Dr: 1.0 * _ratio,   "3W": 1.05 * _ratio, "5W": 1.05 * _ratio, Hy: 1.0,
  "3i": 0.96 * _ratio, "4i": 0.95 * _ratio, "5i": 0.93 * _ratio, "6i": 0.92 * _ratio,
  "7i": 0.92 * _ratio, "8i": 0.92 * _ratio, "9i": 0.92 * _ratio,
  PW:   0.93 * _ratio, GW:  0.93 * _ratio,  SW:  0.93 * _ratio,  LW:  0.93 * _ratio,
};

/** Initial velocity + spin vector shared by both integrators. */
function launchState(ballSpeedKmh: number, laDeg: number, ldDeg: number, backRpm: number, sideRpm: number) {
  const v0 = ballSpeedKmh / 3.6, la = rad(laDeg), ld = rad(ldDeg);
  const vel = {
    x: v0 * Math.cos(la) * Math.sin(ld),
    y: v0 * Math.cos(la) * Math.cos(ld),
    z: v0 * Math.sin(la),
  };
  const wb = (backRpm * 2 * Math.PI) / 60, ws = (sideRpm * 2 * Math.PI) / 60;
  const W = { x: wb * Math.cos(ld), y: wb * -Math.sin(ld), z: -ws };
  return { vel, W, Wmag: Math.hypot(W.x, W.y, W.z) || 1e-6 };
}

function finish(carry: number, carryX: number, apex: number, vx: number, vy: number, vz: number): Flight {
  const descent = (Math.atan2(-vz, Math.hypot(vx, vy)) * 180) / Math.PI;
  const rollFactor = Math.max(0, Math.min(0.25, ((45 - descent) / 45) * 0.22));
  const total = carry * (1 + rollFactor);
  return { carry, total, apex, offlineM: carryX * (total / Math.max(1, carry)), carryDeviation: carryX };
}

// ---- "Réaliste" (truth) — Euler integrator, induced drag, global trim ----
const CD0 = 0.10, KI = 2.0, KCL = 2.4, CLMAX = 0.26;

function eulerBase(ballKmh: number, laDeg: number, ldDeg: number, back: number, side: number, gl: number): Flight {
  const { vel, W, Wmag } = launchState(ballKmh, laDeg, ldDeg, back, side);
  const KL = (0.5 * RHO * A) / M;
  let { x, y, z } = { x: 0, y: 0, z: 0 };
  let { x: vx, y: vy, z: vz } = vel;
  const dt = 0.002;
  let carryX = 0, apex = 0;
  for (let i = 0; i < 12000; i++) {
    const v = Math.hypot(vx, vy, vz) || 1e-6;
    const S = (Wmag * R) / v;
    const Cl = Math.min(CLMAX, KCL * S);
    const Cd = CD0 + KI * Cl * Cl;
    const cx = W.y * vz - W.z * vy, cy = W.z * vx - W.x * vz, cz = W.x * vy - W.y * vx;
    const cm = Math.hypot(cx, cy, cz) || 1e-6;
    const lift = KL * Cl * v * v, drag = KL * Cd * v;
    const ax = -drag * vx + (lift * cx) / cm;
    const ay = -drag * vy + (lift * cy) / cm;
    const az = -drag * vz + (lift * cz) / cm - G;
    vx += ax * dt; vy += ay * dt; vz += az * dt;
    const pz = z; x += vx * dt; y += vy * dt; z += vz * dt;
    if (z > apex) apex = z;
    if (z <= 0 && pz > 0) { const t = pz / (pz - z); carryX = x - vx * dt * (1 - t); y -= vy * dt * (1 - t); break; }
  }
  const f = finish(Math.max(0, y), carryX, apex, vx, vy, vz);
  return { carry: f.carry * gl, total: f.total * gl, apex: f.apex * gl, offlineM: f.offlineM * gl, carryDeviation: f.carryDeviation * gl };
}

function truth(ballKmh: number, laDeg: number, ldDeg: number, back: number, side: number): Flight {
  return eulerBase(ballKmh, laDeg, ldDeg, back, side, GLOBAL_T);
}

// ---- "Théorique" (physics) — RK4, Cd≈0.225, Cl=f(S), no empirical calibration ----
const CD_PHYS = 0.225;
const clOf = (S: number) => Math.min(0.32, 1.5 * S); // grows with spin ratio (0.15–0.30)

function physics(ballKmh: number, laDeg: number, ldDeg: number, back: number, side: number): Flight {
  const { vel, W, Wmag } = launchState(ballKmh, laDeg, ldDeg, back, side);
  const k = (0.5 * RHO * A) / M;
  // state s = [x,y,z,vx,vy,vz]
  type S6 = [number, number, number, number, number, number];
  const deriv = (s: S6): S6 => {
    const vx = s[3], vy = s[4], vz = s[5];
    const v = Math.hypot(vx, vy, vz) || 1e-6;
    const S = (Wmag * R) / v;
    const Cl = clOf(S);
    const cx = W.y * vz - W.z * vy, cy = W.z * vx - W.x * vz, cz = W.x * vy - W.y * vx;
    const cm = Math.hypot(cx, cy, cz) || 1e-6;
    const lift = k * Cl * v * v, drag = k * CD_PHYS * v;
    return [vx, vy, vz,
      -drag * vx + (lift * cx) / cm,
      -drag * vy + (lift * cy) / cm,
      -drag * vz + (lift * cz) / cm - G];
  };
  const add = (a: S6, b: S6, h: number): S6 => a.map((v, i) => v + b[i] * h) as S6;
  let s: S6 = [0, 0, 0, vel.x, vel.y, vel.z];
  const dt = 0.001;
  let apex = 0, carryX = 0;
  for (let i = 0; i < 20000; i++) {
    const k1 = deriv(s), k2 = deriv(add(s, k1, dt / 2)), k3 = deriv(add(s, k2, dt / 2)), k4 = deriv(add(s, k3, dt));
    const next = s.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])) as S6;
    if (next[2] > apex) apex = next[2];
    if (next[2] <= 0 && s[2] > 0) {
      const t = s[2] / (s[2] - next[2]);
      carryX = s[0] + (next[0] - s[0]) * t;
      const yland = s[1] + (next[1] - s[1]) * t;
      return finish(Math.max(0, yland), carryX, apex, next[3], next[4], next[5]);
    }
    s = next;
  }
  return finish(Math.max(0, s[1]), s[0], apex, s[3], s[4], s[5]);
}

export function ballFlight(ballKmh: number, laDeg: number, ldDeg: number, back: number, side: number): Flight {
  if (model === "physics") return physics(ballKmh, laDeg, ldDeg, back, side);
  return truth(ballKmh, laDeg, ldDeg, back, side);
}

/**
 * Recompute a real shot's distances from its raw R10 metrics with the active
 * model. The per-club trim is applied only by the "Réaliste" (truth) model.
 * Simulator shots keep their own values. Idempotent (always derives from raw).
 */
export function applyFlight(s: Shot): Shot {
  if (s.sim) return s;
  const f = ballFlight(s.ballSpeed, s.launchAngle, s.launchDir, s.backSpin, s.sideSpin);
  const k = model === "truth" ? (TRIM_T[s.club] ?? 1) : 1;
  return {
    ...s,
    carry: f.carry * k, total: f.total * k, apex: f.apex * k,
    offlineM: f.offlineM * k, carryDeviation: f.carryDeviation * k,
  };
}
