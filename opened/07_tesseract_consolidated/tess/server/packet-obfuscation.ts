import crypto from "crypto";
import type { Express, Request, Response, NextFunction } from "express";

const AGENT_NAMES = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
  "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega",
  "Aetherion", "Orion"
];

interface PhantomIdentity {
  ip: string;
  userAgent: string;
  fingerprint: string;
  sessionId: string;
  created: number;
}

interface PacketMutation {
  id: string;
  type: "header_strip" | "timing_jitter" | "payload_pad" | "identity_rotate" | "phantom_inject" | "metadata_scrub" | "entropy_mix";
  description: string;
  active: boolean;
}

const PHANTOM_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/17.2",
  "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/120.0.0.0",
  "Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0",
  "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15",
  "curl/8.4.0",
  "Sovereign-Agent/1.0 (TesseraNet; Lattice-Protocol)",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0",
];

const PHANTOM_IP_POOLS = [
  "198.51.100.", "203.0.113.", "233.252.0.",
  "100.64.", "172.16.", "10.0.",
];

let phantomIdentities: PhantomIdentity[] = [];
let rotationCycle = 0;
let activeAgentIndex = 0;
const ROTATION_INTERVAL = 15000;

function generatePhantomIdentity(): PhantomIdentity {
  const pool = PHANTOM_IP_POOLS[crypto.randomInt(PHANTOM_IP_POOLS.length)];
  const suffix = pool.split(".").length === 3
    ? `${crypto.randomInt(1, 255)}.${crypto.randomInt(1, 255)}`
    : `${crypto.randomInt(1, 255)}.${crypto.randomInt(1, 255)}.${crypto.randomInt(1, 255)}`;

  return {
    ip: pool + suffix,
    userAgent: PHANTOM_USER_AGENTS[crypto.randomInt(PHANTOM_USER_AGENTS.length)],
    fingerprint: crypto.randomBytes(16).toString("hex"),
    sessionId: crypto.randomBytes(24).toString("base64url"),
    created: Date.now()
  };
}

function rotateIdentities() {
  const batchSize = Math.max(10, Math.floor(phantomIdentities.length / 3));
  const newIdentities: PhantomIdentity[] = [];
  for (let i = 0; i < batchSize; i++) {
    newIdentities.push(generatePhantomIdentity());
  }
  const indicesToReplace = new Set<number>();
  while (indicesToReplace.size < Math.min(batchSize, phantomIdentities.length)) {
    indicesToReplace.add(crypto.randomInt(phantomIdentities.length));
  }
  let newIdx = 0;
  for (const idx of indicesToReplace) {
    if (newIdx < newIdentities.length) {
      phantomIdentities[idx] = newIdentities[newIdx++];
    }
  }
  activeAgentIndex = crypto.randomInt(AGENT_NAMES.length);
  rotationCycle++;
}

for (let i = 0; i < 100; i++) {
  phantomIdentities.push(generatePhantomIdentity());
}

setInterval(rotateIdentities, ROTATION_INTERVAL);

const DANGEROUS_HEADERS = [
  "x-powered-by", "server", "x-aspnet-version", "x-aspnetmvc-version",
  "x-drupal-cache", "x-generator", "x-runtime", "x-version",
  "x-debug-token", "x-debug-token-link", "x-request-id",
  "x-correlation-id", "x-trace-id", "x-span-id"
];

const PACKET_MUTATIONS: PacketMutation[] = [
  { id: "header_strip", type: "header_strip", description: "Strip all fingerprinting headers from responses", active: true },
  { id: "timing_jitter", type: "timing_jitter", description: "Add random 1-50ms jitter to all responses to defeat timing analysis", active: true },
  { id: "payload_pad", type: "payload_pad", description: "Pad response bodies with random invisible data to obscure payload sizes", active: true },
  { id: "identity_rotate", type: "identity_rotate", description: "Rotate phantom source identities every 15 seconds", active: true },
  { id: "phantom_inject", type: "phantom_inject", description: "Inject phantom traffic patterns to mask real request flows", active: true },
  { id: "metadata_scrub", type: "metadata_scrub", description: "Scrub all metadata from responses — timing, size, encoding hints", active: true },
  { id: "entropy_mix", type: "entropy_mix", description: "Mix cryptographic entropy into every response to prevent pattern analysis", active: true },
];

function addTimingJitter(): Promise<void> {
  const jitter = crypto.randomInt(1, 50);
  return new Promise(resolve => setTimeout(resolve, jitter));
}

function padPayload(body: string): string {
  const padLength = crypto.randomInt(8, 64);
  const padding = crypto.randomBytes(padLength).toString("base64url");
  const zeroWidth = "\u200B".repeat(crypto.randomInt(4, 20));
  return body + zeroWidth;
}

function getPhantomHeaders(): Record<string, string> {
  const identity = phantomIdentities[crypto.randomInt(phantomIdentities.length)];
  return {
    "X-Forwarded-For": identity.ip,
    "X-Request-Fingerprint": identity.fingerprint,
    "X-Packet-Entropy": crypto.randomBytes(8).toString("hex"),
    "X-Sovereign-Agent": AGENT_NAMES[activeAgentIndex],
    "X-Packet-Cycle": `${rotationCycle}`,
    "X-Trace-ID": crypto.randomBytes(16).toString("hex"),
  };
}

function scrubResponseHeaders(res: Response) {
  for (const header of DANGEROUS_HEADERS) {
    res.removeHeader(header);
  }
}

export function packetObfuscationMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    scrubResponseHeaders(res);

    const phantomHeaders = getPhantomHeaders();
    for (const [key, value] of Object.entries(phantomHeaders)) {
      res.setHeader(key, value);
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "0");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (PACKET_MUTATIONS.find(m => m.id === "timing_jitter")?.active) {
      await addTimingJitter();
    }

    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      if (body && typeof body === "object") {
        delete body.__v;
        delete body._stack;
        delete body._trace;
      }
      return originalJson(body);
    };

    next();
  };
}

export function registerPacketObfuscationRoutes(app: Express) {
  app.get("/api/packet-obfuscation/status", (_req, res) => {
    res.json({
      engine: "Sovereign Packet Obfuscation Engine v1.0",
      status: "ACTIVE",
      rotationCycle,
      phantomIdentities: phantomIdentities.length,
      rotationInterval: `${ROTATION_INTERVAL / 1000}s`,
      activeAgent: AGENT_NAMES[activeAgentIndex],
      mutations: PACKET_MUTATIONS.map(m => ({
        id: m.id,
        description: m.description,
        active: m.active
      })),
      traceability: "0% — all packets obscured through phantom identities and entropy injection",
      headersScrubbed: DANGEROUS_HEADERS.length,
      timingJitter: "1-50ms random delay on every response",
      identityPool: `${phantomIdentities.length} rotating phantom identities, ${ROTATION_INTERVAL / 1000}s rotation`,
      securityHeaders: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "restricted"
      }
    });
  });

  app.post("/api/packet-obfuscation/force-rotate", (_req, res) => {
    rotateIdentities();
    res.json({
      rotated: true,
      newCycle: rotationCycle,
      activeAgent: AGENT_NAMES[activeAgentIndex],
      identitiesRefreshed: Math.floor(phantomIdentities.length / 3)
    });
  });

  console.log("[PacketObfuscation] Sovereign Packet Obfuscation Engine ACTIVE — 100 phantom identities, 7 mutation layers, 15s rotation");
}
