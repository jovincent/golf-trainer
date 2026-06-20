import { useEffect, useState } from "react";
import { Loader2, Download, ArrowRight, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { ShareCard } from "./share/cards";

interface Loaded { kind: string; player: string; createdAt: number; data: unknown }

export function SharePage({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");
  const [share, setShare] = useState<Loaded | null>(null);

  useEffect(() => {
    api.getShare(token)
      .then((s) => { setShare(s); setState("ok"); })
      .catch(() => setState("error"));
  }, [token]);

  return (
    <div className="min-h-screen grid place-items-center p-4 sm:p-8">
      {state === "loading" && (
        <div className="flex items-center gap-3 text-ink/50">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      )}

      {state === "error" && (
        <div className="card p-8 text-center max-w-sm grid gap-3">
          <AlertTriangle className="w-10 h-10 text-terracotta mx-auto" />
          <h1 className="font-display text-lg">Share not found</h1>
          <p className="text-sm text-ink/50">This link may have expired or doesn't exist.</p>
          <a href="/" className="text-sm font-semibold text-fairway hover:underline">Discover FlightLab →</a>
        </div>
      )}

      {state === "ok" && share && (
        <div className="grid gap-5 justify-items-center">
          <ShareCard kind={share.kind} player={share.player} data={share.data} />

          <div className="flex items-center gap-2 share-actions">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-ink hover:bg-ink/90 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition"
            >
              <Download className="w-4 h-4" /> Download as PDF
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-fairway hover:bg-fairway-light text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition"
            >
              Try FlightLab <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
