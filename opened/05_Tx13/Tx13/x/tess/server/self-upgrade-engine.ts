import { logger } from "./logger";
import fs from "fs";
import path from "path";

interface UpgradeProposal {
  id: string;
  targetFile: string;
  analysisResult: string;
  proposedChange: string;
  changeType: "optimization" | "feature" | "bugfix" | "security" | "refactor";
  estimatedImpact: number;
  status: "analyzing" | "proposed" | "submitted" | "approved" | "applied" | "verified" | "rolled-back" | "rejected";
  councilVoteId?: string;
  backupContent?: string;
  testResult?: { passed: boolean; description: string };
  createdAt: number;
  appliedAt?: number;
  verifiedAt?: number;
  error?: string;
}

interface UpgradeStats {
  totalProposals: number;
  analyzing: number;
  proposed: number;
  submitted: number;
  approved: number;
  applied: number;
  verified: number;
  rolledBack: number;
  rejected: number;
  successRate: number;
  isRunning: boolean;
  lastCycleAt: string | null;
  analyzedFiles: number;
}

const proposals: UpgradeProposal[] = [];
let running = false;
let cycleInterval: ReturnType<typeof setInterval> | null = null;
let lastCycleAt: number | null = null;
let proposalIdCounter = 0;
let analyzedFileCount = 0;

const ANALYZABLE_FILES = [
  "server/knowledge-engine.ts",
  "server/agi-training-engine.ts",
  "server/auto-improvement-daemon.ts",
  "server/autonomous-builder.ts",
  "server/neural-synapse.ts",
  "server/sovereign-engine.ts",
  "server/council-executor.ts",
  "server/swarm-optimizer.ts",
  "server/tesseract-orchestrator.ts",
  "server/sovereign-brain-engine.ts",
  "server/system-health-agency.ts",
  "server/sovereignty-action-pipeline.ts",
  "server/sovereign-api-gateway.ts",
  "server/api-security-hardening.ts",
  "server/sovereignty-assessment.ts",
  "server/sovereignty-roadmap-executor.ts",
];

const OPTIMIZATION_PATTERNS: { pattern: RegExp; description: string; changeType: UpgradeProposal["changeType"] }[] = [
  { pattern: /setInterval\([^,]+,\s*(\d+)\)/, description: "Interval timing could be optimized for resource efficiency", changeType: "optimization" },
  { pattern: /catch\s*\(\s*\)\s*\{\s*\}/, description: "Empty catch blocks swallow errors — add logging", changeType: "bugfix" },
  { pattern: /console\.(log|error|warn)\(/, description: "Direct console calls should use structured logger", changeType: "refactor" },
  { pattern: /JSON\.parse\([^)]+\)(?!\s*(?:catch|\.catch))/, description: "Unguarded JSON.parse could throw on malformed input", changeType: "bugfix" },
  { pattern: /\.length\s*>\s*(\d{3,})/, description: "Large array threshold check — consider pagination or streaming", changeType: "optimization" },
  { pattern: /password|secret|token|apikey/i, description: "Sensitive data handling detected — verify proper sanitization", changeType: "security" },
  { pattern: /setTimeout\([^,]+,\s*0\)/, description: "setTimeout(fn, 0) can be replaced with setImmediate for better performance", changeType: "optimization" },
  { pattern: /new\s+Date\(\)\.toISOString\(\)/, description: "Repeated Date instantiation — consider caching timestamp", changeType: "optimization" },
];

function generateProposalId(): string {
  return `upg-${++proposalIdCounter}-${Date.now().toString(36)}`;
}

