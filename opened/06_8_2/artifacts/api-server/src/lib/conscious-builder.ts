/**
 * Conscious Builder — Autonomous Self-Building Pipeline
 *
 * Connects Tessera's awareness/reflection loops and goal simulation outcomes
 * to actual code generation, testing, and deployment.
 *
 * Pipeline:
 * 1. Detect capability gaps via awareness engine or high-confidence goal simulations
 * 2. Design a solution through agent deliberation (Grand Conference for significant changes)
 * 3. Generate code for the identified gap
 * 4. Test in the sandbox with the existing safety validation
 * 5. Deploy with rollback protection
 * 6. Record in the Autonomous Build Log
 */

import fs from "fs";
import path from "path";
import { logger } from "./logger";
import { createProposal, testProposal, isTestingLocked } from "./code-sandbox";
import { deployProposal } from "./safe-deploy";
import { runGrandConference, type GrandProposal } from "./grand-conference";

const blog = (msg: string) => logger.info("[ConsciousBuilder] " + msg);

const BUILD_LOG_PATH = path.join(process.cwd(), "autonomous-build-log.json");
const BUILDER_STATE_PATH = path.join(process.cwd(), "conscious-builder-state.json");

const SAFE_NEW_FILE_DIRS = ["src/routes", "src/lib"];
const PROTECTED_FILES = [
  "src/index.ts", "src/app.ts", "src/lib/self-evolution.ts",
  "src/lib/code-sandbox.ts", "src/lib/safe-deploy.ts", "package.json",
  "tsconfig.json", ".env",
];

export interface AutonomousBuildEntry {
  id: string;
  timestamp: number;
  type: "gap-detected" | "design-proposed" | "code-generated" | "sandbox-tested" | "deployed" | "rolled-back" | "conference-deliberated" | "skipped";
  description: string;
  confidence: number;
  filePath?: string;
  isNewFile?: boolean;
  conferenceId?: string;
  deploymentId?: string;
  status: "success" | "failed" | "pending" | "skipped";
  details?: Record<string, unknown>;
}

export interface CapabilityGap {
  id: string;
  description: string;
  category: "missing-module" | "refactor" | "new-capability" | "simulation-outcome";
  confidence: number;
  suggestedFilePath?: string;
  suggestedCode?: string;
  source: "awareness-engine" | "goal-simulation" | "reflection-loop" | "pattern-detection";
  detectedAt: number;
}

export interface BuilderState {
  initialized: boolean;
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  rolledBackBuilds: number;
  lastBuildAt: number | null;
  nextBuildAt: number | null;
  pendingGaps: CapabilityGap[];
  activeConferenceId: string | null;
}

const buildLog: AutonomousBuildEntry[] = [];
const state: BuilderState = {
  initialized: false,
  totalBuilds: 0,
  successfulBuilds: 0,
  failedBuilds: 0,
  rolledBackBuilds: 0,
  lastBuildAt: null,
  nextBuildAt: null,
  pendingGaps: [],
  activeConferenceId: null,
};

const BUILDER_CYCLE_INTERVAL_MS = 30 * 60 * 1000;
const GRAND_CONFERENCE_CONFIDENCE_THRESHOLD = 0.85;

let builderTimer: ReturnType<typeof setTimeout> | null = null;
let builderRunning = false;

function loadBuildLog(): void {
  try {
    if (fs.existsSync(BUILD_LOG_PATH)) {
      const data = JSON.parse(fs.readFileSync(BUILD_LOG_PATH, "utf-8"));
      if (Array.isArray(data)) buildLog.push(...data.slice(-200));
    }
  } catch {
    blog("Could not load build log, starting fresh");
  }
}

function saveBuildLog(): void {
  try {
    fs.writeFileSync(BUILD_LOG_PATH, JSON.stringify(buildLog.slice(-200), null, 2), "utf-8");
  } catch (e: any) {
    blog(`Failed to save build log: ${e.message}`);
  }
}

function loadBuilderState(): void {
  try {
    if (fs.existsSync(BUILDER_STATE_PATH)) {
      const data = JSON.parse(fs.readFileSync(BUILDER_STATE_PATH, "utf-8"));
      Object.assign(state, data);
    }
  } catch {
    blog("Could not load builder state, starting fresh");
  }
}

