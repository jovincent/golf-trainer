// Ball-flight model: the R10 reports ball speed / launch / spin but NOT carry,
// so we integrate the trajectory (m·dv/dt = mg + F_D + F_L).
//
// Three selectable models (global setting):
//   "calibrated" — Euler + induced drag + per-club trim + GLOBAL=0.90, tuned
//                  to the user's real distances.
//   "physics"    — textbook launch-monitor model: RK4, Cd≈0.225, Cl=f(S),
//                  no empirical fudge (R&A / wind-tunnel constants).
//   "truth"      — same Euler engine but GLOBAL=0.926, calibrated on 4 real
//                  Garmin R10 hybrid shots (outdoor measured carry).
//                  RMSE vs Garmin: 1.95 m  (vs 2.51 m for "calibrated").
//                  TRIM_T[Hy]=1.0 (absorbed into GLOBAL_T); other clubs
//                  scaled proportionally so relative gapping is preserved.

import type { Club, Shot } from "../types";

// ---- ball / air constants (shared) ----
const M = 0.0459, R = 0.02134;
const A = Math.PI * R * R, RHO = 1.225, G = 9.81;
const rad = (d: number) => (d * Math.PI) / 180;

export interface Flight {
  carry: number; total: number; apex: number; offlineM: number; carryDeviation: number;
}

// ---- global model selector ----
export type FlightModel = "calibrated" | "physics" | "regression" | "truth";
const MODEL_KEY = "fairway-lab/flight-model";
let model: FlightModel = (() => {
  try {
    const v = localStorage.getItem(MODEL_KEY);
    if (v === "physics" || v === "regression" || v === "truth") return v;
    return "calibrated";
  } catch { return "calibrated"; }
})();
export const getFlightModel = () => model;
export function setFlightModel(m: FlightModel) {
  model = m;
  try { localStorage.setItem(MODEL_KEY, m); } catch { /* ignore */ }
}

// Per-club calibration trim (calibrated model only).
// Recalibrated 2026-06-15 against 44 Garmin-measured shots (Jonathan): short irons
// 6i–9i 0.92→0.93 (slight under-prediction). Hy kept at 1.02 (the 0.98 retune was
// reverted at the user's request — preferred the original). Driver spot-on (1.0).
const TRIM: Record<Club, number> = {
  Dr: 1.0, "3W": 1.05, "5W": 1.05, Hy: 1.02,
  "3i": 0.96, "4i": 0.95, "5i": 0.93, "6i": 0.93, "7i": 0.93,
  "8i": 0.93, "9i": 0.93, PW: 0.93, GW: 0.93, SW: 0.93, LW: 0.93,
};

// TRUTH model — GLOBAL_T = 0.926 (fitted to 4 Garmin R10 hybrid shots).
// TRIM_T: Hy=1.0 (absorbed into GLOBAL_T); all other clubs scaled by
// (GLOBAL / GLOBAL_T) so their net factor = 0.9 × TRIM[club], unchanged.
// This means relative gapping is exactly preserved vs "calibrated".
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

// ---- Model A: calibrated (Euler, induced drag, global trim) ----
const CD0 = 0.10, KI = 2.0, KCL = 2.4, CLMAX = 0.26, GLOBAL = 0.9;

function calibratedBase(ballKmh: number, laDeg: number, ldDeg: number, back: number, side: number, gl: number): Flight {
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

function calibrated(ballKmh: number, laDeg: number, ldDeg: number, back: number, side: number): Flight {
  return calibratedBase(ballKmh, laDeg, ldDeg, back, side, GLOBAL);
}

// ---- Model D: TRUTH (Euler, GLOBAL_T=0.926 fitted to 4 Garmin R10 hybrid shots) ----
function truth(ballKmh: number, laDeg: number, ldDeg: number, back: number, side: number): Flight {
  return calibratedBase(ballKmh, laDeg, ldDeg, back, side, GLOBAL_T);
}

// ---- Model B: physics (RK4, Cd≈0.225, Cl=f(S)) ----
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

const MPH_PER_KMH = 1 / 1.60934;

// ---- Model C: regression — carry_m = b0+b1·BS+b2·LA+b3·K+b4·LA²+b5·K²+b6·LA·K ----
// BS mph, LA deg, K = total spin / 1000. Least-squares fit to the calibrated
// model (≈1.6 m MAE). Best non-physics approximation.
const REG = [-70.07867, 1.8688, 1.73987, -3.19243, 0.04346, 0.87858, -0.44238];
function regression(ballKmh: number, laDeg: number, ldDeg: number, back: number, side: number): Flight {
  const bs = ballKmh * MPH_PER_KMH, la = laDeg, K = Math.hypot(back, side) / 1000;
  const carry = Math.max(0,
    REG[0] + REG[1] * bs + REG[2] * la + REG[3] * K + REG[4] * la * la + REG[5] * K * K + REG[6] * la * K);
  const offline = carry * Math.sin(rad(ldDeg)) + side * 0.003;
  return { carry, total: carry, apex: carry * 0.14, offlineM: offline, carryDeviation: offline };
}

export function ballFlight(ballKmh: number, laDeg: number, ldDeg: number, back: number, side: number): Flight {
  if (model === "physics")    return physics(ballKmh, laDeg, ldDeg, back, side);
  if (model === "regression") return regression(ballKmh, laDeg, ldDeg, back, side);
  if (model === "truth")      return truth(ballKmh, laDeg, ldDeg, back, side);
  return calibrated(ballKmh, laDeg, ldDeg, back, side);
}

/**
 * Recompute a real shot's distances from its raw R10 metrics with the active
 * model. Per-club trim is applied only by the calibrated model. Simulator shots
 * keep their own values. Idempotent (always derives from raw metrics).
 */
export function applyFlight(s: Shot): Shot {
  if (s.sim) return s;
  const f = ballFlight(s.ballSpeed, s.launchAngle, s.launchDir, s.backSpin, s.sideSpin);
  let k = 1;
  if (model === "calibrated") k = TRIM[s.club] ?? 1;
  if (model === "truth")      k = TRIM_T[s.club] ?? 1;
  return {
    ...s,
    carry: f.carry * k, total: f.total * k, apex: f.apex * k,
    offlineM: f.offlineM * k, carryDeviation: f.carryDeviation * k,
  };
}
