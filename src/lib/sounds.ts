// Tiny Web-Audio cues — no asset files. Success = rising two-tone, error = low
// descending buzz. Respects a persisted mute toggle.

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

let enabled = (() => { try { return localStorage.getItem("fairway-lab/sound") !== "off"; } catch { return true; } })();
export const soundsEnabled = () => enabled;
export function setSoundsEnabled(v: boolean) {
  enabled = v;
  try { localStorage.setItem("fairway-lab/sound", v ? "on" : "off"); } catch { /* ignore */ }
}

function beep(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = "sine", peak = 0.09) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Pleasant confirmation — a shot was validated / recorded. */
export function playSuccess() {
  if (!enabled) return;
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  beep(c, 880, t, 0.1);          // A5
  beep(c, 1318.5, t + 0.08, 0.14); // E6
}

/** Error — a shot was not validated / recorded. */
export function playError() {
  if (!enabled) return;
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  beep(c, 233, t, 0.18, "square", 0.05);       // Bb3
  beep(c, 155.6, t + 0.15, 0.24, "square", 0.05); // Eb3
}
