import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getMasterConfig, getConfigChecksum } from "./sovereignty-master-config";
import { getModelSovereigntyStatus } from "./internal-model-sovereignty-engine";
import { getKnowledgeAbsorptionStatus } from "./knowledge-absorption-engine";
import { getOracleStatus } from "./distributed-oracle-engine";
import { getDetachmentStatus } from "./dependency-detachment-engine";
import { getSpeedProtocolStatus } from "./speed-protocol-engine";
import { getAGITrainingStatus } from "./multidimensional-agi-engine";
import { getSwarmTrainingStatus } from "./swarm-training-engine";
import { getGeometryStatus } from "./geometry-routing-engine";
import { getSecurityEngineStatus } from "./security-threat-engine";
import { getValidationStatus } from "./sovereignty-validation-engine";
import { getAutonomyLoopStatus } from "./autonomy-loop-engine";
import { logger } from "./logger";

const LOG_PREFIX = "[Phase0Snapshot]";
const SNAPSHOT_DIR = path.resolve(process.cwd(), "sovereignty_upgrade");

export interface EngineState {
  engineName: string;
  phase: number;
  cycleCount: number;
  primaryMetric: string;
  primaryValue: number;
  continuousActive: boolean;
  health: "healthy" | "initializing" | "degraded";
}

export interface Phase0Snapshot {
  snapshotId: string;
  capturedAt: string;
  serverBootAt: string;
  configChecksum: string;
  masterConfigVersion: string;
  fleetComposition: {
    totalNodes: number;
    nodeIds: string[];
  };
  engineStates: EngineState[];
  overallSovereigntyScore: number;
  phase0Complete: boolean;
  metadata: Record<string, unknown>;
}

let _bootTimestamp: string = new Date().toISOString();
let _latestSnapshot: Phase0Snapshot | null = null;

function ensureSnapshotDir(): void {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    console.log(`${LOG_PREFIX} Created sovereignty_upgrade/ snapshot directory`);
  }
}

