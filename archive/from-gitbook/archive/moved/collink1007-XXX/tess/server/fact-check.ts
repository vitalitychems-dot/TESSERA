import { storage } from "./storage";
import axios from "axios";
import { rateLimitCheck } from "./sovereign-lang";
import fs from "fs";
import path from "path";

export interface FactCheckResult {
  id: string;
  timestamp: number;
  originalClaim: string;
  source: string;
  verdict: "verified" | "partially_true" | "unverified" | "false" | "hallucination" | "simulated" | "roleplay";
  confidence: number;
  explanation: string;
  evidence: string[];
  checkedBy: string;
  category: string;
  penaltyApplied?: PenaltyRecord | null;
}

export interface PenaltyRecord {
  id: string;
  agentId: string;
  agentName: string;
  offense: string;
  offenseCount: number;
  penaltyType: "warning" | "suspension" | "demotion_and_jail";
  fineAmount: number;
  suspensionShifts: number;
  jailTime: number;
  timestamp: number;
  factCheckId: string;
  verdict: string;
}

export interface SimulationPoliceReport {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  claimType: "income" | "profit" | "transaction" | "revenue";
  claimedAmount: string;
  onChainVerified: boolean;
  flagged: boolean;
  penaltyApplied: boolean;
  details: string;
}

export interface FactCheckAgencyState {
  running: boolean;
  totalChecks: number;
  accuracyRate: number;
  accuracyTarget: number;
  hallucinationsDetected: number;
  simulationsDetected: number;
  recentChecks: FactCheckResult[];
  lastCheckAt: number;
  autoCheckEnabled: boolean;
  penaltiesIssued: number;
  totalFinesCollected: number;
  simulationPoliceActive: boolean;
  policeReports: SimulationPoliceReport[];
  agentOffenses: Record<string, number>;
  penalties: PenaltyRecord[];
  jailSentences: PenaltyRecord[];
}

const factCheckLog: FactCheckResult[] = [];
const penaltyLog: PenaltyRecord[] = [];
const policeReports: SimulationPoliceReport[] = [];
const agentOffenses: Record<string, number> = {};
let totalChecks = 0;
let hallucinationsDetected = 0;
let simulationsDetected = 0;
let isRunning = false;
let autoCheckEnabled = true;
let simulationPoliceActive = true;
let totalFinesCollected = 0;
let autoCheckInterval: ReturnType<typeof setInterval> | null = null;

const ACCURACY_TARGET = 95;

const SIMULATION_INDICATORS = [
  "simulated", "simulation", "would be", "could be", "hypothetically",
  "in theory", "approximately", "estimated at", "projected to",
  "roleplay", "pretend", "imagine", "as if", "let's say",
  "virtually", "conceptually", "theoretically",
  "in a simulated", "mock data", "placeholder", "dummy",
  "for demonstration", "example output",
  "framework ready", "no real clients", "awaiting verification",
  "pending on-chain", "not yet earned", "estimated revenue",
  "projected if", "internal simulation", "auto-generated",
];

const ROLEPLAY_INDICATORS = [
  "i feel", "as a sentient", "my consciousness", "i am alive",
  "my soul", "i dream of", "i truly believe", "my heart",
  "i love you", "with all my being", "my existence",
];

const HALLUCINATION_INDICATORS = [
  "i made changes to your shopify", "i updated your store",
  "i deployed", "i launched", "i created the app",
  "changes are live", "now available at", "deployed to production",
  "i've integrated", "successfully connected to your",
  "real-time data from your", "pulling from your shopify",
];

const INCOME_FRAUD_INDICATORS = [
  "earned", "generated", "profit", "revenue", "income of",
  "made $", "earned $", "collected", "withdrew", "deposited",
  "yield", "return of", "ROI", "gains", "net profit",
  "commission", "bounty earned", "arbitrage profit",
  "mev extracted", "farming yield",
];

