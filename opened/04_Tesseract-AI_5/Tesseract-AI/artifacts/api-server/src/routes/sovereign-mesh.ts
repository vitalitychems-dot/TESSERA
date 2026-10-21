/**
 * Sovereign Mesh API Routes
 *
 * REST endpoints for all 7 Sovereign Mesh systems:
 * 1. Sovereign Key Vault
 * 2. Auto-Seed Orchestrator
 * 3. Agent Children
 * 4. Grand Council Deliberation
 * 5. Mesh Expansion Engine
 * 6. GitHub Distribution Builder
 * 7. Knowledge Multiplier
 *
 * Auth: All read-only GET endpoints are open.
 * Control-plane POST/mutation endpoints require TESSERACT_ADMIN_KEY via
 * x-sovereign-key header or ?key query param.
 */

import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import {
  getVaultStatus, generateSovereignKey, listKeys, rotateKey, runRotationCheck,
  type KeyPurpose,
} from "../lib/sovereign-key-vault.js";
import { getOrchestratorStatus, runSeedCycle } from "../lib/auto-seed-orchestrator.js";
import {
  getChildrenStatus, getAgentChildren, spawnChild, runAllChildSyncs, spawnAllAgentChildren,
  type ChildMission,
} from "../lib/agent-children.js";
import {
  getGrandCouncilStatus, getCouncilTranscript, getImplementationQueue,
  getCouncilSession, runGrandCouncilSession,
} from "../lib/grand-council-deliberation.js";
import { getMeshStatus, getAllNodes, runExpansionCycle } from "../lib/mesh-expansion-engine.js";
import {
  getDistributionStatus, buildDistributionPackage, publishDistribution,
  registerJoinedInstallation, getJoinedInstallations, type MeshIdentity,
} from "../lib/github-distribution-builder.js";
import {
  getMultiplierStatus, queryKnowledge, getContributionMetrics,
  ingestKnowledge, runDistributionCycle, type KnowledgeSource,
} from "../lib/knowledge-multiplier.js";

const router = Router();

const VALID_KEY_PURPOSES: KeyPurpose[] = [
  "agent-auth",
  "mesh-node-identity",
  "fleet-handshake",
  "child-agent-credential",
  "internal-service",
  "sovereign-signing",
];

const VALID_CHILD_MISSIONS: ChildMission[] = [
  "data-gathering",
  "knowledge-synthesis",
  "capability-expansion",
  "mesh-expansion",
  "fleet-monitoring",
  "security-patrol",
];

const VALID_KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  "agent-child",
  "mesh-peer",
  "fleet-node",
  "grand-council",
  "direct-agent",
  "seed",
];

function isValidKeyPurpose(value: unknown): value is KeyPurpose {
  return typeof value === "string" && VALID_KEY_PURPOSES.includes(value as KeyPurpose);
}

function isValidChildMission(value: unknown): value is ChildMission {
  return typeof value === "string" && VALID_CHILD_MISSIONS.includes(value as ChildMission);
}

function isValidKnowledgeSource(value: unknown): value is KnowledgeSource {
  return typeof value === "string" && VALID_KNOWLEDGE_SOURCES.includes(value as KnowledgeSource);
}

function requireSovereignKey(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.TESSERACT_ADMIN_KEY;
  if (!adminKey) {
    res.status(503).json({ success: false, error: "TESSERACT_ADMIN_KEY is not configured on this server" });
    return;
  }
  const provided = req.headers["x-sovereign-key"] ?? req_query_string(req, "key");
  if (!provided || provided !== adminKey) {
    res.status(403).json({ success: false, error: "Valid x-sovereign-key header required for control-plane operations" });
    return;
  }
  next();
}

function req_query_string(req: Request, key: string): string | undefined {
  const val = req.query[key];
  if (typeof val === "string") return val;
  return undefined;
}

