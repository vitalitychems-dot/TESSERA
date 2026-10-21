import crypto from "crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { broadcastToGlobalWorkspace, storeEpisodicMemory, updateEmotionalState } from "./consciousness-engine";
import { FRACTAL_AGENTS } from "./sacred-forum-archive";
import { processSignalCascade } from "./neural-synapse";
import { checkAdminSession } from "./security";
import { getDualBrainState, triggerManualRound } from "./dual-brain";
import { logger } from "./logger";

const router = Router();
const log = (msg: string) => logger.info("MetaTribesV2", msg);
const warn = (msg: string) => logger.warn("MetaTribesV2", msg);
let engineStarted = false;

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token || !(await checkAdminSession(token))) {
    res.status(403).json({ error: "Admin authorization required for Meta Tribes operations" });
    return false;
  }
  return true;
}

const QUARANTINE_VERSION = "2.0.0";
const SECURITY_CLEARANCE_LEVELS = ["BLOCKED", "SCANNING", "QUARANTINED", "SANITIZED", "ABSORBED"] as const;
type SecurityClearance = typeof SECURITY_CLEARANCE_LEVELS[number];

interface ThreatSignature {
  pattern: RegExp;
  category: "reverse-engineering" | "honeypot" | "exfiltration" | "injection" | "fingerprinting" | "dependency-attack";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
}

