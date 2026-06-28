// Webcam swing analysis via MediaPipe Pose Landmarker (33 body landmarks),
// running entirely in the browser (WASM + WebGL). Nothing is uploaded — frames
// stay on the device. The WASM runtime and the model are fetched from a CDN, so
// the first run needs a network connection.
import {
  PoseLandmarker, FilesetResolver, DrawingUtils,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

let _lm: PoseLandmarker | null = null;
let _init: Promise<PoseLandmarker> | null = null;

/** Lazily create (and cache) the pose landmarker in VIDEO mode. */
export function createPoseLandmarker(): Promise<PoseLandmarker> {
  if (_lm) return Promise.resolve(_lm);
  if (!_init) {
    _init = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      _lm = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return _lm;
    })();
  }
  return _init;
}

export { PoseLandmarker, DrawingUtils };
export type { NormalizedLandmark };

// ── Landmark indices (MediaPipe Pose) ─────────────────────────────────────────
export const LM = {
  nose: 0,
  lShoulder: 11, rShoulder: 12,
  lElbow: 13, rElbow: 14,
  lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24,
  lKnee: 25, rKnee: 26,
  lAnkle: 27, rAnkle: 28,
} as const;

type P = { x: number; y: number };
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const deg = (r: number) => (r * 180) / Math.PI;
/** Tilt of a line from horizontal (0 = level, 90 = vertical), direction-agnostic. */
const tilt = (dx: number, dy: number) => Math.abs(deg(Math.atan2(dy, Math.abs(dx))));
/** Lean of a (mostly upward) vector from vertical, signed. Image coords are y-down. */
const fromVertical = (dx: number, dy: number) => deg(Math.atan2(dx, -dy));
/** Interior angle at b for the joint a–b–c, in degrees. */
function angleAt(a: P, b: P, c: P) {
  const u = { x: a.x - b.x, y: a.y - b.y }, v = { x: c.x - b.x, y: c.y - b.y };
  const d = (u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) || 1e-6) * (Math.hypot(v.x, v.y) || 1e-6));
  return deg(Math.acos(Math.max(-1, Math.min(1, d))));
}

export interface SwingMetrics {
  spineAngle: number;    // deg lean of the spine from vertical (posture)
  shoulderTilt: number;  // deg of the shoulder line from horizontal
  hipTilt: number;       // deg of the hip line from horizontal
  kneeFlex: number;      // lead-knee interior angle hip-knee-ankle (180 = straight)
  leadArmAngle: number;  // lead shoulder-elbow-wrist angle (180 = straight arm)
  pelvisAngle: number;   // lead hip angle: lead-ankle ∠ trail-shoulder (posture at the top)
  leadWristY: number;    // normalized y of the lead wrist (for phase detection)
  leadWristX: number;    // normalized x of the lead wrist (address "hands ahead" check)
  ankleMidX: number;     // mid-point x of the two ankles
  leadShoulderX: number; // lead shoulder x (contact "shoulder over ankle" check)
  leadAnkleX: number;    // lead ankle x
  nose: P;               // for head-movement tracking
}

/** Per-frame angles from one set of landmarks. `rightHanded` picks the lead side. */
export function computeMetrics(lm: NormalizedLandmark[], rightHanded = true): SwingMetrics | null {
  if (!lm || lm.length < 29) return null;
  const ls = lm[LM.lShoulder], rs = lm[LM.rShoulder], lh = lm[LM.lHip], rh = lm[LM.rHip];
  const sh = mid(ls, rs), hp = mid(lh, rh);
  // lead = the side nearest the target (left for a right-handed golfer)
  const leadShoulder = rightHanded ? ls : rs;
  const trailShoulder = rightHanded ? rs : ls;
  const leadElbow = rightHanded ? lm[LM.lElbow] : lm[LM.rElbow];
  const leadWrist = rightHanded ? lm[LM.lWrist] : lm[LM.rWrist];
  const leadHip = rightHanded ? lh : rh;
  const leadKnee = rightHanded ? lm[LM.lKnee] : lm[LM.rKnee];
  const leadAnkle = rightHanded ? lm[LM.lAnkle] : lm[LM.rAnkle];
  return {
    spineAngle: Math.abs(fromVertical(sh.x - hp.x, sh.y - hp.y)),
    shoulderTilt: tilt(rs.x - ls.x, rs.y - ls.y),
    hipTilt: tilt(rh.x - lh.x, rh.y - lh.y),
    kneeFlex: angleAt(leadHip, leadKnee, leadAnkle),
    leadArmAngle: angleAt(leadShoulder, leadElbow, leadWrist),
    pelvisAngle: angleAt(leadAnkle, leadHip, trailShoulder),
    leadWristY: leadWrist.y,
    leadWristX: leadWrist.x,
    ankleMidX: (lm[LM.lAnkle].x + lm[LM.rAnkle].x) / 2,
    leadShoulderX: leadShoulder.x,
    leadAnkleX: leadAnkle.x,
    nose: { x: lm[LM.nose].x, y: lm[LM.nose].y },
  };
}

export interface Frame { t: number; m: SwingMetrics; img?: string } // img = JPEG data-URL snapshot (only while recording)

/** One position check. `quality` (0 = bad … 1 = ideal) drives the green→red colour. */
export interface PhaseCheck { label: string; ok: boolean; detail?: string; quality: number }
export interface SwingChecks { address: PhaseCheck[]; top: PhaseCheck[]; contact: PhaseCheck[] }

