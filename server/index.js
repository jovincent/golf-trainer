import express from "express";
import cors from "cors";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  listSessions, createSession, appendShot, endSession,
  deleteShot, deleteSession, clearSessions,
  listRounds, createRound, deleteRound,
  listCombines, createCombine, deleteCombine,
  createShare, getShare,
  listProfiles, createProfile, updateProfile, deleteProfile,
} from "./db.js";
import { renderOgPng, shareMeta } from "./og.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", true); // honour x-forwarded-proto/host behind a reverse proxy
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Use a dedicated var so a generic PORT (e.g. injected by a preview harness
// and forwarded to both processes by `concurrently`) only steers Vite.
const PORT = process.env.API_PORT || 4141;

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/profiles", (_req, res) => res.json(listProfiles()));
app.post("/api/profiles", (req, res) => {
  const { name } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  res.status(201).json(createProfile(name.trim()));
});
app.patch("/api/profiles/:id", (req, res) => {
  const { name } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  updateProfile(req.params.id, name.trim());
  res.json({ ok: true });
});
app.delete("/api/profiles/:id", (req, res) => {
  deleteProfile(req.params.id);
  res.json({ ok: true });
});

app.get("/api/sessions", (req, res) => {
  res.json(listSessions(req.query.profileId ?? null));
});

// Create a session (optionally with shots — used for live start, demo seed, migration).
app.post("/api/sessions", (req, res) => {
  const s = req.body;
  if (!s?.id || !s.startedAt || !s.label) {
    return res.status(400).json({ error: "id, startedAt, label required" });
  }
  createSession({ shots: [], ...s });
  res.status(201).json({ ok: true });
});

// Bulk import many sessions at once (migration from localStorage).
app.post("/api/sessions/bulk", (req, res) => {
  const { sessions, profileId } = req.body ?? {};
  if (!Array.isArray(sessions)) return res.status(400).json({ error: "sessions[] required" });
  for (const s of sessions) createSession({ shots: [], ...s, profileId: s.profileId ?? profileId ?? null });
  res.status(201).json({ ok: true, count: sessions.length });
});

// Append one shot to a live session.
app.post("/api/sessions/:id/shots", (req, res) => {
  appendShot(req.params.id, req.body);
  res.status(201).json({ ok: true });
});

// Mark a session ended.
app.patch("/api/sessions/:id", (req, res) => {
  endSession(req.params.id, req.body?.endedAt ?? Date.now());
  res.json({ ok: true });
});

app.delete("/api/sessions/:id/shots/:shotId", (req, res) => {
  deleteShot(req.params.shotId);
  res.json({ ok: true });
});

app.delete("/api/sessions/:id", (req, res) => {
  deleteSession(req.params.id);
  res.json({ ok: true });
});

app.delete("/api/sessions", (_req, res) => {
  clearSessions();
  res.json({ ok: true });
});

// ---- Rounds (course scorecards) --------------------------------------------

app.get("/api/rounds", (req, res) => res.json(listRounds(req.query.profileId ?? null)));

app.post("/api/rounds", (req, res) => {
  const r = req.body;
  if (!r?.id || !r.startedAt) return res.status(400).json({ error: "id, startedAt required" });
  createRound(r);
  res.status(201).json({ ok: true });
});

app.delete("/api/rounds/:id", (req, res) => {
  deleteRound(req.params.id);
  res.json({ ok: true });
});

// ---- Combines (standardized skill tests) ------------------------------------

app.get("/api/combines", (req, res) => res.json(listCombines(req.query.profileId ?? null)));

app.post("/api/combines", (req, res) => {
  const c = req.body;
  if (!c?.id || !c.startedAt || typeof c.score !== "number") {
    return res.status(400).json({ error: "id, startedAt, score required" });
  }
  createCombine(c);
  res.status(201).json({ ok: true });
});

app.delete("/api/combines/:id", (req, res) => {
  deleteCombine(req.params.id);
  res.json({ ok: true });
});

// ---- Shares (public, immutable snapshots) -----------------------------------

app.post("/api/shares", (req, res) => {
  const { kind, player, data } = req.body ?? {};
  if (!kind || !data) return res.status(400).json({ error: "kind, data required" });
  const token = randomBytes(6).toString("hex"); // 12 hex chars, URL-safe
  createShare({ token, kind, player: player ?? "Joueur", data, createdAt: Date.now() });
  res.status(201).json({ token });
});

app.get("/api/shares/:token", (req, res) => {
  const share = getShare(req.params.token);
  if (!share) return res.status(404).json({ error: "not found" });
  res.json(share);
});

// Dynamically rendered Open Graph image (1200×630 PNG) for a share.
app.get("/api/shares/:token/og.png", (req, res) => {
  const share = getShare(req.params.token);
  if (!share) return res.status(404).end();
  try {
    const png = renderOgPng(share);
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=31536000, immutable"); // shares are immutable
    res.send(png);
  } catch (e) {
    console.error("[og] render failed:", e);
    res.status(500).end();
  }
});

// ---- SPA shell for /s/:token with server-injected OG meta (crawler-friendly) ---

const DIST = join(__dirname, "..", "dist");
const INDEX_HTML = existsSync(join(DIST, "index.html"))
  ? join(DIST, "index.html")
  : join(__dirname, "..", "index.html");

function absOrigin(req) {
  return process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
}

// Replace the static <title> + og/twitter/description meta with per-share tags.
function injectMeta(html, meta) {
  const e = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta[^>]+(property=["']og:[^"']+["']|name=["']twitter:[^"']+["']|name=["']description["'])[^>]*>\s*/gi, "");
  const tags = `<title>${e(meta.title)}</title>
    <meta name="description" content="${e(meta.description)}"/>
    <meta property="og:type" content="website"/>
    <meta property="og:title" content="${e(meta.title)}"/>
    <meta property="og:description" content="${e(meta.description)}"/>
    <meta property="og:url" content="${e(meta.url)}"/>
    <meta property="og:image" content="${e(meta.image)}"/>
    <meta property="og:image:width" content="1200"/>
    <meta property="og:image:height" content="630"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content="${e(meta.title)}"/>
    <meta name="twitter:description" content="${e(meta.description)}"/>
    <meta name="twitter:image" content="${e(meta.image)}"/>
  </head>`;
  return stripped.replace(/<\/head>/i, tags);
}

app.get("/s/:token", (req, res) => {
  const share = getShare(req.params.token);
  let html = readFileSync(INDEX_HTML, "utf8");
  if (share) {
    const origin = absOrigin(req);
    const { title, description } = shareMeta(share);
    html = injectMeta(html, {
      title, description,
      url: `${origin}/s/${req.params.token}`,
      image: `${origin}/api/shares/${req.params.token}/og.png`,
    });
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// Serve the built SPA in production (no-op in dev, where Vite serves the app).
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(DIST, "index.html")));
}

app.listen(PORT, () => {
  console.log(`🏌️  Fairway Lab API on http://localhost:${PORT}`);
});