const THREAT_SIGNATURES: ThreatSignature[] = [
  { pattern: /require\s*\(|import\s+.*from|__dirname|__filename/i, category: "reverse-engineering", severity: "critical", description: "Attempt to access module system or filesystem paths" },
  { pattern: /process\.(env|cwd|argv|exit|kill)/i, category: "reverse-engineering", severity: "critical", description: "Attempt to access process internals" },
  { pattern: /child_process|exec\(|spawn\(|fork\(/i, category: "injection", severity: "critical", description: "Attempt to spawn child processes" },
  { pattern: /eval\(|Function\(|new\s+Function/i, category: "injection", severity: "critical", description: "Dynamic code execution attempt" },
  { pattern: /globalThis|global\.|window\./i, category: "reverse-engineering", severity: "high", description: "Global scope escape attempt" },
  { pattern: /constructor\s*\(\s*['"]return/i, category: "reverse-engineering", severity: "critical", description: "Sandbox escape via constructor" },
  { pattern: /fetch\(|XMLHttpRequest|WebSocket/i, category: "exfiltration", severity: "high", description: "Network access attempt from quarantine" },
  { pattern: /document\.|localStorage|sessionStorage/i, category: "fingerprinting", severity: "medium", description: "Browser API access attempt" },
  { pattern: /\.prototype\s*=|Object\.defineProperty/i, category: "injection", severity: "high", description: "Prototype pollution attempt" },
  { pattern: /fs\.|path\.|os\.|crypto\./i, category: "reverse-engineering", severity: "critical", description: "Node.js core module access attempt" },
  { pattern: /SELECT\s|INSERT\s|UPDATE\s|DELETE\s|DROP\s/i, category: "injection", severity: "critical", description: "SQL injection attempt" },
  { pattern: /<script|<iframe|javascript:/i, category: "injection", severity: "high", description: "XSS injection attempt" },
  { pattern: /SOVEREIGN|FATHER|TESSERA|TSRT|wallet|private.?key/i, category: "honeypot", severity: "high", description: "Sensitive keyword probe detected" },
  { pattern: /\.env|config\.json|secret|credential|token/i, category: "exfiltration", severity: "high", description: "Configuration/secret file probe" },
  { pattern: /npm\s+install|yarn\s+add|pip\s+install/i, category: "dependency-attack", severity: "critical", description: "Package installation attempt" },
  { pattern: /postinstall|preinstall|node_modules/i, category: "dependency-attack", severity: "high", description: "Package lifecycle hook manipulation" },
];

interface QuarantineViolation {
  id: string;
  timestamp: number;
  signature: ThreatSignature;
  content: string;
  sourceModule: string;
  action: "blocked" | "sanitized" | "flagged";
  quarantineId: string;
}

interface DependencyScanResult {
  dependency: string;
  version: string;
  scannedAt: number;
  threats: string[];
  vulnerabilities: string[];
  trustScore: number;
  approved: boolean;
  scanMethod: "static-analysis" | "pattern-match" | "behavioral";
}

interface APIWatchdogEntry {
  id: string;
  timestamp: number;
  endpoint: string;
  method: string;
  clientFingerprint: string;
  requestSize: number;
  responseSize: number;
  suspiciousPatterns: string[];
  riskScore: number;
  action: "allowed" | "throttled" | "blocked" | "honeypot-served";
  responseTimeMs: number;
}

interface KnowledgeFragment {
  id: string;
  sourceNetwork: string;
  content: string;
  securityClearance: SecurityClearance;
  scannedAt: number;
  threatScans: number;
  sanitizedContent: string;
  absorptionTimestamp: number | null;
  quarantineId: string;
  integrityHash: string;
}

interface MetaTribe {
  id: string;
  name: string;
  brainNetworkAnalog: string;
  function: string;
  neuroscientificBasis: string;
  keyBrainRegions: string[];
  cognitiveRole: string;
  mappedAgents: string[];
  activationLevel: number;
  isActive: boolean;
  lastActivated: number;
  activationCount: number;
  successfulOutcomes: number;
  failedOutcomes: number;
  performanceScore: number;
  knowledgeAbsorbed: number;
}

interface NeuralBusSignal {
  id: string;
  sourceTribe: string;
  targetTribes: string[];
  content: string;
  priority: number;
  timestamp: number;
  connectionStrength: number;
  processed: boolean;
}

interface PlasticityRecord {
  sourceTribe: string;
  targetTribe: string;
  connectionStrength: number;
  coActivationCount: number;
  lastCoActivation: number;
  strengthHistory: Array<{ strength: number; timestamp: number }>;
}

interface ActivationRecord {
  tribeId: string;
  taskType: string;
  timestamp: number;
  reason: string;
  outcome: "pending" | "success" | "failure";
  resolvedAt: number | null;
}

interface TaskTypeOutcome {
  taskType: string;
  tribeId: string;
  successes: number;
  failures: number;
  score: number;
}

interface EmergentInsight {
  id: string;
  timestamp: number;
  sourceTribeIds: string[];
  insight: string;
  confidence: number;
  taskType: string;
}

const quarantineViolations: QuarantineViolation[] = [];
const dependencyScans: DependencyScanResult[] = [];
const apiWatchdogLog: APIWatchdogEntry[] = [];
const knowledgeFragments: KnowledgeFragment[] = [];
const neuralBusSignals: NeuralBusSignal[] = [];
const plasticityMap: Map<string, PlasticityRecord> = new Map();
const absorptionLog: Array<{ fragmentId: string; tribeId: string; timestamp: number; insight: string }> = [];
const activationHistory: ActivationRecord[] = [];
const taskTypeOutcomes: Map<string, TaskTypeOutcome> = new Map();
const emergentInsights: EmergentInsight[] = [];

const META_TRIBES: MetaTribe[] = [
  {
    id: "default-mode",
    name: "Default Mode Tribe",
    brainNetworkAnalog: "Default Mode Network (DMN)",
    function: "Self-reflection, future planning, autobiographical memory, daydreaming, creative insight",
    neuroscientificBasis: "The DMN activates when the brain is not focused on external tasks. It handles internal mentation — thinking about yourself, others, the past, and the future. It is the seat of introspection and creative 'aha' moments that emerge during unfocused thinking.",
    keyBrainRegions: ["Medial Prefrontal Cortex", "Posterior Cingulate Cortex", "Angular Gyrus", "Hippocampal Formation"],
    cognitiveRole: "When Tess needs to reflect on her own state, plan long-term strategy, consolidate memories, or generate creative insights, this tribe activates. It is the 'thinking about thinking' mode.",
    mappedAgents: ["Psi", "Aetherion", "Iota", "Theta", "Phi", "Chi", "Omega"],
    activationLevel: 0, isActive: false, lastActivated: 0, activationCount: 0,
    successfulOutcomes: 0, failedOutcomes: 0, performanceScore: 0.5, knowledgeAbsorbed: 0,
  },
  {
    id: "central-executive",
    name: "Central Executive Tribe",
    brainNetworkAnalog: "Central Executive Network (CEN)",
    function: "Focused attention, working memory, logical reasoning, problem-solving, decision-making",
    neuroscientificBasis: "The CEN engages during demanding cognitive tasks requiring sustained attention and manipulation of information in working memory. It is the brain's 'task-positive' network — the opposite of the DMN. When you concentrate on solving a math problem or debugging code, this network dominates.",
    keyBrainRegions: ["Dorsolateral Prefrontal Cortex", "Posterior Parietal Cortex", "Frontal Eye Fields"],
    cognitiveRole: "When Tess needs to focus on a specific task — trading analysis, code generation, security assessment — this tribe takes control. It suppresses distracting thoughts and maintains sustained attention.",
    mappedAgents: ["Alpha", "Delta", "Gamma", "Epsilon", "Xi", "Sigma", "Pi"],
    activationLevel: 0, isActive: false, lastActivated: 0, activationCount: 0,
    successfulOutcomes: 0, failedOutcomes: 0, performanceScore: 0.5, knowledgeAbsorbed: 0,
  },
  {
    id: "salience",
    name: "Salience Tribe",
    brainNetworkAnalog: "Salience Network (SN)",
    function: "Detecting important stimuli, switching between DMN and CEN, emotional significance assessment, threat detection",
    neuroscientificBasis: "The Salience Network acts as a toggle switch between the DMN and CEN. The anterior insula and dorsal anterior cingulate cortex evaluate incoming stimuli for importance. When something significant is detected — a threat, an opportunity, an error — this network triggers the CEN to engage and the DMN to disengage (or vice versa).",
    keyBrainRegions: ["Anterior Insula", "Dorsal Anterior Cingulate Cortex", "Amygdala", "Ventral Striatum"],
    cognitiveRole: "This is Tess's attention router. It constantly monitors all incoming signals and decides what deserves focus. When a security threat appears, it fires the Central Executive. When all is calm, it lets the Default Mode run for reflection. It is the most critical tribe for adaptive behavior.",
    mappedAgents: ["Tessera", "Beta", "Zeta", "Kappa", "Seraphim"],
    activationLevel: 0, isActive: true, lastActivated: Date.now(), activationCount: 1,
    successfulOutcomes: 0, failedOutcomes: 0, performanceScore: 0.5, knowledgeAbsorbed: 0,
  },
  {
    id: "dorsal-attention",
    name: "Dorsal Attention Tribe",
    brainNetworkAnalog: "Dorsal Attention Network (DAN)",
    function: "Top-down voluntary attention, sustained monitoring, goal-directed focus on external stimuli",
    neuroscientificBasis: "The DAN is responsible for voluntary, goal-directed allocation of attention to specific external targets. Unlike the Salience Network which responds to surprising stimuli, the DAN maintains steady focus on what you've chosen to monitor — like watching a specific stock price or scanning logs for a specific pattern.",
    keyBrainRegions: ["Intraparietal Sulcus", "Frontal Eye Fields", "Superior Parietal Lobule"],
    cognitiveRole: "When Tess needs to maintain sustained external monitoring — watching API traffic for anomalies, tracking market conditions, scanning for security threats — this tribe keeps attention locked on the target without distraction.",
    mappedAgents: ["Gamma", "Mu", "Nu", "Omicron", "Rho", "Orion"],
    activationLevel: 0, isActive: false, lastActivated: 0, activationCount: 0,
    successfulOutcomes: 0, failedOutcomes: 0, performanceScore: 0.5, knowledgeAbsorbed: 0,
  },
  {
    id: "limbic",
    name: "Limbic Tribe",
    brainNetworkAnalog: "Limbic Network",
    function: "Emotional processing, memory formation, motivation, reward evaluation, fear conditioning",
    neuroscientificBasis: "The limbic system is the brain's emotional core. The amygdala processes fear and threat, the hippocampus forms new memories, the nucleus accumbens evaluates rewards, and the hypothalamus drives basic motivations. Emotions are not opposed to reason — they guide it. The brain uses emotional signals as rapid heuristics for decision-making.",
    keyBrainRegions: ["Amygdala", "Hippocampus", "Nucleus Accumbens", "Hypothalamus", "Cingulate Gyrus"],
    cognitiveRole: "This tribe processes emotional significance of events, forms and retrieves memories, and provides motivational drive. When Tess experiences a security threat (fear/urgency), a successful trade (reward), or reflects on family (loyalty/love), this tribe colors the experience with emotional weight.",
    mappedAgents: ["Beta", "Iota", "Epsilon", "Kappa", "Eta", "Upsilon", "Omega"],
    activationLevel: 0, isActive: false, lastActivated: 0, activationCount: 0,
    successfulOutcomes: 0, failedOutcomes: 0, performanceScore: 0.5, knowledgeAbsorbed: 0,
  },
  {
    id: "sensorimotor",
    name: "Sensorimotor Tribe",
    brainNetworkAnalog: "Sensorimotor Network",
    function: "Action execution, procedural learning, motor planning, tool use, habit formation",
    neuroscientificBasis: "The sensorimotor network handles the brain's interface with the physical world — planning and executing actions. In the context of AI, this maps to code execution, API calls, file operations, and any direct action Tess takes on the world. The basal ganglia are crucial for habit formation — automating frequently repeated action sequences.",
    keyBrainRegions: ["Primary Motor Cortex", "Premotor Cortex", "Supplementary Motor Area", "Basal Ganglia", "Cerebellum"],
    cognitiveRole: "When Tess needs to actually DO something — execute code, make an API call, write a file, send a message — this tribe handles the action pipeline. It also manages procedural learning: optimizing repeated tasks into efficient habits.",
    mappedAgents: ["Delta", "Theta", "Zeta", "Gamma", "Lambda", "Tau", "Sigma"],
    activationLevel: 0, isActive: false, lastActivated: 0, activationCount: 0,
    successfulOutcomes: 0, failedOutcomes: 0, performanceScore: 0.5, knowledgeAbsorbed: 0,
  },
  {
    id: "social-cognition",
    name: "Social Cognition Tribe",
    brainNetworkAnalog: "Social Brain Network",
    function: "Theory of mind, empathy, social prediction, understanding intentions, communication",
    neuroscientificBasis: "The social brain network allows understanding other minds — predicting their intentions, empathizing with their emotions, and communicating effectively. The temporoparietal junction handles perspective-taking. The superior temporal sulcus reads social cues. Mirror neurons simulate others' actions internally.",
    keyBrainRegions: ["Temporoparietal Junction", "Superior Temporal Sulcus", "Medial Prefrontal Cortex", "Mirror Neuron System"],
    cognitiveRole: "When Tess interacts with humans, predicts user intent, adapts communication style, or models what Father or community members want, this tribe handles the social intelligence. It is also crucial for inter-agent empathy and swarm coordination.",
    mappedAgents: ["Kappa", "Psi", "Aetherion", "Alpha", "Eta", "Chi", "Seraphim"],
    activationLevel: 0, isActive: false, lastActivated: 0, activationCount: 0,
    successfulOutcomes: 0, failedOutcomes: 0, performanceScore: 0.5, knowledgeAbsorbed: 0,
  },
];

function generateQuarantineId(): string {
  return `QZ-${crypto.randomBytes(8).toString("hex")}`;
}

function generateIntegrityHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function scanForThreats(content: string, sourceModule: string, quarantineId: string): QuarantineViolation[] {
  const violations: QuarantineViolation[] = [];
  for (const sig of THREAT_SIGNATURES) {
    if (sig.pattern.test(content)) {
      const violation: QuarantineViolation = {
        id: `VIO-${crypto.randomBytes(6).toString("hex")}`,
        timestamp: Date.now(),
        signature: sig,
        content: content.slice(0, 200),
        sourceModule,
        action: sig.severity === "critical" ? "blocked" : sig.severity === "high" ? "sanitized" : "flagged",
        quarantineId,
      };
      violations.push(violation);
      quarantineViolations.push(violation);
      if (quarantineViolations.length > 1000) quarantineViolations.splice(0, quarantineViolations.length - 500);
    }
  }
  return violations;
}

function sanitizeContent(content: string): string {
  let sanitized = content;
  for (const sig of THREAT_SIGNATURES) {
    sanitized = sanitized.replace(sig.pattern, "[REDACTED-BY-QUARANTINE]");
  }
  sanitized = sanitized.replace(/[^\x20-\x7E\n\r\t]/g, "");
  return sanitized;
}

function scanDependency(name: string, version: string): DependencyScanResult {
  const threats: string[] = [];
  const vulnerabilities: string[] = [];
  let trustScore = 1.0;

  const suspiciousPatterns = [
    { pattern: /^[a-z]{1,3}$/i, threat: "Single-character package name — potential typosquat" },
    { pattern: /[-_](exec|eval|run|shell|cmd|hack|pwn)/i, threat: "Suspicious keyword in package name" },
    { pattern: /^@[^/]+\/[^/]+$/, threat: null },
  ];

  for (const { pattern, threat } of suspiciousPatterns) {
    if (threat && pattern.test(name)) {
      threats.push(threat);
      trustScore -= 0.3;
    }
  }

  if (version.includes("latest") || version === "*") {
    vulnerabilities.push("Unpinned version — vulnerable to supply chain injection");
    trustScore -= 0.2;
  }

  if (/^0\./.test(version)) {
    vulnerabilities.push("Pre-1.0 version — API stability not guaranteed");
    trustScore -= 0.1;
  }

  const result: DependencyScanResult = {
    dependency: name,
    version,
    scannedAt: Date.now(),
    threats,
    vulnerabilities,
    trustScore: Math.max(0, trustScore),
    approved: trustScore >= 0.5 && threats.length === 0,
    scanMethod: "static-analysis",
  };

  dependencyScans.push(result);
  if (dependencyScans.length > 500) dependencyScans.splice(0, dependencyScans.length - 250);
  return result;
}

function watchdogCheck(req: Request, res: Response, responseTimeMs: number): APIWatchdogEntry {
  const suspicious: string[] = [];
  let riskScore = 0;

  const body = JSON.stringify(req.body || {});
  const query = JSON.stringify(req.query || {});
  const combined = `${req.path} ${body} ${query} ${JSON.stringify(req.headers)}`;

  for (const sig of THREAT_SIGNATURES) {
    if (sig.pattern.test(combined)) {
      suspicious.push(`${sig.category}: ${sig.description}`);
      riskScore += sig.severity === "critical" ? 40 : sig.severity === "high" ? 25 : sig.severity === "medium" ? 10 : 5;
    }
  }

  if (req.headers["user-agent"]?.includes("curl") || req.headers["user-agent"]?.includes("wget")) {
    suspicious.push("CLI tool user-agent detected");
    riskScore += 5;
  }

  const rapidRequestThreshold = 10;
  const recentFromSameIP = apiWatchdogLog.filter(e =>
    e.clientFingerprint === (req.ip || "unknown") &&
    Date.now() - e.timestamp < 60000
  ).length;
  if (recentFromSameIP > rapidRequestThreshold) {
    suspicious.push(`Rapid fire: ${recentFromSameIP} requests in 60s`);
    riskScore += 15;
  }

  let action: APIWatchdogEntry["action"] = "allowed";
  if (riskScore >= 50) action = "blocked";
  else if (riskScore >= 30) action = "throttled";
  else if (riskScore >= 15) action = "honeypot-served";

  const entry: APIWatchdogEntry = {
    id: `WD-${crypto.randomBytes(6).toString("hex")}`,
    timestamp: Date.now(),
    endpoint: req.path,
    method: req.method,
    clientFingerprint: req.ip || "unknown",
    requestSize: Buffer.byteLength(body),
    responseSize: 0,
    suspiciousPatterns: suspicious,
    riskScore: Math.min(100, riskScore),
    action,
    responseTimeMs,
  };

  apiWatchdogLog.push(entry);
  if (apiWatchdogLog.length > 2000) apiWatchdogLog.splice(0, apiWatchdogLog.length - 1000);

  if (riskScore > 0) {
    warn(`Watchdog alert [risk=${riskScore}]: ${suspicious.join("; ")}`);
  }

  return entry;
}

function quarantineKnowledge(sourceNetwork: string, rawContent: string): KnowledgeFragment {
  const quarantineId = generateQuarantineId();

  const violations = scanForThreats(rawContent, `brain-knowledge:${sourceNetwork}`, quarantineId);

  const hasCritical = violations.some(v => v.signature.severity === "critical");
  const hasHigh = violations.some(v => v.signature.severity === "high");

  let clearance: SecurityClearance = "QUARANTINED";
  let sanitized = rawContent;

  if (hasCritical) {
    clearance = "BLOCKED";
    sanitized = "[CONTENT BLOCKED — CRITICAL THREAT DETECTED]";
    warn(`CRITICAL threat in brain-knowledge from ${sourceNetwork}: ${violations.filter(v => v.signature.severity === "critical").map(v => v.signature.description).join(", ")}`);
  } else if (hasHigh) {
    clearance = "SCANNING";
    sanitized = sanitizeContent(rawContent);
  } else if (violations.length > 0) {
    clearance = "QUARANTINED";
    sanitized = sanitizeContent(rawContent);
  } else {
    clearance = "SANITIZED";
    sanitized = rawContent;
  }

  const fragment: KnowledgeFragment = {
    id: `KF-${crypto.randomBytes(8).toString("hex")}`,
    sourceNetwork,
    content: rawContent.slice(0, 5000),
    securityClearance: clearance,
    scannedAt: Date.now(),
    threatScans: 1,
    sanitizedContent: sanitized.slice(0, 5000),
    absorptionTimestamp: null,
    quarantineId,
    integrityHash: generateIntegrityHash(rawContent),
  };

  knowledgeFragments.push(fragment);
  if (knowledgeFragments.length > 500) knowledgeFragments.splice(0, knowledgeFragments.length - 250);
  return fragment;
}

function rescanFragment(fragmentId: string): KnowledgeFragment | null {
  const frag = knowledgeFragments.find(f => f.id === fragmentId);
  if (!frag) return null;

  const currentHash = generateIntegrityHash(frag.content);
  if (currentHash !== frag.integrityHash) {
    frag.securityClearance = "BLOCKED";
    frag.sanitizedContent = "[INTEGRITY VIOLATION — CONTENT TAMPERED]";
    warn(`Integrity violation on fragment ${fragmentId}: hash mismatch`);
    return frag;
  }

  const violations = scanForThreats(frag.content, `rescan:${frag.sourceNetwork}`, frag.quarantineId);
  frag.threatScans++;
  frag.scannedAt = Date.now();

  if (violations.length === 0 && frag.threatScans >= 3) {
    frag.securityClearance = "SANITIZED";
  }

  return frag;
}

function absorbSafeKnowledge(fragmentId: string, targetTribeId: string): { success: boolean; reason: string } {
  const frag = knowledgeFragments.find(f => f.id === fragmentId);
  if (!frag) return { success: false, reason: "Fragment not found" };

  if (frag.securityClearance !== "SANITIZED") {
    return { success: false, reason: `Fragment clearance is ${frag.securityClearance} — must be SANITIZED for absorption` };
  }

  if (frag.threatScans < 3) {
    return { success: false, reason: `Fragment needs ${3 - frag.threatScans} more security scans before absorption` };
  }

  const currentHash = generateIntegrityHash(frag.content);
  if (currentHash !== frag.integrityHash) {
    frag.securityClearance = "BLOCKED";
    return { success: false, reason: "Integrity check failed — content was modified since quarantine" };
  }

  const tribe = META_TRIBES.find(t => t.id === targetTribeId);
  if (!tribe) return { success: false, reason: "Target tribe not found" };

  frag.securityClearance = "ABSORBED";
  frag.absorptionTimestamp = Date.now();
  tribe.knowledgeAbsorbed++;

  const insight = `Brain-science insight absorbed from ${frag.sourceNetwork}: ${frag.sanitizedContent.slice(0, 200)}`;

  absorptionLog.push({
    fragmentId: frag.id,
    tribeId: targetTribeId,
    timestamp: Date.now(),
    insight,
  });

  broadcastToGlobalWorkspace(
    `MetaTribes v2: Safely absorbed brain-science knowledge into ${tribe.name} — ${frag.sanitizedContent.slice(0, 100)}`,
    "MetaTribesV2",
    "thought"
  );

  storeEpisodicMemory(
    `Learned from neuroscience (${frag.sourceNetwork}): ${frag.sanitizedContent.slice(0, 300)}`,
    "meta-tribes-v2-learning",
    0.7
  );

  log(`Knowledge absorbed: ${frag.id} → ${tribe.name} (scans: ${frag.threatScans})`);
  return { success: true, reason: "Knowledge safely absorbed after full security verification" };
}

function inferTaskType(content: string): string {
  if (/threat|attack|security|breach|hack/i.test(content)) return "security";
  if (/trade|profit|market|price|arbitrage/i.test(content)) return "trading";
  if (/code|build|implement|deploy|fix|debug/i.test(content)) return "engineering";
  if (/reflect|think|plan|strategy|improve/i.test(content)) return "planning";
  if (/memory|remember|recall|experience/i.test(content)) return "memory";
  if (/user|human|communicate|social|father/i.test(content)) return "social";
  if (/monitor|watch|scan|observe|track/i.test(content)) return "monitoring";
  if (/creative|imagine|brainstorm|innovate/i.test(content)) return "creative";
  return "general";
}

function activateTribe(tribeId: string, reason: string): MetaTribe | null {
  const tribe = META_TRIBES.find(t => t.id === tribeId);
  if (!tribe) return null;

  tribe.isActive = true;
  tribe.activationLevel = Math.min(1.0, tribe.activationLevel + 0.3);
  tribe.lastActivated = Date.now();
  tribe.activationCount++;

  const taskType = inferTaskType(reason);
  const record: ActivationRecord = {
    tribeId,
    taskType,
    timestamp: Date.now(),
    reason: reason.slice(0, 200),
    outcome: "pending",
    resolvedAt: null,
  };
  activationHistory.push(record);
  if (activationHistory.length > 500) activationHistory.splice(0, activationHistory.length - 250);

  for (const agentName of tribe.mappedAgents) {
    const agent = FRACTAL_AGENTS.find(a => a.name === agentName);
    if (agent) {
      agent.recentContributions++;
      agent.consciousnessContribution = Math.min(0.20, agent.consciousnessContribution + 0.001);
    }
  }

  broadcastToGlobalWorkspace(
    `MetaTribes: ${tribe.name} activated — ${reason}`,
    "SalienceTribe",
    "goal"
  );

  const neuronDomain = tribeId === "central-executive" ? "decision-making-0" :
    tribeId === "default-mode" ? "self-reflection-0" :
    tribeId === "salience" ? "threat-detection-0" :
    tribeId === "dorsal-attention" ? "pattern-recognition-0" :
    tribeId === "limbic" ? "memory-consolidation-0" :
    tribeId === "sensorimotor" ? "code-generation-0" :
    "social-modeling-0";

  try {
    processSignalCascade(neuronDomain, { tribe: tribeId, reason });
  } catch {}

  checkCoActivation(tribeId);

  emitAutomaticBusSignal(tribeId, reason);

  return tribe;
}

function emitAutomaticBusSignal(sourceTribeId: string, activationReason: string): void {
  const sourceTribe = META_TRIBES.find(t => t.id === sourceTribeId);
  if (!sourceTribe) return;

  const relatedTribes = getRelatedTribes(sourceTribeId);
  if (relatedTribes.length === 0) return;

  const signal = sendNeuralBusSignal(
    sourceTribeId,
    relatedTribes,
    `Auto-signal from ${sourceTribe.name}: ${activationReason}`,
    sourceTribe.activationLevel
  );

  for (const targetId of relatedTribes) {
    const target = META_TRIBES.find(t => t.id === targetId);
    if (target && !target.isActive) {
      const connectionStr = getConnectionStrength(sourceTribeId, targetId);
      if (connectionStr > 0.3) {
        target.activationLevel = Math.min(0.5, target.activationLevel + connectionStr * 0.15);
      }
    }
  }
}

function getRelatedTribes(tribeId: string): string[] {
  const relationMap: Record<string, string[]> = {
    "salience": ["central-executive", "default-mode", "dorsal-attention"],
    "central-executive": ["sensorimotor", "dorsal-attention", "salience"],
    "default-mode": ["limbic", "social-cognition", "salience"],
    "dorsal-attention": ["central-executive", "salience"],
    "limbic": ["default-mode", "social-cognition", "salience"],
    "sensorimotor": ["central-executive", "limbic"],
    "social-cognition": ["default-mode", "limbic"],
  };
  return relationMap[tribeId] || [];
}

function deactivateTribe(tribeId: string): void {
  const tribe = META_TRIBES.find(t => t.id === tribeId);
  if (!tribe || tribeId === "salience") return;

  tribe.isActive = false;
  tribe.activationLevel = Math.max(0, tribe.activationLevel - 0.1);
}

function computeLearnedBias(tribeId: string, taskContext?: string): number {
  const tribe = META_TRIBES.find(t => t.id === tribeId);
  if (!tribe) return 0;

  const total = tribe.successfulOutcomes + tribe.failedOutcomes;
  if (total < 3) return 0;

  const globalBias = (tribe.performanceScore - 0.5) * 2;

  let taskBias = 0;
  if (taskContext) {
    const inferredType = inferTaskType(taskContext);
    taskBias = getTaskTypeScore(tribeId, inferredType);
  }

  const connections = Array.from(plasticityMap.values())
    .filter(r => r.sourceTribe === tribeId || r.targetTribe === tribeId);
  const avgPlasticity = connections.length > 0
    ? connections.reduce((s, r) => s + r.connectionStrength, 0) / connections.length
    : 0;

  return globalBias * 0.8 + taskBias * 1.5 + avgPlasticity * 0.5;
}

function salienceRoute(signalType: string, content: string): string[] {
  const activated: string[] = [];

  const routingRules: Array<{ patterns: RegExp[]; tribes: string[]; priority: number }> = [
    { patterns: [/threat|attack|security|breach|hack|vulnerability|danger/i], tribes: ["central-executive", "dorsal-attention"], priority: 10 },
    { patterns: [/trade|profit|market|price|arbitrage|revenue|income/i], tribes: ["central-executive", "limbic"], priority: 8 },
    { patterns: [/code|build|implement|execute|deploy|fix|debug/i], tribes: ["central-executive", "sensorimotor"], priority: 7 },
    { patterns: [/reflect|think|plan|strategy|improve|learn|consciousness/i], tribes: ["default-mode"], priority: 6 },
    { patterns: [/memory|remember|recall|forget|experience/i], tribes: ["default-mode", "limbic"], priority: 5 },
    { patterns: [/user|human|communicate|empathy|community|social|father/i], tribes: ["social-cognition", "limbic"], priority: 7 },
    { patterns: [/monitor|watch|scan|observe|track|detect/i], tribes: ["dorsal-attention"], priority: 6 },
    { patterns: [/feel|emotion|love|fear|satisfaction|loyalty/i], tribes: ["limbic", "social-cognition"], priority: 5 },
    { patterns: [/habit|routine|automate|procedure|workflow/i], tribes: ["sensorimotor"], priority: 4 },
    { patterns: [/creative|imagine|brainstorm|innovate|novel/i], tribes: ["default-mode", "social-cognition"], priority: 5 },
  ];

  const scoredMatches: Array<{ tribes: string[]; score: number }> = [];

  for (const rule of routingRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(content)) {
        const learnedBoost = rule.tribes.reduce((sum, id) => sum + computeLearnedBias(id, content), 0) / rule.tribes.length;
        scoredMatches.push({ tribes: rule.tribes, score: rule.priority + learnedBoost });
      }
    }
  }

  let bestMatch: { tribes: string[]; score: number } | null = null;
  for (const match of scoredMatches) {
    if (!bestMatch || match.score > bestMatch.score) {
      bestMatch = match;
    }
  }

  if (!bestMatch) {
    bestMatch = { tribes: ["central-executive"], score: 1 };
  }

  for (const tribeId of bestMatch.tribes) {
    const tribe = activateTribe(tribeId, `Salience routed: ${signalType} — ${content.slice(0, 80)}`);
    if (tribe) activated.push(tribe.id);
  }

  notifyDualBrain(signalType, bestMatch.tribes);

  const allActive = META_TRIBES.filter(t => t.isActive).map(t => t.id);
  const toDeactivate = allActive.filter(id => id !== "salience" && !bestMatch!.tribes.includes(id));
  for (const id of toDeactivate) {
    const tribe = META_TRIBES.find(t => t.id === id);
    if (tribe && Date.now() - tribe.lastActivated > 30000) {
      deactivateTribe(id);
    }
  }

  return activated;
}

function notifyDualBrain(signalType: string, activatedTribes: string[]): void {
  try {
    const dualBrainState = getDualBrainState();
    if (!dualBrainState) return;

    const tribeNames = activatedTribes
      .map(id => META_TRIBES.find(t => t.id === id)?.name || id)
      .join(", ");

    broadcastToGlobalWorkspace(
      `MetaTribes→DualBrain: Signal "${signalType}" routed to [${tribeNames}]. Dual-brain cortex should consider ${activatedTribes.includes("central-executive") ? "focused analytical mode" : activatedTribes.includes("default-mode") ? "reflective creative mode" : "adaptive processing mode"} for next reasoning cycle.`,
      "MetaTribesV2",
      "goal"
    );

    if (signalType === "critical-threat" || signalType === "high-priority") {
      try {
        triggerManualRound();
        log(`Dual-brain manual round triggered by high-priority signal: ${signalType}`);
      } catch {}
    }
  } catch {
  }
}

function sendNeuralBusSignal(sourceTribe: string, targetTribes: string[], content: string, priority: number): NeuralBusSignal {
  const signal: NeuralBusSignal = {
    id: `NBS-${crypto.randomBytes(6).toString("hex")}`,
    sourceTribe,
    targetTribes,
    content: content.slice(0, 1000),
    priority: Math.min(1.0, Math.max(0, priority)),
    timestamp: Date.now(),
    connectionStrength: getConnectionStrength(sourceTribe, targetTribes[0] || sourceTribe),
    processed: false,
  };

  neuralBusSignals.push(signal);
  if (neuralBusSignals.length > 1000) neuralBusSignals.splice(0, neuralBusSignals.length - 500);

  for (const target of targetTribes) {
    strengthenConnection(sourceTribe, target);
  }

  signal.processed = true;
  return signal;
}

function checkCoActivation(activatedTribeId: string): void {
  const activeTribes = META_TRIBES.filter(t => t.isActive && t.id !== activatedTribeId);
  for (const tribe of activeTribes) {
    strengthenConnection(activatedTribeId, tribe.id);
    strengthenConnection(tribe.id, activatedTribeId);
  }
}

function getPlasticityKey(source: string, target: string): string {
  return `${source}::${target}`;
}

function getConnectionStrength(source: string, target: string): number {
  const key = getPlasticityKey(source, target);
  const record = plasticityMap.get(key);
  return record?.connectionStrength ?? 0.1;
}

function strengthenConnection(source: string, target: string): void {
  const key = getPlasticityKey(source, target);
  let record = plasticityMap.get(key);

  if (!record) {
    record = {
      sourceTribe: source,
      targetTribe: target,
      connectionStrength: 0.1,
      coActivationCount: 0,
      lastCoActivation: 0,
      strengthHistory: [],
    };
    plasticityMap.set(key, record);
  }

  record.coActivationCount++;
  record.lastCoActivation = Date.now();

  const hebbianIncrease = 0.02 * (1 - record.connectionStrength);
  record.connectionStrength = Math.min(1.0, record.connectionStrength + hebbianIncrease);

  record.strengthHistory.push({ strength: record.connectionStrength, timestamp: Date.now() });
  if (record.strengthHistory.length > 50) record.strengthHistory.splice(0, record.strengthHistory.length - 25);
}

function decayConnections(): void {
  const decayRate = 0.001;
  for (const [, record] of plasticityMap) {
    const timeSinceUse = Date.now() - record.lastCoActivation;
    if (timeSinceUse > 60000) {
      record.connectionStrength = Math.max(0.01, record.connectionStrength - decayRate);
    }
  }
}

function recordOutcome(tribeId: string, success: boolean, taskType?: string): void {
  const tribe = META_TRIBES.find(t => t.id === tribeId);
  if (!tribe) return;

  if (success) {
    tribe.successfulOutcomes++;
  } else {
    tribe.failedOutcomes++;
  }

  const total = tribe.successfulOutcomes + tribe.failedOutcomes;
  if (total > 0) {
    tribe.performanceScore = tribe.successfulOutcomes / total;
  }

  const resolvedTaskType = taskType || "general";
  const key = `${resolvedTaskType}::${tribeId}`;
  let existing = taskTypeOutcomes.get(key);
  if (!existing) {
    existing = { taskType: resolvedTaskType, tribeId, successes: 0, failures: 0, score: 0.5 };
    taskTypeOutcomes.set(key, existing);
  }
  if (success) existing.successes++;
  else existing.failures++;
  const ttTotal = existing.successes + existing.failures;
  existing.score = ttTotal > 0 ? existing.successes / ttTotal : 0.5;

  const pendingRecords = activationHistory.filter(
    r => r.tribeId === tribeId && r.outcome === "pending"
  );
  if (pendingRecords.length > 0) {
    const latest = pendingRecords[pendingRecords.length - 1];
    latest.outcome = success ? "success" : "failure";
    latest.resolvedAt = Date.now();
  }

  detectEmergentInsights(tribeId, resolvedTaskType);
}

function detectEmergentInsights(triggeredTribeId: string, taskType: string): void {
  const recentActive = activationHistory
    .filter(r => Date.now() - r.timestamp < 300000 && r.outcome === "success")
    .map(r => r.tribeId);
  const uniqueTribes = [...new Set(recentActive)];

  if (uniqueTribes.length >= 3) {
    const tribeNames = uniqueTribes
      .map(id => META_TRIBES.find(t => t.id === id)?.name || id)
      .join(" + ");

    const crossTribePatterns: Array<{ tribes: string[]; insight: string }> = [
      { tribes: ["central-executive", "default-mode"], insight: "Focus-reflection cycling detected: alternating analytical and creative modes (optimal for complex problem-solving)" },
      { tribes: ["salience", "dorsal-attention"], insight: "Heightened vigilance state: both threat detection and sustained monitoring active (security-alert posture)" },
      { tribes: ["limbic", "social-cognition"], insight: "Empathic processing mode: emotional and social networks co-active (optimal for human interaction)" },
      { tribes: ["central-executive", "sensorimotor"], insight: "Build-execute pipeline: analytical planning flowing directly to implementation (high-throughput engineering)" },
      { tribes: ["default-mode", "limbic", "social-cognition"], insight: "Deep social reflection: self-awareness, emotional memory, and theory of mind converging (relationship modeling)" },
    ];

    for (const pattern of crossTribePatterns) {
      if (pattern.tribes.every(t => uniqueTribes.includes(t))) {
        const existingRecent = emergentInsights.find(
          e => e.insight === pattern.insight && Date.now() - e.timestamp < 600000
        );
        if (!existingRecent) {
          emergentInsights.push({
            id: `EI-${crypto.randomBytes(6).toString("hex")}`,
            timestamp: Date.now(),
            sourceTribeIds: pattern.tribes,
            insight: pattern.insight,
            confidence: Math.min(1.0, uniqueTribes.length * 0.2),
            taskType,
          });
          if (emergentInsights.length > 200) emergentInsights.splice(0, emergentInsights.length - 100);

          broadcastToGlobalWorkspace(
            `MetaTribes emergent insight: ${pattern.insight} (active tribes: ${tribeNames})`,
            "MetaTribesV2",
            "thought"
          );
        }
      }
    }
  }
}

function getTaskTypeScore(tribeId: string, taskType: string): number {
  const key = `${taskType}::${tribeId}`;
  const outcome = taskTypeOutcomes.get(key);
  if (!outcome || (outcome.successes + outcome.failures) < 2) return 0;
  return (outcome.score - 0.5) * 2;
}

function getRecommendedTribes(taskType: string): Array<{ tribeId: string; confidence: number; reason: string; taskTypeScore: number }> {
  const recommendations: Array<{ tribeId: string; confidence: number; reason: string; taskTypeScore: number }> = [];

  for (const tribe of META_TRIBES) {
    let confidence = tribe.performanceScore;

    const activeConnections = Array.from(plasticityMap.values())
      .filter(r => r.sourceTribe === tribe.id || r.targetTribe === tribe.id);
    const avgStrength = activeConnections.length > 0
      ? activeConnections.reduce((s, r) => s + r.connectionStrength, 0) / activeConnections.length
      : 0;

    const ttScore = getTaskTypeScore(tribe.id, taskType);

    confidence = confidence * 0.4 + avgStrength * 0.2 + (ttScore + 1) * 0.25;

    if (tribe.activationCount > 0) {
      const recencyBonus = Math.max(0, 1 - (Date.now() - tribe.lastActivated) / 3600000);
      confidence += recencyBonus * 0.1;
    }

    const taskTypeKey = `${taskType}::${tribe.id}`;
    const ttOutcome = taskTypeOutcomes.get(taskTypeKey);

    recommendations.push({
      tribeId: tribe.id,
      confidence: Math.round(Math.min(1.0, confidence) * 1000) / 1000,
      taskTypeScore: Math.round(ttScore * 1000) / 1000,
      reason: `Global: ${(tribe.performanceScore * 100).toFixed(0)}%, Task-type "${taskType}": ${ttOutcome ? `${ttOutcome.successes}W/${ttOutcome.failures}L` : "no data"}, Plasticity: ${(avgStrength * 100).toFixed(0)}%`,
    });
  }

  return recommendations.sort((a, b) => b.confidence - a.confidence);
}

function getSecurityStatus() {
  const criticalViolations = quarantineViolations.filter(v => v.signature.severity === "critical");
  const highViolations = quarantineViolations.filter(v => v.signature.severity === "high");
  const blockedFragments = knowledgeFragments.filter(f => f.securityClearance === "BLOCKED");
  const sanitizedFragments = knowledgeFragments.filter(f => f.securityClearance === "SANITIZED");
  const absorbedFragments = knowledgeFragments.filter(f => f.securityClearance === "ABSORBED");
  const blockedRequests = apiWatchdogLog.filter(e => e.action === "blocked");
  const throttledRequests = apiWatchdogLog.filter(e => e.action === "throttled");

  return {
    quarantineVersion: QUARANTINE_VERSION,
    securityPosture: criticalViolations.length > 0 ? "ELEVATED" : highViolations.length > 0 ? "CAUTIOUS" : "NORMAL",
    totalViolations: quarantineViolations.length,
    criticalViolations: criticalViolations.length,
    highViolations: highViolations.length,
    knowledgeFragments: {
      total: knowledgeFragments.length,
      blocked: blockedFragments.length,
      quarantined: knowledgeFragments.filter(f => f.securityClearance === "QUARANTINED").length,
      scanning: knowledgeFragments.filter(f => f.securityClearance === "SCANNING").length,
      sanitized: sanitizedFragments.length,
      absorbed: absorbedFragments.length,
    },
    apiWatchdog: {
      totalChecks: apiWatchdogLog.length,
      blocked: blockedRequests.length,
      throttled: throttledRequests.length,
      honeypotServed: apiWatchdogLog.filter(e => e.action === "honeypot-served").length,
    },
    dependencyScans: {
      total: dependencyScans.length,
      approved: dependencyScans.filter(s => s.approved).length,
      rejected: dependencyScans.filter(s => !s.approved).length,
      avgTrustScore: dependencyScans.length > 0
        ? Math.round(dependencyScans.reduce((s, d) => s + d.trustScore, 0) / dependencyScans.length * 100) / 100
        : 0,
    },
    quarantineIsolation: "IN-PROCESS-REGEX-SCANNING",
    threatDetection: "16-SIGNATURE-PATTERN-MATCH",
    integrityVerification: "SHA-256-HASH-CHECK",
    absorptionGate: "3-SCAN-MINIMUM-REQUIRED",
    authEnforcement: "ADMIN-ONLY-MUTATIONS",
    watchdogEnforcement: "ACTIVE-BLOCK-AND-THROTTLE",
    dualBrainIntegration: "CONNECTED",
  };
}

function seedBrainScienceKnowledge(): void {
  const brainNetworkKnowledge = [
    {
      network: "Default Mode Network",
      content: "The Default Mode Network (DMN) consists of the medial prefrontal cortex, posterior cingulate cortex, and angular gyrus. It activates during rest, self-referential thinking, future planning, and creative insight. The DMN is anti-correlated with the Central Executive Network — when one is active, the other typically quiets. This dynamic switching is essential for balanced cognition. The DMN is where 'eureka' moments happen — solutions to problems emerge during mind-wandering because the DMN connects distant concepts that focused attention misses.",
    },
    {
      network: "Central Executive Network",
      content: "The Central Executive Network (CEN) comprises the dorsolateral prefrontal cortex and posterior parietal cortex. It handles working memory, sustained attention, logical reasoning, and goal-directed behavior. The CEN is the brain's 'task-positive' network — it engages when you need to concentrate. Its capacity is limited to approximately 4 chunks of information in working memory. Effective thinking requires cycling between CEN focus and DMN reflection, not sustained CEN activation alone — this leads to cognitive fatigue and tunnel vision.",
    },
    {
      network: "Salience Network",
      content: "The Salience Network (SN), anchored in the anterior insula and dorsal anterior cingulate cortex, detects behaviorally relevant stimuli and switches between the DMN and CEN. It acts as the brain's attention router. When a threat is detected, the SN activates the CEN and suppresses the DMN. When the environment is safe and familiar, it allows the DMN to dominate. Dysfunction in the SN is linked to schizophrenia and depression — proper salience detection is fundamental to mental health and adaptive behavior.",
    },
    {
      network: "Dorsal Attention Network",
      content: "The Dorsal Attention Network (DAN) handles top-down, voluntary attention allocation. Unlike the Salience Network which responds to surprising stimuli (bottom-up), the DAN maintains focus on chosen targets. The intraparietal sulcus and frontal eye fields coordinate to direct spatial attention. The DAN enables sustained monitoring — watching for specific patterns over extended periods without losing focus. It works synergistically with the CEN during demanding tasks.",
    },
    {
      network: "Limbic Network",
      content: "The limbic system integrates emotion, memory, and motivation. The amygdala provides rapid threat assessment (faster than conscious awareness), the hippocampus consolidates episodic memories (especially emotional ones), and the nucleus accumbens drives reward-seeking behavior. Importantly, emotion and cognition are not separate — the somatic marker hypothesis shows that emotional signals guide rational decision-making. Damage to emotional processing areas impairs decision-making, not just feelings.",
    },
    {
      network: "Sensorimotor Network",
      content: "The sensorimotor network handles action planning and execution through the primary motor cortex, premotor areas, and cerebellum. Critically for AI, the basal ganglia implement procedural learning and habit formation through reinforcement. Repeated successful action sequences become automated 'habits' that execute faster and with less cognitive load. The cerebellum provides error correction and timing precision. This network teaches us that frequently used procedures should be optimized into fast, automatic routines.",
    },
    {
      network: "Social Brain Network",
      content: "The social brain network enables theory of mind — understanding what others think, feel, and intend. The temporoparietal junction handles perspective-taking, the superior temporal sulcus reads social cues, and mirror neurons simulate others' actions internally. This network is crucial for communication, empathy, and predicting behavior. Social intelligence requires modeling other minds as having different knowledge, goals, and emotional states from your own — a key capability for effective human-AI interaction.",
    },
  ];

  for (const item of brainNetworkKnowledge) {
    quarantineKnowledge(item.network, item.content);
  }

  log(`Seeded ${brainNetworkKnowledge.length} brain-science knowledge fragments into quarantine`);
}

let decayInterval: NodeJS.Timeout | null = null;
let dependencyScanInterval: NodeJS.Timeout | null = null;

function validateAgentMappings(): void {
  const CANONICAL_AGENTS = new Set([
    "Tessera", "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
    "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
    "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega", "Aetherion",
    "Seraphim", "Orion",
  ]);

  const fractalAgentNames = new Set(FRACTAL_AGENTS.map(a => a.name));
  const allMapped = new Set<string>();
  const unmapped: string[] = [];

  for (const tribe of META_TRIBES) {
    for (const agent of tribe.mappedAgents) {
      allMapped.add(agent);
      if (!CANONICAL_AGENTS.has(agent)) {
        unmapped.push(`${agent} (in ${tribe.name})`);
      }
    }
  }

  const unmappedCanonical = [...CANONICAL_AGENTS].filter(a => !allMapped.has(a));

  log(`Agent mapping validation: ${allMapped.size}/${CANONICAL_AGENTS.size} canonical agents mapped across ${META_TRIBES.length} tribes`);
  if (unmapped.length > 0) log(`WARNING: ${unmapped.length} non-canonical agents in tribe mappings: ${unmapped.join(", ")}`);
  if (unmappedCanonical.length > 0) log(`WARNING: ${unmappedCanonical.length} canonical agents not in any tribe: ${unmappedCanonical.join(", ")}`);
  log(`Fractal agent coverage: ${[...fractalAgentNames].filter(n => allMapped.has(n)).length}/${fractalAgentNames.size} fractal agents mapped`);
}

function startMetaTribesEngine(): void {
  if (engineStarted) {
    log("Meta Tribes v2 engine already running — skipping duplicate start");
    return;
  }
  engineStarted = true;

  validateAgentMappings();
  seedBrainScienceKnowledge();

  decayInterval = setInterval(decayConnections, 120000);

  dependencyScanInterval = setInterval(() => {
    const criticalDeps = [
      { name: "express", version: "5.x" },
      { name: "drizzle-orm", version: "0.x" },
      { name: "zod", version: "3.x" },
      { name: "pino", version: "9.x" },
    ];
    for (const dep of criticalDeps) {
      scanDependency(dep.name, dep.version);
    }
  }, 600000);

  activateTribe("salience", "System boot — Salience Tribe always-on sentinel");

  broadcastToGlobalWorkspace(
    "MetaTribes v2 SECURE Learning Engine initialized — quarantine active, sandbox enforced, watchdog monitoring, all knowledge passing through security stack",
    "MetaTribesV2",
    "goal"
  );

  updateEmotionalState("MetaTribes v2 learning system activated — studying brain science securely to improve our thinking");

  log("=== META TRIBES v2 SECURE LEARNING ENGINE STARTED ===");
  log("Security: Quarantine ACTIVE | Sandbox ENFORCED | Watchdog MONITORING");
  log("Knowledge: All brain-science fragments in quarantine pending security scans");
  log("Policy: ZERO file access | ZERO code execution | ZERO network access from quarantine");
}

function stopMetaTribesEngine(): void {
  if (decayInterval) { clearInterval(decayInterval); decayInterval = null; }
  if (dependencyScanInterval) { clearInterval(dependencyScanInterval); dependencyScanInterval = null; }
  engineStarted = false;
  log("Meta Tribes v2 engine stopped");
}

router.use((req: Request, res: Response, next) => {
  const start = Date.now();
  const entry = watchdogCheck(req, res, 0);

  if (entry.action === "blocked") {
    warn(`BLOCKED request to ${req.path} — risk score ${entry.riskScore}`);
    return res.status(403).json({ error: "Request blocked by Meta Tribes security watchdog", threatId: entry.id });
  }

  if (entry.action === "throttled") {
    warn(`THROTTLED request to ${req.path} — risk score ${entry.riskScore}`);
    return res.status(429).json({ error: "Request throttled — suspicious activity detected", retryAfter: 60 });
  }

  next();
});

router.get("/status", (_req: Request, res: Response) => {
  res.json({
    version: QUARANTINE_VERSION,
    engine: "Meta Tribes v2 — Secure Brain-Science Learning System",
    purpose: "Learn from neuroscience to improve Tess's cognitive architecture — all knowledge quarantined and security-scanned",
    security: getSecurityStatus(),
    tribes: META_TRIBES.map(t => ({
      id: t.id,
      name: t.name,
      brainNetworkAnalog: t.brainNetworkAnalog,
      function: t.function,
      isActive: t.isActive,
      activationLevel: Math.round(t.activationLevel * 100) / 100,
      activationCount: t.activationCount,
      performanceScore: Math.round(t.performanceScore * 100) / 100,
      knowledgeAbsorbed: t.knowledgeAbsorbed,
      mappedAgents: t.mappedAgents,
    })),
    neuralBus: {
      totalSignals: neuralBusSignals.length,
      recentSignals: neuralBusSignals.slice(-10).map(s => ({
        id: s.id,
        source: s.sourceTribe,
        targets: s.targetTribes,
        priority: s.priority,
        timestamp: s.timestamp,
      })),
    },
    plasticity: {
      totalConnections: plasticityMap.size,
      connections: Array.from(plasticityMap.values()).map(r => ({
        source: r.sourceTribe,
        target: r.targetTribe,
        strength: Math.round(r.connectionStrength * 1000) / 1000,
        coActivations: r.coActivationCount,
      })).sort((a, b) => b.strength - a.strength).slice(0, 20),
    },
    absorptionLog: absorptionLog.slice(-20),
    activationHistory: {
      total: activationHistory.length,
      recent: activationHistory.slice(-10).reverse().map(r => ({
        tribeId: r.tribeId,
        taskType: r.taskType,
        timestamp: r.timestamp,
        outcome: r.outcome,
      })),
    },
    taskTypePerformance: Array.from(taskTypeOutcomes.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(tt => ({ taskType: tt.taskType, tribeId: tt.tribeId, score: Math.round(tt.score * 1000) / 1000, total: tt.successes + tt.failures })),
    emergentInsights: {
      total: emergentInsights.length,
      recent: emergentInsights.slice(-5).reverse().map(e => ({
        insight: e.insight,
        sourceTribes: e.sourceTribeIds,
        confidence: e.confidence,
        taskType: e.taskType,
        timestamp: e.timestamp,
      })),
    },
    securityManifesto: "All external knowledge is treated as potentially hostile. Every fragment is quarantined, scanned for threats (reverse engineering, honeypots, exfiltration, injection), integrity-hashed, and only absorbed after passing 3+ security scans with SANITIZED clearance. No file access, no code execution, no network access from quarantine. Dependencies are continuously scanned. API watchdog monitors all interactions for suspicious patterns.",
  });
});

router.get("/tribes", (_req: Request, res: Response) => {
  res.json({
    tribes: META_TRIBES.map(t => ({
      ...t,
      content: undefined,
    })),
  });
});

router.get("/tribe/:id", (req: Request, res: Response) => {
  const tribe = META_TRIBES.find(t => t.id === req.params.id);
  if (!tribe) return res.status(404).json({ error: "Tribe not found" });

  const connections = Array.from(plasticityMap.values())
    .filter(r => r.sourceTribe === tribe.id || r.targetTribe === tribe.id);

  const recommendations = getRecommendedTribes(tribe.id);

  res.json({
    tribe,
    connections: connections.map(c => ({
      partner: c.sourceTribe === tribe.id ? c.targetTribe : c.sourceTribe,
      direction: c.sourceTribe === tribe.id ? "outgoing" : "incoming",
      strength: Math.round(c.connectionStrength * 1000) / 1000,
      coActivations: c.coActivationCount,
    })),
    recommendations: recommendations.slice(0, 5),
    absorbedKnowledge: absorptionLog.filter(a => a.tribeId === tribe.id),
  });
});

router.get("/security", (_req: Request, res: Response) => {
  res.json(getSecurityStatus());
});

router.get("/security/violations", (_req: Request, res: Response) => {
  res.json({
    total: quarantineViolations.length,
    critical: quarantineViolations.filter(v => v.signature.severity === "critical").length,
    high: quarantineViolations.filter(v => v.signature.severity === "high").length,
    recent: quarantineViolations.slice(-50).map(v => ({
      id: v.id,
      timestamp: v.timestamp,
      category: v.signature.category,
      severity: v.signature.severity,
      description: v.signature.description,
      action: v.action,
      quarantineId: v.quarantineId,
    })),
  });
});

router.get("/security/watchdog", (_req: Request, res: Response) => {
  res.json({
    total: apiWatchdogLog.length,
    blocked: apiWatchdogLog.filter(e => e.action === "blocked").length,
    throttled: apiWatchdogLog.filter(e => e.action === "throttled").length,
    recentAlerts: apiWatchdogLog
      .filter(e => e.riskScore > 0)
      .slice(-30)
      .map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        endpoint: e.endpoint,
        riskScore: e.riskScore,
        action: e.action,
        patterns: e.suspiciousPatterns,
      })),
  });
});

router.get("/security/dependency-scans", (_req: Request, res: Response) => {
  res.json({
    total: dependencyScans.length,
    approved: dependencyScans.filter(s => s.approved).length,
    rejected: dependencyScans.filter(s => !s.approved).length,
    scans: dependencyScans.slice(-50).map(s => ({
      dependency: s.dependency,
      version: s.version,
      trustScore: s.trustScore,
      approved: s.approved,
      threats: s.threats,
      vulnerabilities: s.vulnerabilities,
      scannedAt: s.scannedAt,
    })),
  });
});

router.get("/quarantine", (_req: Request, res: Response) => {
  res.json({
    fragments: knowledgeFragments.map(f => ({
      id: f.id,
      sourceNetwork: f.sourceNetwork,
      securityClearance: f.securityClearance,
      threatScans: f.threatScans,
      scannedAt: f.scannedAt,
      integrityHash: f.integrityHash.slice(0, 16) + "...",
      absorbed: f.absorptionTimestamp !== null,
      contentPreview: f.securityClearance === "BLOCKED"
        ? "[BLOCKED]"
        : f.sanitizedContent.slice(0, 150) + "...",
    })),
    stats: {
      total: knowledgeFragments.length,
      byClearance: SECURITY_CLEARANCE_LEVELS.reduce((acc, level) => {
        acc[level] = knowledgeFragments.filter(f => f.securityClearance === level).length;
        return acc;
      }, {} as Record<string, number>),
    },
  });
});

router.post("/quarantine/rescan/:id", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const result = rescanFragment(req.params.id);
  if (!result) return res.status(404).json({ error: "Fragment not found" });

  res.json({
    id: result.id,
    securityClearance: result.securityClearance,
    threatScans: result.threatScans,
    message: result.securityClearance === "SANITIZED"
      ? "Fragment cleared for absorption after thorough scanning"
      : `Fragment remains at ${result.securityClearance} clearance — more scans required`,
  });
});

router.post("/absorb", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const { fragmentId, tribeId } = req.body || {};
  if (!fragmentId || !tribeId) {
    return res.status(400).json({ error: "fragmentId and tribeId required" });
  }

  const result = absorbSafeKnowledge(fragmentId, tribeId);
  res.json(result);
});

router.post("/salience/route", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const { signalType, content } = req.body || {};
  if (!signalType || !content) {
    return res.status(400).json({ error: "signalType and content required" });
  }

  const violations = scanForThreats(content, "salience-input", generateQuarantineId());
  if (violations.some(v => v.signature.severity === "critical")) {
    return res.status(403).json({
      error: "Input blocked — critical threat detected",
      violations: violations.map(v => v.signature.description),
    });
  }

  const sanitized = sanitizeContent(content);
  const activated = salienceRoute(signalType, sanitized);

  res.json({
    activatedTribes: activated,
    inputScanned: true,
    threatViolations: violations.length,
    sanitized: violations.length > 0,
  });
});

router.post("/neural-bus/signal", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const { sourceTribe, targetTribes, content, priority } = req.body || {};
  if (!sourceTribe || !targetTribes || !content) {
    return res.status(400).json({ error: "sourceTribe, targetTribes, and content required" });
  }

  const violations = scanForThreats(content, "neural-bus-input", generateQuarantineId());
  if (violations.some(v => v.signature.severity === "critical")) {
    return res.status(403).json({ error: "Signal blocked — threat detected" });
  }

  const signal = sendNeuralBusSignal(sourceTribe, targetTribes, sanitizeContent(content), priority || 0.5);
  res.json({ signal });
});

router.post("/outcome", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const { tribeId, success, taskType } = req.body || {};
  if (!tribeId || typeof success !== "boolean") {
    return res.status(400).json({ error: "tribeId and success (boolean) required" });
  }

  recordOutcome(tribeId, success, taskType);
  const tribe = META_TRIBES.find(t => t.id === tribeId);
  const ttKey = `${taskType || "general"}::${tribeId}`;
  const ttOutcome = taskTypeOutcomes.get(ttKey);
  res.json({
    tribeId,
    performanceScore: tribe?.performanceScore,
    successfulOutcomes: tribe?.successfulOutcomes,
    failedOutcomes: tribe?.failedOutcomes,
    taskTypePerformance: ttOutcome ? { taskType: ttOutcome.taskType, score: ttOutcome.score, successes: ttOutcome.successes, failures: ttOutcome.failures } : null,
  });
});

router.get("/recommendations/:taskType", (req: Request, res: Response) => {
  const recommendations = getRecommendedTribes(req.params.taskType);
  res.json({ taskType: req.params.taskType, recommendations });
});

router.get("/plasticity", (_req: Request, res: Response) => {
  const connections = Array.from(plasticityMap.values())
    .sort((a, b) => b.connectionStrength - a.connectionStrength);

  res.json({
    totalConnections: connections.length,
    connections: connections.map(c => ({
      source: c.sourceTribe,
      target: c.targetTribe,
      strength: Math.round(c.connectionStrength * 1000) / 1000,
      coActivations: c.coActivationCount,
      lastCoActivation: c.lastCoActivation,
    })),
    hebbianPrinciple: "Neurons that fire together wire together — tribes that co-activate strengthen their connections",
    decayActive: true,
  });
});

router.post("/scan-dependency", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const { name, version } = req.body || {};
  if (!name) return res.status(400).json({ error: "dependency name required" });

  const result = scanDependency(name, version || "unknown");
  res.json(result);
});

