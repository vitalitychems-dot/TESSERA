/**
 * O10 add-on — on-demand mesh. The owner toggle stays the outer gate: if it is off, nothing switches on.
 * When allowed, the mesh is switched on only for a need (offline, queued sync, page only on a peer)
 * and switched off after `idleMs` with no need. Every switch is logged with its trigger.
 */
export type Trigger = "offline" | "queued-sync" | "peer-only-page" | "idle-timeout" | "owner-off";
export type Switch = { at: number; to: "on" | "off"; trigger: Trigger; agent: string };
export type Need = { online: boolean; queued: number; wantPeerPage?: boolean };

export class OnDemandMesh {
  active = false;
  log: Switch[] = [];
  private lastNeed = 0;
  private ownerOn: () => boolean;
  private start: () => Promise<void>;
  private stop: () => Promise<void>;
  private idleMs: number;
  private now: () => number;
  private agent: string;

  constructor(o: { ownerOn: () => boolean; start: () => Promise<void>; stop: () => Promise<void>; idleMs?: number; now?: () => number; agent?: string }) {
    this.ownerOn = o.ownerOn; this.start = o.start; this.stop = o.stop;
    this.idleMs = o.idleMs ?? 5 * 60_000; this.now = o.now ?? Date.now; this.agent = o.agent ?? "tessera";
  }

  static trigger(n: Need): Trigger | null {
    if (!n.online) return "offline";
    if (n.queued > 0) return "queued-sync";
    if (n.wantPeerPage) return "peer-only-page";
    return null;
  }

  /** Call when conditions change (or on a cheap local tick). Sends nothing itself. */
  async check(n: Need) {
    if (!this.ownerOn()) {
      if (this.active) await this.switchTo("off", "owner-off");
      return this.active;
    }
    const t = OnDemandMesh.trigger(n);
    if (t) {
      this.lastNeed = this.now();
      if (!this.active) await this.switchTo("on", t);
    } else if (this.active && this.now() - this.lastNeed >= this.idleMs) {
      await this.switchTo("off", "idle-timeout");
    }
    return this.active;
  }

  private async switchTo(to: "on" | "off", trigger: Trigger) {
    if (to === "on") await this.start(); else await this.stop();
    this.active = to === "on";
    this.log.push({ at: this.now(), to, trigger, agent: this.agent });
  }
}
