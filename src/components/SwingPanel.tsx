import { useEffect, useState } from "react";
import { Video, VideoOff, AlertTriangle } from "lucide-react";
import { useSwingCamera } from "../lib/useSwingCamera";
import { analyzeSwing, type SwingReport } from "../lib/pose";
import { useStore } from "../store";
import { api, reportSummary } from "../lib/api";
import type { Shot } from "../types";
import { SwingVideo } from "./SwingVideo";
import { HandednessToggle, SwingLiveMetrics, SwingReportGrid } from "./SwingReport";

const hasWebcam = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
const WINDOW_MS = 3500; // swing window grabbed before each detected shot

/**
 * Session swing camera. Runs pose tracking alongside the launch monitor and, when
 * a ball is registered, grabs the ~3.5 s of pose frames before that shot's time
 * and analyses the swing — pairing tempo / head movement / posture with the shot.
 */
export function SwingPanel({ last }: { last?: Shot }) {
  const profileId = useStore((s) => s.profileId);
  const [rightHanded, setRightHanded] = useState(true);
  const cam = useSwingCamera(rightHanded);
  const [report, setReport] = useState<SwingReport | null>(null);
  const [forShot, setForShot] = useState<string | undefined>(undefined);
  const [forClub, setForClub] = useState<string | undefined>(undefined);
  const running = cam.status === "running";

  // A new shot landed while the camera is running → analyse the swing before it,
  // and save it to History (data-only — these in-session swings have no clip).
  useEffect(() => {
    if (!running || !last || last.id === forShot) return;
    setForShot(last.id);
    const r = analyzeSwing(cam.grab(last.ts ?? Date.now(), WINDOW_MS));
    if (r) {
      setReport(r); setForClub(last.club);
      api.createSwing({
        id: `swing_${last.id}`, ts: last.ts ?? Date.now(), profileId, club: last.club,
        durationMs: Math.round(r.backswingMs + r.downswingMs), report: reportSummary(r),
      }).catch(() => { /* offline / API down */ });
    }
  }, [last, running, forShot, cam, profileId]);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-display text-base flex items-center gap-2">
          <Video className="w-4 h-4 text-fairway" /> Swing camera
          <span className="text-[10px] uppercase tracking-wider text-ink/35 font-semibold">beta</span>
        </h3>
        <div className="flex items-center gap-2">
          {running && <HandednessToggle rightHanded={rightHanded} onChange={setRightHanded} />}
          {!running ? (
            <button onClick={cam.start} disabled={!hasWebcam || cam.status === "loading"}
              className="inline-flex items-center gap-2 bg-fairway hover:bg-fairway-light text-white text-sm font-semibold rounded-xl px-4 py-2 transition disabled:opacity-50">
              <Video className="w-4 h-4" /> {cam.status === "loading" ? "Starting…" : "Enable camera"}
            </button>
          ) : (
            <button onClick={cam.stop}
              className="inline-flex items-center gap-2 bg-panel hover:bg-ink/5 text-ink/70 text-sm font-semibold rounded-xl px-3 py-2 transition">
              <VideoOff className="w-4 h-4" /> Stop
            </button>
          )}
        </div>
      </div>

      {!hasWebcam ? (
        <p className="text-sm text-terracotta flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> Your browser doesn't expose a webcam (need a desktop Chromium / Chrome on Android).
        </p>
      ) : (
        // The video/canvas are always mounted (refs must exist before start()).
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
          <SwingVideo videoRef={cam.videoRef} canvasRef={cam.canvasRef} status={cam.status} error={cam.error} />
          <div className="grid gap-3">
            {running && <SwingLiveMetrics live={cam.live} />}
            {running && report ? (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-ink/40 mb-1.5">
                  Swing · last shot{forClub ? ` · ${forClub}` : ""}
                </div>
                <SwingReportGrid report={report} compact />
              </div>
            ) : running ? (
              <p className="text-[11px] text-ink/40 leading-relaxed">
                Hit a ball — the swing in the ~{(WINDOW_MS / 1000).toFixed(1)} s before impact is analysed
                automatically and paired with the shot. Stand face-on, full body in frame.
              </p>
            ) : (
              <p className="text-sm text-ink/50 leading-relaxed">
                Turn on your webcam to capture each swing. When the R10 (or the simulator) registers a ball,
                the swing just before impact is analysed and paired with the shot — <b>tempo</b>,
                <b> head movement</b> and <b>posture stability</b>. On-device; nothing is uploaded.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