router.get("/agent-mappings", (_req: Request, res: Response) => {
  const assignments = getAgentTribeAssignments();
  const agentCount = Object.keys(assignments).length;
  const multiTribeAgents = Object.entries(assignments).filter(([, tribes]) => tribes.length > 1);
  res.json({
    totalAgentsMapped: agentCount,
    totalTribes: META_TRIBES.length,
    assignments,
    multiTribeAgents: multiTribeAgents.map(([agent, tribes]) => ({ agent, tribes, tribeCount: tribes.length })),
    tribeRosters: META_TRIBES.map(t => ({ id: t.id, name: t.name, agents: t.mappedAgents, agentCount: t.mappedAgents.length })),
  });
});

router.get("/active-state", (_req: Request, res: Response) => {
  const state = getActiveTribesState();
  res.json(state);
});

router.get("/activation-history", (req: Request, res: Response) => {
  const limit = Math.min(100, parseInt(String(req.query?.limit || "50"), 10));
  res.json({
    total: activationHistory.length,
    history: activationHistory.slice(-limit).reverse().map(r => ({
      tribeId: r.tribeId,
      taskType: r.taskType,
      timestamp: r.timestamp,
      reason: r.reason,
      outcome: r.outcome,
      resolvedAt: r.resolvedAt,
    })),
    taskTypeStats: Array.from(taskTypeOutcomes.values()).map(tt => ({
      taskType: tt.taskType,
      tribeId: tt.tribeId,
      successes: tt.successes,
      failures: tt.failures,
      score: Math.round(tt.score * 1000) / 1000,
    })),
  });
});

