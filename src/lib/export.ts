import type { Shot } from "../types";

const COLUMNS: Array<[string, (s: Shot) => string | number]> = [
  ["date", (s) => new Date(s.ts).toISOString()],
  ["club", (s) => s.club],
  ["carry_m", (s) => s.carry.toFixed(1)],
  ["total_m", (s) => s.total.toFixed(1)],
  ["ball_kmh", (s) => s.ballSpeed.toFixed(1)],
  ["club_kmh", (s) => s.clubSpeed.toFixed(1)],
  ["smash", (s) => s.smashFactor.toFixed(3)],
  ["launch_deg", (s) => s.launchAngle.toFixed(1)],
  ["launch_dir_deg", (s) => s.launchDir.toFixed(1)],
  ["attack_deg", (s) => (s.attackAngle ?? 0).toFixed(1)],
  ["club_path_deg", (s) => (s.clubPath ?? 0).toFixed(1)],
  ["club_face_deg", (s) => (s.clubFace ?? 0).toFixed(1)],
  ["face_to_path_deg", (s) => (s.faceToPath ?? 0).toFixed(1)],
  ["backspin_rpm", (s) => s.backSpin.toFixed(0)],
  ["sidespin_rpm", (s) => s.sideSpin.toFixed(0)],
  ["spin_total_rpm", (s) => Math.hypot(s.backSpin, s.sideSpin).toFixed(0)],
  ["apex_m", (s) => s.apex.toFixed(1)],
  ["total_dev_m", (s) => s.offlineM.toFixed(1)],
  ["carry_dev_m", (s) => (s.carryDeviation ?? s.offlineM).toFixed(1)],
];

export function shotsToCsv(shots: Shot[]): string {
  const header = COLUMNS.map(([h]) => h).join(",");
  const rows = shots.map((s) => COLUMNS.map(([, f]) => f(s)).join(","));
  return [header, ...rows].join("\n");
}

/** Trigger a browser download of the given text as a file. */
export function downloadText(filename: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
