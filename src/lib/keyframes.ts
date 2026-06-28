import type { Frame, SwingReport } from "./pose";

// The three positions the reference project (and golf coaching) keys off.
const PHASES = [
  { key: "addressIndex", label: "Address" },
  { key: "topIndex", label: "Top" },
  { key: "impactIndex", label: "Contact" },
] as const;

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/**
 * Composite the address / top / contact key frames (video + skeleton snapshots)
 * into a single labelled still (JPEG). This is saved in place of the full video.
 */
export async function buildKeyframeStill(frames: Frame[], r: SwingReport): Promise<Blob | null> {
  const picks = PHASES
    .map((p) => ({ label: p.label as string, img: frames[r[p.key]]?.img }))
    .filter((p): p is { label: string; img: string } => !!p.img);
  if (!picks.length) return null;

  const imgs = await Promise.all(picks.map((p) => loadImg(p.img)));
  const tw = imgs[0].width || 480, th = imgs[0].height || 270, labelH = 30;
  const canvas = document.createElement("canvas");
  canvas.width = tw * imgs.length;
  canvas.height = th + labelH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b1428";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const byLabel: Record<string, { ok: boolean }[]> = {
    address: r.checks.address, top: r.checks.top, contact: r.checks.contact,
  };
  imgs.forEach((im, i) => {
    const x = i * tw;
    ctx.drawImage(im, x, labelH, tw, th);
    const items = byLabel[picks[i].label.toLowerCase()] ?? [];
    const pass = items.filter((c) => c.ok).length, total = items.length;
    // Label bar is green when every position check passes, red when any fault.
    ctx.fillStyle = total ? (pass === total ? "#2F8F5B" : "#C2603A") : "#16294D";
    ctx.fillRect(x, 0, tw, labelH);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Manrope, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(picks[i].label.toUpperCase(), x + 12, labelH / 2 + 1);
    if (total) {
      ctx.textAlign = "right";
      ctx.font = "bold 14px Manrope, system-ui, sans-serif";
      ctx.fillText(`${pass}/${total}`, x + tw - 12, labelH / 2 + 1);
      ctx.textAlign = "left";
    }
    if (i > 0) { ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fillRect(x, labelH, 1, th); }
  });

  return new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.85));
}
