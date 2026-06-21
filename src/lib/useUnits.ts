// React hook bound to the active display unit. Components call useUnits() and use
// the returned converters/formatters so distances & speeds follow the global toggle.
import { useStore } from "../store";
import { distUnit, speedUnit, toDist, toSpeed, fmtDist, fmtSpeed } from "./units";

export function useUnits() {
  const u = useStore((s) => s.units);
  return {
    units: u,
    distUnit: distUnit(u),
    speedUnit: speedUnit(u),
    /** numeric distance string in the active unit (no label). */
    d: (m: number, dp = 0) => toDist(m, u).toFixed(dp),
    /** numeric speed string in the active unit (no label). */
    s: (kmh: number, dp = 0) => toSpeed(kmh, u).toFixed(dp),
    /** raw converted distance value (for charts / maths). */
    dv: (m: number) => toDist(m, u),
    /** distance with label, e.g. "168 m" / "184 yd". */
    fd: (m: number, dp = 0) => fmtDist(m, u, dp),
    /** speed with label, e.g. "182 km/h" / "113 mph". */
    fs: (kmh: number, dp = 0) => fmtSpeed(kmh, u, dp),
  };
}