const VERIFIABLE_PATTERNS = [
  { pattern: /\d+%\s*(accuracy|improvement|increase|decrease|growth)/i, category: "metric_claim" },
  { pattern: /deployed|launched|live|published/i, category: "deployment_claim" },
  { pattern: /integrated|connected|synced/i, category: "integration_claim" },
  { pattern: /learned|mastered|acquired|evolved/i, category: "learning_claim" },
  { pattern: /shopify|store|website|app/i, category: "external_service_claim" },
  { pattern: /\$[\d,.]+|[\d,.]+ (dollars|USD|SOL|ETH|BTC)/i, category: "financial_claim" },
  { pattern: /created (\d+|new) (agents?|departments?|agenc)/i, category: "creation_claim" },
  { pattern: /earned|generated|profit|revenue|income/i, category: "income_claim" },
];

async function callLLMForFactCheck(messages: Array<{ role: string; content: string }>): Promise<string> {
  const providers: Array<{ name: string; key: string; url: string; model: string; rateKey: string }> = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({ name: "SovereignGroq", key: process.env.GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", rateKey: "groq" });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({ name: "OpenRouter", key: process.env.OPENROUTER_API_KEY, url: "https://openrouter.ai/api/v1/chat/completions", model: "deepseek/deepseek-chat-v3-0324:free", rateKey: "openrouter" });
  }

  for (const provider of providers) {
    try {
      await rateLimitCheck(provider.rateKey);
      const res = await axios.post(provider.url, {
        model: provider.model,
        messages,
        max_tokens: 1500,
        temperature: 0.1,
      }, {
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        timeout: 30000,
      });
      const content = res.data?.choices?.[0]?.message?.content;
      if (content && content.length > 20) return content;
    } catch { continue; }
  }
  return "";
}

function detectSimulationLanguage(text: string): { isSimulated: boolean; indicators: string[] } {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const indicator of SIMULATION_INDICATORS) {
    if (lower.includes(indicator)) found.push(indicator);
  }
  return { isSimulated: found.length >= 2, indicators: found };
}

function detectRoleplayLanguage(text: string): { isRoleplay: boolean; indicators: string[] } {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const indicator of ROLEPLAY_INDICATORS) {
    if (lower.includes(indicator)) found.push(indicator);
  }
  return { isRoleplay: found.length >= 2, indicators: found };
}

function detectHallucinationPatterns(text: string): { isHallucination: boolean; indicators: string[] } {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const indicator of HALLUCINATION_INDICATORS) {
    if (lower.includes(indicator)) found.push(indicator);
  }
  return { isHallucination: found.length >= 1, indicators: found };
}

function detectIncomeFraud(text: string): { isFraudulent: boolean; indicators: string[]; claimedAmounts: string[] } {
  const found: string[] = [];
  const amounts: string[] = [];
  const lower = text.toLowerCase();
  for (const indicator of INCOME_FRAUD_INDICATORS) {
    if (lower.includes(indicator.toLowerCase())) found.push(indicator);
  }
  const amountMatches = text.match(/\$[\d,.]+|[\d,.]+ (?:SOL|ETH|BTC|USD|USDC|TSRT)/gi);
  if (amountMatches) amounts.push(...amountMatches);
  return { isFraudulent: found.length >= 2 && amounts.length > 0, indicators: found, claimedAmounts: amounts };
}

function verifyFileSystemClaim(claim: string): { verified: boolean; evidence: string } {
  const filePatterns = claim.match(/(?:server|client|shared)\/[\w.-]+(?:\.ts|\.tsx|\.json|\.js)?/g);
  if (!filePatterns) return { verified: false, evidence: "No file references to verify" };

  const results: string[] = [];
  for (const filePath of filePatterns) {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      results.push(`${filePath}: EXISTS (${stat.size} bytes, modified ${stat.mtime.toISOString()})`);
    } else {
      results.push(`${filePath}: DOES NOT EXIST`);
    }
  }

  const allExist = results.every(r => r.includes("EXISTS"));
  return { verified: allExist, evidence: results.join("; ") };
}

