// ---- Domain model -----------------------------------------------------------

/** Clubs, ordered long → short, for gapping. */
export const CLUBS = [
  "Dr", "3W", "5W", "Hy", "3i", "4i", "5i", "6i", "7i", "8i", "9i",
  "PW", "GW", "SW", "LW",
] as const;
export type Club = (typeof CLUBS)[number];

export const CLUB_LABELS: Record<Club, string> = {
  Dr: "Driver", "3W": "3 Wood", "5W": "5 Wood", Hy: "Hybrid",
  "3i": "3 Iron", "4i": "4 Iron", "5i": "5 Iron", "6i": "6 Iron", "7i": "7 Iron",
  "8i": "8 Iron", "9i": "9 Iron", PW: "Pitching wedge", GW: "Gap wedge", SW: "Sand wedge", LW: "Lob wedge",
};

/**
 * A single shot. Distances in metres, speeds in km/h, angles in degrees,
 * spin in rpm. All raw metrics the R10 reports plus a few derived ones.
 */
export interface Shot {
  id: string;
  ts: number;            // epoch ms
  club: Club;
  ballSpeed: number;     // km/h
  clubSpeed: number;     // km/h
  smashFactor: number;   // ballSpeed / clubSpeed
  launchAngle: number;   // deg (vertical)
  launchDir: number;     // deg (horizontal, + = right)
  attackAngle: number;   // deg (+ = up, − = down/descending)
  clubPath: number;      // deg (+ = in-to-out / right, − = out-to-in / left)
  clubFace: number;      // deg face angle to target (+ = open/right)
  faceToPath: number;    // deg (clubFace − clubPath; drives curve)
  backSpin: number;      // rpm
  sideSpin: number;      // rpm (+ = right / fade)
  spinAxis: number;      // deg (+ = right tilt)
  carry: number;         // m
  total: number;         // m
  apex: number;          // m peak height
  offlineM: number;      // m left(-)/right(+) of target line at landing (total deviation)
  carryDeviation: number;// m left(-)/right(+) at the carry landing point
  sim?: boolean;         // produced by the simulator
}

export interface Session {
  id: string;
  startedAt: number;
  endedAt?: number;
  label: string;
  shots: Shot[];
}

// ---- Launch-monitor adapter contract ----------------------------------------

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface AdapterState {
  status: ConnectionStatus;
  deviceName?: string;
  error?: string;
}

/**
 * The single contract every launch-monitor source implements. The whole app
 * talks to this — never to Bluetooth directly — so the simulator and the real
 * Garmin R10 are fully interchangeable.
 */
export interface LaunchMonitorAdapter {
  readonly id: string;
  readonly displayName: string;
  /** True only in environments that can actually use this adapter. */
  isSupported(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Subscribe to incoming shots. Returns an unsubscribe fn. */
  onShot(cb: (shot: Omit<Shot, "club">) => void): () => void;
  /** Subscribe to connection-state changes. Returns an unsubscribe fn. */
  onState(cb: (s: AdapterState) => void): () => void;
  getState(): AdapterState;
}
