import { useState } from "react";
import { Video, VideoOff, Circle, Square, AlertTriangle, Activity } from "lucide-react";
import { useSwingCamera } from "../lib/useSwingCamera";
import { analyzeSwing, type SwingReport } from "../lib/pose";
import { SwingVideo } from "../components/SwingVideo";
import { HandednessToggle, SwingLiveMetrics, SwingReportGrid } from "../components/SwingReport";

const hasWebcam = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

export function Swing() {
  const [rightHanded, setRightHanded] = useState(true);
  const cam = useSwingCamera(rightHanded);
  const [report, setReport] = useState<SwingReport | null>(null);

  const running = cam.status === "running";

  function toggleRecord() {
    if (cam.recording) {
      setReport(analyzeSwing(cam.stopRecording()));
    } else {
      setReport(null);
      cam.startRecording();
    }
  }

  return (
    <div className="grid gap-4">
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h2 className="font-display text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-fairway" /> Swing video analysis
            </h2>
            <p className="text-sm text-ink/50 mt-0.5">
              Pose estimation from your webcam — body landmarks tracked live, on-device. Nothing is uploaded.
            </p>
          </div>
          <HandednessToggle rightHanded={rightHanded} onChange={setRightHanded} />
        </div>

        {!hasWebcam && (
          <p className="mt-3 text-sm text-terracotta flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Your browser doesn't expose a webcam (need a desktop Chromium / Chrome on Android).
          </p>
        )}

        <div className="mt-4 grid lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
          <SwingVideo videoRef={cam.videoRef} canvasRef={cam.canvasRef} status={cam.status} error={cam.error} recording={cam.recording} />

          <div className="grid gap-3">
            <SwingLiveMetrics live={cam.live} />
            <div className="flex flex-wrap gap-2">
              {!running ? (
                <button onClick={cam.start} disabled={!hasWebcam || cam.status === "loading"}
                  className="inline-flex items-center gap-2 bg-fairway hover:bg-fairway-light text-white font-semibold rounded-xl px-5 py-2.5 transition disabled:opacity-50">
                  <Video className="w-4 h-4" /> {cam.status === "loading" ? "Starting…" : "Start camera"}
                </button>
              ) : (
                <>
                  <button onClick={toggleRecord}
                    className={"inline-flex items-center gap-2 font-semibold rounded-xl px-5 py-2.5 transition text-white " +
                      (cam.recording ? "bg-terracotta hover:bg-terracotta/90" : "bg-ink hover:bg-ink/90")}>
                    {cam.recording ? <><Square className="w-4 h-4" /> Stop & analyze</> : <><Circle className="w-4 h-4" /> Record swing</>}
                  </button>
                  <button onClick={cam.stop}
                    className="inline-flex items-center gap-2 bg-panel hover:bg-ink/5 text-ink/70 font-semibold rounded-xl px-4 py-2.5 transition">
                    <VideoOff className="w-4 h-4" /> Stop
                  </button>
                </>
              )}
            </div>
            <p className="text-[11px] text-ink/40 leading-relaxed">
              Stand <b>face-on</b> (or down-the-line), full body in frame, ~3 m back. Press <b>Record</b> at
              address and <b>Stop</b> after the finish — you'll get tempo, head movement and posture stability.
            </p>
          </div>
        </div>
      </section>

      {report && (
        <section className="card p-5">
          <h3 className="font-display text-base mb-3">Swing report</h3>
          <SwingReportGrid report={report} />
          <p className="text-[11px] text-ink/40 mt-3 leading-relaxed">
            Single-camera 2D estimates: "top" is where your lead hands are highest and "impact" where they
            return to address height. Best for tracking your own consistency over time, not coaching ground truth.
          </p>
        </section>
      )}
    </div>
  );
}