export interface SwingReport {
  frames: Frame[];
  addressIndex: number; topIndex: number; impactIndex: number;
  backswingMs: number; downswingMs: number; tempoRatio: number;
  headMovement: number;   // max nose drift over the swing, % of frame
  maxShoulderTilt: number;
  spineRange: number;     // change in spine lean across the swing (posture stability)
  checks: SwingChecks;    // per-phase pass/fail position checks
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const HEAD_TOL = 0.05; // max head drift from address (fraction of frame) before it's a fault

/** 0…1 quality for a value vs an ideal [lo,hi] band; fades to 0 `margin` beyond it. */
function bandQuality(v: number, lo: number, hi: number, margin: number) {
  if (v >= lo && v <= hi) return 1;
  return clamp01(1 - (v < lo ? lo - v : v - hi) / margin);
}

/** Per-phase position checks at address / top / contact, with the reference's thresholds. */
function evaluateChecks(a: SwingMetrics, top: SwingMetrics, c: SwingMetrics): SwingChecks {
  const headDist = (m: SwingMetrics) => Math.hypot(m.nose.x - a.nose.x, m.nose.y - a.nose.y);
  const deg = (v: number) => `${v.toFixed(0)}°`;
  const headQ = (m: SwingMetrics) => clamp01(1 - headDist(m) / (HEAD_TOL * 2));
  const arm = (v: number, lo: number) =>
    ({ label: "Lead arm straight", ok: inRange(v, lo, 180), detail: deg(v), quality: bandQuality(v, lo, 180, 25) });
  return {
    address: [
      arm(a.leadArmAngle, 165),
      { label: "Hands over the ball", ok: a.ankleMidX - a.leadWristX < 0, quality: a.ankleMidX - a.leadWristX < 0 ? 1 : 0 },
    ],
    top: [
      { label: "Posture held (pelvis)", ok: inRange(top.pelvisAngle, 150, 180), detail: deg(top.pelvisAngle), quality: bandQuality(top.pelvisAngle, 150, 180, 30) },
      { label: "Head steady", ok: headDist(top) <= HEAD_TOL, detail: `${(headDist(top) * 100).toFixed(1)}%`, quality: headQ(top) },
    ],
    contact: [
      arm(c.leadArmAngle, 160),
      { label: "Lead knee extended", ok: inRange(c.kneeFlex, 165, 180), detail: deg(c.kneeFlex), quality: bandQuality(c.kneeFlex, 165, 180, 25) },
      { label: "Head behind the ball", ok: headDist(c) <= HEAD_TOL, detail: `${(headDist(c) * 100).toFixed(1)}%`, quality: headQ(c) },
      { label: "Shoulder over ankle", ok: c.leadAnkleX - c.leadShoulderX >= 0, quality: c.leadAnkleX - c.leadShoulderX >= 0 ? 1 : 0 },
    ],
  };
}

/**
 * Heuristic swing breakdown from a recorded landmark time-series. Single-camera
 * 2D, so it's approximate, keyed off the lead-wrist height (y is down, so a small
 * y = hands high):
 *   • top     = frame where the lead hands are HIGHEST (min y);
 *   • address = lowest hands BEFORE the top (max y) — robust to a pre-shot waggle;
 *   • impact  = lowest hands AFTER the top (hands back down at the ball).
 * Tempo is the backswing:downswing time ratio (tour pros sit near 3:1).
 */
export function analyzeSwing(frames: Frame[]): SwingReport | null {
  if (frames.length < 8) return null;

  let topIndex = 0, minY = Infinity;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].m.leadWristY < minY) { minY = frames[i].m.leadWristY; topIndex = i; }
  }
  let addressIndex = 0, maxBefore = -Infinity;
  for (let i = 0; i <= topIndex; i++) {
    if (frames[i].m.leadWristY > maxBefore) { maxBefore = frames[i].m.leadWristY; addressIndex = i; }
  }
  let impactIndex = frames.length - 1, maxAfter = -Infinity;
  for (let i = topIndex; i < frames.length; i++) {
    if (frames[i].m.leadWristY > maxAfter) { maxAfter = frames[i].m.leadWristY; impactIndex = i; }
  }
  if (impactIndex <= topIndex) impactIndex = frames.length - 1;

  const backswingMs = frames[topIndex].t - frames[addressIndex].t;
  const downswingMs = frames[impactIndex].t - frames[topIndex].t;
  const tempoRatio = downswingMs > 0 ? backswingMs / downswingMs : 0;

  const n0 = frames[addressIndex].m.nose;
  let headMovement = 0;
  for (const f of frames) {
    const d = Math.hypot(f.m.nose.x - n0.x, f.m.nose.y - n0.y);
    if (d > headMovement) headMovement = d;
  }
  const spines = frames.map((f) => f.m.spineAngle);
  return {
    frames, addressIndex, topIndex, impactIndex,
    backswingMs, downswingMs, tempoRatio,
    headMovement: headMovement * 100,
    maxShoulderTilt: Math.max(...frames.map((f) => f.m.shoulderTilt)),
    spineRange: Math.max(...spines) - Math.min(...spines),
    checks: evaluateChecks(frames[addressIndex].m, frames[topIndex].m, frames[impactIndex].m),
  };
}