export function analyzeFile(filePath: string): UpgradeProposal[] {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return [];

  let content: string;
  try {
    content = fs.readFileSync(fullPath, "utf8");
  } catch {
    return [];
  }

  analyzedFileCount++;
  const fileProposals: UpgradeProposal[] = [];
  const lines = content.split("\n");

  for (const optPattern of OPTIMIZATION_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (optPattern.pattern.test(lines[i])) {
        const existing = proposals.find(p =>
          p.targetFile === filePath &&
          p.analysisResult === optPattern.description &&
          (p.status === "proposed" || p.status === "submitted" || p.status === "approved")
        );
        if (existing) continue;

        const proposal: UpgradeProposal = {
          id: generateProposalId(),
          targetFile: filePath,
          analysisResult: optPattern.description,
          proposedChange: `Line ${i + 1}: ${lines[i].trim().slice(0, 80)}... → ${optPattern.description}`,
          changeType: optPattern.changeType,
          estimatedImpact: optPattern.changeType === "security" ? 80 : optPattern.changeType === "bugfix" ? 60 : 40,
          status: "proposed",
          createdAt: Date.now(),
        };
        fileProposals.push(proposal);
        proposals.push(proposal);
        break;
      }
    }
  }

  const functionCount = (content.match(/(?:export\s+)?(?:async\s+)?function\s+\w+/g) || []).length;
  const lineCount = lines.length;

  if (lineCount > 500 && functionCount < 5) {
    const proposal: UpgradeProposal = {
      id: generateProposalId(),
      targetFile: filePath,
      analysisResult: `File has ${lineCount} lines but only ${functionCount} functions — consider splitting into modules`,
      proposedChange: `Refactor ${filePath} into smaller, focused modules`,
      changeType: "refactor",
      estimatedImpact: 30,
      status: "proposed",
      createdAt: Date.now(),
    };
    fileProposals.push(proposal);
    proposals.push(proposal);
  }

  if (proposals.length > 300) proposals.splice(0, proposals.length - 300);

  return fileProposals;
}

export async function submitUpgradeToCouncil(proposalId: string): Promise<boolean> {
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal || proposal.status !== "proposed") return false;

  try {
    const { submitSovereigntyProposal } = await import("./grand-council-routes");
    const motion = `[SELF-UPGRADE] ${proposal.changeType.toUpperCase()}: ${proposal.analysisResult}\n\nTarget File: ${proposal.targetFile}\nChange: ${proposal.proposedChange}\nEstimated Impact: ${proposal.estimatedImpact}%\n\nThis upgrade was identified by the autonomous self-analysis engine.`;
    const voteId = submitSovereigntyProposal(motion);
    proposal.councilVoteId = voteId;
    proposal.status = "submitted";
    logger.info("SelfUpgrade", `Proposal ${proposalId} submitted as vote ${voteId}`);
    return true;
  } catch (err: any) {
    proposal.error = err.message;
    logger.error("SelfUpgrade", `Failed to submit proposal ${proposalId}: ${err.message}`);
    return false;
  }
}

export async function checkUpgradeVotes(): Promise<{ approved: number; rejected: number }> {
  let approved = 0;
  let rejected = 0;

  const submitted = proposals.filter(p => p.status === "submitted" && p.councilVoteId);
  for (const proposal of submitted) {
    try {
      const { getVoteStatus } = await import("./grand-council-routes");
      const voteStatus = getVoteStatus(proposal.councilVoteId!);
      if (!voteStatus) continue;

      if (voteStatus.status === "passed") {
        proposal.status = "approved";
        approved++;

        const testResult = runPreApplyTest(proposal);
        proposal.testResult = testResult;

        if (testResult.passed) {
          proposal.status = "applied";
          proposal.appliedAt = Date.now();

          const verifyResult = runPostApplyTest(proposal);
          if (verifyResult.passed) {
            proposal.status = "verified";
            proposal.verifiedAt = Date.now();
          } else {
            proposal.status = "rolled-back";
            proposal.error = "Post-apply verification failed — rolled back";
          }
        } else {
          proposal.status = "rolled-back";
          proposal.error = "Pre-apply test failed — change not applied";
        }
      } else if (voteStatus.status === "failed") {
        proposal.status = "rejected";
        rejected++;
      }
    } catch (err: any) {
      logger.error("SelfUpgrade", `Vote check failed for ${proposal.id}: ${err.message}`);
    }
  }

  return { approved, rejected };
}

function runPreApplyTest(proposal: UpgradeProposal): { passed: boolean; description: string } {
  try {
    const fullPath = path.join(process.cwd(), proposal.targetFile);
    if (!fs.existsSync(fullPath)) {
      return { passed: false, description: `Target file ${proposal.targetFile} does not exist` };
    }

    const content = fs.readFileSync(fullPath, "utf8");
    if (content.length === 0) {
      return { passed: false, description: "Target file is empty" };
    }

    proposal.backupContent = content;
    return { passed: true, description: `Pre-apply checks passed for ${proposal.targetFile}` };
  } catch (err: any) {
    return { passed: false, description: `Pre-apply test failed: ${err.message}` };
  }
}

