# FlightLab — Garmin R10 Golf Trainer

A web golf-training app built around the **Garmin Approach R10**. It captures shots
over Bluetooth, computes ball flight with ballistic models, tracks your progress and
offers guided drills — all stored locally, no cloud, no account.

> ### 🛠️ A mostly vibe-coded app
> Treat it as a **starting point** to fork and
> build on for your own practice

> **Browser required: desktop Chrome or Edge** (or Chrome on Android).
> The Bluetooth connection relies on the Web Bluetooth API, which Safari/iOS/Firefox don't support.
> Everything except the live R10 link works anywhere via the built-in **Simulator**.

---

## Screenshots

| Session — live shot + 3D ball flight | Course — play simulated rounds |
| :---: | :---: |
| ![Session tab](docs/screenshots/session.png) | ![Course tab](docs/screenshots/course.png) |
| **Stats — per-club gapping & consistency** | **Compare — radar charts across players** |
| ![Stats tab](docs/screenshots/stats.png) | ![Compare tab](docs/screenshots/compare.png) |
| **Bullseye — shot pattern vs your average** | **Dispersion — top-down, % corridors** |
| ![Bullseye by club](docs/screenshots/bullseye.png) | ![Dispersion pattern](docs/screenshots/dispersion.png) |

<p align="center">
  <img src="docs/screenshots/history-expanded.png" alt="History — a session expanded into its shot table" width="70%">
  <br><em>History — every session, filterable by club and sortable by carry / speed / smash; each expands into its full per-shot table.</em>
</p>

---

## Prerequisites

- **Node.js ≥ 22.6** and **npm** — the API uses the built-in `node:sqlite` module, so a
  recent Node is required (**Node 23+ recommended**; developed on Node 25). Check with `node -v`.
- A **Chromium browser** for the live R10 link: desktop **Chrome or Edge** (or Chrome on
  Android), because the connection uses the **Web Bluetooth API**. Everything else (Simulator,
  stats, courses…) runs in any modern browser.
- **git** to clone the repository.
- *For the live launch monitor only:* a **Garmin Approach R10** and a real ball.

---

## Run it on your computer

```bash
git clone https://github.com/jovincent/golf-trainer.git
cd golf-trainer
npm install        # installs front-end + server deps
npm run dev        # starts the API (port 4141) + the Vite front end (port 4040)
```

Then open **http://localhost:4040** in Chrome or Edge. The first launch creates the local
SQLite database automatically — no other setup needed.