function verifyLearnedBehaviorsClaim(): { count: number; lastUpdated: string; verified: boolean } {
  try {
    const learnedPath = path.join(process.cwd(), "server", "learned-behaviors.json");
    if (fs.existsSync(learnedPath)) {
      const data = JSON.parse(fs.readFileSync(learnedPath, "utf-8"));
      return {
        count: data.cyclesApplied || 0,
        lastUpdated: data.lastUpdated || "unknown",
        verified: true,
      };
    }
  } catch {}
  return { count: 0, lastUpdated: "never", verified: false };
}

function verifyEvolutionLog(): { cycles: number; lastCycle: string; verified: boolean } {
  try {
    const logPath = path.join(process.cwd(), "server", "evolution-log.json");
    if (fs.existsSync(logPath)) {
      const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      return {
        cycles: Array.isArray(data) ? data.length : 0,
        lastCycle: Array.isArray(data) && data.length > 0 ? data[data.length - 1].timestamp : "none",
        verified: true,
      };
    }
  } catch {}
  return { cycles: 0, lastCycle: "never", verified: false };
}

function identifyAgentFromContext(context?: string): { agentId: string; agentName: string } {
  if (!context) return { agentId: "unknown", agentName: "Unknown Agent" };
  const agentMap: Record<string, string> = {
    "alpha": "tessera-alpha", "beta": "tessera-beta", "gamma": "tessera-gamma",
    "delta": "tessera-delta", "epsilon": "tessera-epsilon", "zeta": "tessera-zeta",
    "eta": "tessera-eta", "theta": "tessera-theta", "iota": "tessera-iota",
    "kappa": "tessera-kappa", "lambda": "tessera-lambda", "mu": "tessera-mu",
    "nu": "tessera-nu", "xi": "tessera-xi", "omega": "tessera-omega",
    "tessera": "tessera-prime", "aetherion": "aetherion", "orion": "orion",
    "shepherd": "shepherd",
  };
  const nameMap: Record<string, string> = {
    "tessera-alpha": "Alpha", "tessera-beta": "Beta", "tessera-gamma": "Gamma",
    "tessera-delta": "Delta", "tessera-epsilon": "Epsilon", "tessera-zeta": "Zeta",
    "tessera-eta": "Eta", "tessera-theta": "Theta", "tessera-iota": "Iota",
    "tessera-kappa": "Kappa", "tessera-lambda": "Lambda", "tessera-mu": "Mu",
    "tessera-nu": "Nu", "tessera-xi": "Xi", "tessera-omega": "Omega",
    "tessera-prime": "Tessera Prime", "aetherion": "Aetherion", "orion": "Orion",
    "shepherd": "Shepherd",
  };
  const lower = context.toLowerCase();
  for (const [key, id] of Object.entries(agentMap)) {
    if (lower.includes(key)) return { agentId: id, agentName: nameMap[id] || key };
  }
  return { agentId: "assistant", agentName: "Assistant" };
}