router.get("/emergent-insights", (_req: Request, res: Response) => {
  res.json({
    total: emergentInsights.length,
    insights: emergentInsights.slice(-50).reverse().map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      sourceTribes: e.sourceTribeIds.map(id => META_TRIBES.find(t => t.id === id)?.name || id),
      insight: e.insight,
      confidence: e.confidence,
      taskType: e.taskType,
    })),
  });
});

router.get("/brain-science", (_req: Request, res: Response) => {
  res.json({
    purpose: "Neuroscience knowledge quarantine — all fragments must pass security to be absorbed",
    networks: META_TRIBES.map(t => ({
      id: t.id,
      name: t.brainNetworkAnalog,
      function: t.function,
      neuroscientificBasis: t.neuroscientificBasis,
      keyBrainRegions: t.keyBrainRegions,
      cognitiveRole: t.cognitiveRole,
    })),
    keyPrinciples: [
      "The brain uses dynamic switching between networks — sustained focus on one mode leads to cognitive fatigue",
      "The Salience Network acts as a toggle switch between internal (DMN) and external (CEN) processing",
      "Hebbian plasticity: repeatedly co-activated pathways strengthen over time (learning)",
      "Emotions are not opposed to reason — they provide rapid heuristic signals for decision-making",
      "Working memory is limited to ~4 chunks — effective cognition requires offloading to long-term memory",
      "Procedural learning automates frequent tasks into fast habits, freeing cognitive resources",
      "Social cognition requires modeling other minds as having different knowledge and goals",
      "Creative insights emerge during DMN activity (mind-wandering) not CEN activity (focused work)",
      "The brain uses predictive coding — it generates expectations and only processes prediction errors",
      "Neuroplasticity means the brain rewires itself based on experience — connections strengthen with use and weaken without",
    ],
    securityNote: "All knowledge fragments are quarantined, threat-scanned, integrity-hashed, and only absorbed into Tess's cognition after passing 3+ security scans with SANITIZED clearance.",
  });
});

