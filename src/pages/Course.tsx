import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Flag, Target, Play, RotateCcw, Radio, Undo2, Trash2, ChevronRight, ChevronLeft, BarChart3, Search, X, Share2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useStore, allShots } from "../store";
import type { Shot } from "../types";
import { ClubSelector } from "../components/ClubSelector";
import { aggregateByClub } from "../lib/stats";
import { api } from "../lib/api";
import { ShareModal } from "../components/ShareModal";
import { buildRoundShare, type ShareEnvelope } from "../lib/share";
import { usePlayerName } from "../lib/usePlayerName";
import {
  type Hole, type Lie, type Vec, type HoleScore, type Round,
  applyShot, distToPin, pathLength, scoreName,
  puttsForDistance, pinOf, teeOf, LIE_LABEL, roundStats, describeHole, teeApronRadius, lateralOffset,
} from "../lib/course";
import { CRUMPIN_FOX } from "../lib/courses/crumpinFox";
import { PEBBLE_BEACH } from "../lib/courses/pebbleBeach";
import { GOLF_DES_VOLCANS } from "../lib/courses/golfDesVolcans";
import { GOLF_RIOM } from "../lib/courses/golfRiom";
import { GOLF_MONTPENSIER } from "../lib/courses/golfMontpensier";
import { GOLF_LA_PLAINE } from "../lib/courses/golfLaPlaine";
import { GOLF_CHAMBON } from "../lib/courses/golfChambon";
import { GOLF_VEZAC } from "../lib/courses/golfVezac";
import { GOLF_HAUTE_AUV } from "../lib/courses/golfHauteAuvergne";
import { GOLF_VICHY } from "../lib/courses/golfVichy";
import { GOLF_ROYAT } from "../lib/courses/golfRoyat";
import { GOLF_PUY } from "../lib/courses/golfPuyEnVelay";
import { GOLF_BRIAILLES } from "../lib/courses/golfBriailles";
import { GOLF_ST_ANDREWS } from "../lib/courses/stAndrewsOld";
import { GOLF_AUGUSTA } from "../lib/courses/augustaNational";
import { GOLF_SAWGRASS } from "../lib/courses/tpcSawgrass";
import { GOLF_PINEHURST2 } from "../lib/courses/pinehurstNo2";
import { GOLF_CARNOUSTIE } from "../lib/courses/carnoustie";
import { GOLF_COUNTY_DOWN } from "../lib/courses/royalCountyDown";
import { GOLF_KIAWAH } from "../lib/courses/kiawahOcean";
import { GOLF_WHISTLING } from "../lib/courses/whistlingStraits";
import { GOLF_VALDERRAMA } from "../lib/courses/valderrama";
import { GOLF_MUIRFIELD } from "../lib/courses/muirfield";
import { GOLF_BIRKDALE } from "../lib/courses/royalBirkdale";
import { GOLF_ROYAL_MELB } from "../lib/courses/royalMelbourne";
import { COURSE_PHOTOS, GENERIC_GOLF_PHOTO } from "../lib/courses/coursePhotos";

const RESUME_KEY = "fairway-lab/round-in-progress/v1";

interface CourseDef { id: string; label: string; loc: string; group: string; holes: Hole[] }
const COURSE_LIST: CourseDef[] = [
  // ── Parcours mythiques (TPC Sawgrass en tête) ──
  { id: "tpc-sawgrass",    label: "TPC Sawgrass — Stadium",      loc: "Floride, USA · 17 en île",       group: "Mythiques", holes: GOLF_SAWGRASS },
  { id: "st-andrews-old",  label: "St Andrews — Old Course",     loc: "Fife, Écosse · The Home of Golf", group: "Mythiques", holes: GOLF_ST_ANDREWS },
  { id: "augusta-national",label: "Augusta National",            loc: "Géorgie, USA · The Masters",     group: "Mythiques", holes: GOLF_AUGUSTA },
  { id: "pebble-beach",    label: "Pebble Beach Golf Links",     loc: "Californie, USA",                group: "Mythiques", holes: PEBBLE_BEACH },
  { id: "pinehurst-no2",   label: "Pinehurst No. 2",             loc: "Caroline du Nord, USA",          group: "Mythiques", holes: GOLF_PINEHURST2 },
  { id: "carnoustie",      label: "Carnoustie",                  loc: "Angus, Écosse · The Open",       group: "Mythiques", holes: GOLF_CARNOUSTIE },
  { id: "muirfield",       label: "Muirfield",                   loc: "East Lothian, Écosse",           group: "Mythiques", holes: GOLF_MUIRFIELD },
  { id: "royal-county-down",label: "Royal County Down",          loc: "Newcastle, Irlande du Nord",     group: "Mythiques", holes: GOLF_COUNTY_DOWN },
  { id: "royal-birkdale",  label: "Royal Birkdale",              loc: "Merseyside, Angleterre",         group: "Mythiques", holes: GOLF_BIRKDALE },
  { id: "kiawah-ocean",    label: "Kiawah — Ocean Course",       loc: "Caroline du Sud, USA",           group: "Mythiques", holes: GOLF_KIAWAH },
  { id: "whistling-straits",label: "Whistling Straits",          loc: "Wisconsin, USA · Ryder Cup",     group: "Mythiques", holes: GOLF_WHISTLING },
  { id: "valderrama",      label: "Valderrama",                  loc: "Andalousie, Espagne",            group: "Mythiques", holes: GOLF_VALDERRAMA },
  { id: "royal-melbourne", label: "Royal Melbourne — West",      loc: "Victoria, Australie",            group: "Mythiques", holes: GOLF_ROYAL_MELB },
  // ── Auvergne, France ──
  { id: "golf-des-volcans",   label: "Golf des Volcans",            loc: "Orcines (63)",            group: "Auvergne", holes: GOLF_DES_VOLCANS },
  { id: "golf-vichy",         label: "Sporting Club de Vichy",      loc: "Vichy (03)",              group: "Auvergne", holes: GOLF_VICHY },
  { id: "golf-chambon",       label: "Golf du Chambon-sur-Lignon",  loc: "Le Chambon-sur-Lignon (43)", group: "Auvergne", holes: GOLF_CHAMBON },
  { id: "golf-vezac",         label: "Golf Club de Vezac",          loc: "Vezac (15)",              group: "Auvergne", holes: GOLF_VEZAC },
  { id: "golf-haute-auvergne",label: "Golf de Haute Auvergne",      loc: "Arpajon-sur-Cère (15)",   group: "Auvergne", holes: GOLF_HAUTE_AUV },
  { id: "golf-montpensier",   label: "Forêt de Montpensier",        loc: "Montpensier (63)",        group: "Auvergne", holes: GOLF_MONTPENSIER },
  { id: "golf-la-plaine",     label: "Golf de la Plaine",           loc: "Combronde (63)",          group: "Auvergne", holes: GOLF_LA_PLAINE },
  { id: "golf-riom",          label: "Golf de Riom",                loc: "Riom (63) · compact",     group: "Auvergne", holes: GOLF_RIOM },
  { id: "golf-royat",         label: "Golf de Royat-Charade",       loc: "Royat (63) · 9 trous",    group: "Auvergne", holes: GOLF_ROYAT },
  { id: "golf-puy-en-velay",  label: "Golf du Puy-en-Velay",        loc: "Le Puy-en-Velay (43) · 9 trous", group: "Auvergne", holes: GOLF_PUY },
  { id: "golf-briailles",     label: "Golf de Briailles",           loc: "Avermes (03) · 12 trous", group: "Auvergne", holes: GOLF_BRIAILLES },
  // ── Autres ──
  { id: "crumpin-fox",     label: "Crumpin-Fox Club",            loc: "Massachusetts, USA",             group: "Autres", holes: CRUMPIN_FOX },
];
const DEFAULT_COURSE_ID = "tpc-sawgrass";

// ── Scoring modes ────────────────────────────────────────────────────────────
type ScoreMode = "stroke" | "stableford" | "par";
const SCORE_MODES: { id: ScoreMode; label: string; hint: string }[] = [
  { id: "stroke",     label: "Stroke play", hint: "total des coups" },
  { id: "stableford", label: "Stableford",  hint: "points par trou" },
  { id: "par",        label: "Contre le par", hint: "trous gagnés / perdus" },
];
/** Stableford points (par = 2, birdie = 3, eagle = 4, bogey = 1, double+ = 0). */
function stablefordPoints(strokes: number, par: number): number {
  return Math.max(0, 2 - (strokes - par));
}
/** Par/Bogey result for a hole: +1 win, 0 halve, −1 loss vs par. */
function parResult(strokes: number, par: number): number {
  return strokes < par ? 1 : strokes > par ? -1 : 0;
}
/** Total for a finished/partial card under a given mode. */
function modeTotal(card: { strokes: number; par: number }[], mode: ScoreMode): number {
  if (mode === "stableford") return card.reduce((a, h) => a + stablefordPoints(h.strokes, h.par), 0);
  if (mode === "par") return card.reduce((a, h) => a + parResult(h.strokes, h.par), 0);
  return card.reduce((a, h) => a + h.strokes, 0);
}
function modeScoreLabel(card: { strokes: number; par: number }[], mode: ScoreMode): string {
  const t = modeTotal(card, mode);
  if (mode === "stableford") return `${t} pts`;
  if (mode === "par") return `${t > 0 ? "+" : ""}${t}`;
  return `${t}`;
}

