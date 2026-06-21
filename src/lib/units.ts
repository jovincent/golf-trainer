// Display units. All shot data is stored in metric (metres, km/h); these helpers
// convert at render time only — nothing in the DB or the flight model changes.
// The active unit lives in the Zustand store (persisted), see useUnits().

export type Units = "metric" | "imperial";
export const UNITS_KEY = "fairway-lab/units";

const M_TO_YD = 1.09361;     // metres → yards
const KMH_TO_MPH = 0.621371; // km/h → mph

// Default is imperial (yards / mph); only an explicit "metric" choice opts out.
export function readStoredUnits(): Units {
  try { return localStorage.getItem(UNITS_KEY) === "metric" ? "metric" : "imperial"; }
  catch { return "imperial"; }
}

export const distUnit  = (u: Units) => (u === "imperial" ? "yd" : "m");
export const speedUnit = (u: Units) => (u === "imperial" ? "mph" : "km/h");

/** Convert a metric distance (m) to the active unit's numeric value. */
export const toDist  = (m: number,   u: Units) => (u === "imperial" ? m * M_TO_YD : m);
/** Convert a metric speed (km/h) to the active unit's numeric value. */
export const toSpeed = (kmh: number, u: Units) => (u === "imperial" ? kmh * KMH_TO_MPH : kmh);

/** "168 m" / "184 yd". */
export const fmtDist  = (m: number,   u: Units, dp = 0) => `${toDist(m, u).toFixed(dp)} ${distUnit(u)}`;
/** "182 km/h" / "113 mph". */
export const fmtSpeed = (kmh: number, u: Units, dp = 0) => `${toSpeed(kmh, u).toFixed(dp)} ${speedUnit(u)}`;