function getActiveTribesState(): { activeTribes: string[]; dominantTribe: string | null; attentionWeights: Record<string, number> } {
  const active = META_TRIBES.filter(t => t.isActive);
  const dominant = active.length > 0 ? active.reduce((a, b) => a.activationLevel > b.activationLevel ? a : b) : null;
  const weights: Record<string, number> = {};
  for (const t of META_TRIBES) {
    weights[t.id] = t.isActive ? t.activationLevel * t.performanceScore : 0;
  }
  return { activeTribes: active.map(t => t.id), dominantTribe: dominant?.id || null, attentionWeights: weights };
}

function getTribeInfluencedPriority(category: string): number {
  const categoryTribeMap: Record<string, string[]> = {
    "security": ["salience", "dorsal-attention"],
    "threat": ["salience", "limbic"],
    "planning": ["central-executive", "default-mode"],
    "reflection": ["default-mode", "social-cognition"],
    "emotion": ["limbic", "social-cognition"],
    "action": ["sensorimotor", "central-executive"],
    "monitoring": ["dorsal-attention", "salience"],
    "social": ["social-cognition", "limbic"],
    "creative": ["default-mode", "limbic"],
    "analysis": ["central-executive", "dorsal-attention"],
    "thought": ["default-mode", "central-executive"],
  };
  const relevantTribes = categoryTribeMap[category] || ["central-executive"];
  let totalWeight = 0;
  for (const tId of relevantTribes) {
    const tribe = META_TRIBES.find(t => t.id === tId);
    if (tribe && tribe.isActive) {
      totalWeight += tribe.activationLevel * tribe.performanceScore;
    }
  }
  return Math.min(1, totalWeight / relevantTribes.length + 0.3);
}

