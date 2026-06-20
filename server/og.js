// ---- Open Graph image + meta generation -------------------------------------
// Crawlers (WhatsApp, iMessage, Twitter…) don't run JS and want a raster image,
// so we render a 1200×630 PNG server-side from each share's frozen snapshot.
// The card SVG is built by hand (full brand control) then rasterised by resvg,
// using the bundled Manrope / Fraunces fonts so it renders identically on any host.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS = [
  join(__dirname, "assets/fonts/Manrope.ttf"),
  join(__dirname, "assets/fonts/Fraunces.ttf"),
];

// Brand palette (sRGB hex), mirrors src/index.css.
const C = {
  ink: "#16294D", inkDeep: "#0E1C38", white: "#FFFFFF",
  fw: "#2E5DA4", teal: "#2F8FA6", gold: "#C68A14", terra: "#C2603A", lisere: "#F4C534",
  muted: "#9FB0CC",
};
const ACCENT = { round: C.fw, session: C.teal, combine: C.gold, stats: C.teal };

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const trunc = (s, n) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const r0 = (n) => Math.round(Number(n) || 0);
const f1 = (n) => (Number(n) || 0).toFixed(1);
const f2 = (n) => (Number(n) || 0).toFixed(2);

// ── Per-kind extraction → a single neutral layout model ─────────────────────────
function model(kind, data) {
  if (kind === "round") {
    const d = data;
    const vs = d.vsPar === 0 ? "PAR" : d.vsPar > 0 ? `+${d.vsPar}` : `${d.vsPar}`;
    const vsColor = d.vsPar < 0 ? C.teal : d.vsPar > 0 ? C.terra : C.white;
    return {
      eyebrow: "Carte de score", context: trunc(d.course, 24),
      heroLabel: "Score total", hero: `${d.strokes}`, heroUnit: vs, heroUnitColor: vsColor,
      heroSub: `Par ${d.par} · ${d.holes?.length ?? 18} trous`,
      chips: [
        d.girPct != null ? ["Greens", `${r0(d.girPct)}%`] : null,
        d.firPct != null ? ["Fairways", `${r0(d.firPct)}%`] : null,
        d.avgPutts != null ? ["Putts/trou", f1(d.avgPutts)] : ["Birdies", `${d.counts?.birdies ?? 0}`],
      ].filter(Boolean),
    };
  }
  if (kind === "session") {
    const d = data;
    return {
      eyebrow: "Séance d'entraînement", context: trunc(d.label, 24),
      heroLabel: "Coup le plus long", hero: d.longest ? `${r0(d.longest.carry)}` : "—", heroUnit: "m",
      heroSub: d.longest ? `${d.longest.club} · ${r0(d.longest.total)} m total` : "",
      chips: [
        ["Balles", `${d.balls}`],
        d.bestSmash ? ["Smash max", f2(d.bestSmash.smash)] : null,
        d.topBallSpeed ? ["V. balle max", `${r0(d.topBallSpeed.speed)}`] : null,
      ].filter(Boolean),
    };
  }
  if (kind === "combine") {
    const d = data;
    return {
      eyebrow: "Combine FlightLab", context: "Test standardisé",
      heroLabel: "Score Combine", hero: f1(d.score), heroUnit: "/100",
      heroSub: `Niveau ${d.grade}`,
      chips: [
        ["Balles", `${d.balls}`],
        ["Stations", `${d.stations?.length ?? 0}`],
        d.best ? ["Meilleure", d.best.label] : null,
      ].filter(Boolean),
    };
  }
  // stats
  const d = data;
  return {
    eyebrow: "Statistiques", context: "Profil de jeu complet",
    heroLabel: d.topClub ? `Club le plus long · ${d.topClub.club}` : "Mon sac",
    hero: d.topClub ? `${r0(d.topClub.carry)}` : "—", heroUnit: "m",
    heroSub: d.topClub ? `carry moyen · smash ${f2(d.topClub.smash)}` : "",
    chips: [
      ["Balles", `${d.balls}`],
      ["Clubs", `${d.clubs}`],
      ["Smash moy", f2(d.avgSmash)],
    ],
  };
}

