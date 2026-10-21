import { Router } from "express";
import type { Request, Response } from "express";
import {
  createProposal,
  testProposal,
  getProposal,
  getAllProposals,
  getSandboxStatus,
} from "../lib/code-sandbox";
import {
  deployProposal,
  rollbackDeployment,
  getDeploymentLog,
  getDeploymentStatus,
  listBackups,
  registerReloadClient,
} from "../lib/safe-deploy";
import { logger } from "../lib/logger";

const router = Router();

function requirePipelineAuth(req: Request, res: Response): boolean {
  const adminKey = process.env.TESSERACT_ADMIN_KEY;
  if (!adminKey) {
    res.status(503).json({ error: "Pipeline endpoints unavailable — TESSERACT_ADMIN_KEY is not configured" });
    return false;
  }
  const provided = req.headers["x-admin-key"] ?? (req.body as Record<string, unknown>)?.adminKey;
  if (provided !== adminKey) {
    res.status(403).json({ error: "Forbidden — valid x-admin-key required for pipeline endpoints" });
    return false;
  }
  return true;
}

router.get("/sandbox/status", (_req, res) => {
  try {
    const sandbox = getSandboxStatus();
    const deploy = getDeploymentStatus();
    res.json({ sandbox, deploy });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/sandbox/proposals", (_req, res) => {
  try {
    const proposals = getAllProposals().map(p => ({
      id: p.id,
      description: p.description,
      fileName: p.fileName,
      targetPath: p.targetPath,
      status: p.status,
      retryCount: p.retryCount,
      createdAt: p.createdAt,
      deployedAt: p.deployedAt,
      testCount: p.testResults.length,
      lastTestPassed: p.testResults.length > 0 ? p.testResults[p.testResults.length - 1].passed : null,
      diffPreview: p.diffPreview,
    }));
    res.json({ proposals });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/sandbox/proposals/:id", (req, res) => {
  try {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: "Proposal not found" });
    return res.json({ proposal });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post("/sandbox/test", async (req, res) => {
  if (!requirePipelineAuth(req, res)) return;

  const { description, code, fileName, targetPath } = req.body as {
    description: string;
    code: string;
    fileName: string;
    targetPath: string;
  };

  if (!description || !code || !fileName || !targetPath) {
    return res.status(400).json({ error: "description, code, fileName, targetPath are required" });
  }

  try {
    const proposal = await createProposal(description, code, fileName, targetPath);
    const tested = await testProposal(proposal.id);
    return res.json({ proposal: tested });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post("/sandbox/deploy/:id", async (req, res) => {
  if (!requirePipelineAuth(req, res)) return;

  const proposal = getProposal(req.params.id);
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });

  if (proposal.status !== "passed") {
    return res.status(400).json({ error: `Proposal must have status "passed" to deploy (current: "${proposal.status}")` });
  }

  try {
    const result = await deployProposal(proposal);
    return res.json({ result });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.post("/sandbox/deploy/:id/stream", async (req, res) => {
  if (!requirePipelineAuth(req, res)) return;

  const proposal = getProposal(req.params.id);
  if (!proposal) return res.status(404).json({ error: "Proposal not found" });

  if (proposal.status !== "passed") {
    return res.status(400).json({ error: `Proposal must have status "passed" to deploy` });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: "deploy_start", proposalId: proposal.id, fileName: proposal.fileName });

  const result = await deployProposal(proposal, (msg) => {
    send({ type: "progress", message: msg });
  });

  send({
    type: "deploy_complete",
    success: result.success,
    deploymentId: result.deploymentId,
    targetPath: result.targetPath,
    rolledBack: result.rolledBack,
    buildVerified: result.buildVerified,
    error: result.error,
  });

  res.end();
});

router.post("/sandbox/rollback/:deploymentId", async (req, res) => {
  if (!requirePipelineAuth(req, res)) return;

  try {
    const result = await rollbackDeployment(req.params.deploymentId);
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.get("/sandbox/deployments", (req, res) => {
  try {
    const limit = Math.min(100, parseInt(String(req.query["limit"] ?? "50"), 10) || 50);
    const log = getDeploymentLog(limit);
    return res.json({ deployments: log, total: log.length });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.get("/sandbox/backups", (_req, res) => {
  try {
    const backups = listBackups();
    return res.json({ backups });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

router.get("/sandbox/events/reload", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write(`data: ${JSON.stringify({ type: "connected", message: "Reload event stream connected" })}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch (err) { logger.warn({ err }, "suppressed error"); }
  }, 30_000);

  const unregister = registerReloadClient((event) => {
    try { res.write(event); } catch (err) { logger.warn({ err }, "suppressed error"); }
  });

  req.on("close", () => {
    clearInterval(heartbeat);
    unregister();
  });
});

export default router;