// ── Tee sets ─────────────────────────────────────────────────────────────────
// No reliable per-tee data in OSM, so each forward tee plays a fraction of the
// hole — the tee box is moved down the centreline, shortening the carry.
interface TeeSet { id: string; label: string; color: string; factor: number }
const TEE_SETS: TeeSet[] = [
  { id: "champ",  label: "Championnat", color: "#16294D", factor: 1.0 },
  { id: "back",   label: "Back",        color: "#FFFFFF", factor: 0.93 },
  { id: "middle", label: "Milieu",      color: "#F4C534", factor: 0.84 },
  { id: "front",  label: "Avant",       color: "#C2603A", factor: 0.74 },
];
/** Point on the centreline `d` metres forward from the tee (with the direction unit). */
function pointFromTee(line: Vec[], d: number): Vec {
  let rem = d;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    if (rem <= len) { const t = rem / len; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    rem -= len;
  }
  return line[0];
}
/** The playing tee position for a hole given a tee factor (1 = full back tee). */
function teeStartFor(h: Hole, factor: number): Vec {
  if (factor >= 0.999) return teeOf(h);
  const setback = (1 - factor) * pathLength(h.centerline);
  return pointFromTee(h.centerline, setback);
}

type HoleStatus = "playing" | "holed";
interface LogEntry { n: number; club: string; lie: Lie; dist: number; penalty: number }
interface Snapshot { ball: Vec; lie: Lie; strokes: number; trail: Vec[]; log: LogEntry[] }

const SVG_W = 300, SVG_H = 520, PAD = 16;

function makeProjector(h: Hole, w = SVG_W, hgt = SVG_H, pad = PAD) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const ext = (x: number, y: number) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  for (const p of h.centerline) { ext(p.x - h.obHalf, p.y); ext(p.x + h.obHalf, p.y); }
  ext(0, -6); ext(pinOf(h).x, pinOf(h).y + h.greenRadius + 6);
  for (const hz of h.hazards) { ext(hz.cx - hz.r, hz.cy - hz.r); ext(hz.cx + hz.r, hz.cy + hz.r); }
  // island: leave room for the water cap + shoreline trees behind the green
  if (h.island) { const w = h.obHalf + 2; ext(pinOf(h).x - w, pinOf(h).y + w); ext(pinOf(h).x + w, pinOf(h).y + w); }
  const wW = maxX - minX, wH = maxY - minY;
  const scale = Math.min((w - 2 * pad) / wW, (hgt - 2 * pad) / wH);
  const offX = (w - wW * scale) / 2, offY = (hgt - wH * scale) / 2;
  return {
    scale,
    sx: (x: number) => offX + (x - minX) * scale,
    sy: (y: number) => hgt - offY - (y - minY) * scale,
    toWorld: (px: number, py: number): Vec => ({
      x: (px - offX) / scale + minX,
      y: (hgt - offY - py) / scale + minY,
    }),
  };
}

// The rail reuses the same (CDN-cached) image, scaled down by the browser —
// Wikimedia only serves the requested width for these files, so we keep it.
function smallThumb(url: string): string {
  return url;
}

