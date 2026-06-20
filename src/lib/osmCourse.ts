// Download a real golf course from OpenStreetMap (the same source the bundled
// courses are traced from) and convert it to the app's Hole[] format.
//
// Flow: Nominatim geocodes the search term → a point + bounding box; Overpass
// returns the golf features in that box (holes, greens, bunkers, water); we
// project lon/lat to local metres and lay out each hole in its own tee→pin frame.

import type { Hole, Hazard, Vec } from "./course";

export interface ImportedCourse {
  label: string;
  loc: string;
  holes: Hole[];
}

// ---- geo helpers ---------------------------------------------------------------

const R = 6378137, D2R = Math.PI / 180;
const len = (v: Vec) => Math.hypot(v.x, v.y);
const dotv = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const subv = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Equirectangular lon/lat → metres (east, north) about an origin. */
function toM(lat: number, lon: number, lat0: number, lon0: number): Vec {
  return { x: (lon - lon0) * Math.cos(lat0 * D2R) * D2R * R, y: (lat - lat0) * D2R * R };
}

/** Centroid + area of a closed polygon (shoelace); falls back to the mean point. */
function polyInfo(pts: Vec[]): { c: Vec; area: number } {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const cr = p.x * q.y - q.x * p.y;
    a += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-6) {
    const m = pts.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
    return { c: { x: m.x / pts.length, y: m.y / pts.length }, area: 0 };
  }
  return { c: { x: cx / (6 * a), y: cy / (6 * a) }, area: Math.abs(a) };
}

/** Distance from point p to a polyline. */
function distToLine(p: Vec, line: Vec[]): number {
  let m = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const ab = subv(b, a), ap = subv(p, a);
    const t = clamp(dotv(ap, ab) / (dotv(ab, ab) || 1), 0, 1);
    m = Math.min(m, len(subv(p, { x: a.x + ab.x * t, y: a.y + ab.y * t })));
  }
  return m;
}

// ---- remote fetches ------------------------------------------------------------

async function geocode(query: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Geocoding service unavailable.");
  const arr = await res.json();
  if (!arr.length) throw new Error("Course not found. Try a more specific name or add the town/country.");
  const r = arr[0];
  const [s, n, w, e] = (r.boundingbox as string[]).map(Number); // south,north,west,east
  return { lat: +r.lat, lon: +r.lon, name: String(r.display_name).split(",")[0], bbox: { s, n, w, e } };
}

