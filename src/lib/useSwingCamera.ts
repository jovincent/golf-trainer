// Reusable webcam + pose loop. Keeps a rolling buffer of recent pose frames so a
// swing can be grabbed by time window (e.g. around a detected shot), and also
// supports explicit start/stop recording for free-form analysis.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPoseLandmarker, computeMetrics,
  PoseLandmarker, DrawingUtils,
  type Frame, type SwingMetrics,
} from "./pose";

const BUFFER_MS = 6000; // rolling history kept for shot-synced grabs

type Status = "idle" | "loading" | "running" | "error";

export function useSwingCamera(rightHanded: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const drawRef = useRef<DrawingUtils | null>(null);
  const lastVideoTs = useRef<number>(-1);
  const bufRef = useRef<Frame[]>([]);
  const recRef = useRef<{ on: boolean; frames: Frame[] }>({ on: false, frames: [] });
  const rhRef = useRef(rightHanded);
  rhRef.current = rightHanded;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [live, setLive] = useState<SwingMetrics | null>(null);
  const [recording, setRecording] = useState(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const v = videoRef.current;
    (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    bufRef.current = [];
    recRef.current = { on: false, frames: [] };
    setRecording(false);
    setStatus("idle");
    setLive(null);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser has no webcam access (getUserMedia).");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      const lm = await createPoseLandmarker();
      const canvas = canvasRef.current!;
      canvas.width = v.videoWidth; canvas.height = v.videoHeight;
      drawRef.current = new DrawingUtils(canvas.getContext("2d")!);
      lastVideoTs.current = -1;
      setStatus("running");

      const loop = () => {
        const vv = videoRef.current, cv = canvasRef.current, du = drawRef.current;
        if (vv && cv && du && vv.readyState >= 2 && vv.currentTime !== lastVideoTs.current) {
          lastVideoTs.current = vv.currentTime;
          const res = lm.detectForVideo(vv, performance.now());
          const ctx = cv.getContext("2d")!;
          ctx.clearRect(0, 0, cv.width, cv.height);
          const landmarks = res.landmarks?.[0];
          if (landmarks) {
            du.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "#16294D", lineWidth: 3 });
            du.drawLandmarks(landmarks, { color: "#2F8F5B", fillColor: "#2F8F5B", radius: 4 });
            const m = computeMetrics(landmarks, rhRef.current);
            if (m) {
              setLive(m);
              const now = Date.now();
              const frame: Frame = { t: now, m };
              const buf = bufRef.current;
              buf.push(frame);
              const cutoff = now - BUFFER_MS;
              while (buf.length && buf[0].t < cutoff) buf.shift();
              if (recRef.current.on) recRef.current.frames.push(frame);
            }
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      (videoRef.current?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setError(e instanceof Error ? e.message : "Could not start the camera.");
      setStatus("error");
    }
  }, []);

  /** Pose frames in [endTime − durationMs, endTime] from the rolling buffer. */
  const grab = useCallback((endTime: number, durationMs = 3500): Frame[] => {
    const from = endTime - durationMs;
    return bufRef.current.filter((f) => f.t >= from && f.t <= endTime + 250);
  }, []);

  const startRecording = useCallback(() => { recRef.current = { on: true, frames: [] }; setRecording(true); }, []);
  const stopRecording = useCallback((): Frame[] => {
    recRef.current.on = false;
    setRecording(false);
    return recRef.current.frames;
  }, []);

  return { videoRef, canvasRef, status, error, live, recording, start, stop, grab, startRecording, stopRecording };
}
