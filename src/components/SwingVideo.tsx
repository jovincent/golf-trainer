import type { RefObject } from "react";
import { RefreshCw, AlertTriangle, Circle } from "lucide-react";

type Status = "idle" | "loading" | "running" | "error";

/** The mirrored webcam feed with the pose skeleton drawn on an overlay canvas. */
export function SwingVideo({
  videoRef, canvasRef, status, error, recording, aspect = "16 / 9",
}: {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  status: Status;
  error?: string;
  recording?: boolean;
  aspect?: string;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-ink/90" style={{ aspectRatio: aspect, transform: "scaleX(-1)" }}>
      <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
      {status !== "running" && (
        <div className="absolute inset-0 grid place-items-center text-white/70 text-sm px-6 text-center" style={{ transform: "scaleX(-1)" }}>
          {status === "loading" ? (
            <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading the pose model…</span>
          ) : status === "error" ? (
            <span className="flex items-center gap-2 text-terracotta"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</span>
          ) : (
            <span className="text-white/50">Camera off</span>
          )}
        </div>
      )}
      {recording && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-terracotta text-white text-xs font-semibold rounded-full px-2.5 py-1" style={{ transform: "scaleX(-1)" }}>
          <Circle className="w-2.5 h-2.5 fill-current animate-pulse" /> REC
        </div>
      )}
    </div>
  );
}