// Unified course picker: a photo hero + a horizontal thumbnail rail of every
// course (grouped). Selecting in either keeps both in sync — no separate list.
function CourseCarousel({ courseId, setCourseId }: { courseId: string; setCourseId: (id: string) => void }) {
  const idx = Math.max(0, COURSE_LIST.findIndex((c) => c.id === courseId));
  const c = COURSE_LIST[idx];
  const isReal = !!COURSE_PHOTOS[c.id];
  const photo = COURSE_PHOTOS[c.id] ?? GENERIC_GOLF_PHOTO; // generic golf photo for the others
  const go = (d: number) => setCourseId(COURSE_LIST[(idx + d + COURSE_LIST.length) % COURSE_LIST.length].id);
  const par = c.holes.reduce((a, h) => a + h.par, 0);

  // quick course search
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = q
    ? COURSE_LIST.filter((cc) =>
        cc.label.toLowerCase().includes(q) || cc.loc.toLowerCase().includes(q) || cc.group.toLowerCase().includes(q),
      ).slice(0, 8)
    : [];

  return (
    <div className="select-none">
      {/* ── Hero ── */}
      <div className="relative rounded-xl overflow-hidden bg-ink w-full" style={{ height: 230 }}>
        <img src={photo.url} alt={c.label} loading="lazy"
          className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(11,20,40,0.92) 0%, rgba(11,20,40,0.15) 45%, rgba(11,20,40,0) 70%)" }} />
        <div className="absolute left-0 right-0 top-0 h-[3px] bg-lisere" />

        <button onClick={() => go(-1)} aria-label="Parcours précédent"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full bg-white/85 hover:bg-white text-ink shadow-soft transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={() => go(1)} aria-label="Parcours suivant"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full bg-white/85 hover:bg-white text-ink shadow-soft transition">
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-full bg-white/90 text-ink">{c.group}</span>
          <span className="metric text-[10px] px-2 py-1 rounded-full bg-black/35 text-white">{idx + 1}/{COURSE_LIST.length}</span>
        </div>

        <div className="absolute left-4 right-4 bottom-3 text-left text-white">
          <h2 className="font-extrabold text-2xl leading-tight drop-shadow">{c.label}</h2>
          <p className="text-sm text-white/80">Par {par} · {c.holes.length} trous · {c.loc}</p>
          <a href={photo.source} target="_blank" rel="noreferrer"
            className="inline-block mt-1 text-[10px] text-white/55 hover:text-white/90 transition">
            {isReal ? "📷" : "🖼️ Illustration ·"} {photo.author} · {photo.license} · Wikimedia Commons
          </a>
        </div>
      </div>

      {/* ── Quick search ── */}
      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un parcours (nom, lieu, catégorie)…"
          className="w-full rounded-xl bg-panel/60 border border-black/5 pl-9 pr-9 py-2.5 text-sm
                     outline-none focus:ring-2 focus:ring-royal/40 focus:bg-surface transition"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Effacer"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink/40 hover:text-ink hover:bg-ink/5 transition">
            <X className="w-4 h-4" />
          </button>
        )}

        {q && (
          <div className="absolute z-20 left-0 right-0 mt-1.5 rounded-xl bg-surface shadow-soft border border-black/5 overflow-hidden max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-ink/40">Aucun parcours trouvé.</div>
            ) : results.map((cc) => {
              const ph = COURSE_PHOTOS[cc.id] ?? GENERIC_GOLF_PHOTO;
              const on = cc.id === courseId;
              return (
                <button key={cc.id} onClick={() => { setCourseId(cc.id); setQuery(""); }}
                  className={"w-full flex items-center gap-3 px-3 py-2 text-left transition hover:bg-panel/60 " + (on ? "bg-royal/5" : "")}>
                  <img src={smallThumb(ph.url)} alt="" loading="lazy" className="w-12 h-9 rounded-md object-cover shrink-0 ring-1 ring-black/5" />
                  <div className="min-w-0 flex-1">
                    <div className={"text-sm font-semibold truncate " + (on ? "text-royal" : "text-ink/85")}>{cc.label}</div>
                    <div className="text-[11px] text-ink/40 truncate">{cc.group} · {cc.loc}</div>
                  </div>
                  <span className="metric text-[11px] text-ink/40 shrink-0">par {cc.holes.reduce((a, h) => a + h.par, 0)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function Course() {
  const { adapterId, conn, simHit, connect, setClub, selectedClub, clubArmed } = useStore();
  const profileId = useStore((s) => s.profileId);
  const shots = useStore(allShots);
  const [autoClub, setAutoClub] = useState(false);
  const lastShot = useStore((s) => s.current?.shots[0]);
  const connected = conn.status === "connected";

  const [courseId, setCourseId] = useState<string>(DEFAULT_COURSE_ID);
  const [scoreMode, setScoreMode] = useState<ScoreMode>("stroke");
  const [teeId, setTeeId] = useState<string>("champ");
  const tee = TEE_SETS.find((t) => t.id === teeId) ?? TEE_SETS[0];
  const courseMeta = COURSE_LIST.find((c) => c.id === courseId) ?? COURSE_LIST[0];
  const course = courseMeta.holes;
  const coursePar = useMemo(() => course.reduce((a, h) => a + h.par, 0), [course]);
  const nHoles = course.length;

  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [holeIdx, setHoleIdx] = useState(0);
  const [card, setCard] = useState<HoleScore[]>([]);
  const roundStart = useRef<number>(0);

  // Per-hole play state
  const [ball, setBall] = useState<Vec>({ x: 0, y: 0 });
  const [lie, setLie] = useState<Lie>("tee");
  const [strokes, setStrokes] = useState(0);
  const [trail, setTrail] = useState<Vec[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [aim, setAim] = useState<Vec>({ x: 0, y: 0 });
  const [mulligans, setMulligans] = useState(0);
  const [undo, setUndo] = useState<Snapshot[]>([]);
  const [holeStatus, setHoleStatus] = useState<HoleStatus>("playing");
  const [lastPlayed, setLastPlayed] = useState<Shot | null>(null);
  const lastIdRef = useRef<string | undefined>(undefined);

  const [rounds, setRounds] = useState<Round[]>([]);
  useEffect(() => { api.listRounds(profileId).then(setRounds).catch(() => {}); }, [profileId]);
  const player = usePlayerName();
  const [share, setShare] = useState<ShareEnvelope | null>(null);
  const [holeTrails, setHoleTrails] = useState<Vec[][]>([]);

  // Resume: persist an in-progress round (restart at the current hole).
  const [resumable, setResumable] = useState<{ startedAt: number; holeIdx: number; card: HoleScore[] } | null>(null);
  useEffect(() => {
    try { const raw = localStorage.getItem(RESUME_KEY); if (raw) setResumable(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);

  const H = course[holeIdx];
  const dist = distToPin(ball, H);
  const putts = puttsForDistance(dist);
  const aimDist = Math.hypot(aim.x - ball.x, aim.y - ball.y);

  const aggs = aggregateByClub(shots);
  const isApproach = phase === "playing" && holeStatus === "playing" && lie !== "green"
    && dist > 0 && dist <= 100;
  const suggestion = (() => {
    if (phase !== "playing" || holeStatus !== "playing" || lie === "green" || !aggs.length) return null;
    if (isApproach) {
      const front = dist - H.greenRadius;
      const target = dist + H.greenRadius * 0.2;
      const onGreen = front > 0 ? aggs.filter((a) => a.carryMed >= front) : aggs;
      const pool = onGreen.length ? onGreen : aggs;
      return pool.reduce((b, a) => (Math.abs(a.carryMed - target) < Math.abs(b.carryMed - target) ? a : b)).club;
    }
    return aggs.reduce((b, a) => (Math.abs(a.carry - aimDist) < Math.abs(b.carry - aimDist) ? a : b)).club;
  })();

  function startHole(idx: number) {
    const h = course[idx];
    lastIdRef.current = useStore.getState().current?.shots[0]?.id;
    const start = teeStartFor(h, tee.factor);
    setBall(start); setLie("tee"); setStrokes(0); setTrail([start]); setLog([]);
    setAim(pinOf(h)); setMulligans(0); setUndo([]); setHoleStatus("playing"); setLastPlayed(null);
  }

  function startRound() {
    roundStart.current = Date.now();
    setCard([]); setHoleTrails([]); setHoleIdx(0); setPhase("playing"); startHole(0);
    setResumable(null);
  }

  function resumeRound() {
    if (!resumable) return;
    roundStart.current = resumable.startedAt;
    setCard(resumable.card); setHoleTrails([]); setHoleIdx(resumable.holeIdx);
    setPhase("playing"); startHole(resumable.holeIdx); setResumable(null);
  }

  // Persist progress at the start of each hole (resume restarts the current hole).
  useEffect(() => {
    if (phase !== "playing") return;
    try { localStorage.setItem(RESUME_KEY, JSON.stringify({ startedAt: roundStart.current, holeIdx, card })); } catch { /* ignore */ }
  }, [phase, holeIdx, card]);

  // Consume each NEW full-swing shot.
  useEffect(() => {
    if (phase !== "playing" || holeStatus !== "playing" || lie === "green") return;
    if (!lastShot || lastShot.id === lastIdRef.current) return;
    lastIdRef.current = lastShot.id;
    setUndo((u) => [...u, { ball, lie, strokes, trail, log }]);
    const res = applyShot(ball, lastShot, aim, lie, H);
    setLastPlayed(lastShot);
    setBall(res.ball); setLie(res.lie); setStrokes((s) => s + 1 + res.penalty);
    if (res.event !== "ob") setTrail((t) => [...t, res.ball]);
    setLog((l) => [...l, { n: l.length + 1, club: lastShot.club, lie: res.event, dist: distToPin(res.ball, H), penalty: res.penalty }]);
    setAim(pinOf(H));
  }, [lastShot, phase, holeStatus, lie, ball, aim, H]);

  // Auto-club: keep the selected club matched to the aim distance.
  useEffect(() => {
    if (!autoClub || phase !== "playing" || holeStatus !== "playing" || lie === "green") return;
    if (suggestion && suggestion !== selectedClub) setClub(suggestion);
  }, [autoClub, suggestion, selectedClub, phase, holeStatus, lie, setClub]);

  function mulligan() {
    setUndo((u) => {
      if (!u.length) return u;
      const prev = u[u.length - 1];
      setBall(prev.ball); setLie(prev.lie); setStrokes(prev.strokes);
      setTrail(prev.trail); setLog(prev.log); setAim(pinOf(H));
      setMulligans((m) => m + 1);
      return u.slice(0, -1);
    });
  }

  function holeOut() {
    const n = puttsForDistance(distToPin(ball, H));
    // Derive analytics from the shot log (robust to mulligans).
    let toGreen = 0, reached = false, pen = 0;
    for (const e of log) { pen += e.penalty; toGreen += 1 + e.penalty; if (e.lie === "green") { reached = true; break; } }
    const gir = reached && toGreen <= H.par - 2;
    const fairwayHit = H.par === 3 ? null : log[0]?.lie === "fairway";
    const final = strokes + n;
    const finalTrail = [...trail, pinOf(H)];
    setStrokes(final);
    setBall(pinOf(H)); setTrail(finalTrail);
    setHoleTrails((t) => [...t, finalTrail]);
    setLog((l) => [...l, { n: l.length + 1, club: `${n} putt${n > 1 ? "s" : ""}`, lie: "holed", dist: 0, penalty: 0 }]);
    setHoleStatus("holed");
    setCard((c) => [...c, { number: H.number, par: H.par, strokes: final, putts: n, mulligans, gir, fairwayHit, penalties: pen }]);
  }

  function nextHole() {
    if (holeIdx < nHoles - 1) { const i = holeIdx + 1; setHoleIdx(i); startHole(i); }
    else finishRound();
  }

  function finishRound() {
    const totalStrokes = card.reduce((a, h) => a + h.strokes, 0);
    const totalMulligans = card.reduce((a, h) => a + h.mulligans, 0);
    const round: Round = {
      id: `round_${roundStart.current}`,
      startedAt: roundStart.current, endedAt: Date.now(),
      coursePar, totalStrokes, totalMulligans, holes: card,
    };
    api.saveRound({ ...round, profileId }).then(() => api.listRounds(profileId).then(setRounds)).catch(() => {});
    try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
    setResumable(null);
    setPhase("done");
  }

  function reaim(p: Vec) {
    setAim({ x: p.x, y: Math.max(ball.y + 2, p.y) });
  }

  // ---- Render ----
  if (phase === "idle") {
    return (
      <div className="grid gap-4">
        <section className="card p-4 sm:p-6">
          {/* Hero carousel */}
          <CourseCarousel courseId={courseId} setCourseId={setCourseId} />
          <p className="text-center text-[11px] text-ink/40 mt-2 mb-4">
            Tracé réel © OpenStreetMap (ODbL) · photo Wikimedia Commons
          </p>


          {/* Scoring mode */}
          <div className="flex items-center justify-center gap-1.5 mb-3">
            {SCORE_MODES.map((m) => {
              const on = m.id === scoreMode;
              return (
                <button key={m.id} onClick={() => setScoreMode(m.id)} title={m.hint}
                  className={"rounded-lg px-3 py-1.5 text-sm font-semibold border transition " +
                    (on ? "border-royal bg-royal/10 text-royal" : "border-black/5 bg-surface text-ink/60 hover:bg-ink/5")}>
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Tee set */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <span className="text-[11px] text-ink/40 mr-1">Départ</span>
            {TEE_SETS.map((t) => {
              const on = t.id === teeId;
              const yards = Math.round(coursePar > 0 ? course.reduce((a, h) => a + pathLength(h.centerline), 0) * t.factor : 0);
              return (
                <button key={t.id} onClick={() => setTeeId(t.id)} title={`${yards} m`}
                  className={"flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold border transition " +
                    (on ? "border-royal bg-royal/10 text-royal" : "border-black/5 bg-surface text-ink/60 hover:bg-ink/5")}>
                  <span className="w-3 h-3 rounded-full ring-1 ring-ink/20 shrink-0" style={{ background: t.color }} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {resumable && (
              <button onClick={resumeRound} className="inline-flex items-center gap-2 bg-ink hover:bg-ink/90
                text-white font-semibold rounded-xl px-6 py-3 transition">
                <Play className="w-4 h-4" /> Reprendre (trou {resumable.holeIdx + 1})
              </button>
            )}
            <button onClick={startRound} className={"inline-flex items-center gap-2 font-semibold rounded-xl px-6 py-3 transition " +
              (resumable ? "bg-panel hover:bg-ink/5 text-ink/70" : "bg-fairway hover:bg-fairway-light text-white")}>
              {resumable ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />} Nouvelle partie
            </button>
          </div>
        </section>
        <RoundStats rounds={rounds} />
        <CourseOverview course={course} />
        <PastRounds rounds={rounds} onDelete={(id) => { api.deleteRound(id).catch(() => {}); setRounds((r) => r.filter((x) => x.id !== id)); }} />
      </div>
    );
  }

  if (phase === "done") {
    const total = card.reduce((a, h) => a + h.strokes, 0);
    const muls = card.reduce((a, h) => a + h.mulligans, 0);
    const modeName = SCORE_MODES.find((m) => m.id === scoreMode)!.label;
    return (
      <div className="grid gap-4">
        <section className="card p-6 text-center">
          <h2 className="font-display text-xl">Partie terminée 🏁</h2>
          <div className="text-[11px] uppercase tracking-widest text-ink/40 mt-1">{modeName}</div>
          <div className="metric text-5xl font-bold text-fairway my-1">{modeScoreLabel(card, scoreMode)}</div>
          <p className="text-sm text-ink/60">
            {total} coups · Par {coursePar} ({total - coursePar >= 0 ? "+" : ""}{total - coursePar}) · {muls} mulligan{muls > 1 ? "s" : ""}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={startRound} className="inline-flex items-center gap-2 bg-fairway hover:bg-fairway-light
              text-white font-semibold rounded-xl px-6 py-3 transition">
              <RotateCcw className="w-4 h-4" /> Nouvelle partie
            </button>
            <button onClick={() => setShare(buildRoundShare(
              { id: `round_${roundStart.current}`, startedAt: roundStart.current, endedAt: Date.now(),
                coursePar, totalStrokes: total, totalMulligans: muls, holes: card },
              courseMeta.label, player,
            ))} className="inline-flex items-center gap-2 bg-ink hover:bg-ink/90
              text-white font-semibold rounded-xl px-6 py-3 transition">
              <Share2 className="w-4 h-4" /> Partager
            </button>
          </div>
        </section>
        <Scorecard course={course} card={card} currentIdx={-1} scoreMode={scoreMode} />
        <RoundSummaryGrid course={course} card={card} holeTrails={holeTrails} />
        <RoundStats rounds={rounds} />
        <PastRounds rounds={rounds} onDelete={(id) => { api.deleteRound(id).catch(() => {}); setRounds((r) => r.filter((x) => x.id !== id)); }} />
        {share && <ShareModal envelope={share} onClose={() => setShare(null)} />}
      </div>
    );
  }

  // phase === "playing"
  return (
    <div className="grid gap-4">
      <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
        <div className="grid gap-3">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg flex items-center gap-2">
                <Flag className="w-5 h-5 text-terracotta" /> Trou {H.number}/{nHoles}
                {H.name && <span className="text-ink/40 font-normal italic">· {H.name}</span>}
              </h2>
              <span className="metric text-xs font-semibold rounded-full px-2.5 py-1 bg-panel text-ink/70">Par {H.par}</span>
            </div>
            <p className="text-sm text-ink/50 -mt-1">{describeHole(H)}</p>

            {holeStatus === "playing" ? (
              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Au drapeau" value={`${dist.toFixed(0)} m`} accent="terracotta" />
                  <Stat label="Lie" value={LIE_LABEL[lie]} />
                  <Stat label="Coups" value={`${strokes}`} />
                  <Stat label="Mulligans" value={`${mulligans}`} accent={mulligans ? "gold" : undefined} />
                </div>

                {lie === "green" ? (
                  <>
                    <p className="text-sm text-ink/60">
                      Green à <b>{dist.toFixed(1)} m</b> → <b>{dist <= 3 ? "≤ 3 m : 1 putt" : "2 putts"}</b>.
                    </p>
                    <button onClick={holeOut} className="w-full inline-flex items-center justify-center gap-2
                      bg-ink hover:bg-ink/90 text-white font-semibold rounded-xl px-5 py-3 transition">
                      <Target className="w-4 h-4" /> Rentrer ({putts} putt{putts > 1 ? "s" : ""})
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-ink/50">
                      🎯 Clique la carte pour viser — <b className="metric">{aimDist.toFixed(0)} m</b>
                      {suggestion && <>
                      {" · "}club suggéré <b className="metric">{suggestion}</b>
                      {isApproach && <span className="text-teal"> · vise le centre du green</span>}
                    </>}
                    </p>
                    <label className="flex items-center gap-2 text-xs text-ink/55 cursor-pointer select-none">
                      <input type="checkbox" checked={autoClub} onChange={(e) => setAutoClub(e.target.checked)} className="accent-fairway" />
                      Club automatique (suit la distance visée)
                    </label>
                    <div className={autoClub ? "opacity-50 pointer-events-none" : ""}>
                      <ClubSelector />
                    </div>
                    {!autoClub && !clubArmed && connected && (
                      <p className="text-xs font-semibold text-gold">Choisis le club du prochain coup.</p>
                    )}
                    {!connected ? (
                      <button onClick={() => connect()} className="w-full inline-flex items-center justify-center gap-2
                        bg-fairway hover:bg-fairway-light text-white font-semibold rounded-xl px-5 py-3 transition">
                        <Radio className="w-4 h-4" /> Connecter pour frapper
                      </button>
                    ) : adapterId === "simulator" ? (
                      <button onClick={simHit} disabled={!clubArmed}
                        title={!clubArmed ? "Choisis d'abord un club" : undefined}
                        className="w-full inline-flex items-center justify-center gap-2
                        bg-ink hover:bg-ink/90 text-white font-semibold rounded-xl px-5 py-3 transition
                        disabled:opacity-50 disabled:cursor-not-allowed">
                        <Target className="w-4 h-4" /> {clubArmed ? "Frapper" : "Choisis un club"}
                      </button>
                    ) : (
                      <p className="text-sm text-ink/50">{clubArmed ? "Frappe ta balle — le R10 l'enverra." : "Choisis le club avant de frapper."}</p>
                    )}
                  </>
                )}

                {undo.length > 0 && (
                  <button onClick={mulligan} className="w-full inline-flex items-center justify-center gap-2 text-sm
                    font-semibold rounded-lg px-4 py-2 bg-gold/10 text-gold hover:bg-gold/20 transition">
                    <Undo2 className="w-4 h-4" /> Mulligan (rejouer le dernier coup)
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-4 grid gap-2 text-center">
                <div className="font-display text-xl">{scoreName(strokes, H.par)}</div>
                <div className="metric text-3xl font-bold text-fairway">{strokes}</div>
                <div className="text-sm text-ink/50">
                  Par {H.par} ({strokes - H.par >= 0 ? "+" : ""}{strokes - H.par}) · {mulligans} mulligan{mulligans > 1 ? "s" : ""}
                </div>
                <button onClick={nextHole} className="mt-1 w-full inline-flex items-center justify-center gap-2
                  bg-fairway hover:bg-fairway-light text-white font-semibold rounded-xl px-5 py-3 transition">
                  {holeIdx < nHoles - 1 ? <>Trou suivant <ChevronRight className="w-4 h-4" /></> : <>Terminer la partie 🏁</>}
                </button>
              </div>
            )}
          </section>

          {lastPlayed && <ShotMetricsCard shot={lastPlayed} n={log.length} />}

          {log.length > 0 && (
            <section className="card overflow-hidden">
              <h3 className="text-[11px] uppercase tracking-wide text-ink/40 px-4 py-2.5 border-b border-black/5">Déroulé</h3>
              <div className="divide-y divide-black/[0.04]">
                {log.map((e) => (
                  <div key={e.n} className="flex items-center gap-2 px-4 py-2 text-sm">
                    <span className="metric text-ink/40 w-5">{e.n}</span>
                    <span className="metric font-semibold flex-1">{e.club}</span>
                    <span className={"text-xs " + (e.lie === "water" || e.lie === "ob" ? "text-terracotta font-semibold" : "text-ink/50")}>
                      {LIE_LABEL[e.lie]}{e.penalty ? ` +${e.penalty}` : ""}
                    </span>
                    <span className="metric text-ink/60 w-16 text-right">{e.lie === "holed" ? "✓" : `${e.dist.toFixed(0)} m`}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="card p-4">
          <HoleMap H={H} ball={ball} trail={trail} aim={aim}
            aiming={holeStatus === "playing" && lie !== "green"} aimDist={aimDist} onAim={reaim}
            teeFactor={tee.factor} teeColor={tee.color} />
        </section>
      </div>

      <Scorecard course={course} card={card} currentIdx={holeIdx} scoreMode={scoreMode} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "terracotta" | "gold" }) {
  return (
    <div className="bg-panel rounded-xl px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink/45">{label}</div>
      <div className={"metric text-lg font-semibold " + (accent === "terracotta" ? "text-terracotta" : accent === "gold" ? "text-gold" : "text-ink")}>{value}</div>
    </div>
  );
}

// Metrics of the shot just played — shown in the left column after each tee/approach shot.
function ShotMetricsCard({ shot, n }: { shot: Shot; n: number }) {
  const lr = (v: number | undefined) => (v == null ? "—" : `${Math.abs(v).toFixed(1)} ${v < 0 ? "G" : "D"}`);
  const cells: Array<{ k: string; v: string; accent?: boolean }> = [
    { k: "Carry", v: `${shot.carry.toFixed(0)} m`, accent: true },
    { k: "Total", v: `${shot.total.toFixed(0)} m` },
    { k: "V. balle", v: `${shot.ballSpeed.toFixed(0)} km/h` },
    { k: "V. club", v: `${shot.clubSpeed.toFixed(0)} km/h` },
    { k: "Smash", v: shot.smashFactor.toFixed(2) },
    { k: "Lancement", v: `${(shot.launchAngle ?? 0).toFixed(1)}°` },
    { k: "Apex", v: `${shot.apex.toFixed(0)} m` },
    { k: "Backspin", v: `${(shot.backSpin ?? 0).toFixed(0)} rpm` },
    { k: "Écart", v: lr(shot.offlineM) },
  ];
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/5">
        <h3 className="text-[11px] uppercase tracking-wide text-ink/40">Dernier coup · #{n}</h3>
        <span className="metric text-[11px] font-semibold rounded-full px-2 py-0.5 bg-royal/10 text-royal">{shot.club}</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-black/[0.04]">
        {cells.map((c) => (
          <div key={c.k} className="bg-surface px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-ink/45">{c.k}</div>
            <div className={"metric text-sm font-semibold " + (c.accent ? "text-royal" : "text-ink/80")}>{c.v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Small seeded RNG so tree placement is stable per hole.
function rng32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Tree { x: number; y: number; r: number }

/** Half-width of an island hole's water corridor (matches the rendered lake). */
const islandWaterHalf = (h: Hole) => h.obHalf - 7;

/** True if a point sits in an island hole's water (corridor lake + cap behind green). */
function inIslandWater(h: Hole, p: Vec): boolean {
  if (!h.island) return false;
  const pin = pinOf(h), len = pathLength(h.centerline);
  const wHalf = islandWaterHalf(h);
  const inCorridor = lateralOffset(p, h.centerline) <= wHalf + 1 && p.y >= -2 && p.y <= len + 1;
  const inCap = Math.hypot(p.x - pin.x, p.y - pin.y) <= wHalf + 1; // rounded water around/behind the green
  return inCorridor || inCap;
}

/** Trees rimming both sides of the hole, just outside the rough — never in water. */
function treesFor(h: Hole): Tree[] {
  const rnd = rng32(h.number * 7919 + 13);
  const trees: Tree[] = [];
  const pin = pinOf(h), tee = teeOf(h);

  if (h.island) {
    // Shoreline around the lake: both banks + a far shore arc behind the green + behind the tee.
    const len = pathLength(h.centerline);
    const shore = islandWaterHalf(h) + 3;
    for (let y = -8; y <= len + h.obHalf * 0.5; y += 12) {
      for (const side of [-1, 1]) {
        if (rnd() > 0.78) continue;
        trees.push({ x: pin.x + side * (shore + rnd() * 9), y, r: 4 + rnd() * 2.4 });
      }
    }
    // far shore behind the green (an arc beyond the water cap)
    for (let k = -3; k <= 3; k++) {
      trees.push({ x: pin.x + k * 9 + (rnd() - 0.5) * 5, y: pin.y + islandWaterHalf(h) + 5 + rnd() * 6, r: 4 + rnd() * 2 });
    }
    // behind the tee
    for (let k = -2; k <= 2; k++) {
      trees.push({ x: tee.x + k * 10, y: tee.y - 9 - rnd() * 5, r: 4 + rnd() * 2 });
    }
    return trees.filter((t) => !inIslandWater(h, t));
  }

  const spacing = 13;
  for (let i = 1; i < h.centerline.length; i++) {
    const a = h.centerline[i - 1], b = h.centerline[i];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    for (let s = 0; s < len; s += spacing) {
      const t = s / len, cx = a.x + dx * t, cy = a.y + dy * t;
      for (const side of [-1, 1]) {
        if (rnd() > 0.82) continue;
        const off = h.obHalf + rnd() * 7 - 1;
        trees.push({ x: cx + px * side * off, y: cy + py * side * off, r: 4 + rnd() * 2.5 });
      }
    }
  }
  // a few behind the tee and behind the green
  for (let k = -2; k <= 2; k++) {
    trees.push({ x: tee.x + k * 10, y: tee.y - 8 - rnd() * 5, r: 4 + rnd() * 2 });
    trees.push({ x: pin.x + k * 10, y: pin.y + h.greenRadius + 6 + rnd() * 5, r: 4 + rnd() * 2 });
  }
  return trees;
}

/** Point on the centreline `d` metres back from the pin, with segment direction. */
function pointBackFromPin(line: Vec[], d: number): { x: number; y: number; ux: number; uy: number } {
  let rem = d;
  for (let i = line.length - 1; i > 0; i--) {
    const b = line[i], a = line[i - 1];
    const dx = a.x - b.x, dy = a.y - b.y, len = Math.hypot(dx, dy) || 1;
    if (rem <= len) { const t = rem / len; return { x: b.x + dx * t, y: b.y + dy * t, ux: dx / len, uy: dy / len }; }
    rem -= len;
  }
  return { x: line[0].x, y: line[0].y, ux: 0, uy: 1 };
}

// ── Organic shape helpers (greens & fairways) ────────────────────────────────
/** Resample a polyline into n roughly equally spaced points. */
function resamplePolyline(line: Vec[], n: number): Vec[] {
  const total = pathLength(line);
  if (total === 0 || line.length < 2) return line.slice();
  const step = total / (n - 1);
  const out: Vec[] = [line[0]];
  let seg = 1, walked = 0;
  let a = line[0], b = line[1];
  let segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  for (let k = 1; k < n - 1; k++) {
    const target = k * step;
    while (walked + segLen < target && seg < line.length - 1) {
      walked += segLen; seg++; a = line[seg - 1]; b = line[seg];
      segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    }
    const t = (target - walked) / segLen;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  out.push(line[line.length - 1]);
  return out;
}

/** Catmull-Rom → cubic Bézier smooth closed path through screen-space points. */
function smoothClosed(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n < 3) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d + " Z";
}

/** Generic organic blob polygon (world coords) around a centre. */
function blobWorld(cx: number, cy: number, r: number, seed: number, n = 16, jitter = 0.34): Vec[] {
  const rnd = rng32(seed);
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 - jitter / 2 + rnd() * jitter);
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.92 });
  }
  return pts;
}

/** Organic green polygon (world coords): per-vertex noise + a random elongation axis. */
function greenBlobWorld(h: Hole, scale = 1): Vec[] {
  const pin = pinOf(h);
  const rnd = rng32(h.number * 90001 + 7);
  const N = 14;
  const ang0 = rnd() * Math.PI;
  const elong = 0.82 + rnd() * 0.5;
  const ca0 = Math.cos(ang0), sa0 = Math.sin(ang0);
  const pts: Vec[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = h.greenRadius * scale * (0.8 + rnd() * 0.4);
    const lx = Math.cos(a) * rr * elong, ly = Math.sin(a) * rr;
    pts.push({ x: pin.x + lx * ca0 - ly * sa0, y: pin.y + lx * sa0 + ly * ca0 });
  }
  return pts;
}

/** Organic fairway ribbon (world coords): varying half-width down the centreline. */
function fairwayRibbonWorld(h: Hole, base: number, variance: number, seed: number, samplesN = 22): Vec[] {
  const samples = resamplePolyline(h.centerline, samplesN);
  const rnd = rng32(seed);
  const noise: number[] = [];
  let prev = 0.5;
  for (let i = 0; i < samples.length; i++) { prev = prev * 0.55 + rnd() * 0.45; noise.push(prev); }
  const left: Vec[] = [], right: Vec[] = [];
  for (let i = 0; i < samples.length; i++) {
    const t = i / (samples.length - 1);
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    const taper = 0.5 + 0.5 * Math.min(1, t / 0.12);                 // narrow at the tee
    const bulge = 1 + 0.28 * Math.sin(Math.min(Math.PI, t * Math.PI * 1.05)); // wide landing zone
    const hw = base * bulge * taper * (1 - variance / 2 + noise[i] * variance);
    left.push({ x: samples[i].x + px * hw, y: samples[i].y + py * hw });
    right.push({ x: samples[i].x - px * hw, y: samples[i].y - py * hw });
  }
  return left.concat(right.reverse());
}

function HoleMap({ H, ball, trail, aim, aiming, aimDist, onAim, teeFactor = 1, teeColor = "#16294D" }: {
  H: Hole; ball: Vec; trail: Vec[]; aim: Vec; aiming: boolean; aimDist: number; onAim: (p: Vec) => void;
  teeFactor?: number; teeColor?: string;
}) {
  const proj = useMemo(() => makeProjector(H), [H]);
  const trees = useMemo(() => treesFor(H), [H]);
  const { sx, sy, scale } = proj;
  const pin = pinOf(H), tee = teeOf(H);
  const total = pathLength(H.centerline);
  const isIsland = !!H.island;
  const markers = (isIsland ? [] : [50, 100, 150]).filter((d) => d < total - H.greenRadius - 6).map((d) => ({ d, p: pointBackFromPin(H.centerline, d) }));
  // organic turf shapes (screen-space smooth paths)
  const toScreen = (pts: Vec[]) => pts.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
  const fwSeed = H.number * 1337 + 11;
  const roughPath    = smoothClosed(toScreen(fairwayRibbonWorld(H, H.fairwayHalf + 13, 0.16, fwSeed)));
  const firstCutPath = smoothClosed(toScreen(fairwayRibbonWorld(H, H.fairwayHalf + 5, 0.14, fwSeed)));
  const fairwayPath  = smoothClosed(toScreen(fairwayRibbonWorld(H, H.fairwayHalf, 0.26, fwSeed)));
  const sheenPath    = smoothClosed(toScreen(fairwayRibbonWorld(H, H.fairwayHalf * 0.62, 0.22, fwSeed)));
  const greenCollarPath = smoothClosed(toScreen(greenBlobWorld(H, (H.greenRadius + 2.6) / H.greenRadius)));
  const greenPath       = smoothClosed(toScreen(greenBlobWorld(H)));
  // island: water fills the whole corridor + a rounded cap behind the green
  const islandWHalf = islandWaterHalf(H);
  const waterCenterline = [...H.centerline, { x: pin.x, y: pin.y + islandWHalf }];
  const lakePath = isIsland
    ? smoothClosed(toScreen(fairwayRibbonWorld({ ...H, centerline: waterCenterline }, islandWHalf, 0.1, H.number * 53 + 3)))
    : "";
  const teeApronPath = isIsland ? smoothClosed(toScreen(blobWorld(tee.x, tee.y, teeApronRadius(H), H.number * 17 + 5, 12, 0.3))) : "";
  // cart path: offset the centreline to one side of the hole
  const pathSide = H.number % 2 === 0 ? 1 : -1;
  const cartPath = H.centerline.map((p, i) => {
    const a = H.centerline[Math.max(0, i - 1)], b = H.centerline[Math.min(H.centerline.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const q = { x: p.x + (-dy / len) * pathSide * (H.obHalf + 5), y: p.y + (dx / len) * pathSide * (H.obHalf + 5) };
    return `${sx(q.x)},${sy(q.y)}`;
  }).join(" ");
  const windSpeed = Math.hypot(H.wind.wx, H.wind.wy);
  // wind arrow on screen (y is flipped): world (wx, wy) → screen (wx, −wy)
  const wlen = windSpeed || 1;
  const wux = H.wind.wx / wlen, wuy = -H.wind.wy / wlen;

  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!aiming) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * SVG_W;
    const py = ((e.clientY - rect.top) / rect.height) * SVG_H;
    onAim(proj.toWorld(px, py));
  }

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className={"w-full " + (aiming ? "cursor-crosshair" : "")}
      style={{ maxHeight: 600 }} onClick={handleClick}>
      <defs>
        <pattern id="sand" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="#ecdfb0" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="#d6c184" strokeWidth="1" />
        </pattern>
        <radialGradient id="greenfill" cx="42%" cy="38%" r="68%">
          <stop offset="0%" stopColor="#d2f0cf" />
          <stop offset="100%" stopColor="#9fd9a4" />
        </radialGradient>
        <linearGradient id="waterfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a9d6f2" />
          <stop offset="100%" stopColor="#79b4dd" />
        </linearGradient>
        <radialGradient id="forest" cx="50%" cy="38%" r="80%">
          <stop offset="0%" stopColor="#1d365c" />
          <stop offset="100%" stopColor="#122140" />
        </radialGradient>
        <filter id="softsh" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="#16294D" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* background — dark navy field on every hole */}
      <rect x={0} y={0} width={SVG_W} height={SVG_H} rx={14} fill="url(#forest)" />

      {isIsland ? (
        <>
          {/* island: water lake + tee apron (organic shapes) */}
          <path d={lakePath} fill="url(#waterfill)" stroke="#5f9fce" strokeWidth={1.5} filter="url(#softsh)" />
          <path d={teeApronPath} fill="#73ad7d" filter="url(#softsh)" />
          <path d={smoothClosed(toScreen(blobWorld(tee.x, tee.y, teeApronRadius(H) - 4, H.number * 17 + 9, 12, 0.28)))} fill="#a4d9aa" />
        </>
      ) : (
        <>
          {/* organic rough → first cut → fairway → sheen */}
          <path d={roughPath} fill="#4f8c58" />
          <path d={firstCutPath} fill="#73ad7d" />
          <path d={fairwayPath} fill="#a4d9aa" />
          <path d={sheenPath} fill="#bce4bf" fillOpacity={0.5} />
          {/* cart path */}
          <polyline points={cartPath} fill="none" stroke="#d8d8d2" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85} />
        </>
      )}
      {/* distance-to-green markers */}
      {markers.map(({ d, p }) => {
        const nx = -p.uy, ny = p.ux;
        return (
          <g key={d}>
            <line x1={sx(p.x + nx * H.fairwayHalf)} y1={sy(p.y + ny * H.fairwayHalf)}
              x2={sx(p.x - nx * H.fairwayHalf)} y2={sy(p.y - ny * H.fairwayHalf)}
              stroke="#0f1d38" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 3" />
            <text x={sx(p.x - nx * H.fairwayHalf) - 3} y={sy(p.y - ny * H.fairwayHalf)} textAnchor="end"
              fontSize={9} fontFamily="JetBrains Mono" fill="#cdd9ec" fillOpacity={0.75}>{d}</text>
          </g>
        );
      })}

      {/* water ponds */}
      {H.hazards.filter((h) => h.type === "water").map((hz, i) => (
        <ellipse key={`w${i}`} cx={sx(hz.cx)} cy={sy(hz.cy)} rx={hz.r * scale} ry={hz.r * scale * 0.82} fill="url(#waterfill)" stroke="#5f9fce" strokeWidth={1.5} filter="url(#softsh)" />
      ))}
      {/* bunkers (sand) */}
      {H.hazards.filter((h) => h.type === "sand").map((hz, i) => (
        <ellipse key={`s${i}`} cx={sx(hz.cx)} cy={sy(hz.cy)} rx={hz.r * scale} ry={hz.r * scale * 0.78} fill="url(#sand)" stroke="#bfa564" strokeWidth={1} filter="url(#softsh)" />
      ))}

      {/* green: organic collar + surface + putting ring */}
      <path d={greenCollarPath} fill="#5f9d69" filter="url(#softsh)" />
      <path d={greenPath} fill="url(#greenfill)" />
      <circle cx={sx(pin.x)} cy={sy(pin.y)} r={3 * scale} fill="none" stroke="#16294D" strokeOpacity={0.22} strokeDasharray="2 2.5" />

      {/* trees rimming the hole — shadow + two-tone canopy */}
      {trees.map((t, i) => {
        const r = t.r * scale;
        return (
          <g key={`t${i}`}>
            <ellipse cx={sx(t.x) + r * 0.28} cy={sy(t.y) + r * 0.42} rx={r * 0.95} ry={r * 0.6} fill="#16294D" fillOpacity={0.14} />
            <circle cx={sx(t.x)} cy={sy(t.y)} r={r} fill="#2f6a39" />
            <circle cx={sx(t.x) - r * 0.28} cy={sy(t.y) - r * 0.3} r={r * 0.72} fill="#3f854a" />
            <circle cx={sx(t.x) - r * 0.42} cy={sy(t.y) - r * 0.46} r={r * 0.4} fill="#57a262" />
          </g>
        );
      })}

      {/* tee — at the actual playing tee (trail start), coloured by the tee set */}
      {(() => {
        const t0 = trail[0] ?? tee;
        return (
          <g>
            <rect x={sx(t0.x) - 6} y={sy(t0.y) - 4} width={12} height={8} rx={2.5} fill="#fff" stroke="#16294D" strokeOpacity={0.25} filter="url(#softsh)" />
            <circle cx={sx(t0.x)} cy={sy(t0.y)} r={2.4} fill={teeColor} stroke="#16294D" strokeOpacity={0.3} strokeWidth={0.6} />
          </g>
        );
      })()}

      {/* shot trajectories — a bowed flight arc per shot, with arrowhead */}
      {trail.slice(1).map((b, i) => {
        const a = trail[i];
        const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y);
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
        const px = -dy / len, py = dx / len;
        // bow the flight toward the pin side for a natural ball-flight look
        const tox = sx(pin.x) - ax, toy = sy(pin.y) - ay;
        const side = Math.sign(px * tox + py * toy) || 1;
        const bow = Math.min(len * 0.16, 20);
        const mx = (ax + bx) / 2 + px * side * bow, my = (ay + by) / 2 + py * side * bow;
        const d = `M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}`;
        // arrowhead at the landing, oriented along the tangent (b − control)
        const tx = bx - mx, ty = by - my, tl = Math.hypot(tx, ty) || 1;
        const ux = tx / tl, uy = ty / tl, qx = -uy, qy = ux;
        const head = `M ${bx} ${by} L ${bx - ux * 7 + qx * 3.4} ${by - uy * 7 + qy * 3.4} L ${bx - ux * 7 - qx * 3.4} ${by - uy * 7 - qy * 3.4} Z`;
        return (
          <g key={`tr${i}`}>
            <path d={d} fill="none" stroke="#16294D" strokeWidth={3.2} strokeOpacity={0.28} strokeLinecap="round" />
            <path d={d} fill="none" stroke="#F4C534" strokeWidth={1.6} strokeOpacity={0.95} strokeLinecap="round" />
            <path d={head} fill="#F4C534" />
          </g>
        );
      })}
      {/* landing markers (intermediate rests; the current ball is drawn separately) */}
      {trail.slice(1, -1).map((p, i) => (
        <circle key={`lm${i}`} cx={sx(p.x)} cy={sy(p.y)} r={2.4} fill="#fff" stroke="#16294D" strokeWidth={1.2} />
      ))}

      {/* aim */}
      {aiming && (
        <g>
          <line x1={sx(ball.x)} y1={sy(ball.y)} x2={sx(aim.x)} y2={sy(aim.y)} stroke="#2F8FA6" strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.85} />
          <circle cx={sx(aim.x)} cy={sy(aim.y)} r={5} fill="none" stroke="#2F8FA6" strokeWidth={1.5} />
          <line x1={sx(aim.x) - 7} y1={sy(aim.y)} x2={sx(aim.x) + 7} y2={sy(aim.y)} stroke="#2F8FA6" strokeWidth={1} />
          <line x1={sx(aim.x)} y1={sy(aim.y) - 7} x2={sx(aim.x)} y2={sy(aim.y) + 7} stroke="#2F8FA6" strokeWidth={1} />
          <text x={sx(aim.x) + 9} y={sy(aim.y) - 6} fontSize={11} fontFamily="JetBrains Mono" fill="#2F8FA6">{aimDist.toFixed(0)} m</text>
        </g>
      )}

      {/* pin / flag */}
      <line x1={sx(pin.x)} y1={sy(pin.y)} x2={sx(pin.x)} y2={sy(pin.y) - 18} stroke="#16294D" strokeWidth={1.5} />
      <path d={`M ${sx(pin.x)} ${sy(pin.y) - 18} l 11 4 l -11 4 z`} fill="#C2603A" />
      <circle cx={sx(pin.x)} cy={sy(pin.y)} r={2.5} fill="#16294D" />

      {/* ball */}
      <circle cx={sx(ball.x)} cy={sy(ball.y)} r={4.5} fill="#fff" stroke="#16294D" strokeWidth={1.5} />

      {/* yardage-book hole badge (top-left) */}
      <g filter="url(#softsh)">
        <rect x={10} y={10} width={68} height={52} rx={8} fill="#fff" />
        <rect x={10} y={10} width={68} height={3} rx={1.5} fill="#F4C534" />
        <text x={20} y={42} fontSize={26} fontWeight={800} fontFamily="Manrope" fill="#16294D">{H.number}</text>
        <text x={44} y={30} fontSize={10} fontWeight={700} fontFamily="Manrope" fill="#2E5DA4">Par {H.par}</text>
        <text x={44} y={43} fontSize={9} fontFamily="JetBrains Mono" fill="#16294D" fillOpacity={0.55}>{Math.round(total * teeFactor)} m</text>
        {H.name && (
          <text x={20} y={56} fontSize={8} fontFamily="Manrope" fontStyle="italic" fill="#16294D" fillOpacity={0.5}>{H.name.slice(0, 16)}</text>
        )}
      </g>

      {/* green-detail inset (bottom-right) — magnified green with pin + depths */}
      {(() => {
        const cx = SVG_W - 50, cy = SVG_H - 50, R = 40;
        const gr = R * 0.62;        // drawn green radius in the inset
        const frontM = Math.max(0, Math.round(total - H.greenRadius));
        const backM = Math.round(total + H.greenRadius);
        return (
          <g filter="url(#softsh)">
            <circle cx={cx} cy={cy} r={R} fill="#eef6ef" stroke="#16294D" strokeOpacity={0.12} />
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F4C534" strokeWidth={1.5} strokeOpacity={0.9} />
            {/* magnified green */}
            <ellipse cx={cx} cy={cy + 2} rx={gr} ry={gr * 0.92} fill="#5f9d69" />
            <ellipse cx={cx} cy={cy + 2} rx={gr - 2.5} ry={gr * 0.92 - 2.5} fill="url(#greenfill)" />
            {/* front / back depth dots */}
            <circle cx={cx} cy={cy + gr * 0.92 + 1} r={2.4} fill="#fff" stroke="#16294D" strokeOpacity={0.4} />
            <text x={cx + gr + 2} y={cy + gr * 0.92 + 4} fontSize={7.5} fontFamily="JetBrains Mono" fill="#16294D" fillOpacity={0.6}>{frontM}</text>
            <circle cx={cx} cy={cy - gr * 0.92 + 3} r={2.4} fill="#C2603A" />
            <text x={cx + gr + 2} y={cy - gr * 0.92 + 6} fontSize={7.5} fontFamily="JetBrains Mono" fill="#16294D" fillOpacity={0.6}>{backM}</text>
            {/* pin + flag */}
            <line x1={cx} y1={cy} x2={cx} y2={cy - 13} stroke="#16294D" strokeWidth={1.2} />
            <path d={`M ${cx} ${cy - 13} l 8 3 l -8 3 z`} fill="#C2603A" />
            <circle cx={cx} cy={cy} r={1.8} fill="#16294D" />
            <text x={cx} y={cy + R + 9} textAnchor="middle" fontSize={7} fontFamily="JetBrains Mono" letterSpacing={1} fill="#cdd9ec" fillOpacity={0.7}>GREEN</text>
          </g>
        );
      })()}

      {/* wind indicator */}
      <g transform={`translate(${SVG_W - 30},30)`}>
        <circle r={18} fill="#fff" fillOpacity={0.9} stroke="#16294D" strokeOpacity={0.15} filter="url(#softsh)" />
        {windSpeed >= 0.5 ? (
          <>
            <line x1={-wux * 11} y1={-wuy * 11} x2={wux * 11} y2={wuy * 11} stroke="#2F8FA6" strokeWidth={2} />
            <path d={`M ${wux * 11} ${wuy * 11} L ${wux * 11 - wux * 6 - wuy * 4} ${wuy * 11 - wuy * 6 + wux * 4} L ${wux * 11 - wux * 6 + wuy * 4} ${wuy * 11 - wuy * 6 - wux * 4} Z`} fill="#2F8FA6" />
          </>
        ) : (
          <text textAnchor="middle" y={3} fontSize={8} fontFamily="Manrope" fill="#16294D">calme</text>
        )}
        <text textAnchor="middle" y={31} fontSize={9} fontFamily="JetBrains Mono" fill="#16294D" fillOpacity={0.6}>
          {windSpeed.toFixed(0)} m/s
        </text>
      </g>
    </svg>
  );
}

function Scorecard({ course, card, currentIdx, scoreMode = "stroke" }: { course: Hole[]; card: HoleScore[]; currentIdx: number; scoreMode?: ScoreMode }) {
  const byHole = new Map(card.map((h) => [h.number, h]));
  const nine = (from: number, to: number) => course.slice(from, to);
  const total = card.reduce((a, h) => a + h.strokes, 0);
  const playedPar = card.reduce((a, h) => a + h.par, 0);
  const hasBackNine = course.length > 9;
  const showModeRow = scoreMode !== "stroke";
  const modeRowLabel = scoreMode === "stableford" ? "Pts" : "±";
  const holeModeVal = (s: number, par: number) =>
    scoreMode === "stableford" ? stablefordPoints(s, par) : parResult(s, par);
  const nineModeTotal = (holes: Hole[]) =>
    modeTotal(holes.map((h) => byHole.get(h.number)).filter(Boolean).map((s) => ({ strokes: s!.strokes, par: s!.par })), scoreMode);

  const Row = ({ holes, label }: { holes: Hole[]; label: string }) => {
    const played = holes.map((h) => byHole.get(h.number)).filter(Boolean) as HoleScore[];
    const strokeSub = played.reduce((a, s) => a + s.strokes, 0);
    return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs metric">
        <tbody>
          <tr className="text-ink/40">
            <td className="px-2 py-1 text-left font-sans uppercase tracking-wide text-[10px]">Trou</td>
            {holes.map((h) => (
              <td key={h.number} className={"px-2 py-1 text-center " + (h.number - 1 === currentIdx ? "bg-fairway/10 rounded font-bold text-fairway" : "")}>{h.number}</td>
            ))}
            <td className="px-2 py-1 text-center font-sans uppercase text-[10px]">{label}</td>
          </tr>
          <tr className="text-ink/50">
            <td className="px-2 py-1 text-left font-sans text-[10px]">Par</td>
            {holes.map((h) => <td key={h.number} className="px-2 py-1 text-center">{h.par}</td>)}
            <td className="px-2 py-1 text-center">{holes.reduce((a, h) => a + h.par, 0)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="px-2 py-1 text-left font-sans text-[10px] text-ink/50">Coups</td>
            {holes.map((h) => {
              const s = byHole.get(h.number);
              const d = s ? s.strokes - h.par : 0;
              return (
                <td key={h.number} className={"px-2 py-1 text-center " + (!s ? "text-ink/25" : d < 0 ? "text-fairway" : d > 1 ? "text-terracotta" : "text-ink")}>
                  {s ? s.strokes : "–"}
                </td>
              );
            })}
            <td className="px-2 py-1 text-center">{strokeSub || "–"}</td>
          </tr>
          {showModeRow && (
            <tr className="font-semibold text-royal">
              <td className="px-2 py-1 text-left font-sans text-[10px] text-ink/50">{modeRowLabel}</td>
              {holes.map((h) => {
                const s = byHole.get(h.number);
                if (!s) return <td key={h.number} className="px-2 py-1 text-center text-ink/25">–</td>;
                const v = holeModeVal(s.strokes, h.par);
                return <td key={h.number} className="px-2 py-1 text-center">{scoreMode === "par" && v > 0 ? "+" : ""}{v}</td>;
              })}
              <td className="px-2 py-1 text-center">{scoreMode === "par" && nineModeTotal(holes) > 0 ? "+" : ""}{nineModeTotal(holes)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    );
  };

  return (
    <section className="card p-4 grid gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base">Carte de score</h3>
        {card.length > 0 && (
          <span className="metric text-sm">
            {scoreMode !== "stroke" && <span className="text-royal font-semibold mr-2">{modeScoreLabel(card, scoreMode)}</span>}
            {total} <span className="text-ink/40">({total - playedPar >= 0 ? "+" : ""}{total - playedPar})</span>
            <span className="text-ink/40"> · {card.reduce((a, h) => a + h.mulligans, 0)} mull.</span>
          </span>
        )}
      </div>
      <Row holes={nine(0, 9)} label={hasBackNine ? "Aller" : "Total"} />
      {hasBackNine && <Row holes={nine(9, course.length)} label="Retour" />}
    </section>
  );
}

function PastRounds({ rounds, onDelete }: { rounds: Round[]; onDelete: (id: string) => void }) {
  if (!rounds.length) return null;
  return (
    <section className="card overflow-hidden">
      <h3 className="font-display text-base px-4 py-3 border-b border-black/5">Historique des parties</h3>
      <div className="divide-y divide-black/[0.04]">
        {rounds.map((r) => {
          const diff = r.totalStrokes - r.coursePar;
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="text-ink/50">
                {new Date(r.startedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              <span className="metric font-semibold ml-auto">{r.totalStrokes}</span>
              <span className="metric text-ink/50 w-12 text-right">{diff >= 0 ? "+" : ""}{diff}</span>
              <span className="text-xs text-gold w-16 text-right">{r.totalMulligans} mull.</span>
              <button onClick={() => onDelete(r.id)} className="p-1.5 rounded-lg text-ink/25 hover:text-terracotta hover:bg-terracotta/10 transition" title="Supprimer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RoundStats({ rounds }: { rounds: Round[] }) {
  const s = roundStats(rounds);
  if (!s) return null;
  const trend = [...rounds].reverse().map((r, i) => ({ i: i + 1, vsPar: r.totalStrokes - r.coursePar }));
  const tiles = [
    { label: "Parties", value: `${s.rounds}` },
    { label: "Handicap est.", value: s.handicap == null ? "–" : `${s.handicap >= 0 ? "+" : ""}${s.handicap.toFixed(1)}` },
    { label: "Score moyen", value: s.avgStrokes.toFixed(1) },
    { label: "Meilleur", value: `${s.bestStrokes}` },
    { label: "GIR", value: `${s.girPct.toFixed(0)} %` },
    { label: "Fairways", value: `${s.firPct.toFixed(0)} %` },
    { label: "Putts/partie", value: s.avgPutts.toFixed(1) },
    { label: "Pénalités/p.", value: s.avgPenalties.toFixed(1) },
  ];
  return (
    <section className="card p-4 grid gap-3">
      <h3 className="font-display text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-teal" /> Statistiques de parcours</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="bg-panel rounded-xl px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-ink/45">{t.label}</div>
            <div className="metric text-lg font-semibold">{t.value}</div>
          </div>
        ))}
      </div>
      {trend.length >= 2 && (
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ left: -16, right: 8, top: 6 }}>
              <XAxis dataKey="i" tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
              <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#16294D" strokeDasharray="4 4" strokeOpacity={0.4} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #eef3fb", fontFamily: "Manrope" }}
                formatter={(v: number) => [`${v >= 0 ? "+" : ""}${v}`, "vs par"]} labelFormatter={(l) => `Partie ${l}`} />
              <Line type="monotone" dataKey="vsPar" stroke="#2F8F5B" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

// Shared lush-turf base for the thumbnail SVGs (layered corridor, hazards,
// gradient green, two-tone trees, flag, tee). Matches the main HoleMap style.
function MiniTurf({ h, proj }: { h: Hole; proj: ReturnType<typeof makeProjector> }) {
  const { sx, sy, scale } = proj;
  const pin = pinOf(h), tee = teeOf(h);
  const trees = treesFor(h);
  const isIsland = !!h.island;
  const toScreen = (pts: Vec[]) => pts.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
  const fwSeed = h.number * 1337 + 11;
  const greenCollarPath = smoothClosed(toScreen(greenBlobWorld(h, (h.greenRadius + 2.2) / h.greenRadius)));
  const greenPath = smoothClosed(toScreen(greenBlobWorld(h)));
  const islandWHalf = islandWaterHalf(h);
  const waterCenterline = [...h.centerline, { x: pin.x, y: pin.y + islandWHalf }];
  return (
    <>
      {isIsland ? (
        <>
          <path d={smoothClosed(toScreen(fairwayRibbonWorld({ ...h, centerline: waterCenterline }, islandWHalf, 0.1, h.number * 53 + 3)))} fill="#7fb9e2" stroke="#6aa6d2" strokeWidth={0.5} />
          <path d={smoothClosed(toScreen(blobWorld(tee.x, tee.y, teeApronRadius(h), h.number * 17 + 5, 12, 0.3)))} fill="#a4d9aa" />
        </>
      ) : (
        <>
          {/* organic rough → first cut → fairway */}
          <path d={smoothClosed(toScreen(fairwayRibbonWorld(h, h.fairwayHalf + 13, 0.16, fwSeed)))} fill="#4f8c58" />
          <path d={smoothClosed(toScreen(fairwayRibbonWorld(h, h.fairwayHalf + 5, 0.14, fwSeed)))} fill="#73ad7d" />
          <path d={smoothClosed(toScreen(fairwayRibbonWorld(h, h.fairwayHalf, 0.26, fwSeed)))} fill="#a4d9aa" />
          {/* hazards */}
          {h.hazards.filter((z) => z.type === "water").map((hz, i) => (
            <ellipse key={`w${i}`} cx={sx(hz.cx)} cy={sy(hz.cy)} rx={Math.max(1.5, hz.r * scale)} ry={Math.max(1.2, hz.r * scale * 0.82)} fill="#8fc4e8" stroke="#6aa6d2" strokeWidth={0.5} />
          ))}
          {h.hazards.filter((z) => z.type === "sand").map((hz, i) => (
            <ellipse key={`s${i}`} cx={sx(hz.cx)} cy={sy(hz.cy)} rx={Math.max(1.3, hz.r * scale)} ry={Math.max(1, hz.r * scale * 0.78)} fill="#ecdfb0" stroke="#cdba7d" strokeWidth={0.4} />
          ))}
        </>
      )}
      {/* green (organic) */}
      <path d={greenCollarPath} fill="#5f9d69" />
      <path d={greenPath} fill="#c2e8c5" />
      {/* trees */}
      {trees.map((t, i) => {
        const r = Math.max(1.4, t.r * scale);
        return (
          <g key={`t${i}`}>
            <circle cx={sx(t.x)} cy={sy(t.y)} r={r} fill="#2f6a39" />
            <circle cx={sx(t.x) - r * 0.3} cy={sy(t.y) - r * 0.3} r={r * 0.6} fill="#469150" />
          </g>
        );
      })}
      {/* flag */}
      <line x1={sx(pin.x)} y1={sy(pin.y)} x2={sx(pin.x)} y2={sy(pin.y) - 8} stroke="#16294D" strokeWidth={0.9} />
      <path d={`M ${sx(pin.x)} ${sy(pin.y) - 8} l 5 2 l -5 2 z`} fill="#C2603A" />
      {/* tee */}
      <rect x={sx(tee.x) - 2.5} y={sy(tee.y) - 1.6} width={5} height={3.2} rx={1} fill="#fff" stroke="#16294D" strokeOpacity={0.3} strokeWidth={0.5} />
    </>
  );
}

function MiniHole({ h }: { h: Hole }) {
  const W = 130, Hh = 96, P = 8;
  const proj = makeProjector(h, W, Hh, P);
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} className="w-full">
      <rect x={0} y={0} width={W} height={Hh} rx={8} fill="#16294D" />
      <MiniTurf h={h} proj={proj} />
    </svg>
  );
}

function MiniHoleWithTrail({ h, trail, score, par }: { h: Hole; trail: Vec[]; score: number; par: number }) {
  const W = 130, Hh = 96, P = 8;
  const proj = makeProjector(h, W, Hh, P);
  const { sx, sy } = proj;
  const diff = score - par;
  const scoreColor = diff <= -1 ? "#2F8F5B" : diff === 0 ? "#2F8FA6" : diff === 1 ? "#C68A14" : "#C2603A";
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} className="w-full">
      <rect x={0} y={0} width={W} height={Hh} rx={8} fill="#16294D" />
      <MiniTurf h={h} proj={proj} />
      {/* bowed flight arcs per shot */}
      {trail.slice(1).map((b, i) => {
        const a = trail[i];
        const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y);
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
        const pinS = pinOf(h);
        const px = -dy / len, py = dx / len;
        const side = Math.sign(px * (sx(pinS.x) - ax) + py * (sy(pinS.y) - ay)) || 1;
        const bow = Math.min(len * 0.16, 12);
        const mx = (ax + bx) / 2 + px * side * bow, my = (ay + by) / 2 + py * side * bow;
        return <path key={`tr${i}`} d={`M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}`} fill="none" stroke="#F4C534" strokeWidth={1.3} strokeOpacity={0.95} strokeLinecap="round" />;
      })}
      {trail.slice(1, -1).map((p, i) => (
        <circle key={`lm${i}`} cx={sx(p.x)} cy={sy(p.y)} r={1.6} fill="#fff" stroke="#16294D" strokeWidth={0.7} />
      ))}
      {trail.length > 0 && (
        <circle cx={sx(trail[trail.length - 1].x)} cy={sy(trail[trail.length - 1].y)} r={2.5} fill={scoreColor} />
      )}
      <rect x={W - 22} y={2} width={20} height={13} rx={3} fill={scoreColor} />
      <text x={W - 12} y={12} textAnchor="middle" fontSize={9} fontFamily="JetBrains Mono" fill="white" fontWeight="bold">
        {diff >= 0 ? "+" : ""}{diff}
      </text>
    </svg>
  );
}

function RoundSummaryGrid({ course, card, holeTrails }: { course: Hole[]; card: HoleScore[]; holeTrails: Vec[][] }) {
  if (!card.length) return null;
  return (
    <section className="card p-4">
      <h3 className="font-display text-base mb-3">Déroulé du parcours</h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {card.map((h, i) => {
          const hole = course[h.number - 1];
          const diff = h.strokes - h.par;
          return (
            <div key={h.number} className="grid gap-1">
              <MiniHoleWithTrail h={hole} trail={holeTrails[i] ?? []} score={h.strokes} par={h.par} />
              <div className="flex items-center justify-between text-[11px] px-1">
                <span className="metric font-semibold text-ink/50">{h.number}</span>
                <span className={"metric font-semibold " + (diff <= -1 ? "text-fairway" : diff === 0 ? "text-teal" : diff === 1 ? "text-gold" : "text-terracotta")}>
                  {h.strokes}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CourseOverview({ course }: { course: Hole[] }) {
  return (
    <section className="card p-4">
      <h3 className="font-display text-base mb-3">Aperçu du parcours · {course.length} trous</h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {course.map((h) => (
          <div key={h.number} className="grid gap-1">
            <MiniHole h={h} />
            <div className="flex items-center justify-between text-[11px] text-ink/50 px-1">
              <span className="metric font-semibold">{h.number}</span>
              <span>P{h.par} · {pathLength(h.centerline).toFixed(0)}m</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