function chipSvg(x, y, w, h, label, value, accent) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.10"/>
    <text x="${x + 22}" y="${y + 32}" font-family="Manrope" font-weight="600" font-size="17" letter-spacing="1.2" fill="${C.muted}">${esc(String(label).toUpperCase())}</text>
    <text x="${x + 22}" y="${y + 70}" font-family="Manrope" font-weight="800" font-size="34" fill="${accent}">${esc(value)}</text>
  `;
}

function cardSvg(share) {
  const m = model(share.kind, share.data);
  const accent = ACCENT[share.kind] ?? C.fw;
  const W = 1200, H = 630;
  const player = trunc(share.player, 28);
  const date = new Date(share.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // Left column content x=80..700 ; right column hero centered around x=930.
  const chipW = 196, chipH = 92, chipGap = 16, chipY = 470;
  const chips = m.chips.slice(0, 3).map((c, i) => chipSvg(80 + i * (chipW + chipGap), chipY, chipW, chipH, c[0], c[1], accent)).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.ink}"/>
      <stop offset="1" stop-color="${C.inkDeep}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1010" cy="150" r="360" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="10" fill="${C.lisere}"/>
  <line x1="700" y1="120" x2="700" y2="510" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>

  <!-- Brand -->
  <rect x="80" y="70" width="62" height="62" rx="16" fill="${C.fw}"/>
  <text x="111" y="112" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="26" fill="#ffffff">FL</text>
  <text x="162" y="112" font-family="Manrope" font-weight="800" font-size="34" fill="#ffffff">Flight<tspan font-family="Fraunces" font-weight="600" fill="${C.muted}">Lab</tspan></text>
  <text x="1120" y="108" text-anchor="end" font-family="Manrope" font-weight="700" font-size="18" letter-spacing="3" fill="${C.muted}">${esc(m.eyebrow.toUpperCase())}</text>

  <!-- Left: context + player -->
  <text x="80" y="232" font-family="Manrope" font-weight="800" font-size="58" fill="#ffffff">${esc(m.context)}</text>
  <text x="80" y="288" font-family="Manrope" font-weight="600" font-size="30" fill="${C.muted}">${esc(player)} · ${esc(date)}</text>

  <!-- Chips -->
  ${chips}

  <!-- Right: hero (number centred at cx, unit anchored just past its right edge) -->
  <text x="${HERO_CX}" y="190" text-anchor="middle" font-family="Manrope" font-weight="700" font-size="20" letter-spacing="2" fill="${C.muted}">${esc(m.heroLabel.toUpperCase())}</text>
  <text x="${HERO_CX}" y="380" text-anchor="middle" font-family="Fraunces" font-weight="600" font-size="200" fill="#ffffff">${esc(m.hero)}</text>
  <text x="${heroUnitX(m.hero)}" y="380" text-anchor="start" font-family="Manrope" font-weight="700" font-size="44" fill="${m.heroUnitColor ?? C.muted}">${esc(m.heroUnit)}</text>
  <text x="${HERO_CX}" y="440" text-anchor="middle" font-family="Manrope" font-weight="600" font-size="30" fill="${C.muted}">${esc(m.heroSub)}</text>

  <!-- Footer -->
  <text x="80" y="600" font-family="Manrope" font-weight="700" font-size="20" fill="${C.muted}">Généré avec FlightLab</text>
  <text x="1120" y="600" text-anchor="end" font-family="Manrope" font-weight="500" font-size="18" fill="${C.muted}" fill-opacity="0.7">Analyse de swing &amp; entraînement golf connecté</text>
</svg>`;
}

// Centre of the right-hand hero column.
const HERO_CX = 900;

// Estimate the rendered width of the hero number (Fraunces 600 @ 200px) so the
// unit can be start-anchored just past its right edge — robust to 2–4 digit values.
function heroUnitX(hero) {
  let w = 0;
  for (const ch of String(hero)) w += (ch === "." || ch === ",") ? 50 : 110;
  return HERO_CX + w / 2 + 14;
}

export function renderOgPng(share) {
  const svg = cardSvg(share);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Manrope" },
  });
  return resvg.render().asPng();
}

// ── Per-share <meta> text (title + description) ─────────────────────────────────
export function shareMeta(share) {
  const { kind, data, player } = share;
  if (kind === "round") {
    const vs = data.vsPar === 0 ? "au par" : data.vsPar > 0 ? `+${data.vsPar}` : `${data.vsPar}`;
    return {
      title: `${player} — ${data.strokes} (${vs}) à ${trunc(data.course, 40)}`,
      description: `Carte de score FlightLab · Par ${data.par}` +
        (data.girPct != null ? ` · GIR ${r0(data.girPct)}%` : "") +
        (data.firPct != null ? ` · Fairways ${r0(data.firPct)}%` : ""),
    };
  }
  if (kind === "session") {
    return {
      title: `${player} — séance${data.longest ? ` : drive ${r0(data.longest.carry)} m` : ""}`,
      description: `${data.balls} balles` +
        (data.bestSmash ? ` · smash max ${f2(data.bestSmash.smash)}` : "") +
        (data.topBallSpeed ? ` · ${r0(data.topBallSpeed.speed)} km/h` : "") + " · FlightLab",
    };
  }
  if (kind === "combine") {
    return {
      title: `${player} — Combine ${f1(data.score)}/100 (${data.grade})`,
      description: `Test standardisé FlightLab · ${data.balls} balles sur ${data.stations?.length ?? 0} cibles`,
    };
  }
  return {
    title: `${player} — statistiques FlightLab`,
    description: `${data.balls} balles · ${data.clubs} clubs` +
      (data.topClub ? ` · ${data.topClub.club} ${r0(data.topClub.carry)} m` : "") +
      (data.avgSmash ? ` · smash moyen ${f2(data.avgSmash)}` : ""),
  };
}
