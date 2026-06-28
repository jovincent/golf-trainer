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
  kneeFlex: number;      // interior angle of the lead knee (180 = straight)
  leadWristY: number;    // normalized y of the lead wrist (for phase detection)
  nose: P;               // for head-movement tracking
}

/** Per-frame angles from one set of landmarks. `rightHanded` picks the lead side. */
export function computeMetrics(lm: NormalizedLandmark[], rightHanded = true): SwingMetrics | null {
  if (!lm || lm.length < 29) return null;
  const ls = lm[LM.lShoulder], rs = lm[LM.rShoulder], lh = lm[LM.lHip], rh = lm[LM.rHip];
  const sh = mid(ls, rs), hp = mid(lh, rh);
  const hip = rightHanded ? lh : rh;
  const knee = rightHanded ? lm[LM.lKnee] : lm[LM.rKnee];
  const ankle = rightHanded ? lm[LM.lAnkle] : lm[LM.rAnkle];
  const leadWrist = rightHanded ? lm[LM.lWrist] : lm[LM.rWrist];
  return {
    spineAngle: Math.abs(fromVertical(sh.x - hp.x, sh.y - hp.y)),
    shoulderTilt: tilt(rs.x - ls.x, rs.y - ls.y),
    hipTilt: tilt(rh.x - lh.x, rh.y - lh.y),
    kneeFlex: angleAt(hip, knee, ankle),
    leadWristY: leadWrist.y,
    nose: { x: lm[LM.nose].x, y: lm[LM.nose].y },
  };
}

export interface Frame { t: number; m: SwingMetrics }

export interface SwingReport {
  frames: Frame[];
  addressIndex: number; topIndex: number; impactIndex: number;
  backswingMs: number; downswingMs: number; tempoRatio: number;
  headMovement: number;   // max nose drift over the swing, % of frame
  maxShoulderTilt: number;
  spineRange: number;     // change in spine lean across the swing (posture stability)
}

/**
 * Heuristic swing breakdown from a recorded landmark time-series. Single-camera
 * 2D, so it's approximate: "top of backswing" is the frame where the lead hands
 * are highest, "impact" the first frame they return to address height afterwards.
 * Tempo is the backswing:downswing time ratio (tour pros sit near 3:1).
 */
export function analyzeSwing(frames: Frame[]): SwingReport | null {
  if (frames.length < 8) return null;
  const addressIndex = 0;
  const addrY = frames[addressIndex].m.leadWristY;

  let topIndex = 0, minY = Infinity;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].m.leadWristY < minY) { minY = frames[i].m.leadWristY; topIndex = i; }
  }
  let impactIndex = frames.length - 1;
  for (let i = topIndex + 1; i < frames.length; i++) {
    if (frames[i].m.leadWristY >= addrY * 0.98) { impactIndex = i; break; }
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
  };
}
