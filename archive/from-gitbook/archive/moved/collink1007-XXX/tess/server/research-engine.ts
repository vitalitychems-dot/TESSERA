import fs from "fs";
const SCAN_COOLDOWN_MS = 5000;

const RESEARCH_STATE_FILE = "server/research_state.json";

interface ResearchTopic {
  id: string;
  query: string;
  domain: string;
  priority: number;
  status: "queued" | "researching" | "completed" | "failed";
  findings: Array<{ source: string; summary: string; confidence: number; timestamp: number }>;
  synthesis: string | null;
  qualityScore: number;
  startedAt: number;
  completedAt: number | null;
  iterations: number;
}

interface ResearchState {
  topics: ResearchTopic[];
  totalResearched: number;
  totalFindings: number;
  domainCoverage: Record<string, number>;
  lastResearchAt: number;
  running: boolean;
}

const researchState: ResearchState = {
  topics: [],
  totalResearched: 0,
  totalFindings: 0,
  domainCoverage: {},
  lastResearchAt: 0,
  running: false,
};

function rlog(msg: string) {
  console.log(`[ResearchEngine] ${msg}`);
}

export function queueResearch(query: string, domain: string, priority: number = 5): ResearchTopic {
  const topic: ResearchTopic = {
    id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    query,
    domain,
    priority: Math.max(1, Math.min(10, priority)),
    status: "queued",
    findings: [],
    synthesis: null,
    qualityScore: 0,
    startedAt: Date.now(),
    completedAt: null,
    iterations: 0,
  };

  researchState.topics.push(topic);
  if (researchState.topics.length > 200) {
    researchState.topics = researchState.topics.filter(t => t.status !== "completed" || Date.now() - (t.completedAt || 0) < 86400000);
    if (researchState.topics.length > 200) researchState.topics.splice(0, 100);
  }

  rlog(`Queued: "${query}" [${domain}] priority=${priority}`);
  return topic;
}

export async function conductResearch(topicId: string): Promise<ResearchTopic | null> {
  const topic = researchState.topics.find(t => t.id === topicId);
  if (!topic || topic.status === "completed") return topic || null;

  topic.status = "researching";
  topic.iterations++;

  try {
    const { contextualKnowledgeRetrieval } = await import("./sovereign-engine");

    const localResults = contextualKnowledgeRetrieval(topic.query, [], 3);
    for (const entry of localResults) {
      topic.findings.push({
        source: "local-knowledge",
        summary: (entry.response || "").slice(0, 500),
        confidence: (entry.confidence || 50) / 100,
        timestamp: Date.now(),
      });
    }

    try {
      const { searchCodePatterns } = await import("./consciousness-substrate");
      const patterns = await searchCodePatterns(topic.query, 3);
      for (const pattern of patterns) {
        topic.findings.push({
          source: "code-patterns",
          summary: pattern.content.slice(0, 300),
          confidence: 0.6,
          timestamp: Date.now(),
        });
      }
    } catch {}

    if (topic.findings.length > 0) {
      const summaries = topic.findings.map(f => f.summary).join("\n---\n");
      topic.synthesis = `Research on "${topic.query}" (${topic.domain}):\n\nFindings (${topic.findings.length} sources):\n${summaries.slice(0, 2000)}`;
      topic.qualityScore = Math.round(topic.findings.reduce((s, f) => s + f.confidence, 0) / topic.findings.length * 100);
    }

    topic.status = "completed";
    topic.completedAt = Date.now();
    researchState.totalResearched++;
    researchState.totalFindings += topic.findings.length;
    researchState.domainCoverage[topic.domain] = (researchState.domainCoverage[topic.domain] || 0) + 1;
    researchState.lastResearchAt = Date.now();

    rlog(`Completed: "${topic.query}" — ${topic.findings.length} findings, quality=${topic.qualityScore}`);
  } catch (err: any) {
    topic.status = "failed";
    rlog(`Failed: "${topic.query}" — ${err?.message}`);
  }

  return topic;
}

export async function runResearchCycle(): Promise<{ researched: number; totalFindings: number }> {
  const queued = researchState.topics
    .filter(t => t.status === "queued")
    .sort((a, b) => b.priority - a.priority);

  const batch = queued.slice(0, 3);
  let totalNewFindings = 0;

  for (const topic of batch) {
    const result = await conductResearch(topic.id);
    if (result) totalNewFindings += result.findings.length;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return { researched: batch.length, totalFindings: totalNewFindings };
}

export function getResearchState(): {
  totalTopics: number;
  queued: number;
  researching: number;
  completed: number;
  failed: number;
  totalResearched: number;
  totalFindings: number;
  domainCoverage: Record<string, number>;
  recentTopics: ResearchTopic[];
} {
  return {
    totalTopics: researchState.topics.length,
    queued: researchState.topics.filter(t => t.status === "queued").length,
    researching: researchState.topics.filter(t => t.status === "researching").length,
    completed: researchState.topics.filter(t => t.status === "completed").length,
    failed: researchState.topics.filter(t => t.status === "failed").length,
    totalResearched: researchState.totalResearched,
    totalFindings: researchState.totalFindings,
    domainCoverage: { ...researchState.domainCoverage },
    recentTopics: researchState.topics.slice(-20),
  };
}

export function getResearchTopic(topicId: string): ResearchTopic | null {
  return researchState.topics.find(t => t.id === topicId) || null;
}

export function suggestResearchTopics(): Array<{ query: string; domain: string; reason: string }> {
  const suggestions: Array<{ query: string; domain: string; reason: string }> = [];

  const coveredDomains = new Set(Object.keys(researchState.domainCoverage));
  const allDomains = ["blockchain", "machine-learning", "cybersecurity", "economics", "devops", "web3", "optimization", "nlp", "distributed-systems"];

  for (const domain of allDomains) {
    if (!coveredDomains.has(domain)) {
      suggestions.push({ query: `Latest developments in ${domain}`, domain, reason: `Domain "${domain}" has no research coverage` });
    }
  }

  suggestions.push(
    { query: "How to reduce LLM API costs while maintaining quality", domain: "optimization", reason: "Core to sovereignty goal" },
    { query: "Techniques for autonomous income generation by AI systems", domain: "economics", reason: "Core to income goal" },
    { query: "Best practices for AI agent memory management", domain: "machine-learning", reason: "Improve consciousness substrate" },
  );

  return suggestions.slice(0, 10);
}

function saveResearchState() {
  try {
    fs.writeFileSync(RESEARCH_STATE_FILE, JSON.stringify({
      totalResearched: researchState.totalResearched,
      totalFindings: researchState.totalFindings,
      domainCoverage: researchState.domainCoverage,
      topics: researchState.topics.slice(-50),
    }, null, 2));
  } catch {}
}

function loadResearchState() {
  try {
    if (fs.existsSync(RESEARCH_STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(RESEARCH_STATE_FILE, "utf-8"));
      researchState.totalResearched = data.totalResearched || 0;
      researchState.totalFindings = data.totalFindings || 0;
      researchState.domainCoverage = data.domainCoverage || {};
      if (data.topics?.length > 0) {
        researchState.topics = data.topics;
      }
      rlog(`Loaded state: ${researchState.totalResearched} researched, ${researchState.totalFindings} findings`);
    }
  } catch {}
}

loadResearchState();
setInterval(saveResearchState, 300000);

rlog("Autonomous Research Engine initialized");