No launch monitor? Pick the **Simulator** source, click **Connect** and hit balls —
everything works with realistic simulated data. To use a real R10, see
[*How the Garmin R10 connection works*](#how-the-garmin-r10-connection-works-bluetooth--protobuf) below.

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
└── server/
    ├── index.js              # Express API (port 4141) + Open Graph share images
    ├── og.js                 # Dynamic OG card (PNG) generator
    ├── db.js                 # SQLite access (WAL mode)
    └── data/
        └── fairway.db        # Local SQLite database (git-ignored)
```

---

## Stack

| Layer | Technology |
|---|---|
| Front end | React 18 · TypeScript 5 · Vite 5 |
| Style | Tailwind CSS 3 · CSS custom properties |
| Backend | Express 4 (Node.js ESM) |
| Database | SQLite via native `node:sqlite` (WAL mode) |
| Bluetooth | Web Bluetooth API (Chrome/Edge only) |

---

## Flight models — how the trajectory is computed

The R10 measures **launch conditions** (ball speed, launch angle & direction, spin rate and
spin axis) but **not distance**. The app derives carry / total / apex / offline by integrating
the ball's flight from those launch conditions in [`src/lib/flight.ts`](src/lib/flight.ts).

### The physics

Each shot is a projectile under three forces — gravity, aerodynamic **drag**, and the
**Magnus lift** generated by backspin:

$$
m\,\frac{d\mathbf{v}}{dt}=
\underbrace{m\,\mathbf{g}}_{\text{gravity}}
\;-\;
\underbrace{\tfrac{1}{2}\rho A\,C_d\,\lvert\mathbf{v}\rvert\,\mathbf{v}}_{\text{drag}\;(\propto v^2,\ \text{along }-\mathbf{v})}
\;+\;
\underbrace{\tfrac{1}{2}\rho A\,C_l\,\lvert\mathbf{v}\rvert^2\,(\hat{\boldsymbol{\omega}}\times\hat{\mathbf{v}})}_{\text{Magnus lift}\;(\perp\,\mathbf{v})}
$$

with golf-ball constants: mass $m = 0.0459\ \text{kg}$, radius $R = 0.02134\ \text{m}$, frontal
area $A = \pi R^2$, air density $\rho = 1.225\ \text{kg/m}^3$, gravity $g = 9.81\ \text{m/s}^2$.
The launch state turns ball speed + launch angle/direction into the initial velocity
$\mathbf{v}$, and the spin (split into back/side from the spin axis) into the angular-velocity
vector $\boldsymbol{\omega}$.

At each step the aerodynamic coefficients depend on the **spin ratio**
$S = \lvert\boldsymbol{\omega}\rvert\,R / \lvert\mathbf{v}\rvert$:

$$
C_l = \min(0.26,\ 2.4\,S)
\qquad
C_d = 0.10 + 2.0\,C_l^2
$$

(the lift coefficient $C_l$ rises with spin then saturates; the drag coefficient $C_d$ grows
with lift — "induced" drag.)

So a high-spin wedge gets more lift (higher, steeper) and more drag (shorter) than a
low-spin driver. The ODE is integrated with a fixed **2 ms forward-Euler** step until the
ball returns to the ground → **carry** distance and lateral **deviation**; the peak height is
the **apex**. **Roll** is then added from the landing (descent) angle — a steeper descent
rolls less, capped at +25 % — to give **total**.

### The two models

| Display | Internal | Integrator | Aero | Calibration | RMSE vs Garmin |
|---|---|---|---|---|---|
| **Realistic 🎯** *(default)* | `truth` | forward Euler, 2 ms | induced drag $C_d = 0.10 + 2\,C_l^2$ | every result $\times\,0.926$ **plus a per-club trim**, fitted to **real measured Garmin R10 carries** | ≈ 1.95 m |
| **Theoretical** | `physics` | Runge-Kutta 4 | fixed $C_d \approx 0.225$, $C_l = \min(0.32,\,1.5\,S)$ | none (textbook constants) | variable |

**Realistic** is the default — its distances match a real range. Its per-club trim is scaled
$\times\,(0.9 / 0.926)$ so relative club gapping stays intact. **Theoretical** runs the same forces
with a higher-order integrator and pure wind-tunnel constants (no empirical tuning): a useful
reference, but less faithful to real carries.

Switch models from the dropdown in the connection bar — only the **raw launch metrics** are
stored, so `recomputeAll()` re-derives every existing shot's distances on the fly.

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

## Add your own courses

Courses are plain TypeScript data files in [`src/lib/courses/`](src/lib/courses/) — no
in-app downloader, you add them yourself. Each file exports a `Hole[]` array; a course is a
list of holes described in a **local metric frame** where the tee sits at the origin,
`y` points toward the pin and `x` is lateral (`+x` = right). Distances are in metres.

```ts
// src/lib/courses/myCourse.ts
import type { Hole } from "../course";

export const MY_COURSE: Hole[] = [
  {
    number: 1,
    par: 4,
    name: "",              // optional hole name
    fairwayHalf: 16,       // half-width of the fairway corridor (m)
    greenRadius: 8,        // green radius (m)
    obHalf: 41,            // beyond this lateral distance = out of bounds (m)
    centerline: [          // tee … pin, ≥2 points; add bends for doglegs
      { x: 0, y: 0 },
      { x: 0, y: 340 },
    ],
    hazards: [             // bunkers / water, positioned in the same frame
      { type: "sand",  cx: 8, cy: 250, r: 5 },
      { type: "water", cx: -12, cy: 300, r: 14 },
    ],
    wind: { wx: 0, wy: 0 },
  },
  // … one object per hole
];
```

**Where to find the geometry.** The bundled courses were traced from **OpenStreetMap**
(© OpenStreetMap contributors, ODbL):

1. Find the course on [openstreetmap.org](https://www.openstreetmap.org) and note the
   `golf=hole` ways, or query the **Overpass API**
   ([overpass-turbo.eu](https://overpass-turbo.eu)) for `golf=hole`, `golf=green`,
   `golf=bunker` and `natural=water` around the course.
2. Take each hole's centreline (tee → green) and read off the lat/lon points.
3. Project them to the local metre frame: pick the tee as origin, rotate so the green is
   straight ahead (`+y`), convert degrees to metres (≈ `111 320 m` per degree of latitude,
   `× cos(lat)` for longitude). Attach bunkers/water as `{cx, cy, r}` in the same frame.

You don't have to be exact — eyeballed coordinates play fine. The `Hole` type lives in
[`src/lib/course.ts`](src/lib/course.ts) if you want every field.

**Register it.** Import the file in [`src/pages/Course.tsx`](src/pages/Course.tsx) and add
one entry to `COURSE_LIST`:

```ts
import { MY_COURSE } from "../lib/courses/myCourse";

const COURSE_LIST: CourseDef[] = [
  { id: "my-course", label: "My Course", loc: "Town, Country", group: "Others", holes: MY_COURSE },
  // …
];
```

It then shows up in the course carousel and search. Optionally add a hero photo in
`src/lib/courses/coursePhotos.ts` (it falls back to a generic golf photo otherwise).

---

## How the Garmin R10 connection works (Bluetooth + protobuf)

The R10 speaks a **framed protobuf** protocol over Bluetooth Low Energy. Garmin doesn't
publish it; the adapter in [`src/adapters/garminR10.ts`](src/adapters/garminR10.ts) is ported
from the open-source **gsp-r10-adapter** reference and runs entirely in the browser via the
**Web Bluetooth API** (so Chrome/Edge only — Safari/iOS/Firefox have no Web Bluetooth).

**1 · Connect & discover.** `navigator.bluetooth.requestDevice` filters on the name prefixes
`Approach` / `R10`. On the GATT server the adapter uses:
- a **device-interface** service (`6a4e2800-…`) exposing a *writer* and a *notifier*
  characteristic — this is the protobuf channel;
- the **measurement** service (`6a4e3400-…`) and the standard **Battery** service.

**2 · Framing (COBS + CRC16).** Each message is wrapped as `[length][payload][CRC16]`, then
**COBS**-encoded (consistent-overhead byte-stuffing, zero-delimited) and split into ≤19-byte
BLE writes, each prefixed with a per-session header byte. Incoming notifications are
reassembled, CRC-checked and COBS-decoded. See [`r10/cobs.ts`](src/adapters/r10/cobs.ts),
[`r10/crc16.ts`](src/adapters/r10/crc16.ts) and [`r10/proto.ts`](src/adapters/r10/proto.ts)
(the hand-written protobuf wrapper encoder/decoder).

**3 · Handshake.** A fixed init sequence is exchanged to open the session and capture the
header byte used for every later frame.

**4 · Session setup.** Once connected the app sends protobuf requests: `wake_up`, `status`,
`subscribe` to launch-monitor **alerts** (type 8), `shot_config` (temperature, humidity, air
density and the **R10 → ball distance / tee range**), then `start_tilt_cal`. The R10 must sit
**level**: a `PLATFORM_TILTED` error blocks ball computation, so the app auto-recalibrates and
shows a live tilt indicator.

**5 · A shot arrives.** Each ball is delivered as an `AlertNotification` protobuf with:
- `ball_metrics` — ball speed (m/s), launch angle, launch direction, total spin, spin axis;
- `club_metrics` — club-head speed, attack angle, club face & path angles.

The adapter converts speeds to km/h (× 3.6), splits total spin into **backspin / sidespin**
using the spin axis (`back = spin·cos(axis)`, `side = spin·sin(axis)`), computes
`smash = ball ÷ club speed`, and — because the **R10 transmits no distance** — calls the flight
model (`ballFlight(...)`, see above) to obtain carry / total / apex / offline before emitting
the shot to the app.

Open the **R10 diagnostics** panel in the app to watch the raw BLE/protobuf stream live
(service UUIDs, frames, decoded metrics) while connecting and hitting balls. The protocol is
reverse-engineered, so a firmware change may need tweaks in `handleProto()`.

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

> Ports are fixed: front end **4040**, API **4141** (`vite.config.ts`, `server/index.js`).
> `recomputeAll()` in the store re-derives every shot's distances when the flight model changes.
