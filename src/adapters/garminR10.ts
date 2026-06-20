import type { LaunchMonitorAdapter } from "../types";
import { AdapterEmitter, shotId } from "./base";
import { cobsEncode, cobsDecode } from "./r10/cobs";
import { crc16 } from "./r10/crc16";
import { encodeWrapper, decodeWrapper } from "./r10/proto";
import { ballFlight } from "../lib/flight";
import { playError } from "../lib/sounds";

/**
 * Garmin Approach R10 — Web Bluetooth adapter.
 *
 * Implements Garmin's framed protobuf protocol (ported from the open-source
 * gsp-r10-adapter reference): COBS + CRC16 framing over the device-interface
 * service, a handshake, then protobuf requests/notifications. Shot metrics
 * arrive as AlertNotification protobufs; carry/total are estimated with a
 * ball-flight model (the R10 doesn't transmit distances).
 *
 * Requires Chrome/Edge desktop or Chrome Android (not Safari/iOS).
 */

const SVC_MEASUREMENT = "6a4e3400-667b-11e3-949a-0800200c9a66";
const CH_MEAS = "6a4e3401-667b-11e3-949a-0800200c9a66";
const CH_CTRL = "6a4e3402-667b-11e3-949a-0800200c9a66";
const CH_STATUS = "6a4e3403-667b-11e3-949a-0800200c9a66";
const SVC_INTERFACE = "6a4e2800-667b-11e3-949a-0800200c9a66";
const CH_NOTIFIER = "6a4e2812-667b-11e3-949a-0800200c9a66";
const CH_WRITER = "6a4e2822-667b-11e3-949a-0800200c9a66";
const SVC_BATTERY = "battery_service";
const CH_BATTERY = "battery_level";
const SVC_DEVINFO = "device_information";

