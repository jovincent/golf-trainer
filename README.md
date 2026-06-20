# FlightLab — Garmin R10 Golf Trainer

A web golf-training app built around the **Garmin Approach R10**. It captures shots
over Bluetooth, computes ball flight with ballistic models, tracks your progress and
offers guided drills — all stored locally, no cloud, no account.

> ### 🛠️ A fully vibe-coded app
> This is a **fully vibe-coded** project — built end to end by chatting with an AI,
> not by a studio or a polished product team. It's shared in the hope it helps
> **fellow golfers take a different approach to their training**: visualize dispersion,
> understand club gapping, run a standardized test, and actually *see* progress over time.
>
> Treat it as a **basic starting point** — a foundation to fork, tweak and build on for
> your own practice, not a finished commercial product. If it sparks ideas for how you
> train, it's done its job. No warranty, no support — just a useful base to start from. ⛳

> **Browser required: desktop Chrome or Edge** (or Chrome on Android).
> The Bluetooth connection relies on the Web Bluetooth API, which Safari/iOS/Firefox don't support.
> Everything except the live R10 link works anywhere via the built-in **Simulator**.

---

## Quick start

```bash
npm install
npm run dev        # Starts the API (port 4141) + the Vite front end (port 4040)
```

Open **http://localhost:4040** in Chrome or Edge.

No launch monitor? Pick the **Simulator** source, click **Connect** and hit balls —
everything works with realistic simulated data.

### Available commands

| Command | Role |
|---|---|
| `npm run dev` | API + Vite in parallel **(main command)** |
| `npm run server` | Express API only (port 4141) |
| `npm run web` | Vite only — ⚠️ **without the API, profiles won't load** |
| `npm run build` | Production build |
| `npm run preview` | Preview the build |

> **Important:** always use `npm run dev`. `npm run web` doesn't start the Express API —
> player profiles won't appear and nothing is persisted.

---

## Architecture

```
Golf-Trainer/
├── src/
│   ├── adapters/
│   │   ├── garminR10.ts      # Bluetooth BLE — Garmin Approach R10
│   │   └── simulator.ts      # Realistic shot generator (no hardware)
│   ├── components/
│   │   └── ConnectionBar.tsx # Connection bar + flight-model selector + sound
│   ├── lib/
│   │   ├── api.ts            # HTTP client → Express API (profiles + sessions)
│   │   ├── export.ts         # CSV export
│   │   ├── flight.ts         # Ball-flight models (Realistic / Theoretical)
│   │   ├── sounds.ts         # Feedback sounds (success, error)
│   │   └── stats.ts          # Statistics (mean, stdDev, percentile…)
│   ├── pages/
│   │   ├── LiveSession.tsx   # Live session
│   │   ├── Stats.tsx         # Stats & dispersion pattern
│   │   ├── Practice.tsx      # Guided drills
│   │   ├── Combine.tsx       # Standardized skill test (Combine)
│   │   ├── History.tsx       # Session history (filter & sort by club / metric)
│   │   ├── Compare.tsx       # Cross-profile comparison
│   │   ├── Course.tsx        # Course simulation
│   │   └── Junior.tsx        # Simplified kids mode ⭐
│   ├── store.ts              # Global Zustand state
│   ├── types.ts              # TypeScript types (Shot, Session, Club…)
│   └── App.tsx               # Navigation + profile selector
├── server/
│   ├── index.js              # Express API (port 4141) + Open Graph share images
│   ├── og.js                 # Dynamic OG card (PNG) generator
│   ├── db.js                 # SQLite access (WAL mode)
│   └── data/
│       └── fairway.db        # Local SQLite database (git-ignored)
└── .claude/
    └── launch.json           # Claude Code preview config (npm run dev)
```

---

## Stack

| Layer | Technology |
|---|---|
| Front end | React 18 · TypeScript 5 · Vite 5 |
| Style | Tailwind CSS 3 · CSS custom properties |
| Global state | Zustand |
| Charts | Recharts |
| Icons | lucide-react |
| Backend | Express 4 (Node.js ESM) |
| Database | SQLite via native `node:sqlite` (WAL mode) |
| Share images | `@resvg/resvg-js` (server-rendered OG PNGs) |
| Bluetooth | Web Bluetooth API (Chrome/Edge only) |

---

## Flight models

Switchable in real time from the dropdown in the connection bar. Every existing shot is
recomputed on the fly when you change the model. Two models, named to be self-explanatory:

| Display | Internal | Algorithm | Calibration | RMSE vs Garmin |
|---|---|---|---|---|
| **Realistic 🎯** | `truth` | Euler + drag/lift/spin | GLOBAL=0.926 + per-club trim, tuned on real measured Garmin R10 carries | ≈ 1.95 m |
| **Theoretical** | `physics` | Runge-Kutta 4, full aero | None (pure physics constants) | Variable |

**Realistic** is the default: its distances match what you'd see on a range. The per-club
trim is scaled `× (0.9 / 0.926)` to preserve relative club gapping (Hy=1.0, absorbed into
GLOBAL). **Theoretical** applies pure physics with no empirical tuning — useful as a
reference, but less faithful to real-world carries.

---

## Local persistence — SQLite

All data is stored in `server/data/fairway.db`, created automatically on first launch.
**No data leaves the machine.** Shots are written **ball by ball** (not at session end), so
nothing is lost if you close the browser mid-session.

### REST API (port 4141)

```
# Player profiles
GET    /api/profiles                 list profiles
POST   /api/profiles                 create a profile  { name }
PATCH  /api/profiles/:id             rename            { name }
DELETE /api/profiles/:id             delete

# Sessions & shots
GET    /api/sessions?profileId=...   profile sessions
POST   /api/sessions                 create a session
POST   /api/sessions/bulk            bulk import
POST   /api/sessions/:id/shots       append a shot
PATCH  /api/sessions/:id             update (endedAt…)
DELETE /api/sessions/:id             delete a session

# Combines, rounds & public shares (Open Graph images)
GET/POST/DELETE /api/combines        standardized-test results
GET/POST/DELETE /api/rounds          course scorecards
POST   /api/shares                   create a public share snapshot
GET    /api/shares/:token            read a share
GET    /api/shares/:token/og.png     dynamic 1200×630 share image
GET    /s/:token                     public share page (crawler-friendly OG meta)
```

---

## Features by tab

- **Session** — shot-by-shot metrics: carry, ball/club speed, smash factor, spin, apex,
  offline. Cumulative shot table. Auto-saved ball by ball.
- **Course** — play simulated rounds on iconic and regional courses, with scoring, a hole
  map, and a saved scorecard you can share.
- **Practice** — targeted drills (accuracy corridor + distance control) scored live,
  plus a closest-to-pin challenge.
- **Combine** — a standardized 30-ball skill test (9 fixed distances + driver), each ball
  scored 0–100, comparable between players and across time.
- **Stats** — dispersion pattern, per-club gapping, consistency (carry & lateral σ),
  bullseye, with CSV and share-card export.
- **History** — every session for the active profile. Filter by club and sort by date,
  carry, ball/club speed or smash — filtering flattens to a single ranked shot list.
- **Compare** — cross-profile comparison with radar (spider) charts per metric.
- **Junior ⭐** — a simplified, kid-friendly mode with star ratings and a session record.

Each round / session / Combine / stats view can be **shared** as a branded card via a
public link with a rich Open Graph preview (renders nicely in WhatsApp / iMessage), or
downloaded.

---

## Player profiles

The profile selector (user icon, top right) creates, renames and deletes profiles. Each
profile keeps its own isolated session history.

> If the selector doesn't appear, the Express API isn't running.
> Fix: `npm run dev` (not `npm run web`).

---

## Garmin R10 adapter — BLE notes

Garmin doesn't publish the R10 Bluetooth protocol. The parsing in
`src/adapters/garminR10.ts` is based on reverse engineering and may need calibration on
the physical device. The **R10 diagnostics** panel in the app shows all BLE messages in
real time (service UUIDs, characteristics, raw data) — open it while connecting and hitting
balls to inspect the stream.

---

## Development

```bash
# Type-check
npx tsc --noEmit

# Inspect the database
sqlite3 server/data/fairway.db ".tables"
sqlite3 server/data/fairway.db "SELECT name FROM profiles;"

# Import a Garmin "DrivingRange" CSV export into a profile (computes distances)
node scripts/importGarmin.mjs            # dry-run
node scripts/importGarmin.mjs --commit   # save

# Validate the flight model against measured carries (if the export has them)
node scripts/validateModel.mjs path/to/export.csv
```

> Ports are fixed: front end **4040**, API **4141** (`vite.config.ts`, `server/index.js`,
> `.claude/launch.json`). `recomputeAll()` in the store re-derives every shot's distances
> when the flight model changes.
