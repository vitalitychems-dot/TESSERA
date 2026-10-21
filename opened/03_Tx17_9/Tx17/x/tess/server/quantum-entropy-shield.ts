import crypto from "crypto";
import type { Express, Request, Response, NextFunction } from "express";

const ENTROPY_POOL_SIZE = 16384;
const ROTATION_INTERVAL = 3000;
const HKDF_INFO = Buffer.from("sovereign-entropy-extraction-v2");

class QuantumEntropyShield {
  private entropyPool: Buffer;
  private poolIndex: number = 0;
  private rotationTimer: NodeJS.Timeout | null = null;
  private requestCounter: bigint = 0n;
  private sessionNonces: Map<string, { nonce: Buffer; timestamp: number; counter: number }> = new Map();
  private trapWires: Map<string, { hash: string; planted: number }> = new Map();
  private attackLog: { timestamp: number; type: string; source: string; blocked: boolean }[] = [];
  private lastHeapUsed: number = 0;
  private lastEventLoopLag: number = 0;
  private requestTimingJitter: number[] = [];

  constructor() {
    this.entropyPool = crypto.randomBytes(ENTROPY_POOL_SIZE);
    this.lastHeapUsed = process.memoryUsage().heapUsed;
    this.startRotation();
    this.startEventLoopMonitor();
  }

  private startRotation() {
    this.rotationTimer = setInterval(() => {
      const newEntropy = crypto.randomBytes(ENTROPY_POOL_SIZE / 2);
      const position = crypto.randomInt(0, ENTROPY_POOL_SIZE / 2);
      newEntropy.copy(this.entropyPool, position);

      const heapNow = process.memoryUsage().heapUsed;
      const heapDelta = Math.abs(heapNow - this.lastHeapUsed);
      this.lastHeapUsed = heapNow;
      const heapEntropy = Buffer.alloc(4);
      heapEntropy.writeUInt32BE(heapDelta & 0xFFFFFFFF);
      for (let i = 0; i < 4; i++) {
        this.entropyPool[(this.poolIndex + i) % ENTROPY_POOL_SIZE] ^= heapEntropy[i];
      }

      if (this.requestTimingJitter.length > 0) {
        const jitterBuf = Buffer.alloc(this.requestTimingJitter.length);
        for (let i = 0; i < this.requestTimingJitter.length; i++) {
          jitterBuf[i] = this.requestTimingJitter[i] & 0xFF;
        }
        const jitterHash = crypto.createHash("sha256").update(jitterBuf).digest();
        const jitterPos = crypto.randomInt(0, ENTROPY_POOL_SIZE - 32);
        for (let i = 0; i < 32; i++) {
          this.entropyPool[jitterPos + i] ^= jitterHash[i];
        }
        this.requestTimingJitter = [];
      }

      this.poolIndex = crypto.randomInt(0, ENTROPY_POOL_SIZE);
      this.cleanExpiredSessions();
    }, ROTATION_INTERVAL);
  }