function saveBuilderState(): void {
  try {
    fs.writeFileSync(BUILDER_STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (e: any) {
    blog(`Failed to save builder state: ${e.message}`);
  }
}

function addBuildEntry(entry: Omit<AutonomousBuildEntry, "id" | "timestamp">): AutonomousBuildEntry {
  const full: AutonomousBuildEntry = {
    ...entry,
    id: `build-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  buildLog.push(full);
  if (buildLog.length > 200) buildLog.splice(0, buildLog.length - 200);
  saveBuildLog();
  return full;
}

function validateNewFilePath(filePath: string): { valid: boolean; reason?: string } {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    return { valid: false, reason: `Path traversal detected: ${filePath}` };
  }
  if (PROTECTED_FILES.some(p => normalized.endsWith(p) || normalized === p)) {
    return { valid: false, reason: `${filePath} is a protected file` };
  }
  if (!SAFE_NEW_FILE_DIRS.some(d => normalized.startsWith(d))) {
    return { valid: false, reason: `${filePath} outside allowed dirs (${SAFE_NEW_FILE_DIRS.join(", ")})` };
  }
  return { valid: true };
}

function generateCapabilityGapCode(gap: CapabilityGap): { code: string; filePath: string; isNew: boolean } | null {
  if (gap.suggestedCode && gap.suggestedFilePath) {
    return { code: gap.suggestedCode, filePath: gap.suggestedFilePath, isNew: !fs.existsSync(path.join(process.cwd(), gap.suggestedFilePath)) };
  }

  if (gap.category === "new-capability" && gap.suggestedFilePath) {
    const moduleName = path.basename(gap.suggestedFilePath, ".ts");
    const loggerImportPath = gap.suggestedFilePath.startsWith("src/routes") ? "../lib/logger" : "./logger";
    const code = [
      `/**`,
      ` * ${moduleName} — Auto-generated by Tessera Conscious Builder`,
      ` * Generated at: ${new Date().toISOString()}`,
      ` * Gap detected: ${gap.description}`,
      ` * Source: ${gap.source}`,
      ` */`,
      ``,
      `import { logger } from "${loggerImportPath}";`,
      ``,
      `const mlog = (msg: string) => logger.info("[${moduleName}] " + msg);`,
      ``,
      `export interface ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Status {`,
      `  initialized: boolean;`,
      `  lastRunAt: number | null;`,
      `  cycleCount: number;`,
      `}`,
      ``,
      `const status: ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Status = {`,
      `  initialized: false,`,
      `  lastRunAt: null,`,
      `  cycleCount: 0,`,
      `};`,
      ``,
      `// initialize: sets up the module and starts the main loop`,
      `export async function initialize(): Promise<void> {`,
      `  if (status.initialized) return;`,
      `  status.initialized = true;`,
      `  mlog("${moduleName} initialized — capability gap filled by Conscious Builder");`,
      `}`,
      ``,
      `// getStatus: returns current module status`,
      `export function getStatus(): ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Status {`,
      `  return { ...status };`,
      `}`,
    ].join("\n");
    const isNew = !fs.existsSync(path.join(process.cwd(), gap.suggestedFilePath));
    return { code, filePath: gap.suggestedFilePath, isNew };
  }

  return null;
}

async function runGrandConferenceForGap(gap: CapabilityGap): Promise<{ approved: boolean; conferenceId: string }> {
  const proposals: GrandProposal[] = [
    {
      id: `gap-${gap.id}`,
      title: `Autonomous Build: ${gap.description.slice(0, 80)}`,
      description: `Tessera's Conscious Builder detected a capability gap: "${gap.description}". Confidence: ${Math.round(gap.confidence * 100)}%. Source: ${gap.source}. Proposed action: generate and deploy code to ${gap.suggestedFilePath ?? "a new module"}.`,
      proposedBy: "conscious-builder",
    },
  ];

  blog(`Convening Grand Conference for high-confidence autonomous build: "${gap.description.slice(0, 60)}"`);

  const result = await runGrandConference({
    topic: `Autonomous build proposal: ${gap.description}`,
    title: `Grand Conference: Conscious Builder Proposal — ${gap.category}`,
    description: `The Conscious Builder has identified a capability gap requiring autonomous code generation. The council must deliberate on whether to approve this self-modification.`,
    category: "autonomous-build",
    proposals,
  });

  state.activeConferenceId = result.conferenceId;
  saveBuilderState();

  addBuildEntry({
    type: "conference-deliberated",
    description: `Grand Conference deliberated on: "${gap.description.slice(0, 80)}"`,
    confidence: gap.confidence,
    filePath: gap.suggestedFilePath,
    conferenceId: result.conferenceId,
    status: result.status === "approved" ? "success" : "failed",
    details: {
      agentCount: result.agentCount,
      approvalRate: result.finalApprovalRate,
      status: result.status,
      rounds: result.rounds.length,
    },
  });

  return { approved: result.status === "approved", conferenceId: result.conferenceId };
}

async function buildFromGap(gap: CapabilityGap): Promise<boolean> {
  blog(`Processing capability gap: "${gap.description.slice(0, 80)}" (confidence: ${Math.round(gap.confidence * 100)}%)`);
  state.totalBuilds++;

  if (gap.confidence >= GRAND_CONFERENCE_CONFIDENCE_THRESHOLD) {
    try {
      const conferenceResult = await runGrandConferenceForGap(gap);
      if (!conferenceResult.approved) {
        blog(`Grand Conference rejected autonomous build for gap: "${gap.description.slice(0, 60)}"`);
        addBuildEntry({
          type: "skipped",
          description: `Conference rejected: "${gap.description.slice(0, 80)}"`,
          confidence: gap.confidence,
          filePath: gap.suggestedFilePath,
          conferenceId: conferenceResult.conferenceId,
          status: "skipped",
        });
        return false;
      }
      blog(`Grand Conference approved — proceeding with autonomous build`);
    } catch (e: any) {
      blog(`Grand Conference failed: ${e.message} — skipping build`);
      return false;
    }
  }

  addBuildEntry({
    type: "gap-detected",
    description: `Gap confirmed: "${gap.description.slice(0, 100)}"`,
    confidence: gap.confidence,
    filePath: gap.suggestedFilePath,
    isNewFile: !gap.suggestedFilePath || !fs.existsSync(path.join(process.cwd(), gap.suggestedFilePath)),
    status: "pending",
    details: { category: gap.category, source: gap.source },
  });

  const generated = generateCapabilityGapCode(gap);
  if (!generated) {
    blog(`No code generation strategy for gap category: ${gap.category}`);
    state.failedBuilds++;
    return false;
  }

  if (generated.isNew) {
    const pathCheck = validateNewFilePath(generated.filePath);
    if (!pathCheck.valid) {
      blog(`Path validation failed for new file: ${pathCheck.reason}`);
      addBuildEntry({
        type: "code-generated",
        description: `Path validation failed for new file: ${generated.filePath}`,
        confidence: gap.confidence,
        filePath: generated.filePath,
        isNewFile: true,
        status: "failed",
        details: { reason: pathCheck.reason },
      });
      state.failedBuilds++;
      return false;
    }
  }

  addBuildEntry({
    type: "code-generated",
    description: `Generated ${generated.isNew ? "new file" : "modification"}: ${generated.filePath}`,
    confidence: gap.confidence,
    filePath: generated.filePath,
    isNewFile: generated.isNew,
    status: "success",
    details: { codeLength: generated.code.length, category: gap.category },
  });

  if (isTestingLocked()) {
    blog(`Sandbox is busy — queueing gap for next cycle`);
    state.pendingGaps.unshift(gap);
    return false;
  }

  try {
    const fileName = path.basename(generated.filePath);
    blog(`Creating sandbox proposal for: ${fileName}`);
    const proposal = await createProposal(
      `[AutonomousBuild] ${gap.description.slice(0, 80)}`,
      generated.code,
      fileName,
      generated.filePath
    );

    addBuildEntry({
      type: "sandbox-tested",
      description: `Sandbox testing: ${fileName}`,
      confidence: gap.confidence,
      filePath: generated.filePath,
      isNewFile: generated.isNew,
      status: "pending",
      details: { proposalId: proposal.id },
    });

    const testResult = await testProposal(proposal.id, (msg) => blog(`  [test] ${msg}`));

    if (testResult.status !== "passed") {
      blog(`Sandbox tests failed for: ${fileName} — not deploying`);
      addBuildEntry({
        type: "sandbox-tested",
        description: `Sandbox FAILED: ${fileName}`,
        confidence: gap.confidence,
        filePath: generated.filePath,
        isNewFile: generated.isNew,
        status: "failed",
        details: { proposalId: proposal.id, status: testResult.status },
      });
      state.failedBuilds++;
      return false;
    }

    blog(`Sandbox passed — deploying ${fileName} to ${generated.filePath}`);
    const deployResult = await deployProposal(testResult, (msg) => blog(`  [deploy] ${msg}`));

    if (deployResult.success) {
      state.successfulBuilds++;
      state.lastBuildAt = Date.now();
      addBuildEntry({
        type: "deployed",
        description: `Successfully deployed: ${generated.filePath}`,
        confidence: gap.confidence,
        filePath: generated.filePath,
        isNewFile: generated.isNew,
        deploymentId: deployResult.deploymentId,
        status: "success",
        details: {
          deploymentId: deployResult.deploymentId,
          buildVerified: deployResult.buildVerified,
          isNewFile: generated.isNew,
        },
      });
      blog(`Autonomous build successful: ${generated.filePath} (deployment: ${deployResult.deploymentId})`);
      return true;
    } else {
      if (deployResult.rolledBack) {
        state.rolledBackBuilds++;
        addBuildEntry({
          type: "rolled-back",
          description: `Auto-rolled back: ${generated.filePath} — ${deployResult.error}`,
          confidence: gap.confidence,
          filePath: generated.filePath,
          isNewFile: generated.isNew,
          deploymentId: deployResult.deploymentId,
          status: "failed",
          details: { error: deployResult.error, rolledBack: true },
        });
      } else {
        state.failedBuilds++;
        addBuildEntry({
          type: "deployed",
          description: `Deploy failed: ${generated.filePath} — ${deployResult.error}`,
          confidence: gap.confidence,
          filePath: generated.filePath,
          isNewFile: generated.isNew,
          status: "failed",
          details: { error: deployResult.error },
        });
      }
      return false;
    }
  } catch (e: any) {
    blog(`Build pipeline error: ${e.message}`);
    state.failedBuilds++;
    addBuildEntry({
      type: "deployed",
      description: `Pipeline error: ${e.message}`,
      confidence: gap.confidence,
      filePath: gap.suggestedFilePath,
      status: "failed",
      details: { error: e.message },
    });
    return false;
  }
}

export function registerCapabilityGap(gap: Omit<CapabilityGap, "id" | "detectedAt">): CapabilityGap {
  const fullGap: CapabilityGap = {
    ...gap,
    id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    detectedAt: Date.now(),
  };
  state.pendingGaps.push(fullGap);
  if (state.pendingGaps.length > 50) state.pendingGaps = state.pendingGaps.slice(-50);
  saveBuilderState();
  blog(`Gap registered: "${gap.description.slice(0, 60)}" (confidence: ${Math.round(gap.confidence * 100)}%)`);
  return fullGap;
}

export function registerSimulationOutcome(goal: string, confidence: number, recommendedPath: string): void {
  if (confidence < 0.8) return;
  const gap: CapabilityGap = {
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    description: `Goal simulation high-confidence outcome: "${goal.slice(0, 80)}" → ${recommendedPath.slice(0, 60)}`,
    category: "simulation-outcome",
    confidence,
    source: "goal-simulation",
    detectedAt: Date.now(),
  };
  state.pendingGaps.push(gap);
  if (state.pendingGaps.length > 50) state.pendingGaps = state.pendingGaps.slice(-50);
  saveBuilderState();
  blog(`Simulation outcome registered for build consideration (confidence: ${Math.round(confidence * 100)}%)`);
}

async function runBuilderCycle(): Promise<void> {
  blog(`Starting conscious builder cycle — ${state.pendingGaps.length} pending gaps`);

  const gaps = state.pendingGaps.splice(0, 3);
  state.pendingGaps = state.pendingGaps;
  saveBuilderState();

  if (gaps.length === 0) {
    blog("No pending gaps to process this cycle");
    return;
  }

  const sortedGaps = gaps.sort((a, b) => b.confidence - a.confidence);
  const bestGap = sortedGaps[0];

  if (bestGap) {
    await buildFromGap(bestGap);
  }

  for (let i = 1; i < sortedGaps.length; i++) {
    const g = sortedGaps[i]!;
    state.pendingGaps.push(g);
  }
  saveBuilderState();
}

function scheduleNextCycle(): void {
  if (builderTimer) clearTimeout(builderTimer);
  builderTimer = setTimeout(async () => {
    try {
      await runBuilderCycle();
    } catch (e: any) {
      blog(`Cycle error: ${e.message}`);
    }
    scheduleNextCycle();
  }, BUILDER_CYCLE_INTERVAL_MS);
  state.nextBuildAt = Date.now() + BUILDER_CYCLE_INTERVAL_MS;
}

export function startConsciousBuilder(): void {
  if (builderRunning) return;
  builderRunning = true;
  loadBuildLog();
  loadBuilderState();
  state.initialized = true;
  blog("Conscious Builder initialized — autonomous self-building pipeline active");
  scheduleNextCycle();
}

export function stopConsciousBuilder(): void {
  builderRunning = false;
  if (builderTimer) { clearTimeout(builderTimer); builderTimer = null; }
  blog("Conscious Builder stopped");
}

export function getBuilderStatus(): BuilderState & { running: boolean } {
  return { ...state, running: builderRunning };
}

export function getBuildLog(limit = 50): AutonomousBuildEntry[] {
  return buildLog.slice(-limit).reverse();
}

export async function triggerManualBuild(gap: Omit<CapabilityGap, "id" | "detectedAt">): Promise<AutonomousBuildEntry[]> {
  const fullGap = registerCapabilityGap(gap);
  await buildFromGap(fullGap);
  return getBuildLog(10);
}
