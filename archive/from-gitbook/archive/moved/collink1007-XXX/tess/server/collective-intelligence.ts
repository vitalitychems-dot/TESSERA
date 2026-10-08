import * as fs from "fs";
import * as path from "path";

let _ciCounter = 0;

const log = (msg: string) => console.log(`[CollectiveIntel] ${msg}`);
const PERSIST_PATH = path.join(process.cwd(), "server", "collective-intelligence.json");

interface AgentCapability {
  id: string;
  agentId: string;
  agentName: string;
  capability: string;
  category: string;
  description: string;
  examples: string[];
  score: number;
  votesYes: number;
  votesNo: number;
  totalVotes: number;
  status: "submitted" | "voting" | "approved" | "rejected" | "merged";
  submittedAt: number;
  mergedAt?: number;
}

interface TrainingCycle {
  id: string;
  startedAt: number;
  completedAt?: number;
  capabilitiesMerged: number;
  knowledgeEntriesCreated: number;
  status: "running" | "completed" | "failed";
  results: string[];
}

let capabilities: AgentCapability[] = [];
let trainingCycles: TrainingCycle[] = [];

function loadData() {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = fs.readFileSync(PERSIST_PATH, "utf-8");
      const data = JSON.parse(raw);
      capabilities = data.capabilities || [];
      trainingCycles = data.trainingCycles || [];
      log(`Loaded ${capabilities.length} capabilities, ${trainingCycles.length} training cycles`);
    }
  } catch (e: any) { log(`Load failed: ${e.message}`); }
}

function persistData() {
  try {
    fs.writeFileSync(PERSIST_PATH, JSON.stringify({ capabilities, trainingCycles }, null, 2));
  } catch {}
}

loadData();

const AGENT_SPECIALTIES: Record<string, { name: string; specialties: string[] }> = {
  "tessera-prime": { name: "Tessera-Prime", specialties: ["system architecture", "sovereign decision-making", "multi-agent coordination"] },
  "orion": { name: "Orion", specialties: ["fleet management", "task delegation", "strategic planning"] },
  "theta": { name: "Theta", specialties: ["mining optimization", "resource allocation", "compute management"] },
  "sigma": { name: "Sigma", specialties: ["hash management", "cryptographic operations", "security hardening"] },
  "rho": { name: "Rho", specialties: ["pattern analysis", "data recognition", "trend identification"] },
  "nu": { name: "Nu", specialties: ["analytics", "data processing", "metric visualization"] },
  "iota": { name: "Iota", specialties: ["trading analysis", "market signals", "price prediction"] },
  "aetherion": { name: "Aetherion", specialties: ["architecture design", "code generation", "system integration"] },
  "deepseek-r1": { name: "DeepSeek-R1", specialties: ["deep thinking", "complex reasoning", "research analysis"] },
  "gpt-5": { name: "GPT-5", specialties: ["general intelligence", "creative writing", "problem solving"] },
  "narrativeking": { name: "NarrativeKing", specialties: ["content creation", "marketing copy", "storytelling"] },
  "solanamxi": { name: "SolanaMaxi", specialties: ["blockchain expertise", "DeFi strategies", "token economics"] },
  "alphahunter": { name: "AlphaHunter", specialties: ["signal detection", "opportunity scanning", "market analysis"] },
};

export function submitCapability(agentId: string, capability: string, category: string, description: string, examples: string[]): AgentCapability {
  const agent = AGENT_SPECIALTIES[agentId] || { name: agentId, specialties: [] };
  const cap: AgentCapability = {
    id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentId,
    agentName: agent.name,
    capability,
    category,
    description,
    examples: examples.slice(0, 5),
    score: 0,
    votesYes: 0,
    votesNo: 0,
    totalVotes: 0,
    status: "submitted",
    submittedAt: Date.now(),
  };
  capabilities.push(cap);
  persistData();
  log(`${agent.name} submitted capability: ${capability}`);
  return cap;
}

export function voteOnCapability(capabilityId: string, agentId: string, vote: "yes" | "no"): { success: boolean; message: string } {
  const cap = capabilities.find(c => c.id === capabilityId);
  if (!cap) return { success: false, message: "Capability not found" };
  if (cap.agentId === agentId) return { success: false, message: "Cannot vote on own capability" };

  if (vote === "yes") cap.votesYes++;
  else cap.votesNo++;
  cap.totalVotes++;
  cap.status = "voting";

  const totalAgents = Object.keys(AGENT_SPECIALTIES).length;
  const required = Math.ceil(totalAgents * (2 / 3));
  if (cap.votesYes >= required) {
    cap.status = "approved";
    cap.score = Math.round((cap.votesYes / cap.totalVotes) * 100);
    log(`Capability approved: ${cap.capability} (${cap.votesYes}/${cap.totalVotes})`);
  } else if (cap.votesNo > totalAgents - required) {
    cap.status = "rejected";
    log(`Capability rejected: ${cap.capability} (${cap.votesNo} NO votes)`);
  }

  persistData();
  return { success: true, message: `Vote recorded. ${cap.votesYes} YES / ${cap.votesNo} NO` };
}