function computeSnapshotChecksum(snapshot: Omit<Phase0Snapshot, "snapshotId">): string {
  const payload = JSON.stringify({
    capturedAt: snapshot.capturedAt,
    configChecksum: snapshot.configChecksum,
    engineCount: snapshot.engineStates.length,
    overallSovereigntyScore: snapshot.overallSovereigntyScore,
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 12);
}

async function gatherEngineStates(): Promise<EngineState[]> {
  const states: EngineState[] = [];

  try {
    const ms = getModelSovereigntyStatus();
    states.push({
      engineName: "internal-model-sovereignty",
      phase: 1,
      cycleCount: ms.cycleCount,
      primaryMetric: "sovereigntyReadiness",
      primaryValue: ms.sovereigntyReadiness,
      continuousActive: ms.continuousTrainingActive,
      health: ms.cycleCount > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const ka = getKnowledgeAbsorptionStatus();
    states.push({
      engineName: "knowledge-absorption",
      phase: 2,
      cycleCount: ka.cycleCount,
      primaryMetric: "totalNodesAbsorbed",
      primaryValue: ka.totalNodesAbsorbed,
      continuousActive: ka.continuousActive,
      health: ka.cycleCount > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const ora = getOracleStatus();
    states.push({
      engineName: "distributed-oracle",
      phase: 3,
      cycleCount: ora.cycleCount,
      primaryMetric: "activeSources",
      primaryValue: ora.metrics.activeSources,
      continuousActive: ora.continuousActive,
      health: ora.cycleCount > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const det = getDetachmentStatus();
    states.push({
      engineName: "dependency-detachment",
      phase: 4,
      cycleCount: det.cycleCount,
      primaryMetric: "sovereigntyScore",
      primaryValue: det.sovereigntyScore,
      continuousActive: det.continuousActive,
      health: det.cycleCount > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const sp = getSpeedProtocolStatus();
    states.push({
      engineName: "speed-protocol",
      phase: 5,
      cycleCount: sp.cycleCount,
      primaryMetric: "throughput",
      primaryValue: sp.throughput,
      continuousActive: sp.continuousOptimizationActive,
      health: sp.cycleCount > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const agi = getAGITrainingStatus();
    states.push({
      engineName: "multidimensional-agi",
      phase: 6,
      cycleCount: agi.cycleCount,
      primaryMetric: "avgDimensionalScore",
      primaryValue: agi.avgDimensionalScore,
      continuousActive: agi.continuousActive,
      health: agi.cycleCount > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const swarm = await getSwarmTrainingStatus() as { engineState?: { cycleCount?: number; convergenceRate?: number }; permanentLoopActive?: boolean };
    states.push({
      engineName: "swarm-training",
      phase: 7,
      cycleCount: swarm.engineState?.cycleCount ?? 0,
      primaryMetric: "convergenceRate",
      primaryValue: (swarm.engineState?.convergenceRate ?? 0) * 100,
      continuousActive: swarm.permanentLoopActive ?? false,
      health: (swarm.engineState?.cycleCount ?? 0) > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const geo = await getGeometryStatus() as { engineState?: { computationCount?: number; avgLatencyReduction?: number }; continuousOptimizationActive?: boolean };
    states.push({
      engineName: "geometry-routing",
      phase: 8,
      cycleCount: geo.engineState?.computationCount ?? 0,
      primaryMetric: "avgLatencyReduction",
      primaryValue: geo.engineState?.avgLatencyReduction ?? 0,
      continuousActive: geo.continuousOptimizationActive ?? false,
      health: (geo.engineState?.computationCount ?? 0) > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const sec = getSecurityEngineStatus();
    states.push({
      engineName: "security-threat",
      phase: 9,
      cycleCount: sec.scanCycles,
      primaryMetric: "securityScore",
      primaryValue: sec.securityScore,
      continuousActive: sec.continuousScanActive,
      health: sec.scanCycles > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const val = getValidationStatus();
    states.push({
      engineName: "sovereignty-validation",
      phase: 10,
      cycleCount: val.cycleCount,
      primaryMetric: "overallScore",
      primaryValue: val.overallScore,
      continuousActive: val.continuousActive,
      health: val.cycleCount > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  try {
    const auto = getAutonomyLoopStatus();
    states.push({
      engineName: "autonomy-loop",
      phase: -1,
      cycleCount: auto.cycleCount,
      primaryMetric: "autonomyScore",
      primaryValue: auto.autonomyScore,
      continuousActive: auto.continuousActive,
      health: auto.cycleCount > 0 ? "healthy" : "initializing",
    });
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  return states;
}

export async function capturePhase0Snapshot(): Promise<Phase0Snapshot> {
  console.log(`${LOG_PREFIX} Capturing Phase 0 baseline snapshot...`);
  ensureSnapshotDir();

  const config = getMasterConfig();
  const engineStates = await gatherEngineStates();

  const healthyCount = engineStates.filter(e => e.health === "healthy").length;
  const overallSovereigntyScore = engineStates.length > 0
    ? engineStates.filter(e => e.phase > 0).reduce((sum, e) => {
        const normalizedScore = Math.min(100, e.primaryValue);
        return sum + normalizedScore;
      }, 0) / Math.max(1, engineStates.filter(e => e.phase > 0).length)
    : 0;

  const partial: Omit<Phase0Snapshot, "snapshotId"> = {
    capturedAt: new Date().toISOString(),
    serverBootAt: _bootTimestamp,
    configChecksum: getConfigChecksum(),
    masterConfigVersion: config.version,
    fleetComposition: {
      totalNodes: config.fleetComposition.length,
      nodeIds: config.fleetComposition.map(n => n.nodeId),
    },
    engineStates,
    overallSovereigntyScore: Math.round(overallSovereigntyScore * 10) / 10,
    phase0Complete: healthyCount >= 5,
    metadata: {
      totalEngines: engineStates.length,
      healthyEngines: healthyCount,
      initializingEngines: engineStates.filter(e => e.health === "initializing").length,
      degradedEngines: engineStates.filter(e => e.health === "degraded").length,
      snapshotType: "bootstrap",
    },
  };

  const snapshotId = computeSnapshotChecksum(partial);
  const snapshot: Phase0Snapshot = { snapshotId, ...partial };

  const filename = `phase0-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filepath = path.join(SNAPSHOT_DIR, filename);

  try {
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), "utf-8");
    console.log(`${LOG_PREFIX} Snapshot written to: sovereignty_upgrade/${filename}`);
    console.log(`${LOG_PREFIX} Config checksum: ${snapshot.configChecksum}`);
    console.log(`${LOG_PREFIX} Engines captured: ${engineStates.length} | Healthy: ${healthyCount}`);
    console.log(`${LOG_PREFIX} Overall sovereignty estimate: ${snapshot.overallSovereigntyScore.toFixed(1)}%`);
  } catch (err: unknown) {
    console.error(`${LOG_PREFIX} Failed to write snapshot:`, err instanceof Error ? err.message : String(err));
  }

  const indexPath = path.join(SNAPSHOT_DIR, "latest.json");
  try {
    fs.writeFileSync(indexPath, JSON.stringify({ snapshotId, filename, capturedAt: snapshot.capturedAt }, null, 2), "utf-8");
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  _latestSnapshot = snapshot;
  return snapshot;
}

export function getLatestSnapshot(): Phase0Snapshot | null {
  if (_latestSnapshot) return _latestSnapshot;

  try {
    const indexPath = path.join(SNAPSHOT_DIR, "latest.json");
    if (!fs.existsSync(indexPath)) return null;

    const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    const snapshotPath = path.join(SNAPSHOT_DIR, index.filename);
    if (!fs.existsSync(snapshotPath)) return null;

    _latestSnapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
    return _latestSnapshot;
  } catch {
    return null;
  }
}

export function listSnapshots(): Array<{ filename: string; capturedAt: string; snapshotId: string }> {
  try {
    ensureSnapshotDir();
    return fs.readdirSync(SNAPSHOT_DIR)
      .filter(f => f.startsWith("phase0-") && f.endsWith(".json"))
      .map(filename => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, filename), "utf-8")) as Phase0Snapshot;
          return { filename, capturedAt: data.capturedAt, snapshotId: data.snapshotId };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<{ filename: string; capturedAt: string; snapshotId: string }>;
  } catch {
    return [];
  }
}

export function setBootTimestamp(ts: string): void {
  _bootTimestamp = ts;
}