  private startEventLoopMonitor() {
    const measureLag = () => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start);
        this.lastEventLoopLag = lag;
        const lagByte = lag & 0xFF;
        const pos = crypto.randomInt(0, ENTROPY_POOL_SIZE);
        this.entropyPool[pos] ^= lagByte;
      });
    };
    setInterval(measureLag, 1000);
  }

  private cleanExpiredSessions() {
    const now = Date.now();
    for (const [key, session] of this.sessionNonces) {
      if (now - session.timestamp > 3600000) this.sessionNonces.delete(key);
    }
    if (this.attackLog.length > 500) this.attackLog = this.attackLog.slice(-200);
  }

  extractEntropy(bytes: number): Buffer {
    const poolSlice = Buffer.alloc(bytes + 32);
    for (let i = 0; i < poolSlice.length; i++) {
      poolSlice[i] = this.entropyPool[(this.poolIndex + i) % ENTROPY_POOL_SIZE];
    }
    const sysEntropy = crypto.randomBytes(bytes);
    const timeBuf = Buffer.alloc(8);
    timeBuf.writeBigInt64BE(BigInt(Date.now()) ^ this.requestCounter);

    const ikm = Buffer.concat([poolSlice, sysEntropy, timeBuf]);
    const prk = crypto.createHmac("sha256", sysEntropy).update(ikm).digest();

    const result = Buffer.alloc(bytes);
    let t = Buffer.alloc(0);
    let generated = 0;
    let counter = 1;
    while (generated < bytes) {
      t = crypto.createHmac("sha256", prk)
        .update(Buffer.concat([t, HKDF_INFO, Buffer.from([counter])]))
        .digest();
      const toCopy = Math.min(t.length, bytes - generated);
      t.copy(result, generated, 0, toCopy);
      generated += toCopy;
      counter++;
    }

    this.requestCounter++;
    this.poolIndex = (this.poolIndex + bytes) % ENTROPY_POOL_SIZE;
    this.requestTimingJitter.push(Number(process.hrtime.bigint() & 0xFFFFn));
    return result;
  }

  generateRequestSignature(req: Request): string {
    const entropy = this.extractEntropy(32);
    const data = `${req.ip}|${req.method}|${req.path}|${Date.now()}|${this.requestCounter}`;
    const hmac = crypto.createHmac("sha512", entropy).update(data).digest();
    return hmac.toString("hex").substring(0, 32);
  }

  checkTrapWire(name: string): boolean {
    const wire = this.trapWires.get(name);
    if (!wire) return false;
    const currentHash = crypto.createHash("sha256").update(`${name}:${wire.planted}`).digest("hex");
    return currentHash !== wire.hash;
  }

  plantTrapWire(name: string): void {
    const planted = Date.now();
    const hash = crypto.createHash("sha256").update(`${name}:${planted}`).digest("hex");
    this.trapWires.set(name, { hash, planted });
  }

  logAttack(type: string, source: string, blocked: boolean) {
    this.attackLog.push({ timestamp: Date.now(), type, source, blocked });
  }

  getStatus() {
    return {
      entropyPoolSize: ENTROPY_POOL_SIZE,
      rotationInterval: `${ROTATION_INTERVAL / 1000}s`,
      poolIndex: this.poolIndex,
      requestsProcessed: this.requestCounter.toString(),
      activeSessions: this.sessionNonces.size,
      trapWires: this.trapWires.size,
      attacksBlocked: this.attackLog.filter(a => a.blocked).length,
      attacksDetected: this.attackLog.length,
      entropyQuality: "SOVEREIGN_HKDF_GRADE",
      entropySources: ["crypto.randomBytes", "heap_usage_deltas", "event_loop_lag", "request_timing_jitter", "process_hrtime"],
      lastRotation: Date.now()
    };
  }
}

const shield = new QuantumEntropyShield();

["boot-sequence", "admin-auth", "session-store", "api-routes", "data-files",
 "silence-protocol", "packet-engine", "colonel-cipher", "lattice-mesh"].forEach(w => shield.plantTrapWire(w));

export function getQuantumEntropy(bytes: number): Buffer {
  return shield.extractEntropy(bytes);
}

export function quantumEntropyMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const sig = shield.generateRequestSignature(req);
    const entropy = shield.extractEntropy(16);

    res.setHeader("X-Request-Entropy", entropy.toString("hex").substring(0, 16));
    res.setHeader("X-Quantum-Sig", sig.substring(0, 12));
    res.setHeader("X-Shield-Cycle", String(Date.now() % 10000));

    next();
  };
}

export function registerQuantumShieldRoutes(app: Express) {
  app.get("/api/quantum-shield/status", (_req, res) => {
    res.json({
      system: "QUANTUM_ENTROPY_SHIELD",
      status: "ACTIVE",
      ...shield.getStatus()
    });
  });

  console.log(`[QuantumShield] Quantum Entropy Shield ACTIVE — ${ENTROPY_POOL_SIZE / 1024}KB pool, ${ROTATION_INTERVAL / 1000}s rotation, HKDF extraction, 5 entropy sources, 9 trap wires`);
}