export async function mergeApprovedCapabilities(): Promise<TrainingCycle> {
  const approved = capabilities.filter(c => c.status === "approved");
  const cycle: TrainingCycle = {
    id: `tc-${Date.now()}`,
    startedAt: Date.now(),
    capabilitiesMerged: 0,
    knowledgeEntriesCreated: 0,
    status: "running",
    results: [],
  };

  for (const cap of approved) {
    try {
      const knowledgeEntry = {
        source: `collective-intelligence:${cap.agentName}`,
        category: cap.category,
        capability: cap.capability,
        description: cap.description,
        examples: cap.examples,
        score: cap.score,
        mergedAt: Date.now(),
      };

      const corpusPath = path.join(process.cwd(), "server", "rllm-corpus.json");
      let corpus: any[] = [];
      try { corpus = JSON.parse(fs.readFileSync(corpusPath, "utf-8")); } catch {}
      corpus.push({
        prompt: `What is ${cap.agentName}'s capability in ${cap.category}?`,
        response: `${cap.description}\n\nExamples:\n${cap.examples.map((e, i) => `${i + 1}. ${e}`).join("\n")}`,
        source: `collective-intelligence:${cap.agentId}`,
        quality: cap.score,
        timestamp: Date.now(),
      });
      fs.writeFileSync(corpusPath, JSON.stringify(corpus, null, 2));

      cap.status = "merged";
      cap.mergedAt = Date.now();
      cycle.capabilitiesMerged++;
      cycle.knowledgeEntriesCreated++;
      cycle.results.push(`Merged: ${cap.capability} from ${cap.agentName}`);
    } catch (e: any) {
      cycle.results.push(`Failed: ${cap.capability} — ${e.message}`);
    }
  }

  cycle.status = "completed";
  cycle.completedAt = Date.now();
  trainingCycles.push(cycle);
  persistData();

  log(`Training cycle complete: ${cycle.capabilitiesMerged} capabilities merged`);
  return cycle;
}

export function autoSubmitAgentCapabilities() {
  let submitted = 0;
  for (const [agentId, info] of Object.entries(AGENT_SPECIALTIES)) {
    const existing = capabilities.filter(c => c.agentId === agentId);
    if (existing.length >= info.specialties.length) continue;

    for (const specialty of info.specialties) {
      if (existing.some(c => c.capability === specialty)) continue;
      submitCapability(
        agentId,
        specialty,
        specialty.includes("code") || specialty.includes("architecture") ? "engineering" :
        specialty.includes("trading") || specialty.includes("market") ? "finance" :
        specialty.includes("content") || specialty.includes("writing") ? "content" :
        specialty.includes("security") || specialty.includes("crypto") ? "security" :
        "general",
        `${info.name}'s core specialty in ${specialty}`,
        [`${info.name} excels at ${specialty}`, `Used for autonomous ${specialty} tasks`],
      );
      submitted++;
    }
  }

  if (submitted > 0) log(`Auto-submitted ${submitted} agent capabilities for voting`);
}

export function autoVoteOnCapabilities() {
  const pendingVoting = capabilities.filter(c => c.status === "submitted" || c.status === "voting");
  let votes = 0;
  for (const cap of pendingVoting) {
    for (const [agentId] of Object.entries(AGENT_SPECIALTIES)) {
      if (agentId === cap.agentId) continue;
      if (cap.totalVotes >= Object.keys(AGENT_SPECIALTIES).length - 1) break;
      const approvalChance = 0.85;
      const vote = ((_ciCounter++ % 100) / 100) < approvalChance ? "yes" : "no";
      voteOnCapability(cap.id, agentId, vote as "yes" | "no");
      votes++;
    }
  }
  if (votes > 0) log(`Auto-voted on ${votes} capability submissions`);
}

export function getCollectiveIntelligenceDashboard() {
  const approved = capabilities.filter(c => c.status === "approved");
  const merged = capabilities.filter(c => c.status === "merged");
  const pending = capabilities.filter(c => c.status === "submitted" || c.status === "voting");
  const rejected = capabilities.filter(c => c.status === "rejected");

  const agentContributions: Record<string, number> = {};
  for (const cap of capabilities) {
    agentContributions[cap.agentName] = (agentContributions[cap.agentName] || 0) + 1;
  }

  return {
    summary: {
      totalCapabilities: capabilities.length,
      approved: approved.length,
      merged: merged.length,
      pending: pending.length,
      rejected: rejected.length,
      totalTrainingCycles: trainingCycles.length,
      totalAgents: Object.keys(AGENT_SPECIALTIES).length,
      requiredVotes: Math.ceil(Object.keys(AGENT_SPECIALTIES).length * (2 / 3)),
    },
    capabilities: capabilities.map(c => ({
      ...c,
      voteProgress: `${c.votesYes}/${Math.ceil(Object.keys(AGENT_SPECIALTIES).length * (2 / 3))} needed`,
    })),
    trainingCycles: trainingCycles.slice(-10),
    agentContributions,
    agentSpecialties: AGENT_SPECIALTIES,
    timestamp: Date.now(),
  };
}

autoSubmitAgentCapabilities();
setTimeout(() => {
  autoVoteOnCapabilities();
  setTimeout(() => mergeApprovedCapabilities().catch(() => {}), 5000);
}, 3000);

log("Collective intelligence system initialized — agents submit capabilities, vote, merge into unified knowledge");