const MS_TO_KMH = 3.6; // R10 reports speeds in m/s
const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => Uint8Array.from(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));
const i32le = (n: number) => Uint8Array.from([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const concat = (...a: Uint8Array[]) => { const t = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { t.set(x, o); o += x.length; } return t; };

export interface R10Tilt { roll: number; pitch: number; level: boolean }
const TEE_RANGE_KEY = "fairway-lab/r10-tee-range";
const ROLL_LIMIT = 4; // deg of side-to-side roll tolerated before "tilted"

export class GarminR10Adapter extends AdapterEmitter implements LaunchMonitorAdapter {
  readonly id = "garmin-r10";
  readonly displayName = "Garmin Approach R10";

  private teeRange = 2.13; // m, R10 → ball (≈ 7 ft)
  private tilt: { roll: number; pitch: number } | null = null;
  private tiltError = false;
  private tiltTimer?: number;
  private tiltCbs = new Set<(t: R10Tilt) => void>();
  private protoBusy = false;
  private battery: number | null = null;
  private battCbs = new Set<(b: number | null) => void>();

  constructor() {
    super();
    try { const v = localStorage.getItem(TEE_RANGE_KEY); if (v) this.teeRange = parseFloat(v); } catch { /* ignore */ }
  }

  // ---- tilt + tee-range API (for the UI) ----
  onTilt(cb: (t: R10Tilt) => void) { this.tiltCbs.add(cb); return () => { this.tiltCbs.delete(cb); }; }
  getTilt(): R10Tilt | null {
    if (this.tilt) return { ...this.tilt, level: this.isLevel() };
    return this.tiltError ? { roll: 0, pitch: 0, level: false } : null;
  }
  private isLevel() { return !this.tiltError && (this.tilt ? Math.abs(this.tilt.roll) <= ROLL_LIMIT : true); }
  private emitTilt() { const t = this.getTilt(); if (t) this.tiltCbs.forEach((c) => c(t)); }
  onBattery(cb: (b: number | null) => void) { this.battCbs.add(cb); return () => { this.battCbs.delete(cb); }; }
  getBattery() { return this.battery; }
  private emitBattery() { this.battCbs.forEach((c) => c(this.battery)); }
  getTeeRange() { return this.teeRange; }
  setTeeRange(m: number) {
    this.teeRange = m;
    try { localStorage.setItem(TEE_RANGE_KEY, String(m)); } catch { /* ignore */ }
    if (this.handshakeComplete) {
      this.sendProto({ service: { shot_config_request: { temperature: 20, humidity: 0.5, altitude: 0, air_density: 1.225, tee_range: m } } });
      this.log(`Distance R10 → balle réglée à ${(m * 100).toFixed(0)} cm`);
    }
  }

  private device?: BluetoothDevice;
  private writer?: BluetoothRemoteGATTCharacteristic;
  private header = 0;
  private handshakeComplete = false;
  private handshakeResolve?: (ok: boolean) => void;
  private protoCounter = 0;
  private protoResolve?: (m: unknown) => void;
  private current: number[] = [];
  private seenShots = new Set<number>();
  private writeQ: Promise<unknown> = Promise.resolve();
  private tiltCalSent = false;
  private lastState = -1;

  // ---- debug log (surfaced in the UI) ----
  private debugCbs = new Set<(line: string) => void>();
  private debugBuf: string[] = [];
  onDebug(cb: (line: string) => void) { this.debugCbs.add(cb); return () => { this.debugCbs.delete(cb); }; }
  getDebug() { return this.debugBuf; }
  private log(line: string) {
    this.debugBuf.push(line);
    if (this.debugBuf.length > 200) this.debugBuf.shift();
    this.debugCbs.forEach((c) => c(line));
    // eslint-disable-next-line no-console
    console.log("[R10]", line);
  }

  isSupported() { return typeof navigator !== "undefined" && !!navigator.bluetooth; }

  async connect() {
    if (!this.isSupported()) {
      this.setState({ status: "error", error: "Web Bluetooth indisponible. Utilise Chrome/Edge sur ordinateur." });
      return;
    }
    try {
      this.setState({ status: "connecting", error: undefined });
      this.log("Sélection de l'appareil…");
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "Approach" }, { namePrefix: "R10" }],
        optionalServices: [SVC_MEASUREMENT, SVC_INTERFACE, SVC_BATTERY, SVC_DEVINFO],
      });
      this.device.addEventListener("gattserverdisconnected", () => {
        this.log("Déconnecté.");
        this.setState({ status: "disconnected" });
      });
      const server = await this.device.gatt!.connect();
      this.log(`Connecté à ${this.device.name}. Découverte des services…`);

      // Battery level (standard Battery Service).
      try {
        const batt = await server.getPrimaryService(SVC_BATTERY);
        const bc = await batt.getCharacteristic(CH_BATTERY);
        const v = await bc.readValue();
        this.battery = v.getUint8(0); this.emitBattery();
        this.log(`Batterie R10 : ${this.battery}%`);
        await bc.startNotifications();
        bc.addEventListener("characteristicvaluechanged", (e) => {
          this.battery = (e.target as BluetoothRemoteGATTCharacteristic).value!.getUint8(0);
          this.emitBattery();
        });
      } catch (e) { this.log("Batterie indisponible: " + (e as Error).message); }

      // Measurement service — subscribe (listeners are diagnostic only).
      try {
        const meas = await server.getPrimaryService(SVC_MEASUREMENT);
        for (const u of [CH_MEAS, CH_CTRL, CH_STATUS]) {
          const c = await meas.getCharacteristic(u);
          await c.startNotifications();
          c.addEventListener("characteristicvaluechanged", () => {});
        }
        this.log("Service mesure abonné.");
      } catch (e) { this.log("Service mesure absent: " + (e as Error).message); }

      // Device-interface service — the protobuf channel.
      const iface = await server.getPrimaryService(SVC_INTERFACE);
      this.writer = await iface.getCharacteristic(CH_WRITER);
      const notifier = await iface.getCharacteristic(CH_NOTIFIER);
      await notifier.startNotifications();
      notifier.addEventListener("characteristicvaluechanged", (e) => {
        const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
        this.readBytes(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
      });
      this.log("Interface abonnée. Handshake…");

      const ok = await this.performHandshake();
      if (!ok) { this.setState({ status: "error", error: "Handshake R10 échoué (voir diagnostic)." }); this.log("❌ Handshake échoué."); return; }
      this.log("✅ Handshake OK.");

      this.setState({ status: "connected", deviceName: this.device.name ?? "Garmin R10" });

      // Wake, status, subscribe to launch-monitor alerts (shots).
      await this.sendProto({ service: { wake_up_request: {} } });
      this.log("Réveil envoyé.");
      await this.sendProto({ service: { status_request: {} } });
      await this.sendProto({ event: { subscribe_request: { alerts: [{ type: 8 }] } } });
      // Provide shot conditions — some firmwares need this to compute ball flight.
      await this.sendProto({ service: { shot_config_request: { temperature: 20, humidity: 0.5, altitude: 0, air_density: 1.225, tee_range: this.teeRange } } });
      // Tilt calibration — without it the R10 reports PLATFORM_TILTED and only
      // returns club data. The unit must be level and still during this.
      this.tiltCalSent = false;
      this.tiltError = false;
      this.tilt = null;
      this.log("⚙️ Calibration de l'inclinaison — pose le R10 à plat, immobile, face à la cible…");
      await this.sendProto({ service: { start_tilt_cal_request: {} } });
      this.log(`Prêt — frappe une balle (R10 à plat, ~${(this.teeRange * 100).toFixed(0)} cm derrière la balle).`);
      this.startTiltPoll();
    } catch (err) {
      this.log("Erreur: " + (err as Error).message);
      this.setState({ status: "error", error: (err as Error).message });
    }
  }

  async disconnect() {
    this.handshakeComplete = false;
    if (this.tiltTimer) { clearInterval(this.tiltTimer); this.tiltTimer = undefined; }
    this.battery = null; this.emitBattery();
    this.device?.gatt?.disconnect();
    this.device = undefined;
    this.writer = undefined;
    this.setState({ status: "disconnected", deviceName: undefined });
  }

  /** Poll device tilt periodically for the live level/tilt indicator. */
  private startTiltPoll() {
    if (this.tiltTimer) clearInterval(this.tiltTimer);
    this.tiltTimer = window.setInterval(async () => {
      if (!this.handshakeComplete || this.protoBusy) return;
      const r = (await this.sendProto({ service: { tilt_request: {} } })) as any;
      const t = r?.service?.tilt_response?.tilt;
      if (t) { this.tilt = { roll: t.roll ?? 0, pitch: t.pitch ?? 0 }; this.emitTilt(); }
    }, 1500);
  }

  // ---- low-level framing ----------------------------------------------------

  private write(bytes: Uint8Array) {
    this.writeQ = this.writeQ
      .then(() => this.writer?.writeValueWithResponse(bytes as unknown as BufferSource))
      .catch((e) => this.log("write err " + e));
    return this.writeQ;
  }

  private sendBytes(bytes: Uint8Array) {
    this.write(concat(Uint8Array.from([this.header]), bytes));
  }

  private writeMessage(bytes: Uint8Array) {
    const len = 2 + bytes.length + 2;
    const withLen = concat(Uint8Array.from([len & 0xff, (len >>> 8) & 0xff]), bytes);
    const frame = concat(withLen, crc16(withLen));
    let encoded = Array.from(concat(Uint8Array.from([0]), cobsEncode(frame), Uint8Array.from([0])));
    while (encoded.length > 19) { this.sendBytes(Uint8Array.from(encoded.slice(0, 19))); encoded = encoded.slice(19); }
    if (encoded.length > 0) this.sendBytes(Uint8Array.from(encoded));
  }

  private performHandshake(): Promise<boolean> {
    this.handshakeComplete = false;
    this.header = 0;
    this.sendBytes(fromHex("000000000000000000010000"));
    return new Promise<boolean>((res) => {
      this.handshakeResolve = res;
      setTimeout(() => res(this.handshakeComplete), 10000);
    });
  }

  private readBytes(bytes: Uint8Array) {
    const header = bytes[0];
    const rest = bytes.slice(1);
    if (header === 0 || !this.handshakeComplete) { this.continueHandshake(rest); return; }

    let msg = rest;
    let complete = false;
    if (msg[msg.length - 1] === 0) { complete = true; msg = msg.slice(0, -1); }
    if (msg.length > 0 && msg[0] === 0) { this.current = []; msg = msg.slice(1); }
    this.current.push(...msg);
    if (complete && this.current.length > 0) {
      const decoded = cobsDecode(Uint8Array.from(this.current));
      this.current = [];
      this.processMessage(decoded);
    }
  }

  private continueHandshake(rest: Uint8Array) {
    if (toHex(rest).startsWith("010000000000000000010000")) {
      this.header = rest[12];
      this.sendBytes(Uint8Array.from([0]));
      this.handshakeComplete = true;
      this.handshakeResolve?.(true);
    }
  }

  private processMessage(frame: Uint8Array) {
    if (frame.length < 4) return;
    const calc = crc16(frame.slice(0, -2));
    const got = frame.slice(-2);
    if (calc[0] !== got[0] || calc[1] !== got[1]) { this.log("CRC mismatch"); return; }
    const msg = frame.slice(2, -2);
    const type = (msg[1] << 8) | msg[0]; // little-endian id
    const ackBody = concat(Uint8Array.from([0]), msg.slice(2, 4), new Uint8Array(7));

    if (type === 0x13b4) { // protobuf response
      const counter = u16le(msg, 2);
      if (counter === this.protoCounter) {
        try { this.protoResolve?.(decodeWrapper(msg.slice(16))); } catch (e) { this.log("decode resp err " + e); }
      }
      this.ack(msg, ackBody);
    } else if (type === 0x13b3) { // protobuf request / notification (shots!)
      try { this.handleProto(decodeWrapper(msg.slice(16))); } catch (e) { this.log("decode notif err " + e); }
      this.ack(msg, ackBody);
    } else {
      this.ack(msg, Uint8Array.from([0]));
    }
  }

  private ack(msg: Uint8Array, body: Uint8Array) {
    this.writeMessage(concat(fromHex("8813"), msg.slice(0, 2), body));
  }

  private sendProto(obj: object): Promise<unknown> {
    const bytes = encodeWrapper(obj);
    const l = bytes.length;
    const full = concat(fromHex("b313"), i32le(this.protoCounter), Uint8Array.from([0, 0]), i32le(l), i32le(l), bytes);
    this.protoBusy = true;
    return new Promise<unknown>((res) => {
      this.protoResolve = res;
      this.writeMessage(full);
      setTimeout(() => res(null), 5000);
    }).then((m) => { this.protoCounter++; this.protoBusy = false; return m; });
  }

  // ---- protobuf handling ----------------------------------------------------

  private handleProto(wrapper: any) {
    const notif = wrapper?.event?.notification;
    const details = notif?.AlertNotification ?? notif?.alertNotification;
    if (!details) return;

    // Readable state transitions.
    if (details.state) {
      const names = ["Veille", "Test interférences", "Prêt", "Enregistrement", "Traitement", "ERREUR"];
      const s = details.state.state ?? 0;
      if (s !== this.lastState) { this.lastState = s; this.log(`État: ${names[s] ?? s}`); }
    }

    // Errors — PLATFORM_TILTED (3) blocks ball computation → recalibrate once.
    if (details.error && details.error.code != null) {
      const codes = ["inconnue", "surchauffe", "saturation radar", "plateau incliné"];
      const code = details.error.code;
      this.log(`⚠️ Erreur R10: ${codes[code] ?? code}`);
      if (details.error.deviceTilt) {
        this.tilt = { roll: details.error.deviceTilt.roll ?? 0, pitch: details.error.deviceTilt.pitch ?? 0 };
      }
      if (code === 3) {
        this.tiltError = true;
        this.emitTilt();
        if (!this.tiltCalSent) {
          this.tiltCalSent = true;
          this.log("↻ Recalibration inclinaison — garde le R10 immobile et à plat…");
          this.sendProto({ service: { start_tilt_cal_request: {} } });
        }
      }
    }

    if (details.tilt_calibration) {
      this.tiltCalSent = false;
      this.tiltError = false;
      this.emitTilt();
      this.log("✅ Inclinaison calibrée.");
    }

    const metrics = details.metrics;
    if (!metrics) return;
    this.log("metrics brut: " + JSON.stringify(metrics).slice(0, 320));

    const id = metrics.shot_id ?? 0;
    const b = metrics.ball_metrics ?? {};
    // shot_type 0 = PRACTICE → the radar saw the club but no ball launch.
    if (!(b.ball_speed > 0)) {
      const cs = ((metrics.club_metrics?.club_head_speed ?? 0) * MS_TO_KMH).toFixed(0);
      this.log(`Shot #${id}: ⚠️ aucune balle détectée (swing à vide ou balle hors champ) — club ${cs} km/h. Place une vraie balle ~2 m devant le R10, avec de l'espace pour qu'elle parte.`);
      playError();
      return;
    }
    if (this.seenShots.has(id)) return;
    this.seenShots.add(id);
    if (this.tiltError) { this.tiltError = false; this.emitTilt(); } // a measured ball ⇒ device is fine

    const c = metrics.club_metrics ?? {};
    const ballSpeed = (b.ball_speed ?? 0) * MS_TO_KMH;
    const clubSpeed = (c.club_head_speed ?? 0) * MS_TO_KMH;
    const launchAngle = b.launch_angle ?? 0;
    const launchDir = b.launch_direction ?? 0;
    const axis = b.spin_axis ?? 0;
    const totalSpin = b.total_spin ?? 0;
    const backSpin = totalSpin * Math.cos((axis * Math.PI) / 180);
    const sideSpin = totalSpin * Math.sin((axis * Math.PI) / 180);
    const clubFace = c.club_angle_face ?? 0;
    const clubPath = c.club_angle_path ?? 0;
    const flight = ballFlight(ballSpeed, launchAngle, launchDir, backSpin, sideSpin);

    this.log(`Shot #${id}: balle ${ballSpeed.toFixed(0)} km/h, lancement ${launchAngle.toFixed(1)}°, spin ${totalSpin.toFixed(0)} → carry ${flight.carry.toFixed(0)} m`);

    this.emitShot({
      id: shotId(), ts: Date.now(),
      ballSpeed, clubSpeed,
      smashFactor: clubSpeed > 0 ? ballSpeed / clubSpeed : 0,
      launchAngle, launchDir,
      attackAngle: c.attack_angle ?? 0,
      clubPath, clubFace, faceToPath: clubFace - clubPath,
      backSpin, sideSpin, spinAxis: axis,
      carry: flight.carry, total: flight.total, apex: flight.apex,
      offlineM: flight.offlineM, carryDeviation: flight.carryDeviation,
    });
  }
}