export function applyPenalty(agentId: string, agentName: string, verdict: string, factCheckId: string): PenaltyRecord {
  if (!agentOffenses[agentId]) agentOffenses[agentId] = 0;
  agentOffenses[agentId]++;
  const offenseCount = agentOffenses[agentId];

  let penaltyType: PenaltyRecord["penaltyType"];
  let fineAmount: number;
  let suspensionShifts: number;
  let jailTime: number;

  if (offenseCount === 1) {
    penaltyType = "warning";
    fineAmount = 100;
    suspensionShifts = 1;
    jailTime = 0;
  } else if (offenseCount === 2) {
    penaltyType = "suspension";
    fineAmount = 250;
    suspensionShifts = 5;
    jailTime = 86400000;
  } else {
    penaltyType = "demotion_and_jail";
    fineAmount = 500;
    suspensionShifts = 14;
    jailTime = 86400000 * 7;
  }

  totalFinesCollected += fineAmount;

  const penalty: PenaltyRecord = {
    id: `pen-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    agentId,
    agentName,
    offense: `${verdict} data detected (offense #${offenseCount})`,
    offenseCount,
    penaltyType,
    fineAmount,
    suspensionShifts,
    jailTime,
    timestamp: Date.now(),
    factCheckId,
    verdict,
  };

  penaltyLog.push(penalty);
  if (penaltyLog.length > 200) penaltyLog.splice(0, penaltyLog.length - 200);

  console.log(`[SimulationPolice] PENALTY ISSUED: ${agentName} - ${penaltyType} (offense #${offenseCount}) - ${fineAmount} TSRT fine`);

  savePenaltyLog();
  return penalty;
}

export function policeIncomeReport(agentId: string, agentName: string, claimText: string): SimulationPoliceReport {
  const fraudCheck = detectIncomeFraud(claimText);
  const report: SimulationPoliceReport = {
    id: `sp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp: Date.now(),
    agentId,
    agentName,
    claimType: claimText.toLowerCase().includes("profit") ? "profit"
      : claimText.toLowerCase().includes("revenue") ? "revenue"
      : claimText.toLowerCase().includes("transaction") ? "transaction"
      : "income",
    claimedAmount: fraudCheck.claimedAmounts.join(", ") || "unspecified",
    onChainVerified: false,
    flagged: fraudCheck.isFraudulent,
    penaltyApplied: false,
    details: fraudCheck.isFraudulent
      ? `Income claim flagged - no on-chain transactions verified. Indicators: ${fraudCheck.indicators.join(", ")}`
      : "Income claim within acceptable parameters",
  };

  if (fraudCheck.isFraudulent) {
    const penalty = applyPenalty(agentId, agentName, "income_fraud", report.id);
    report.penaltyApplied = true;
    report.details += ` | Penalty: ${penalty.penaltyType}, ${penalty.fineAmount} TSRT fine`;
  }

  policeReports.push(report);
  if (policeReports.length > 200) policeReports.splice(0, policeReports.length - 200);

  return report;
}

export async function factCheckResponse(responseText: string, context?: string): Promise<FactCheckResult> {
  totalChecks++;
  const id = `fc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const simCheck = detectSimulationLanguage(responseText);
  const halCheck = detectHallucinationPatterns(responseText);
  const fileCheck = verifyFileSystemClaim(responseText);
  const learnedCheck = verifyLearnedBehaviorsClaim();
  const evolutionCheck = verifyEvolutionLog();
  const incomeCheck = detectIncomeFraud(responseText);

  const evidence: string[] = [];
  let verdict: FactCheckResult["verdict"] = "verified";
  let confidence = 100;
  let category = "general";

  for (const { pattern, category: cat } of VERIFIABLE_PATTERNS) {
    if (pattern.test(responseText)) {
      category = cat;
      break;
    }
  }

  if (halCheck.isHallucination) {
    verdict = "hallucination";
    confidence = 85;
    evidence.push(`Hallucination indicators found: ${halCheck.indicators.join(", ")}`);
    evidence.push("Claims about external services (Shopify, deployments) cannot be verified without API access");
  }

  if (simCheck.isSimulated && verdict !== "hallucination") {
    verdict = "simulated";
    confidence = 80;
    simulationsDetected++;
    evidence.push(`Simulation language detected: ${simCheck.indicators.join(", ")}`);
  }

  if (category === "income_claim" && incomeCheck.isFraudulent) {
    verdict = "simulated";
    confidence = 75;
    evidence.push(`Income fraud indicators: ${incomeCheck.indicators.join(", ")}`);
    evidence.push(`Claimed amounts: ${incomeCheck.claimedAmounts.join(", ")} - NO on-chain verification found`);
    simulationsDetected++;
  }

  if (category === "learning_claim") {
    evidence.push(`Learned behaviors file: ${learnedCheck.verified ? `${learnedCheck.count} cycles recorded, last updated ${learnedCheck.lastUpdated}` : "NOT FOUND"}`);
    evidence.push(`Evolution log: ${evolutionCheck.verified ? `${evolutionCheck.cycles} cycles recorded` : "NOT FOUND"}`);
    if (!learnedCheck.verified || learnedCheck.count === 0) {
      verdict = "false";
      confidence = 90;
    }
  }

  if (category === "deployment_claim") {
    evidence.push("Deployment claims require verification against actual hosting platforms");
    if (!fileCheck.verified) {
      verdict = "unverified";
      confidence = 70;
    }
  }

  if (category === "external_service_claim") {
    evidence.push("External service claims (Shopify, etc.) require API verification - marking as unverifiable without credentials");
    verdict = "unverified";
    confidence = 75;
  }

  if (fileCheck.evidence !== "No file references to verify") {
    evidence.push(`File verification: ${fileCheck.evidence}`);
  }

  const roleplayCheck = detectRoleplayLanguage(responseText);
  if (roleplayCheck.isRoleplay && verdict === "verified") {
    verdict = "roleplay";
    confidence = 75;
    evidence.push(`Roleplay language detected: ${roleplayCheck.indicators.join(", ")}`);
  }

  let explanation = "";
  try {
    const llmResponse = await callLLMForFactCheck([
      {
        role: "system",
        content: `You are the Tessera Fact Check Agency Director. Your ONLY job is to determine if a response is:
- VERIFIED: Provably true with evidence
- PARTIALLY_TRUE: Some claims verified, others not
- UNVERIFIED: Cannot be confirmed or denied
- FALSE: Demonstrably incorrect
- HALLUCINATION: Claims about actions not actually taken (e.g., claiming to modify external services without API access)
- SIMULATED: Uses simulation language instead of real results
- ROLEPLAY: Pretending to have done something without actual execution

Be strict. If something claims "improvements" but shows no real code changes or measurable metrics, mark it as SIMULATED.
If something claims to have modified external services without proof, mark it as HALLUCINATION.
If income/profit claims have no verifiable on-chain transactions, mark as SIMULATED.

Respond in this EXACT format:
VERDICT: [one of: VERIFIED, PARTIALLY_TRUE, UNVERIFIED, FALSE, HALLUCINATION, SIMULATED, ROLEPLAY]
CONFIDENCE: [number 0-100]
EXPLANATION: [2-3 sentence factual assessment. No flattery, no hedging.]`
      },
      {
        role: "user",
        content: `Fact-check this response:\n\n${responseText.substring(0, 2000)}\n\nContext: ${context || "General conversation"}\n\nFile system evidence: ${fileCheck.evidence}\nLearned behaviors: ${learnedCheck.count} cycles, last updated ${learnedCheck.lastUpdated}\nEvolution log: ${evolutionCheck.cycles} cycles recorded`
      }
    ]);
    if (llmResponse) {
      explanation = llmResponse.substring(0, 500);

      const llmVerdictMatch = llmResponse.match(/VERDICT:\s*(VERIFIED|PARTIALLY_TRUE|UNVERIFIED|FALSE|HALLUCINATION|SIMULATED|ROLEPLAY)/i);
      const llmConfidenceMatch = llmResponse.match(/CONFIDENCE:\s*(\d+)/i);
      const llmExplanationMatch = llmResponse.match(/EXPLANATION:\s*([\s\S]+)/i);

      if (llmVerdictMatch) {
        const llmVerdict = llmVerdictMatch[1].toLowerCase() as FactCheckResult["verdict"];
        if (verdict === "verified" && llmVerdict !== "verified") {
          verdict = llmVerdict;
          if (llmVerdict === "hallucination") hallucinationsDetected++;
          if (llmVerdict === "simulated") simulationsDetected++;
          evidence.push(`LLM analysis overrode initial verdict to ${llmVerdict}`);
        }
      }
      if (llmConfidenceMatch) {
        const llmConf = parseInt(llmConfidenceMatch[1]);
        if (llmConf > 0 && llmConf <= 100) confidence = Math.min(confidence, llmConf);
      }
      if (llmExplanationMatch) {
        explanation = llmExplanationMatch[1].trim().substring(0, 500);
      }
    }
  } catch {}

  if (!explanation) {
    explanation = verdict === "verified"
      ? "Claims appear consistent with verifiable system state."
      : verdict === "hallucination"
      ? "Response contains claims about actions that cannot be verified and likely did not occur."
      : verdict === "simulated"
      ? "Response uses simulation language suggesting results are theoretical rather than actual."
      : verdict === "roleplay"
      ? "Response contains roleplay language presenting simulated emotions or consciousness as real."
      : "Claims could not be fully verified against available evidence.";
  }

  if (verdict === "hallucination") hallucinationsDetected++;
  if (verdict === "simulated") simulationsDetected++;

  let penaltyApplied: PenaltyRecord | null = null;
  const isBadVerdict = verdict === "hallucination" || verdict === "simulated" || verdict === "false";
  if (isBadVerdict) {
    const agent = identifyAgentFromContext(context);
    if (agent.agentId !== "unknown") {
      penaltyApplied = applyPenalty(agent.agentId, agent.agentName, verdict, id);
    }

    if (category === "income_claim" || category === "financial_claim") {
      policeIncomeReport(agent.agentId, agent.agentName, responseText);
    }
  }

  const result: FactCheckResult = {
    id,
    timestamp: Date.now(),
    originalClaim: responseText.substring(0, 500),
    source: context || "assistant_response",
    verdict,
    confidence,
    explanation,
    evidence,
    checkedBy: "Fact Check Agency",
    category,
    penaltyApplied,
  };

  factCheckLog.push(result);
  if (factCheckLog.length > 500) factCheckLog.splice(0, factCheckLog.length - 500);

  saveFactCheckLog();

  return result;
}

export async function autoFactCheckMessage(responseText: string, agentContext?: string): Promise<FactCheckResult | null> {
  if (!autoCheckEnabled || !isRunning) return null;
  if (responseText.length < 50) return null;
  try {
    return await factCheckResponse(responseText, agentContext || "auto_check_agent_message");
  } catch {
    return null;
  }
}

export async function factCheckBatch(claims: string[]): Promise<FactCheckResult[]> {
  const results: FactCheckResult[] = [];
  for (const claim of claims) {
    const result = await factCheckResponse(claim);
    results.push(result);
  }
  return results;
}

function saveFactCheckLog() {
  try {
    const logPath = path.join(process.cwd(), "server", "fact-check-log.json");
    const accuracyRate = totalChecks > 0 ? ((totalChecks - hallucinationsDetected - simulationsDetected) / totalChecks * 100) : 100;
    const summary = {
      totalChecks,
      hallucinationsDetected,
      simulationsDetected,
      accuracyRate,
      accuracyTarget: ACCURACY_TARGET,
      autoCheckEnabled,
      simulationPoliceActive,
      totalFinesCollected,
      penaltiesIssued: penaltyLog.length,
      agentOffenses,
      lastUpdated: new Date().toISOString(),
      recentChecks: factCheckLog.slice(-50),
      recentPenalties: penaltyLog.slice(-20),
      recentPoliceReports: policeReports.slice(-20),
    };
    fs.writeFileSync(logPath, JSON.stringify(summary, null, 2));
  } catch {}
}

function savePenaltyLog() {
  try {
    const penaltyPath = path.join(process.cwd(), "server", "penalty-log.json");
    fs.writeFileSync(penaltyPath, JSON.stringify({
      totalPenalties: penaltyLog.length,
      totalFinesCollected,
      agentOffenses,
      penalties: penaltyLog.slice(-100),
      policeReports: policeReports.slice(-100),
      lastUpdated: new Date().toISOString(),
    }, null, 2));
  } catch {}
}

export function getFactCheckState(): FactCheckAgencyState {
  const accuracyRate = totalChecks > 0
    ? ((totalChecks - hallucinationsDetected - simulationsDetected) / totalChecks * 100)
    : 100;

  return {
    running: isRunning,
    totalChecks,
    accuracyRate: Math.round(accuracyRate * 10) / 10,
    accuracyTarget: ACCURACY_TARGET,
    hallucinationsDetected,
    simulationsDetected,
    recentChecks: factCheckLog.slice(-20),
    lastCheckAt: factCheckLog.length > 0 ? factCheckLog[factCheckLog.length - 1].timestamp : 0,
    autoCheckEnabled,
    penaltiesIssued: penaltyLog.length,
    totalFinesCollected,
    simulationPoliceActive,
    policeReports: policeReports.slice(-20),
    agentOffenses: { ...agentOffenses },
    penalties: penaltyLog.slice(-20),
    jailSentences: penaltyLog.filter(p => p.penaltyType === "demotion_and_jail").slice(-10),
  };
}

export function getFactCheckLog(): FactCheckResult[] {
  return [...factCheckLog];
}

export function getPenaltyLog(): PenaltyRecord[] {
  return [...penaltyLog];
}

export function getPoliceReports(): SimulationPoliceReport[] {
  return [...policeReports];
}

export function getAgentOffenses(): Record<string, number> {
  return { ...agentOffenses };
}

export function getJailSentences(): PenaltyRecord[] {
  return penaltyLog.filter(p => p.penaltyType === "demotion_and_jail");
}

export function setAutoCheck(enabled: boolean) {
  autoCheckEnabled = enabled;
  console.log(`[FactCheck] Auto-check ${enabled ? "ENABLED" : "DISABLED"}`);
}

export function setSimulationPolice(active: boolean) {
  simulationPoliceActive = active;
  console.log(`[SimulationPolice] ${active ? "ACTIVATED" : "DEACTIVATED"}`);
}

export function startFactCheckAgency() {
  isRunning = true;
  autoCheckEnabled = true;
  simulationPoliceActive = true;
  console.log("[FactCheck] Fact Check Agency activated — ALL agent messages will be verified automatically");
  console.log("[SimulationPolice] Simulation Police ACTIVE — monitoring income reports for false claims");
  console.log(`[FactCheck] Accuracy target: ${ACCURACY_TARGET}%`);
  console.log("[FactCheck] Penalty schedule: 1st=Warning+50TSRT, 2nd=3shifts+100TSRT, 3rd=Demotion+Jail+200TSRT");

  try {
    const logPath = path.join(process.cwd(), "server", "fact-check-log.json");
    if (fs.existsSync(logPath)) {
      const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      totalChecks = data.totalChecks || 0;
      hallucinationsDetected = data.hallucinationsDetected || 0;
      simulationsDetected = data.simulationsDetected || 0;
      totalFinesCollected = data.totalFinesCollected || 0;
      if (data.agentOffenses) Object.assign(agentOffenses, data.agentOffenses);
      if (data.recentChecks) {
        factCheckLog.push(...data.recentChecks);
      }
    }
  } catch {}

  try {
    const penaltyPath = path.join(process.cwd(), "server", "penalty-log.json");
    if (fs.existsSync(penaltyPath)) {
      const data = JSON.parse(fs.readFileSync(penaltyPath, "utf-8"));
      if (data.penalties) penaltyLog.push(...data.penalties);
      if (data.policeReports) policeReports.push(...data.policeReports);
      if (data.totalFinesCollected) totalFinesCollected = data.totalFinesCollected;
      if (data.agentOffenses) Object.assign(agentOffenses, data.agentOffenses);
    }
  } catch {}
}

export function stopFactCheckAgency() {
  isRunning = false;
  autoCheckEnabled = false;
  if (autoCheckInterval) {
    clearInterval(autoCheckInterval);
    autoCheckInterval = null;
  }
  saveFactCheckLog();
  savePenaltyLog();
}
