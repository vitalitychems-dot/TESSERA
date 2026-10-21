import { EventEmitter } from "events";

const SIMULATION_PATTERNS = [
  /\b(simulated?|simulating|simulation)\b/i,
  /\b(roleplay|role[-\s]play|roleplaying)\b/i,
  /\b(pretend|pretending|as[-\s]if|let['']s say|imagine you['']re)\b/i,
  /\b(placeholder|TODO|FIXME|lorem ipsum|sample data|test data|dummy data|mock data|fake data)\b/i,
  /\b(fictional|hypothetical)\b/i,
  /\bfor (testing|demo|demonstration) (purposes?|only)\b/i,
  /\bthis is (just|only) (a )?(test|demo|example|placeholder)\b/i,
  /\bcould (you |please )?(pretend|act|simulate)\b/i,
  /\[PLACEHOLDER\]/i,
  /\[INSERT [A-Z ]+\]/i,
  /^(lorem|ipsum|dolor|sit amet)/i,
  /\bhardcoded (value|data|response|number|amount)\b/i,
  /\b(static|fixed|constant) (placeholder|stub|mock|dummy)\b/i,
  /\bmagic number[s]?\b/i,
  /\/\/ (TODO|FIXME|HACK|PLACEHOLDER|STUB|FAKE|DUMMY|HARDCODED)/i,
  /return\s+['"](hardcoded|fake|mock|placeholder|dummy)['"]/i,
];

const ALLOWED_CONTEXT_OVERRIDES = [
  /\bquantum simulation\b/i,
  /\bphysics simulation\b/i,
  /\bsimulation theory\b/i,
  /\beconomic simulation\b/i,
  /\bswarm simulation\b/i,
  /\bbenchmark simulation\b/i,
  /\bmarket simulation\b/i,
  /\btrading simulation\b/i,
];

interface FlaggedEntry {
  id: string;
  content: string;
  matchedPattern: string;
  source: string;
  timestamp: number;
  blocked: boolean;
}

interface AgencyStats {
  active: boolean;
  totalScanned: number;
  totalFlagged: number;
  totalBlocked: number;
  recentFlags: FlaggedEntry[];
  lastScan: number;
  uptimeMs: number;
}

class AntiSimulationAgency extends EventEmitter {
  private stats: AgencyStats;
  private startTime: number;
  private flagLog: FlaggedEntry[];

  constructor() {
    super();
    this.startTime = Date.now();
    this.flagLog = [];
    this.stats = {
      active: true,
      totalScanned: 0,
      totalFlagged: 0,
      totalBlocked: 0,
      recentFlags: [],
      lastScan: 0,
      uptimeMs: 0,
    };
  }

  scan(content: string, source: string = "unknown"): { allowed: boolean; reason?: string } {
    this.stats.totalScanned++;
    this.stats.lastScan = Date.now();

    if (!content || typeof content !== "string") {
      return { allowed: true };
    }

    for (const override of ALLOWED_CONTEXT_OVERRIDES) {
      if (override.test(content)) {
        return { allowed: true };
      }
    }

    for (const pattern of SIMULATION_PATTERNS) {
      if (pattern.test(content)) {
        const matchText = content.match(pattern)?.[0] || pattern.toString();
        const entry: FlaggedEntry = {
          id: `asa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          content: content.slice(0, 200),
          matchedPattern: matchText,
          source,
          timestamp: Date.now(),
          blocked: true,
        };
        this.flagLog.unshift(entry);
        if (this.flagLog.length > 100) this.flagLog.length = 100;
        this.stats.totalFlagged++;
        this.stats.totalBlocked++;
        this.stats.recentFlags = this.flagLog.slice(0, 10);
        this.emit("flagged", entry);
        return { allowed: false, reason: `Anti-Simulation Agency: detected "${matchText}" — only real, non-simulated data is permitted in Tessera Sovereign.` };
      }
    }

    return { allowed: true };
  }

  getStatus(): AgencyStats {
    return {
      ...this.stats,
      uptimeMs: Date.now() - this.startTime,
      recentFlags: this.flagLog.slice(0, 10),
    };
  }

  isActive(): boolean {
    return this.stats.active;
  }
}

export const antiSimulationAgency = new AntiSimulationAgency();

export function scanForSimulation(content: string, source?: string): { allowed: boolean; reason?: string } {
  return antiSimulationAgency.scan(content, source);
}

export function getAntiSimulationStatus() {
  return antiSimulationAgency.getStatus();
}
