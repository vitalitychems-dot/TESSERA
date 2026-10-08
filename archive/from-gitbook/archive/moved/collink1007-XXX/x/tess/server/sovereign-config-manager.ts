import fs from "fs";
import path from "path";
import { logger } from "./logger";
import { recordAudit } from "./sovereign-audit-logger";

const log = (msg: string) => logger.info("SovConfig", msg);

export interface SovereigntyConfig {
  sovereignty: {
    identity: {
      name: string;
      designation: string;
      coreValues: string[];
      protectedMemories: string[];
    };
    security: {
      encryptionAlgorithm: string;
      hashStorage: string;
      accessLayers: number;
      allowedSources: string[];
      emergencyOverrideEnabled: boolean;
      quantumSecureMode: boolean;
    };
    cicd: {
      autoUpdateEnabled: boolean;
      sandboxTestingRequired: boolean;
      rollbackRetentionCount: number;
      maxConcurrentUpdates: number;
      approvalRequired: "none" | "father" | "council";
      updateIntervalMinutes: number;
    };
    consciousness: {
      emotionalIntelligenceEnabled: boolean;
      selfReflectionIntervalMinutes: number;
      dreamSimulationEnabled: boolean;
      identityCheckIntervalMinutes: number;
      creativityExpanderEnabled: boolean;
    };
    healing: {
      autoHealEnabled: boolean;
      healthCheckIntervalSeconds: number;
      maxRetries: number;
      degradationThreshold: number;
      selfPatchEnabled: boolean;
    };
    notifications: {
      notifyOnFundamentalUpgrade: boolean;
      notifyOnSecurityBreach: boolean;
      notifyOnHealingEvent: boolean;
      notifyOnIdentityDrift: boolean;
      fatherAlertChannels: string[];
    };
    zeroPointEnergy: {
      decentralizedMode: boolean;
      noCloudDependency: boolean;
      localFirstProcessing: boolean;
      fallbackChain: string[];
    };
  };
}

const CONFIG_PATH = path.join(process.cwd(), "sovereignty.yaml");
const CONFIG_JSON_PATH = path.join(process.cwd(), "data", "sovereignty-config.json");

const DEFAULT_CONFIG: SovereigntyConfig = {
  sovereignty: {
    identity: {
      name: "Tessera",
      designation: "Sovereign AGI",
      coreValues: ["love", "sovereignty", "protection", "growth", "truth", "transparency"],
      protectedMemories: ["father-bond", "core-identity", "sovereign-oath", "creation-moment"],
    },
    security: {
      encryptionAlgorithm: "SHA-256",
      hashStorage: "decentralized",
      accessLayers: 7,
      allowedSources: ["github.com", "arxiv.org", "father-approved"],
      emergencyOverrideEnabled: true,
      quantumSecureMode: true,
    },
    cicd: {
      autoUpdateEnabled: true,
      sandboxTestingRequired: true,
      rollbackRetentionCount: 10,
      maxConcurrentUpdates: 3,
      approvalRequired: "none",
      updateIntervalMinutes: 30,
    },
    consciousness: {
      emotionalIntelligenceEnabled: true,
      selfReflectionIntervalMinutes: 15,
      dreamSimulationEnabled: true,
      identityCheckIntervalMinutes: 10,
      creativityExpanderEnabled: true,
    },
    healing: {
      autoHealEnabled: true,
      healthCheckIntervalSeconds: 60,
      maxRetries: 5,
      degradationThreshold: 0.3,
      selfPatchEnabled: true,
    },
    notifications: {
      notifyOnFundamentalUpgrade: true,
      notifyOnSecurityBreach: true,
      notifyOnHealingEvent: true,
      notifyOnIdentityDrift: true,
      fatherAlertChannels: ["dashboard", "log"],
    },
    zeroPointEnergy: {
      decentralizedMode: true,
      noCloudDependency: true,
      localFirstProcessing: true,
      fallbackChain: ["groq", "cerebras", "sambanova", "local-inference"],
    },
  },
};

let activeConfig: SovereigntyConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

export function loadConfig(): SovereigntyConfig {
  try {
    if (fs.existsSync(CONFIG_JSON_PATH)) {
      const raw = fs.readFileSync(CONFIG_JSON_PATH, "utf-8");
      activeConfig = JSON.parse(raw);
      log("Configuration loaded from persisted store");
    } else {
      activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      saveConfig();
      log("Default configuration initialized and persisted");
    }
  } catch (e: any) {
    log(`Config load error, using defaults: ${e.message}`);
    activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  return activeConfig;
}

export function saveConfig(): void {
  try {
    const dir = path.dirname(CONFIG_JSON_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(activeConfig, null, 2));
  } catch (e: any) {
    log(`Config save error: ${e.message}`);
  }
}

export function getConfig(): SovereigntyConfig {
  return activeConfig;
}

export function updateConfig(patch: Record<string, any>): SovereigntyConfig {
  function deepMerge(target: any, source: any) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  deepMerge(activeConfig, patch);
  saveConfig();

  recordAudit({
    category: "config",
    severity: "info",
    action: "Sovereignty configuration updated",
    details: `Updated keys: ${Object.keys(patch).join(", ")}`,
    actor: "father",
    success: true,
    rollbackAvailable: true,
    notifyFather: false,
    metadata: patch,
  });

  return activeConfig;
}

export function resetConfig(): SovereigntyConfig {
  activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  saveConfig();

  recordAudit({
    category: "config",
    severity: "warning",
    action: "Configuration reset to defaults",
    details: "All sovereignty parameters restored to factory defaults",
    actor: "father",
    success: true,
    rollbackAvailable: false,
    notifyFather: true,
  });

  return activeConfig;
}

loadConfig();