async function overpassGolf(b: { s: number; n: number; w: number; e: number }) {
  // A fixed box around the result centre (Nominatim often returns a single point
  // for a course, so we can't trust its size). ~0.05° ≈ 5 km covers any course;
  // a proximity filter later keeps only the one at the search location.
  const cs = (b.s + b.n) / 2, cw = (b.w + b.e) / 2, H = 0.025;
  const box = `(${cs - H},${cw - H},${cs + H},${cw + H})`;
  const ql = `[out:json][timeout:40];(` +
    `way["golf"="hole"]${box};` +
    `way["golf"="green"]${box};` +
    `way["golf"="bunker"]${box};` +
    `way["golf"="water_hazard"]${box};` +
    `way["golf"="lateral_water_hazard"]${box};` +
    `);out body;>;out skel qt;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: ql });
  if (!res.ok) throw new Error("OpenStreetMap query failed (try again in a moment).");
  return res.json() as Promise<{ elements: Array<{ type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }> }>;
}

// ---- build ---------------------------------------------------------------------

export async function fetchCourseFromOSM(query: string): Promise<ImportedCourse> {
  const place = await geocode(query);
  const data = await overpassGolf(place.bbox);

  const nodes = new Map<number, { lat: number; lon: number }>();
  const ways: Array<{ tags: Record<string, string>; pts: number[] }> = [];
  for (const el of data.elements) {
    if (el.type === "node" && el.lat != null) nodes.set(el.id, { lat: el.lat, lon: el.lon! });
    else if (el.type === "way") ways.push({ tags: el.tags ?? {}, pts: el.nodes ?? [] });
  }

  const lat0 = place.lat, lon0 = place.lon;
  const ptsOf = (w: { pts: number[] }): Vec[] =>
    w.pts.map((id) => nodes.get(id)).filter(Boolean).map((nd) => toM(nd!.lat, nd!.lon, lat0, lon0));

  const allHoles = ways.filter((w) => w.tags.golf === "hole").map((w) => ({ tags: w.tags, line: ptsOf(w) })).filter((h) => h.line.length >= 2);
  if (!allHoles.length) throw new Error("No golf holes found near that course in OpenStreetMap.");
  // The box may straddle several courses; keep the one at the search location —
  // holes whose tee is within ~1.6 km of the geocoded point (origin = 0,0).
  const near = allHoles.filter((h) => len(h.line[0]) < 1600);
  const holeWays = near.length >= 5 ? near : allHoles;

  const greens = ways.filter((w) => w.tags.golf === "green").map((w) => polyInfo(ptsOf(w)));
  const sandPolys = ways.filter((w) => w.tags.golf === "bunker").map((w) => polyInfo(ptsOf(w)));
  const waterPolys = ways.filter((w) => /water_hazard/.test(w.tags.golf ?? "")).map((w) => polyInfo(ptsOf(w)));

  // Order holes by ref number when present, else by appearance.
  holeWays.sort((a, b) => (Number(a.tags.ref) || 1e9) - (Number(b.tags.ref) || 1e9));
  // A search may sit on a multi-course complex: keep the first hole per number so
  // we return a single 18 (or 9), not every course in the area stitched together.
  const seen = new Set<string>();
  const chosen = holeWays.filter((h) => {
    const ref = h.tags.ref;
    if (!ref) return true;
    if (seen.has(ref)) return false;
    seen.add(ref); return true;
  }).slice(0, 18);

  // Lay out each hole in a tee→pin frame and record its global centreline for hazard matching.
  const built = chosen.map((h, i) => {
    let line = h.line;
    const tee = line[0], end = line[line.length - 1];
    // Pick the green nearest either endpoint; orient the hole so it sits at the pin.
    let green: { c: Vec; area: number } | null = null, gd = Infinity;
    for (const g of greens) {
      const d = Math.min(len(subv(g.c, tee)), len(subv(g.c, end)));
      if (d < gd && d < 80) { gd = d; green = g; }
    }
    if (green && len(subv(green.c, tee)) < len(subv(green.c, end))) line = [...line].reverse();
    const T = line[0];
    const pin = green ? green.c : line[line.length - 1];
    const yAxis = (() => { const d = subv(pin, T); const l = len(d) || 1; return { x: d.x / l, y: d.y / l }; })();
    const xAxis: Vec = { x: yAxis.y, y: -yAxis.x };
    const local = (p: Vec): Vec => ({ x: dotv(subv(p, T), xAxis), y: dotv(subv(p, T), yAxis) });

    const centerline = line.map(local);
    centerline[centerline.length - 1] = local(pin); // end exactly on the pin
    const length = centerline[centerline.length - 1].y;
    const par = clamp(Number(h.tags.par) || (length > 380 ? 5 : length > 230 ? 4 : 3), 3, 6);
    const greenRadius = green && green.area > 0 ? clamp(Math.sqrt(green.area / Math.PI), 6, 18) : par === 3 ? 10 : 11;
    const fairwayHalf = par === 3 ? 16 : 18;
    const hole: Hole = {
      number: i + 1, par, name: h.tags.name || undefined,
      fairwayHalf, greenRadius, obHalf: fairwayHalf + 25,
      centerline, hazards: [], wind: { wx: 0, wy: 0 },
    };
    return { hole, T, xAxis, yAxis, globalLine: line };
  });

  // Attach each bunker / water hazard to the nearest hole (within 60 m of its line).
  const addHazard = (poly: { c: Vec; area: number }, type: Hazard["type"]) => {
    let best = -1, bd = 60;
    built.forEach((b, idx) => { const d = distToLine(poly.c, b.globalLine); if (d < bd) { bd = d; best = idx; } });
    if (best < 0) return;
    const b = built[best];
    const c = poly.c;
    b.hole.hazards.push({
      type,
      cx: dotv(subv(c, b.T), b.xAxis),
      cy: dotv(subv(c, b.T), b.yAxis),
      r: clamp(poly.area > 0 ? Math.sqrt(poly.area / Math.PI) : 6, 4, 22),
    });
  };
  sandPolys.forEach((p) => addHazard(p, "sand"));
  waterPolys.forEach((p) => addHazard(p, "water"));

  return { label: place.name, loc: "OpenStreetMap", holes: built.map((b) => b.hole) };
}
