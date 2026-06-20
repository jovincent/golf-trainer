import { useEffect, useState } from "react";
import { X, Loader2, Link2, Check, Download, Share2 } from "lucide-react";
import { api } from "../lib/api";
import { shareUrl, type ShareEnvelope } from "../lib/share";
import { ShareCard } from "../pages/share/cards";

/**
 * Creates an immutable public share for an envelope on open, then shows a live
 * preview of the card alongside the public link and PDF/native-share actions.
 */
export function ShareModal({ envelope, onClose }: { envelope: ShareEnvelope; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    api.createShare(envelope)
      .then((r) => { if (alive) setToken(r.token); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [envelope]);

  const url = token ? shareUrl(token) : "";

  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  }

  async function nativeShare() {
    if (!url) return;
    if (navigator.share) { try { await navigator.share({ title: "FlightLab", url }); } catch { /* cancelled */ } }
    else copy();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 share-modal-overlay"
      style={{ background: "rgb(22 41 77 / .45)" }} onClick={onClose}>
      <div className="bg-canvas rounded-2xl w-full max-w-[600px] max-h-[92vh] overflow-auto relative"
        style={{ background: "rgb(var(--c-canvas))", boxShadow: "var(--shadow-cta)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center gap-2 px-5 py-3 bg-surface/90 backdrop-blur"
          style={{ borderBottom: "1px solid var(--border-card)" }}>
          <Share2 className="w-4 h-4 text-fairway" />
          <h2 className="font-display text-base">Share</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto p-1.5 rounded-lg text-ink/40 hover:bg-panel hover:text-ink transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid gap-4 justify-items-center">
          <ShareCard kind={envelope.kind} player={envelope.player} data={envelope.data} />

          {/* Link + actions */}
          <div className="w-full grid gap-2 share-actions">
            {err ? (
              <p className="text-sm text-terracotta text-center">Unable to create the share link.</p>
            ) : !token ? (
              <div className="flex items-center justify-center gap-2 text-sm text-ink/50 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Creating public link…
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 bg-panel rounded-xl px-3 py-2">
                  <Link2 className="w-4 h-4 text-ink/40 shrink-0" />
                  <input readOnly value={url} className="flex-1 bg-transparent text-sm text-ink/70 outline-none min-w-0" />
                  <button onClick={copy} className="inline-flex items-center gap-1.5 text-sm font-semibold text-fairway shrink-0 px-2 py-1 rounded-lg hover:bg-fairway/10 transition">
                    {copied ? <><Check className="w-4 h-4" /> Copied!</> : "Copy"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={nativeShare} className="flex-1 inline-flex items-center justify-center gap-2 bg-fairway hover:bg-fairway-light text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition">
                    <Share2 className="w-4 h-4" /> Share link
                  </button>
                  <button onClick={() => window.print()} className="flex-1 inline-flex items-center justify-center gap-2 bg-ink hover:bg-ink/90 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition">
                    <Download className="w-4 h-4" /> PDF
                  </button>
                </div>
                <p className="text-[11px] text-ink/40 text-center">Public link, read-only · frozen at the moment of sharing.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