router.get("/sovereign-mesh/status", (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        vault: getVaultStatus(),
        seed: getOrchestratorStatus(),
        children: getChildrenStatus(),
        council: getGrandCouncilStatus(),
        mesh: getMeshStatus(),
        distribution: getDistributionStatus(),
        knowledge: getMultiplierStatus(),
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/vault/status", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getVaultStatus() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/vault/keys", (req: Request, res: Response) => {
  try {
    const purposeRaw = req_query_string(req, "purpose");
    const service = req_query_string(req, "service");
    const purpose = isValidKeyPurpose(purposeRaw) ? purposeRaw : undefined;
    res.json({ success: true, data: listKeys({ purpose, service }) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/vault/generate", requireSovereignKey, (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const { purpose, service } = body;
    const bits = typeof body.bits === "number" ? body.bits : undefined;
    const rotationIntervalMs = typeof body.rotationIntervalMs === "number" ? body.rotationIntervalMs : undefined;
    if (!isValidKeyPurpose(purpose)) {
      res.status(400).json({ success: false, error: `purpose must be one of: ${VALID_KEY_PURPOSES.join(", ")}` });
      return;
    }
    if (typeof service !== "string" || !service) {
      res.status(400).json({ success: false, error: "service (string) is required" });
      return;
    }
    const key = generateSovereignKey(purpose, service, bits, rotationIntervalMs);
    res.json({ success: true, data: key });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/vault/rotate/:id", requireSovereignKey, (req: Request, res: Response) => {
  try {
    const rotated = rotateKey(req.params.id);
    if (!rotated) {
      res.status(404).json({ success: false, error: "Key not found or inactive" });
      return;
    }
    res.json({ success: true, data: rotated });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/vault/rotation-check", requireSovereignKey, (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: runRotationCheck() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/seed/status", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getOrchestratorStatus() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/seed/trigger", requireSovereignKey, async (_req: Request, res: Response) => {
  try {
    const result = await runSeedCycle();
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/children/status", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getChildrenStatus() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/children/:parentId", (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getAgentChildren(req.params.parentId) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/children/spawn", requireSovereignKey, (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const parentId = typeof body.parentId === "string" ? body.parentId : undefined;
    const missionRaw = body.mission;
    const context = typeof body.context === "string" ? body.context : undefined;

    if (!parentId) {
      res.status(400).json({ success: false, error: "parentId (string) is required" });
      return;
    }
    const mission = isValidChildMission(missionRaw) ? missionRaw : undefined;
    const child = spawnChild(parentId, mission, context);
    if (!child) {
      res.status(400).json({ success: false, error: "Could not spawn child — max children reached or invalid parent" });
      return;
    }
    res.json({ success: true, data: child });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/children/spawn-all", requireSovereignKey, (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: spawnAllAgentChildren() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/children/sync-all", requireSovereignKey, (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: runAllChildSyncs() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/council/status", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getGrandCouncilStatus() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/council/convene", requireSovereignKey, (_req: Request, res: Response) => {
  try {
    res.json({ success: true, message: "Grand Council session triggered — running BFT per-proposal votes in background", data: getGrandCouncilStatus() });
    runGrandCouncilSession().catch(err =>
      console.error("[SovereignMeshRoutes] Grand Council session error:", err instanceof Error ? err.message : err)
    );
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/council/transcript", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { transcript: getCouncilTranscript() } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/council/session", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getCouncilSession() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/council/queue", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getImplementationQueue() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/mesh/status", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getMeshStatus() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/mesh/nodes", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getAllNodes() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/mesh/expand", requireSovereignKey, async (_req: Request, res: Response) => {
  try {
    const result = await runExpansionCycle();
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/distribution/status", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getDistributionStatus() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/distribution/build", requireSovereignKey, async (_req: Request, res: Response) => {
  try {
    const pkg = await buildDistributionPackage();
    res.json({ success: true, data: pkg });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/distribution/publish/:buildId", requireSovereignKey, async (req: Request, res: Response) => {
  try {
    const pkg = await publishDistribution(req.params.buildId);
    if (!pkg) {
      res.status(404).json({ success: false, error: "Build not found or not ready to publish" });
      return;
    }
    res.json({ success: true, data: pkg });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/distribution/join", requireSovereignKey, (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const meshIdentity = body.meshIdentity as MeshIdentity | undefined;
    const region = typeof body.region === "string" ? body.region : undefined;
    if (!meshIdentity?.nodeId) {
      res.status(400).json({ success: false, error: "meshIdentity.nodeId is required" });
      return;
    }
    res.json({ success: true, data: registerJoinedInstallation(meshIdentity, region) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/distribution/installations", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getJoinedInstallations() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/knowledge/status", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getMultiplierStatus() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/knowledge/query", (req: Request, res: Response) => {
  try {
    const q = req_query_string(req, "q") ?? "";
    const limitRaw = parseInt(req_query_string(req, "limit") ?? "20", 10);
    const limit = isNaN(limitRaw) ? 20 : Math.min(limitRaw, 100);
    res.json({ success: true, data: queryKnowledge(q, limit) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/sovereign-mesh/knowledge/metrics", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getContributionMetrics() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/knowledge/ingest", requireSovereignKey, (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const { content, source, sourceId, sourceName, parentAgentId } = body;
    const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [];
    const summary = typeof body.summary === "string" ? body.summary : undefined;

    if (typeof content !== "string" || !content) {
      res.status(400).json({ success: false, error: "content (string) is required" });
      return;
    }
    if (!isValidKnowledgeSource(source)) {
      res.status(400).json({ success: false, error: `source must be one of: ${VALID_KNOWLEDGE_SOURCES.join(", ")}` });
      return;
    }
    if (typeof sourceId !== "string" || !sourceId) {
      res.status(400).json({ success: false, error: "sourceId (string) is required" });
      return;
    }
    if (typeof sourceName !== "string" || !sourceName) {
      res.status(400).json({ success: false, error: "sourceName (string) is required" });
      return;
    }
    if (typeof parentAgentId !== "string" || !parentAgentId) {
      res.status(400).json({ success: false, error: "parentAgentId (string) is required" });
      return;
    }

    const entry = ingestKnowledge(content, source, sourceId, sourceName, parentAgentId, tags, summary);
    if (!entry) {
      res.status(400).json({ success: false, error: "Content too short (minimum 10 characters)" });
      return;
    }
    res.json({ success: true, data: entry });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/sovereign-mesh/knowledge/distribute", requireSovereignKey, (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const rawNodes = body.targetNodes;
    const targetNodes = Array.isArray(rawNodes) && rawNodes.every(n => typeof n === "string")
      ? rawNodes as string[]
      : ["all-mesh-nodes"];
    res.json({ success: true, data: runDistributionCycle(targetNodes) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