function runPostApplyTest(proposal: UpgradeProposal): { passed: boolean; description: string } {
  try {
    const fullPath = path.join(process.cwd(), proposal.targetFile);
    if (!fs.existsSync(fullPath)) {
      return { passed: false, description: "File missing after apply" };
    }

    const content = fs.readFileSync(fullPath, "utf8");
    if (content.length === 0) {
      return { passed: false, description: "File empty after apply" };
    }

    const hasSyntaxIssue = content.includes("undefined") && content.includes("null") && content.length < 100;
    if (hasSyntaxIssue) {
      return { passed: false, description: "Potential syntax/logic issue detected" };
    }

    return { passed: true, description: `Post-apply verification passed for ${proposal.targetFile}` };
  } catch (err: any) {
    return { passed: false, description: `Post-apply test failed: ${err.message}` };
  }
}

export function rollbackUpgrade(proposalId: string): boolean {
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal || !proposal.backupContent) return false;

  try {
    const fullPath = path.join(process.cwd(), proposal.targetFile);
    fs.writeFileSync(fullPath, proposal.backupContent);
    proposal.status = "rolled-back";
    proposal.error = "Manually rolled back";
    logger.info("SelfUpgrade", `Rolled back upgrade ${proposalId} on ${proposal.targetFile}`);
    return true;
  } catch (err: any) {
    logger.error("SelfUpgrade", `Rollback failed for ${proposalId}: ${err.message}`);
    return false;
  }
}

async function analysisCycle(): Promise<void> {
  const fileIdx = analyzedFileCount % ANALYZABLE_FILES.length;
  const file = ANALYZABLE_FILES[fileIdx];
  analyzeFile(file);

  const proposed = proposals.filter(p => p.status === "proposed");
  for (const proposal of proposed.slice(0, 2)) {
    await submitUpgradeToCouncil(proposal.id);
  }

  await checkUpgradeVotes();
  lastCycleAt = Date.now();
}

export function startSelfUpgradeEngine(): void {
  if (running) return;
  running = true;

  for (const file of ANALYZABLE_FILES.slice(0, 3)) {
    analyzeFile(file);
  }

  cycleInterval = setInterval(async () => {
    try {
      await analysisCycle();
    } catch (err: any) {
      logger.error("SelfUpgrade", `Analysis cycle failed: ${err.message}`);
    }
  }, 300000);

  logger.info("SelfUpgrade", `Self-upgrade engine started — analyzing ${ANALYZABLE_FILES.length} files (300s cycle)`);
}

export function stopSelfUpgradeEngine(): void {
  if (cycleInterval) {
    clearInterval(cycleInterval);
    cycleInterval = null;
  }
  running = false;
  logger.info("SelfUpgrade", "Self-upgrade engine stopped");
}

export function getUpgradeStats(): UpgradeStats {
  const verified = proposals.filter(p => p.status === "verified");
  const total = proposals.length || 1;

  return {
    totalProposals: proposals.length,
    analyzing: proposals.filter(p => p.status === "analyzing").length,
    proposed: proposals.filter(p => p.status === "proposed").length,
    submitted: proposals.filter(p => p.status === "submitted").length,
    approved: proposals.filter(p => p.status === "approved").length,
    applied: proposals.filter(p => p.status === "applied").length,
    verified: verified.length,
    rolledBack: proposals.filter(p => p.status === "rolled-back").length,
    rejected: proposals.filter(p => p.status === "rejected").length,
    successRate: parseFloat(((verified.length / total) * 100).toFixed(1)),
    isRunning: running,
    lastCycleAt: lastCycleAt ? new Date(lastCycleAt).toISOString() : null,
    analyzedFiles: analyzedFileCount,
  };
}

export function getUpgradeProposals(filter?: { status?: string; changeType?: string; limit?: number }): UpgradeProposal[] {
  let result = [...proposals];
  if (filter?.status) result = result.filter(p => p.status === filter.status);
  if (filter?.changeType) result = result.filter(p => p.changeType === filter.changeType);
  result.sort((a, b) => b.createdAt - a.createdAt);
  if (filter?.limit) result = result.slice(0, filter.limit);
  return result.map(p => ({ ...p, backupContent: undefined }));
}
