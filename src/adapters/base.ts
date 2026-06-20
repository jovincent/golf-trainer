import type { AdapterState, Shot } from "../types";

type ShotCb = (shot: Omit<Shot, "club">) => void;
type StateCb = (s: AdapterState) => void;

/** Shared emitter plumbing for adapters. */
export class AdapterEmitter {
  private shotCbs = new Set<ShotCb>();
  private stateCbs = new Set<StateCb>();
  protected state: AdapterState = { status: "disconnected" };

  onShot(cb: ShotCb) {
    this.shotCbs.add(cb);
    return () => this.shotCbs.delete(cb);
  }
  onState(cb: StateCb) {
    this.stateCbs.add(cb);
    return () => this.stateCbs.delete(cb);
  }
  getState() {
    return this.state;
  }
  protected emitShot(shot: Omit<Shot, "club">) {
    this.shotCbs.forEach((cb) => cb(shot));
  }
  protected setState(patch: Partial<AdapterState>) {
    this.state = { ...this.state, ...patch };
    this.stateCbs.forEach((cb) => cb(this.state));
  }
}

let counter = 0;
/** Monotonic id without Date.now()/Math.random() coupling for testability. */
export function shotId() {
  counter += 1;
  return `shot_${counter}_${performance.now().toFixed(0)}`;
}