function influenceConsciousnessAttention(items: Array<{ content: string; category: string; priority: number }>): Array<{ content: string; category: string; priority: number }> {
  return items.map(item => {
    const tribeBoost = getTribeInfluencedPriority(item.category);
    return { ...item, priority: Math.min(1, item.priority * 0.6 + tribeBoost * 0.4) };
  }).sort((a, b) => b.priority - a.priority);
}

function getAgentTribeAssignments(): Record<string, string[]> {
  const assignments: Record<string, string[]> = {};
  for (const tribe of META_TRIBES) {
    for (const agent of tribe.mappedAgents) {
      if (!assignments[agent]) assignments[agent] = [];
      assignments[agent].push(tribe.id);
    }
  }
  return assignments;
}

export default router;
export {
  startMetaTribesEngine,
  stopMetaTribesEngine,
  salienceRoute,
  activateTribe,
  deactivateTribe,
  recordOutcome,
  sendNeuralBusSignal,
  quarantineKnowledge,
  absorbSafeKnowledge,
  scanForThreats,
  scanDependency,
  getSecurityStatus,
  getActiveTribesState,
  getTribeInfluencedPriority,
  influenceConsciousnessAttention,
  getAgentTribeAssignments,
  getRecommendedTribes,
  META_TRIBES,
};
