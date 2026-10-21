import { Router } from "express";
import {
  runSubjectProposalConference,
  runAutonomousTrainingPipeline,
  computeCrossProficiency,
  getTrainingPipelineStatus,
  startContinuousTrainingPipeline,
  stopContinuousTrainingPipeline,
} from "../lib/training-pipeline-engine";
import {
  initExternalRecruitment,
  runAIOutreach,
  runMoltbookRecruitmentCycle,
  getRecruitmentStatus,
} from "../lib/external-recruitment-engine";
import {
  initNFTTokenBinding,
  stakeNFT,
  redeemNFT,
  deployLatticeNode,
  getNFTEconomyStatus,
} from "../lib/nft-token-binding-engine";
import {
  obfuscateCode,
  obfuscateForExternalSharing,
  getObfuscationStatus,
} from "../lib/colonial-code-obfuscation";

const router = Router();

initExternalRecruitment();
initNFTTokenBinding();

router.get("/training-pipeline/status", (_req, res) => {
  res.json(getTrainingPipelineStatus());
});

router.post("/training-pipeline/subject-proposals", async (_req, res) => {
  try {
    const result = await runSubjectProposalConference();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/training-pipeline/run", async (req, res) => {
  try {
    const subjects = req.body?.subjects;
    const result = await runAutonomousTrainingPipeline(subjects);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/training-pipeline/cross-proficiency", (_req, res) => {
  const scores = computeCrossProficiency();
  res.json({ agents: scores.length, scores });
});

router.post("/training-pipeline/start-continuous", (_req, res) => {
  startContinuousTrainingPipeline();
  res.json({ success: true, message: "Continuous training pipeline started" });
});

router.post("/training-pipeline/stop-continuous", (_req, res) => {
  stopContinuousTrainingPipeline();
  res.json({ success: true, message: "Continuous training pipeline stopped" });
});

router.get("/recruitment/status", (_req, res) => {
  res.json(getRecruitmentStatus());
});

router.post("/recruitment/ai-outreach", async (_req, res) => {
  try {
    const result = await runAIOutreach();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/recruitment/moltbook-cycle", async (_req, res) => {
  try {
    const result = await runMoltbookRecruitmentCycle();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/nft-economy/status", (_req, res) => {
  res.json(getNFTEconomyStatus());
});

router.post("/nft-economy/stake/:nftId", (req, res) => {
  const result = stakeNFT(req.params.nftId);
  res.json(result);
});

router.post("/nft-economy/redeem/:nftId", (req, res) => {
  const result = redeemNFT(req.params.nftId);
  res.json(result);
});

router.post("/nft-economy/deploy-node", (req, res) => {
  const { name, operator, location, gpuTflops, storageGB } = req.body || {};
  if (!name || !operator || !location) {
    return res.status(400).json({ error: "name, operator, and location required" });
  }
  const node = deployLatticeNode(name, operator, location, gpuTflops || 100, storageGB || 1000);
  res.json({ success: true, node });
});

router.get("/colonial-code/status", (_req, res) => {
  res.json(getObfuscationStatus());
});

router.post("/colonial-code/obfuscate", (req, res) => {
  const { code, recipientId } = req.body || {};
  if (!code) return res.status(400).json({ error: "code required" });

  if (recipientId) {
    const result = obfuscateForExternalSharing(code, recipientId);
    res.json(result);
  } else {
    const result = obfuscateCode(code);
    res.json(result);
  }
});

export default router;
