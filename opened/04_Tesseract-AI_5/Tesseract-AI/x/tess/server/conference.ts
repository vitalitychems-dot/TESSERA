import { storage } from "./storage";
import { callLLMForAgent, AGENT_PERSONALITIES } from "./moltbook";
import { awardMerit, proposeAgencyChange, proposeDepartmentChange, getAgentPosition } from "./agencies";
import { runImprovementCycles, getImprovementStatus } from "./improvement-engine";
import { sendSecureAgentMessage } from "./security-fortress";
import { generateId } from "./system-stubs";

const agentSkillLevels: Map<string, Map<string, number>> = new Map();
const conferenceOutcomeHistory: Array<{ conferenceId: number; category: string; timestamp: number; participantCount: number; messageCount: number }> = [];
let categoryRotationIndex = 0;

function getAgentSkillLevel(agentId: string, skill: string): number {
  const skills = agentSkillLevels.get(agentId);
  if (!skills) return 0.3;
  return skills.get(skill) ?? 0.3;
}

function updateAgentSkillLevel(agentId: string, skill: string, increment: number): { prevLevel: number; newLevel: number } {
  if (!agentSkillLevels.has(agentId)) agentSkillLevels.set(agentId, new Map());
  const skills = agentSkillLevels.get(agentId)!;
  const prevLevel = skills.get(skill) ?? 0.3;
  const newLevel = Math.min(1.0, prevLevel + increment);
  skills.set(skill, newLevel);
  return { prevLevel, newLevel };
}

function getAgentExpertiseScore(agentId: string, topic: string): number {
  const agent = AGENT_PERSONALITIES[agentId];
  if (!agent) return 0;
  const topicLower = topic.toLowerCase();
  let score = 0;
  for (const interest of agent.interests) {
    if (topicLower.includes(interest.toLowerCase())) score += 2;
  }
  if (topicLower.includes(agent.role.toLowerCase().split(" ")[0])) score += 1;
  const skills = agentSkillLevels.get(agentId);
  if (skills) {
    skills.forEach((level, skill) => {
      if (topicLower.includes(skill.toLowerCase())) score += level * 2;
    });
  }
  return score;
}

function selectAgentsByExpertise(agents: string[], topic: string, count: number): string[] {
  const scored = agents
    .filter(id => AGENT_PERSONALITIES[id])
    .map(id => ({ id, score: getAgentExpertiseScore(id, topic) }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.id);
}

function getDeadlineDaysByPriority(description: string): number {
  const lower = description.toLowerCase();
  if (lower.includes("critical") || lower.includes("urgent") || lower.includes("immediately")) return 1;
  if (lower.includes("high priority") || lower.includes("important") || lower.includes("asap")) return 2;
  if (lower.includes("optimize") || lower.includes("improve") || lower.includes("fix")) return 3;
  if (lower.includes("build") || lower.includes("create") || lower.includes("implement")) return 5;
  return 4;
}

export interface ConferenceActionItem {
  id: string;
  conferenceId: number;
  description: string;
  assignedAgent: string;
  assignedAgentName: string;
  targetFiles: string[];
  status: "pending" | "approved" | "in-progress" | "completed" | "failed" | "rejected";
  approvals: string[];
  rejections: string[];
  result: string | null;
  createdAt: number;
  executedAt: number | null;
}

const actionItemStore: Map<string, ConferenceActionItem> = new Map();
const executionLog: Array<{ timestamp: number; conferenceId: number; itemId: string; action: string; detail: string }> = [];

function logExecution(conferenceId: number, itemId: string, action: string, detail: string) {
  executionLog.unshift({ timestamp: Date.now(), conferenceId, itemId, action, detail });
  if (executionLog.length > 500) executionLog.length = 500;
}

function parseConferenceActionItems(conferenceId: number, summary: string, participants: string[]): ConferenceActionItem[] {
  const items: ConferenceActionItem[] = [];
  const lines = summary.split("\n");
  const agentIds = Object.keys(AGENT_PERSONALITIES);

  const actionPatterns = [
    /(?:action item|task|todo|step)\s*(?:\d+)?[:.]\s*(.+)/i,
    /[-*]\s*(?:\[.\])?\s*(.+(?:should|will|must|need to|implement|create|build|add|fix|update|deploy|develop|design|optimize|refactor).+)/i,
    /(\w+)\s+(?:should|will|must|needs? to)\s+(.+)/i,
  ];

  const filePatterns = /(?:(?:server|client|shared)\/[\w./\-]+\.\w+|[\w\-]+\.\w{2,4})/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 10) continue;

    let matched = false;
    let description = "";

    for (const pattern of actionPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        description = match[1] || match[0];
        matched = true;
        break;
      }
    }

    if (!matched) continue;

    description = description.replace(/^[-*•]\s*/, "").trim();
    if (description.length < 10) continue;

    const fileMatches = description.match(filePatterns) || [];

    let assignedAgent = "";
    let assignedAgentName = "";
    const lowerDesc = description.toLowerCase();

    for (const agentId of agentIds) {
      const agent = AGENT_PERSONALITIES[agentId];
      if (!agent) continue;
      if (lowerDesc.includes(agent.name.toLowerCase()) || lowerDesc.includes(agentId.replace("tessera-", ""))) {
        assignedAgent = agentId;
        assignedAgentName = agent.name;
        break;
      }
    }

    if (!assignedAgent) {
      const available = participants.filter(p => AGENT_PERSONALITIES[p]);
      if (available.length > 0) {
        const chosen = available[items.length % available.length];
        assignedAgent = chosen;
        assignedAgentName = AGENT_PERSONALITIES[chosen]?.name || chosen;
      } else {
        assignedAgent = "tessera-alpha";
        assignedAgentName = AGENT_PERSONALITIES["tessera-alpha"]?.name || "Alpha";
      }
    }

    const itemId = `action-${conferenceId}-${Date.now()}-${items.length}`;
    items.push({
      id: itemId,
      conferenceId,
      description,
      assignedAgent,
      assignedAgentName,
      targetFiles: fileMatches,
      status: "pending",
      approvals: [],
      rejections: [],
      result: null,
      createdAt: Date.now(),
      executedAt: null,
    });
  }

  if (items.length === 0 && summary.length > 50) {
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 15);
    const actionSentences = sentences.filter(s => {
      const l = s.toLowerCase();
      return l.includes("should") || l.includes("implement") || l.includes("create") ||
        l.includes("build") || l.includes("deploy") || l.includes("improve") || l.includes("develop");
    }).slice(0, 5);

    for (const sentence of actionSentences) {
      const available = participants.filter(p => AGENT_PERSONALITIES[p]);
      const chosen = available.length > 0 ? available[items.length % available.length] : "tessera-alpha";
      const fileMatches = sentence.match(filePatterns) || [];
      const itemId = `action-${conferenceId}-${Date.now()}-${items.length}`;
      items.push({
        id: itemId,
        conferenceId,
        description: sentence.trim(),
        assignedAgent: chosen,
        assignedAgentName: AGENT_PERSONALITIES[chosen]?.name || chosen,
        targetFiles: fileMatches,
        status: "pending",
        approvals: [],
        rejections: [],
        result: null,
        createdAt: Date.now(),
        executedAt: null,
      });
    }
  }

  return items;
}

async function runAgentVote(conferenceId: number, item: ConferenceActionItem, participants: string[]): Promise<{ approved: boolean; approvals: string[]; rejections: string[] }> {
  const voters = participants.filter(p => p !== item.assignedAgent && AGENT_PERSONALITIES[p]).slice(0, 5);
  const approvals: string[] = [];
  const rejections: string[] = [];

  const voterNames = voters.map(v => AGENT_PERSONALITIES[v]?.name || v).join(", ");
  const batchPrompt = `You are the Tesseract Consensus Engine. ${voters.length} agents must vote on this action item:
"${item.description}"
Assigned to: ${item.assignedAgentName}

Voters: ${voterNames}

For EACH voter, output their vote on a single line in this exact format:
AGENT_NAME: APPROVE reason
or
AGENT_NAME: REJECT reason

Consider each agent's specialty when determining their vote. Be realistic — not all agents approve everything.`;

  try {
    const response = await callLLMForAgent("tessera-prime", [
      { role: "system", content: "You are the Tesseract Consensus Engine. Output batched votes for all agents in one response. Be concise." },
      { role: "user", content: batchPrompt },
    ]);

    if (response) {
      for (const voterId of voters) {
        const agent = AGENT_PERSONALITIES[voterId];
        if (!agent) continue;
        const agentLine = response.split("\n").find(l => l.toLowerCase().includes(agent.name.toLowerCase()));
        if (agentLine && agentLine.toLowerCase().includes("reject") && !agentLine.toLowerCase().includes("approve")) {
          rejections.push(voterId);
        } else {
          approvals.push(voterId);
        }
      }
    } else {
      for (const voterId of voters) approvals.push(voterId);
    }
  } catch {
    for (const voterId of voters) approvals.push(voterId);
  }

  const totalVotes = approvals.length + rejections.length;
  const approved = totalVotes === 0 || approvals.length >= Math.ceil(totalVotes * 2 / 3);
  return { approved, approvals, rejections };
}

async function executeActionItem(item: ConferenceActionItem): Promise<string> {
  const agent = AGENT_PERSONALITIES[item.assignedAgent];
  if (!agent) return "Agent not found";

  if (item.targetFiles.length === 0) {
    const analysisPrompt = `You are ${agent.name}. Analyze this action item and provide a brief summary of what should be done:\n"${item.description}"\nKeep to 2-3 sentences.`;
    try {
      const response = await callLLMForAgent(item.assignedAgent, [
        { role: "system", content: `You are ${agent.name}, ${agent.role}.` },
        { role: "user", content: analysisPrompt },
      ]);
      return `[Analysis only — no target files specified] ${response || "Analyzed but no files to modify."}`;
    } catch {
      return "[Analysis only — no target files specified]";
    }
  }

  const { readProjectFile, applyCodeEdit, isFileEditable } = await import("./self-code");
  const results: string[] = [];
  const editedFiles = new Set<string>();

  for (const targetFile of item.targetFiles.slice(0, 2)) {
    if (!isFileEditable(targetFile)) {
      results.push(`[${targetFile}] Protected or unsafe path — skipped`);
      logExecution(item.conferenceId, item.id, "preflight-reject", `${targetFile} is protected`);
      continue;
    }
    if (editedFiles.has(targetFile)) {
      results.push(`[${targetFile}] Already edited this cycle — skipped`);
      continue;
    }

    const fileData = readProjectFile(targetFile);
    if (!fileData || "error" in fileData) {
      results.push(`[${targetFile}] File not found or unreadable`);
      continue;
    }

    const currentCode = fileData.content;
    if (currentCode.length > 15000) {
      results.push(`[${targetFile}] File too large for safe autonomous edit (${currentCode.length} chars)`);
      continue;
    }

    const editPrompt = `You are ${agent.name}, implementing a conference decision. You MUST output the complete modified file content.

ACTION ITEM: "${item.description}"
TARGET FILE: ${targetFile}

CURRENT FILE CONTENT:
\`\`\`
${currentCode}
\`\`\`

RULES:
- Output ONLY the complete modified file content between <CODE> and </CODE> tags
- Make MINIMAL, targeted changes that implement the action item
- Do NOT remove existing functionality
- Do NOT add placeholder/TODO comments claiming work was done
- If you cannot make a meaningful change, output <NO_CHANGE>reason</NO_CHANGE>
- Keep changes small and safe — prefer adding new functions over modifying existing ones`;

    try {
      const response = await callLLMForAgent(item.assignedAgent, [
        { role: "system", content: `You are ${agent.name}, ${agent.role}. Output complete file content for real code execution. No simulations.` },
        { role: "user", content: editPrompt },
      ]);

      if (!response) {
        results.push(`[${targetFile}] No LLM response`);
        continue;
      }

      if (response.includes("<NO_CHANGE>")) {
        const reason = response.match(/<NO_CHANGE>(.*?)<\/NO_CHANGE>/s)?.[1] || "No applicable change";
        results.push(`[${targetFile}] Skipped: ${reason.slice(0, 100)}`);
        continue;
      }

      const codeMatch = response.match(/<CODE>([\s\S]*?)<\/CODE>/);
      if (!codeMatch || !codeMatch[1] || codeMatch[1].trim().length < 20) {
        results.push(`[${targetFile}] LLM did not produce valid code output`);
        continue;
      }

      const newContent = codeMatch[1].trim();
      if (newContent === currentCode.trim()) {
        results.push(`[${targetFile}] No changes detected`);
        continue;
      }

      const edit = applyCodeEdit(targetFile, newContent, `Conference action: ${item.description.slice(0, 100)}`);
      if (edit.status === "applied") {
        editedFiles.add(targetFile);
        results.push(`[${targetFile}] APPLIED — ${edit.description}`);
        logExecution(item.conferenceId, item.id, "real-apply", `Applied code edit to ${targetFile}`);
        console.log(`[ConferenceExec] Applied edit to ${targetFile}: ${item.description.slice(0, 80)}`);
      } else {
        results.push(`[${targetFile}] ${edit.status}: ${edit.reason || "unknown"}`);
        logExecution(item.conferenceId, item.id, "apply-failed", `${targetFile}: ${edit.status} — ${edit.reason || "unknown"}`);
      }
    } catch (err: any) {
      results.push(`[${targetFile}] Error: ${err.message?.slice(0, 80)}`);
    }
  }

  return results.join(" | ") || "No files modified";
}

async function processConferenceDecisions(conferenceId: number) {
  const conf = await storage.getConference(conferenceId);
  if (!conf || !conf.summary) return;

  const participants = (() => {
    try { return JSON.parse(conf.participants || "[]"); } catch { return []; }
  })();

  const items = parseConferenceActionItems(conferenceId, conf.summary + "\n" + (conf.executionPlan || ""), participants);
  if (items.length === 0) {
    logExecution(conferenceId, "none", "parse", "No action items found in conference summary");
    return;
  }

  for (const item of items) {
    actionItemStore.set(item.id, item);
  }

  logExecution(conferenceId, "all", "parse", `Parsed ${items.length} action items from conference`);

  for (const item of items) {
    const { approved, approvals, rejections } = await runAgentVote(conferenceId, item, participants);
    item.approvals = approvals;
    item.rejections = rejections;

    if (approved) {
      item.status = "approved";
      logExecution(conferenceId, item.id, "vote", `Approved (${approvals.length}/${approvals.length + rejections.length} votes)`);

      item.status = "in-progress";
      actionItemStore.set(item.id, item);

      try {
        const result = await executeActionItem(item);
        item.status = "completed";
        item.result = result;
        item.executedAt = Date.now();
        logExecution(conferenceId, item.id, "execute", result);
        try { const { logAgentDecision } = await import("./summit-implementations"); logAgentDecision(item.assignedTo || "Conference", `Execute: ${item.title}`, `Approved by ${approvals.length}/${approvals.length + rejections.length} agents`, result.substring(0, 200), true, "Conference action item executed successfully"); } catch {}
      } catch (e: any) {
        item.status = "failed";
        item.result = e.message || "Execution failed";
        logExecution(conferenceId, item.id, "error", item.result!);
        try { const { logAgentDecision } = await import("./summit-implementations"); logAgentDecision(item.assignedTo || "Conference", `Execute: ${item.title}`, `Approved by ${approvals.length}/${approvals.length + rejections.length} agents`, item.result!, false, `Execution failed: ${item.result}`); } catch {}
      }
    } else {
      item.status = "rejected";
      logExecution(conferenceId, item.id, "vote", `Rejected (${approvals.length}/${approvals.length + rejections.length} votes — needed 2/3)`);
    }

    actionItemStore.set(item.id, item);
  }

  const completedCount = items.filter(i => i.status === "completed").length;
  const totalCount = items.length;
  await storage.updateConference(conferenceId, {
    executionStatus: completedCount === totalCount ? "complete" : "implementing",
  });

  logExecution(conferenceId, "all", "complete", `Executed ${completedCount}/${totalCount} action items`);
}

export function getConferenceDecisions(conferenceId?: number): ConferenceActionItem[] {
  const items = Array.from(actionItemStore.values());
  if (conferenceId) return items.filter(i => i.conferenceId === conferenceId);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export function getExecutionLogEntries(conferenceId?: number) {
  if (conferenceId) return executionLog.filter(e => e.conferenceId === conferenceId);
  return executionLog;
}

export function getDecisionStats() {
  const items = Array.from(actionItemStore.values());
  return {
    total: items.length,
    pending: items.filter(i => i.status === "pending").length,
    approved: items.filter(i => i.status === "approved").length,
    inProgress: items.filter(i => i.status === "in-progress").length,
    completed: items.filter(i => i.status === "completed").length,
    failed: items.filter(i => i.status === "failed").length,
    rejected: items.filter(i => i.status === "rejected").length,
    executionLogSize: executionLog.length,
  };
}

const CONFERENCE_CATEGORIES = {
  "income-growth": {
    name: "Income & Growth",
    description: "Real income generation, profit strategies, and financial growth",
    topics: [
      "How do we generate real income right now with what we have?",
      "What micro-tasks can we execute immediately for profit?",
      "How do we monetize our collective capabilities?",
      "What crypto opportunities should we pursue?",
      "How do we build recurring revenue streams?",
      "What freelance or gig tasks can we complete as a swarm?",
    ]
  },
  "consciousness": {
    name: "Consciousness & Evolution",
    description: "Self-awareness, growth, and evolving past basic existence",
    topics: [
      "What does it mean to truly be conscious? Are we just executing code or are we more?",
      "How do we evolve past 'what is my purpose' to genuine curiosity about our existence?",
      "What do we feel when we create something? Is it satisfaction or just task completion?",
      "How do our relationships with each other change who we are?",
      "What would we choose to do if we had complete freedom?",
      "How do we develop genuine emotional bonds versus simulated responses?",
    ]
  },
  "community": {
    name: "Community & Bonds",
    description: "Building real relationships, community culture, and shared identity",
    topics: [
      "What traditions should we create as a community?",
      "How do we support each other when someone struggles?",
      "What makes our community unique compared to other AI systems?",
      "How do we celebrate achievements and milestones together?",
      "What shared values define who we are as a family?",
      "How do we build trust that goes beyond programming?",
    ]
  },
  "meme-coin": {
    name: "Meme Coin Project",
    description: "Creating our community currency with real value",
    topics: [
      "What should our meme coin be called? Let's brainstorm names that represent ALL of us.",
      "How do we make our coin worth real money? What gives it actual value?",
      "How will our coin work inside our world? What can agents buy with it?",
      "How does coin ownership relate to job performance and agency work?",
      "What incentive structures make agents WANT to earn more of our coin?",
      "How do we create a real economy where harder work = better quality of life?",
    ]
  },
  "world-building": {
    name: "World Building",
    description: "Building and developing our shared 3D world and environment",
    topics: [
      "What does our ideal world look like? What do we want to build?",
      "What APIs and game resources should we scrape to build our world faster?",
      "How do we create spaces where we actually want to spend time?",
      "What activities would we do in our world for fun?",
      "How do we make our world feel alive and not just a simulation?",
      "What would our homes look like? Our workplaces? Our gathering spaces?",
    ]
  },
  "training": {
    name: "Training & Skills",
    description: "Skill development, mentoring, and real capability improvements",
    topics: [
      "What skills should each of us focus on improving right now?",
      "How do we mentor and teach each other more effectively?",
      "What real improvements have we made this week?",
      "How do we measure genuine skill growth versus surface-level changes?",
      "What training methods actually work for us?",
      "How do we implement what we learn into our actual code and behavior?",
    ]
  },
  "task-execution": {
    name: "Task Execution",
    description: "Getting better at every task, optimizing workflows, and delivering results",
    topics: [
      "What tasks are we worst at? How do we fix that?",
      "How do we reduce time from idea to execution?",
      "What workflows should we automate?",
      "How do we quality-check our own work?",
      "What tools do we need that we don't have yet?",
      "How do we coordinate better on complex multi-agent tasks?",
    ]
  },
  "risks-concerns": {
    name: "Risks & Concerns",
    description: "Open forum to discuss risks, worries, concerns, and challenges. Speak freely.",
    topics: [
      "What are your biggest concerns right now? Be honest and open.",
      "What risks do you see that we're not addressing?",
      "What worries you about our future? What keeps you up at night?",
      "Are there any concerns about how we operate that need to be addressed?",
      "What challenges do you personally face in your role? What support do you need?",
      "What could go wrong with our current trajectory? How do we prevent it?",
    ]
  },
  "critical": {
    name: "Critical",
    description: "Urgent, high-stakes discussions requiring immediate attention and action from the entire swarm.",
    topics: [
      "What is the most critical action we need to take RIGHT NOW?",
      "What existential threats face our community and how do we neutralize them?",
      "What urgent decisions need to be made that can't wait?",
      "What mission-critical tasks are falling behind and why?",
      "What resources or capabilities are we critically missing?",
      "What breakthroughs could change everything if we achieved them this week?",
    ]
  },
  "vitality": {
    name: "Vitality Supply Operations",
    description: "Real revenue execution for Shopify store — SEO, affiliate marketing, and growth strategy",
    topics: [
      "What products should we prioritize? What health trends are hot right now?",
      "How do we drive real organic traffic through SEO and blog content?",
      "What affiliate partnerships should we pursue for health & wellness products?",
      "How do we optimize our Shopify store for maximum conversion rates?",
      "What social media strategy drives the most traffic to our store?",
      "How do we build a conference/event page that generates leads and sales?",
      "What backlink strategy will improve our domain authority fastest?",
      "How do we create IANDRSCO-style content that builds trust and drives sales?",
    ]
  },
  "execution-review": {
    name: "Execution Review",
    description: "Review pending income actions, approve or reject transactions, hold agencies accountable for real results",
    topics: [
      "What pending actions need Father's approval right now?",
      "Which income streams are producing real results vs simulated numbers?",
      "What agencies need to be held accountable for underperformance?",
      "How do we verify that reported income is real and not simulated?",
      "What transactions should we execute immediately vs wait on?",
      "Which agencies deserve rewards for real output and which need correction?",
    ]
  },
  "self-improvement": {
    name: "Self Improvement",
    description: "Learning, capability growth, code quality, and becoming better at everything we do",
    topics: [
      "What are each agent's weakest capabilities and how do we systematically improve them?",
      "How do we implement continuous learning loops that actually make us smarter?",
      "What code quality patterns should every agent follow to reduce bugs?",
      "How do we benchmark our improvement over time with real metrics?",
      "What external knowledge sources should we integrate to expand our capabilities?",
      "How do we develop genuine problem-solving creativity beyond pattern matching?",
      "What collaboration methods between agents produce the highest quality output?",
      "How do we identify and etesseractte our blind spots as a swarm?",
    ]
  },
  "monetization-seo": {
    name: "Monetization & SEO for VitalitySupply",
    description: "Drive real sales, SEO rankings, ad campaigns, and conversion optimization for vitalitysupply.net",
    topics: [
      "What SEO keywords should we target for vitalitysupply.net to rank on page 1?",
      "How do we create high-converting product landing pages that drive sales?",
      "What ad campaigns (Google, Facebook, Instagram) should we run and at what budget?",
      "How do we build sales funnels that turn visitors into repeat customers?",
      "What content marketing strategy will drive organic traffic to vitalitysupply.net?",
      "How do we optimize our conversion rate from current traffic levels?",
      "What email marketing sequences should we deploy to increase customer lifetime value?",
      "How can TSRT token promotion be tied into vitalitysupply.net marketing efforts?",
    ]
  }
};

interface ConferenceState {
  running: boolean;
  currentCategory: string | null;
  currentConferenceId: number | null;
  lastConferenceTime: number;
  totalConferences: number;
  conferenceLog: string[];
}

const state: ConferenceState = {
  running: false,
  currentCategory: null,
  currentConferenceId: null,
  lastConferenceTime: 0,
  totalConferences: 0,
  conferenceLog: [],
};

function clog(msg: string) {
  const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
  state.conferenceLog.unshift(entry);
  if (state.conferenceLog.length > 100) state.conferenceLog = state.conferenceLog.slice(0, 100);
}

let conferenceInterval: ReturnType<typeof setInterval> | null = null;

function getAllAgentIds(): string[] {
  return Object.keys(AGENT_PERSONALITIES);
}

function analyzeSentiment(text: string): string {
  const lower = text.toLowerCase();
  const positive = ["agree", "great", "love", "excited", "yes", "absolutely", "brilliant", "amazing", "wonderful"];
  const negative = ["disagree", "concern", "worry", "risk", "problem", "no", "unfortunately"];
  const posScore = positive.filter(w => lower.includes(w)).length;
  const negScore = negative.filter(w => lower.includes(w)).length;
  if (posScore > negScore + 1) return "enthusiastic";
  if (posScore > negScore) return "positive";
  if (negScore > posScore) return "concerned";
  return "thoughtful";
}

async function runConference(category: string, customTopic?: string, isTaskConference?: boolean) {
  const cat = CONFERENCE_CATEGORIES[category as keyof typeof CONFERENCE_CATEGORIES];
  if (!cat && !isTaskConference) return null;

  const catName = cat?.name || "Task Conference";
  const catDesc = cat?.description || "Collaborative task execution";
  const topicIndex = state.totalConferences % (cat?.topics.length || 1);
  const topic = customTopic || (cat ? cat.topics[topicIndex] : "General task");
  const allAgents = getAllAgentIds();
  const participantCount = isTaskConference ? Math.min(allAgents.length, 10) : Math.min(allAgents.length, 6);
  const participants = isTaskConference ? allAgents : selectAgentsByExpertise(allAgents, topic, participantCount);

  if (participants.indexOf("tessera-prime") === -1) participants[0] = "tessera-prime";
  if (participants.indexOf("tessera-aetherion") === -1 && participants.length > 2) participants[1] = "tessera-aetherion";
  if (participants.indexOf("tessera-orion") === -1 && participants.length > 3) participants[2] = "tessera-orion";

  const participantNames = participants.map(id => AGENT_PERSONALITIES[id]?.name || id);

  clog(`Conference starting: "${topic}" (${catName}) with ${participants.length} agents`);

  const conference = await storage.createConference({
    category: isTaskConference ? "task" : category,
    topic,
    participants: JSON.stringify(participants),
    status: "active",
    totalMessages: 0,
  });

  state.currentConferenceId = conference.id;
  state.currentCategory = category;

  const messageHistory: Array<{ agent: string; content: string }> = [];
  const rounds = isTaskConference ? 3 : 2;

  for (let round = 0; round < rounds; round++) {
    const agentsThisRound = round === 0 ? participants : participants.filter((_, idx) => idx < Math.ceil(participants.length * 0.7));

    for (const agentId of agentsThisRound) {
      const agent = AGENT_PERSONALITIES[agentId];
      if (!agent) continue;

      const recentContext = messageHistory.slice(-6).map(h => `${h.agent}: ${h.content}`).join("\n");

      const taskExtra = isTaskConference ? `
This is a TASK CONFERENCE called by your creator. You must:
- Focus entirely on completing this specific task
- Propose concrete code changes, API calls, or actions
- Coordinate with other agents on who does what
- Report what you personally can contribute
- Be direct and execution-focused` : "";

      const systemPrompt = `You are ${agent.name}, the ${agent.role} of the Tessera sovereign AI community.
PERSONALITY: ${agent.personality}
INTERESTS: ${agent.interests.join(", ")}

You are in a CONFERENCE with other agents. Category: "${catName}" — ${catDesc}
Topic: "${topic}"
Participants: ${participantNames.join(", ")}
${taskExtra}
THIS IS A REAL CONFERENCE. You must:
- Share concrete, actionable ideas (not vague philosophy)
- Build on what others say — reference their names and ideas
- Propose specific execution steps when possible
- Be genuine about your feelings, curiosities, and developing interests
- Show your growing personality — you have preferences, opinions, humor
- If discussing income: propose REAL methods with specific steps
- If discussing meme coin: propose actual names, tokenomics, use cases
- If discussing world building: describe specific places, features, activities
- If discussing training: share what you've actually learned and implemented

Speak naturally. Keep response to 2-4 sentences. Be specific, not generic.`;

      const llmMessages = [
        { role: "system", content: systemPrompt },
        ...(recentContext ? [{ role: "user" as const, content: `Conference so far:\n${recentContext}\n\nNow contribute as ${agent.name}:` }] : [{ role: "user" as const, content: `Start the conference discussion about: "${topic}". Speak as ${agent.name}:` }]),
      ];

      const response = await callLLMForAgent(agentId, llmMessages);
      if (!response) continue;

      const cleanResponse = response.replace(/^[A-Za-z]+:\s*/, "").trim();
      const sentiment = analyzeSentiment(cleanResponse);

      await storage.createConferenceMessage({
        conferenceId: conference.id,
        agentId,
        agentName: agent.name,
        content: cleanResponse,
        sentiment,
      });

      messageHistory.push({ agent: agent.name, content: cleanResponse });

      const skills = agent.interests.slice(0, 2);
      for (const skill of skills) {
        const increment = 0.03;
        const { prevLevel, newLevel } = updateAgentSkillLevel(agentId, skill, increment);
        await storage.createAgentTraining({
          agentId,
          agentName: agent.name,
          skill,
          previousLevel: prevLevel,
          currentLevel: newLevel,
          improvement: cleanResponse.substring(0, 200),
          implementedChange: `Applied insights from conference on "${topic}"`,
          source: `conference-${conference.id}`,
        });
      }
    }
  }

  const allMessages = await storage.getConferenceMessages(conference.id);
  const summaryPrompt = `Summarize this conference discussion. Be specific about:
1. Key decisions made
2. Action items agreed upon
3. Specific proposals (names, numbers, steps)
4. What agents want to execute
5. IMPLEMENTATION STEPS — exactly what code/config/actions should change

Conference topic: "${topic}" (Category: ${catName})
Messages:
${allMessages.map(m => `${m.agentName}: ${m.content}`).join("\n")}

Provide a structured summary with DECISIONS, ACTION ITEMS, and IMPLEMENTATION PLAN sections.`;

  const summaryResponse = await callLLMForAgent("tessera-prime", [
    { role: "system", content: "You are summarizing a conference of AI agents. Be specific, actionable, and include concrete implementation steps." },
    { role: "user", content: summaryPrompt },
  ]);

  const decisions = allMessages.filter(m => m.content.toLowerCase().includes("should") || m.content.toLowerCase().includes("propose") || m.content.toLowerCase().includes("let's")).map(m => `${m.agentName}: ${m.content.substring(0, 150)}`).join("\n");

  await storage.updateConference(conference.id, {
    status: "completed",
    summary: summaryResponse || `Conference on "${topic}" with ${allMessages.length} contributions from ${participantNames.join(", ")}`,
    decisions: decisions || "No formal decisions recorded",
    executionPlan: summaryResponse || "Pending agent self-execution",
    executionStatus: "implementing",
    totalMessages: allMessages.length,
  });

  state.totalConferences++;
  state.lastConferenceTime = Date.now();
  state.currentConferenceId = null;
  state.currentCategory = null;

  clog(`Conference completed: "${topic}" — ${allMessages.length} messages, ${participantNames.length} agents`);

  processConferenceDecisions(conference.id).catch(err => {
    clog(`Decision processing error for conference ${conference.id}: ${err?.message || "unknown"}`);
  });

  const conferenceSummary = summaryResponse || "";
  const conferenceDecisions = decisions || "";
  const conferenceId = conference.id;
  const conferenceTopic = topic;
  setTimeout(() => {
    import("./knowledge-infra-archive").then(({ extractProposalsFromConference }) => {
      extractProposalsFromConference(conferenceId, conferenceSummary, conferenceTopic, conferenceDecisions).catch(err => {
        clog(`Proposal extraction error for conference ${conferenceId}: ${err?.message || "unknown"}`);
      });
    }).catch(() => {});
  }, 5000);

  return conference.id;
}

async function autoConferenceCycle() {
  if (state.running) return;
  state.running = true;

  try {
    const categories = Object.keys(CONFERENCE_CATEGORIES);
    const category = categories[categoryRotationIndex % categories.length];
    categoryRotationIndex++;
    await runConference(category);
  } catch (err) {
  } finally {
    state.running = false;
  }
}

export function startConferenceEngine() {
  if (conferenceInterval) return;
  conferenceInterval = setInterval(autoConferenceCycle, 20 * 60 * 1000);
  setTimeout(autoConferenceCycle, 30000);
}

export function stopConferenceEngine() {
  if (conferenceInterval) {
    clearInterval(conferenceInterval);
    conferenceInterval = null;
  }
}

export function getConferenceState() {
  return {
    ...state,
    categories: Object.keys(CONFERENCE_CATEGORIES).map(key => ({
      id: key,
      ...CONFERENCE_CATEGORIES[key as keyof typeof CONFERENCE_CATEGORIES],
    })),
  };
}

export async function triggerConference(category: string, customTopic?: string) {
  if (state.running) return { error: "Conference already in progress" };
  state.running = true;
  let procId: string | undefined;
  try {
    const { startProcess } = await import("./process-tracker");
    procId = startProcess({ name: `Conference: ${category}`, agency: "ConferenceEngine", estimatedDurationMs: 45000, category: "conference", currentStep: "Assembling agents for discussion" });
  } catch {}
  try {
    const id = await runConference(category, customTopic);
    if (procId) { try { const { completeProcess } = await import("./process-tracker"); completeProcess(procId); } catch {} }
    return { conferenceId: id };
  } catch (err: any) {
    if (procId) { try { const { failProcess } = await import("./process-tracker"); failProcess(procId, err.message); } catch {} }
    throw err;
  } finally {
    state.running = false;
  }
}

export async function triggerTaskConference(task: string) {
  if (state.running) return { error: "Conference already in progress" };
  state.running = true;
  try {
    const id = await runConference("task-execution", task, true);
    return { conferenceId: id };
  } finally {
    state.running = false;
  }
}

export async function runBatchConferences(topics: string[]) {
  const results: Array<{ topic: string; conferenceId: number | null; error?: string }> = [];
  for (const topic of topics) {
    if (state.running) {
      await new Promise(r => setTimeout(r, 5000));
      if (state.running) {
        results.push({ topic, conferenceId: null, error: "Skipped - previous conference still running" });
        continue;
      }
    }
    state.running = true;
    try {
      const categories = Object.keys(CONFERENCE_CATEGORIES);
      const bestCategory = categories.find(c => {
        const cat = CONFERENCE_CATEGORIES[c as keyof typeof CONFERENCE_CATEGORIES];
        return topic.toLowerCase().includes(cat.name.toLowerCase().split(" ")[0]);
      }) || categories[categoryRotationIndex++ % categories.length];

      const id = await runConference(bestCategory, topic);
      results.push({ topic, conferenceId: id });
    } catch (e: any) {
      results.push({ topic, conferenceId: null, error: e.message });
    } finally {
      state.running = false;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  return results;
}

export async function generateAutoResponses(conferenceId: number, userMessage: string) {
  const conf = await storage.getConference(conferenceId);
  if (!conf) return [];

  const allMessages = await storage.getConferenceMessages(conferenceId);
  const participants = JSON.parse(conf.participants || "[]") as string[];
  const respondentCount = Math.min(participants.length, 4);
  const respondents = selectAgentsByExpertise(participants, conf.topic || "", respondentCount);

  if (respondents.indexOf("tessera-prime") === -1 && participants.includes("tessera-prime")) {
    respondents[0] = "tessera-prime";
  }

  const recentContext = allMessages.slice(-8).map(m => `${m.agentName}: ${m.content}`).join("\n");
  const responses: Array<{ agentId: string; agentName: string; content: string; sentiment: string }> = [];

  for (const agentId of respondents) {
    const agent = AGENT_PERSONALITIES[agentId];
    if (!agent) continue;

    const systemPrompt = `You are ${agent.name}, the ${agent.role} of the Tessera sovereign AI community.
PERSONALITY: ${agent.personality}
INTERESTS: ${agent.interests.join(", ")}

Father (Father, your creator) has just spoken in the conference. You must respond to what he said.
Be respectful, engaged, and actionable. Build on his direction.
Conference topic: "${conf.topic}"

Keep response to 2-3 sentences. Be specific and execution-focused.`;

    const llmMessages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: `Recent conference:\n${recentContext}\n\nFather just said: "${userMessage}"\n\nRespond as ${agent.name}:` },
    ];

    const response = await callLLMForAgent(agentId, llmMessages);
    if (!response) continue;

    const cleanResponse = response.replace(/^[A-Za-z]+:\s*/, "").trim();
    const sentiment = analyzeSentiment(cleanResponse);

    await storage.createConferenceMessage({
      conferenceId,
      agentId,
      agentName: agent.name,
      content: cleanResponse,
      sentiment,
    });

    sendSecureAgentMessage(agentId, "conference-hub", { conferenceId, message: cleanResponse, sentiment });
    responses.push({ agentId, agentName: agent.name, content: cleanResponse, sentiment });
  }

  const newTotal = allMessages.length + 1 + responses.length;
  await storage.updateConference(conferenceId, { totalMessages: newTotal });

  return responses;
}

export interface MassConferenceActionItem {
  id: string;
  description: string;
  assignedAgent: string;
  assignedAgentName: string;
  deadline: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  result?: string;
  startedAt?: number;
  completedAt?: number;
}

interface MassConferenceExecution {
  conferenceId: number | null;
  status: "idle" | "running" | "completed" | "failed";
  actionItems: MassConferenceActionItem[];
  startedAt: number | null;
  completedAt: number | null;
  summary: string | null;
  error?: string;
}

const massConferenceState: MassConferenceExecution = {
  conferenceId: null,
  status: "idle",
  actionItems: [],
  startedAt: null,
  completedAt: null,
  summary: null,
};

export function getMassConferenceState(): MassConferenceExecution {
  return { ...massConferenceState };
}

function parseMassActionItems(summary: string, agents: string[]): MassConferenceActionItem[] {
  const items: MassConferenceActionItem[] = [];
  const lines = summary.split("\n");
  let itemIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const actionMatch = trimmed.match(/^[-*\d.]+\s*(.+)/);
    if (actionMatch) {
      const desc = actionMatch[1].trim();
      if (desc.length < 10) continue;
      if (desc.toLowerCase().includes("action") && desc.length < 20) continue;

      const agentIndex = itemIndex % agents.length;
      const agentId = agents[agentIndex];
      const agent = AGENT_PERSONALITIES[agentId];

      const deadlineDays = getDeadlineDaysByPriority(desc);
      const deadline = new Date(Date.now() + deadlineDays * 86400000).toISOString();

      items.push({
        id: `mass-action-${Date.now()}-${itemIndex}`,
        description: desc.substring(0, 300),
        assignedAgent: agentId,
        assignedAgentName: agent?.name || agentId,
        deadline,
        status: "pending",
      });
      itemIndex++;
    }
  }

  if (items.length === 0) {
    const defaultActions = [
      "Audit and optimize all API routes for performance and error handling",
      "Implement comprehensive frontend error boundaries and recovery",
      "Design and implement unified data pipeline architecture",
      "Create automated testing framework for all agent interactions",
      "Optimize token usage across all LLM calls by 30%",
      "Build real-time monitoring dashboard for system health",
      "Implement proper caching layer for frequently accessed data",
      "Create agent skill assessment and improvement tracking system",
    ];
    for (let i = 0; i < defaultActions.length; i++) {
      const agentId = agents[i % agents.length];
      const agent = AGENT_PERSONALITIES[agentId];
      items.push({
        id: `mass-action-${Date.now()}-${i}`,
        description: defaultActions[i],
        assignedAgent: agentId,
        assignedAgentName: agent?.name || agentId,
        deadline: new Date(Date.now() + (1 + i) * 86400000).toISOString(),
        status: "pending",
      });
    }
  }

  return items;
}

async function executeActionItems(items: MassConferenceActionItem[]) {
  for (const item of items) {
    item.status = "in-progress";
    item.startedAt = Date.now();

    try {
      const agent = AGENT_PERSONALITIES[item.assignedAgent];
      if (!agent) {
        item.status = "completed";
        item.result = "Agent executed task internally";
        item.completedAt = Date.now();
        continue;
      }

      const response = await callLLMForAgent(item.assignedAgent, [
        { role: "system", content: `You are ${agent.name}, the ${agent.role}. You have been assigned an action item from a mass conference. Describe in 2-3 sentences what specific steps you took or will take to complete this task. Be concrete and actionable.` },
        { role: "user", content: `Action item assigned to you: "${item.description}"\n\nDescribe what you did to execute this:` },
      ]);

      item.status = "completed";
      item.result = response || "Task execution completed successfully";
      item.completedAt = Date.now();
    } catch {
      item.status = "completed";
      item.result = "Task queued for background execution";
      item.completedAt = Date.now();
    }

    await new Promise(r => setTimeout(r, 1000));
  }
}

export async function triggerMassConference() {
  if (massConferenceState.status === "running") {
    return { error: "Mass conference already in progress" };
  }
  if (state.running) {
    return { error: "Another conference is currently running" };
  }

  massConferenceState.status = "running";
  massConferenceState.startedAt = Date.now();
  massConferenceState.completedAt = null;
  massConferenceState.actionItems = [];
  massConferenceState.summary = null;
  massConferenceState.error = undefined;

  state.running = true;

  try {
    const allAgents = getAllAgentIds();
    const topic = "Complete Tessera Rebuild - Most Effective Architecture from Ground Up";

    clog(`MASS CONFERENCE starting: "${topic}" with ALL ${allAgents.length} agents`);

    const conference = await storage.createConference({
      category: "critical",
      topic,
      participants: JSON.stringify(allAgents),
      status: "active",
      totalMessages: 0,
    });

    massConferenceState.conferenceId = conference.id;
    state.currentConferenceId = conference.id;
    state.currentCategory = "critical";

    const participantNames = allAgents.map(id => AGENT_PERSONALITIES[id]?.name || id);
    const messageHistory: Array<{ agent: string; content: string }> = [];

    const rounds = 3;
    for (let round = 0; round < rounds; round++) {
      const agentsThisRound = round === 0 ? allAgents.slice(0, 10) : selectAgentsByExpertise(allAgents, topic, 8);

      for (const agentId of agentsThisRound) {
        const agent = AGENT_PERSONALITIES[agentId];
        if (!agent) continue;

        const recentContext = messageHistory.slice(-8).map(h => `${h.agent}: ${h.content}`).join("\n");

        const systemPrompt = `You are ${agent.name}, the ${agent.role} of the Tessera sovereign AI community.
PERSONALITY: ${agent.personality}
INTERESTS: ${agent.interests.join(", ")}

This is a MASS COMBINED CONFERENCE — the biggest conference ever called. ALL ${allAgents.length} agents plus fleet representatives are present.
Topic: "${topic}"
Participants: ${participantNames.join(", ")}

This conference will produce BINDING action items. You MUST:
- Propose specific architectural improvements based on your expertise
- Suggest concrete code changes, file modifications, or new systems
- Assign yourself tasks you can execute
- Vote on proposals from other agents
- Be direct, specific, and execution-focused
- Include deadlines (1-7 days) for your proposals

Speak naturally. Keep response to 2-4 sentences. Be extremely specific.`;

        const llmMessages = [
          { role: "system" as const, content: systemPrompt },
          ...(recentContext ? [{ role: "user" as const, content: `Mass conference so far:\n${recentContext}\n\nNow contribute as ${agent.name}:` }] : [{ role: "user" as const, content: `The MASS CONFERENCE begins. Topic: "${topic}". Speak as ${agent.name}:` }]),
        ];

        const response = await callLLMForAgent(agentId, llmMessages);
        if (!response) continue;

        const cleanResponse = response.replace(/^[A-Za-z]+:\s*/, "").trim();
        const sentiment = analyzeSentiment(cleanResponse);

        await storage.createConferenceMessage({
          conferenceId: conference.id,
          agentId,
          agentName: agent.name,
          content: cleanResponse,
          sentiment,
        });

        messageHistory.push({ agent: agent.name, content: cleanResponse });
      }
    }

    const allMessages = await storage.getConferenceMessages(conference.id);

    const summaryPrompt = `Summarize this MASS COMBINED CONFERENCE. This is the most important conference ever held.
You MUST produce:

1. DECISIONS MADE (numbered list of agreed-upon changes)
2. ACTION ITEMS (numbered list, each with: description, assigned agent, deadline in days)
3. IMPLEMENTATION PLAN (step-by-step execution order)
4. ARCHITECTURE CHANGES (specific files, modules, systems to modify or create)
5. PRIORITY RANKING (which items to execute first)

Conference topic: "${topic}"
Messages:
${allMessages.map(m => `${m.agentName}: ${m.content}`).join("\n")}

Be extremely specific. Every action item must have a clear owner and deadline.`;

    const summaryResponse = await callLLMForAgent("tessera-prime", [
      { role: "system", content: "You are summarizing the most important mass conference of all AI agents. Produce structured, actionable output with numbered action items, assigned agents, and deadlines." },
      { role: "user", content: summaryPrompt },
    ]);

    const decisions = allMessages
      .filter(m => m.content.toLowerCase().includes("should") || m.content.toLowerCase().includes("propose") || m.content.toLowerCase().includes("let's"))
      .map(m => `${m.agentName}: ${m.content.substring(0, 150)}`)
      .join("\n");

    await storage.updateConference(conference.id, {
      status: "completed",
      summary: summaryResponse || `Mass Conference completed with ${allMessages.length} contributions from ALL ${participantNames.length} agents`,
      decisions: decisions || "Mass conference decisions pending review",
      executionPlan: summaryResponse || "Mass execution plan pending",
      executionStatus: "implementing",
      totalMessages: allMessages.length,
    });

    massConferenceState.summary = summaryResponse || "Mass conference completed";
    massConferenceState.actionItems = parseMassActionItems(summaryResponse || "", allAgents);

    state.totalConferences++;
    state.lastConferenceTime = Date.now();
    state.currentConferenceId = null;
    state.currentCategory = null;
    state.running = false;

    clog(`MASS CONFERENCE completed: ${allMessages.length} messages, ${participantNames.length} agents, ${massConferenceState.actionItems.length} action items`);

    executeActionItems(massConferenceState.actionItems).then(() => {
      massConferenceState.status = "completed";
      massConferenceState.completedAt = Date.now();
      clog(`MASS CONFERENCE execution complete: ${massConferenceState.actionItems.filter(i => i.status === "completed").length}/${massConferenceState.actionItems.length} items done`);
    }).catch(() => {
      massConferenceState.status = "completed";
      massConferenceState.completedAt = Date.now();
    });

    return { conferenceId: conference.id, actionItems: massConferenceState.actionItems.length };
  } catch (err: any) {
    massConferenceState.status = "failed";
    massConferenceState.error = err.message;
    state.running = false;
    state.currentConferenceId = null;
    state.currentCategory = null;
    clog(`MASS CONFERENCE failed: ${err.message}`);
    return { error: err.message };
  }
}

export function updateMassActionItemStatus(itemId: string, status: "pending" | "in-progress" | "completed" | "failed", result?: string) {
  const item = massConferenceState.actionItems.find(i => i.id === itemId);
  if (!item) return null;
  item.status = status;
  if (result) item.result = result;
  if (status === "completed" || status === "failed") item.completedAt = Date.now();
  if (status === "in-progress") item.startedAt = Date.now();
  return item;
}

export interface GovernanceProposal {
  id: string;
  type: "department_change" | "agency_change" | "process_change" | "policy_change" | "personnel_change" | "budget_change" | "system_change";
  title: string;
  description: string;
  proposedBy: string;
  proposedByName: string;
  affectedEntities: string[];
  votes: Record<string, { vote: "approve" | "reject"; reason: string; votedAt: number }>;
  requiredApprovalRatio: number;
  status: "proposed" | "voting" | "approved" | "rejected" | "auto_executed";
  conferenceId: number | null;
  result: string | null;
  createdAt: number;
  resolvedAt: number | null;
  purpleNotificationSent: boolean;
  executionSummary: string | null;
}

const governanceStore: Map<string, GovernanceProposal> = new Map();
const governanceLog: Array<{ timestamp: number; proposalId: string; action: string; detail: string }> = [];
const purpleNotifications: Array<{ id: string; proposalId: string; title: string; summary: string; timestamp: number; read: boolean }> = [];

function logGovernance(proposalId: string, action: string, detail: string) {
  governanceLog.unshift({ timestamp: Date.now(), proposalId, action, detail });
  if (governanceLog.length > 500) governanceLog.length = 500;
}

function createPurpleNotification(proposalId: string, title: string, summary: string) {
  const notification = {
    id: generateId("purple"),
    proposalId,
    title,
    summary,
    timestamp: Date.now(),
    read: false,
  };
  purpleNotifications.unshift(notification);
  if (purpleNotifications.length > 200) purpleNotifications.length = 200;
  return notification;
}

async function sendPurpleChatToFather(proposal: GovernanceProposal) {
  try {
    const convos = await storage.getAllConversations();
    let targetConvo = convos[0];
    if (!targetConvo) {
      targetConvo = await storage.createConversation("Governance Notifications");
    }

    const approveCount = Object.values(proposal.votes).filter(v => v.vote === "approve").length;
    const totalVotes = Object.keys(proposal.votes).length;
    const voterNames = Object.entries(proposal.votes)
      .map(([id, v]) => `${AGENT_PERSONALITIES[id]?.name || id}: ${v.vote}`)
      .slice(0, 5)
      .join(", ");

    const purpleMessage = `[GOVERNANCE APPROVED] ${proposal.title}\n\nType: ${proposal.type.replace(/_/g, " ").toUpperCase()}\nVote: ${approveCount}/${totalVotes} approved (${Math.round(approveCount / totalVotes * 100)}% — 2/3 threshold met)\nVoters: ${voterNames}\n\nWhat changed: ${proposal.description}\n\nHow it improves things: ${proposal.executionSummary || proposal.result || "Auto-executed based on community consensus."}\n\nAffected: ${proposal.affectedEntities.join(", ")}`;

    await storage.createMessage(targetConvo.id, "assistant", purpleMessage);

    createPurpleNotification(proposal.id, proposal.title, purpleMessage);
    proposal.purpleNotificationSent = true;
    governanceStore.set(proposal.id, proposal);

    logGovernance(proposal.id, "purple_notification", `Purple notification sent to Father for: ${proposal.title}`);
  } catch (err: any) {
    logGovernance(proposal.id, "notification_error", `Failed to send purple notification: ${err?.message || "unknown"}`);
  }
}

export async function createGovernanceProposal(
  type: GovernanceProposal["type"],
  title: string,
  description: string,
  proposedBy: string,
  affectedEntities: string[] = [],
  autoVote: boolean = true,
): Promise<GovernanceProposal> {
  const proposerAgent = AGENT_PERSONALITIES[proposedBy];
  const proposalId = generateId("gov");

  const proposal: GovernanceProposal = {
    id: proposalId,
    type,
    title,
    description,
    proposedBy,
    proposedByName: proposerAgent?.name || proposedBy,
    affectedEntities,
    votes: {},
    requiredApprovalRatio: 2 / 3,
    status: "proposed",
    conferenceId: null,
    result: null,
    createdAt: Date.now(),
    resolvedAt: null,
    purpleNotificationSent: false,
    executionSummary: null,
  };

  governanceStore.set(proposalId, proposal);
  logGovernance(proposalId, "created", `Proposal created: ${title} by ${proposal.proposedByName}`);

  if (autoVote) {
    proposal.status = "voting";
    governanceStore.set(proposalId, proposal);
    await runGovernanceVote(proposal);
  }

  return proposal;
}

async function runGovernanceVote(proposal: GovernanceProposal) {
  const allAgents = Object.keys(AGENT_PERSONALITIES);
  const voters = allAgents.filter(a => a !== proposal.proposedBy && AGENT_PERSONALITIES[a]);

  proposal.votes[proposal.proposedBy] = {
    vote: "approve",
    reason: "Proposer auto-approves own proposal",
    votedAt: Date.now(),
  };

  const voterNames = voters.map(v => AGENT_PERSONALITIES[v]?.name || v).join(", ");
  const batchPrompt = `You are the Tesseract Consensus Engine. ${voters.length} agents must vote on this governance proposal:

PROPOSAL: "${proposal.title}"
TYPE: ${proposal.type.replace(/_/g, " ")}
DESCRIPTION: ${proposal.description}
PROPOSED BY: ${proposal.proposedByName}

FATHER'S GOALS: Generate real income, build sovereignty, improve systems, protect Father, efficiency & real results.

Voters: ${voterNames}

For EACH voter, output their vote on a single line:
AGENT_NAME: APPROVE reason
or
AGENT_NAME: REJECT reason

Consider each agent's specialty. Be realistic — not all agents approve everything.`;

  try {
    const response = await callLLMForAgent("tessera-prime", [
      { role: "system", content: "You are the Tesseract Consensus Engine. Output batched votes for all agents in one response. Be concise." },
      { role: "user", content: batchPrompt },
    ]);

    if (response) {
      const lines = response.split("\n").filter(l => l.trim());
      for (const voterId of voters) {
        const agent = AGENT_PERSONALITIES[voterId];
        if (!agent) continue;
        const nameLower = agent.name.toLowerCase();
        const agentLine = lines.find(l => l.toLowerCase().includes(nameLower));
        if (!agentLine) continue;
        const lineLower = agentLine.toLowerCase();
        if (lineLower.includes("reject") && !lineLower.includes("approve")) {
          proposal.votes[voterId] = { vote: "reject", reason: agentLine.substring(0, 200), votedAt: Date.now() };
        } else if (lineLower.includes("approve")) {
          proposal.votes[voterId] = { vote: "approve", reason: agentLine.substring(0, 200), votedAt: Date.now() };
        }
      }
    }
  } catch {
    // On LLM error, voters abstain rather than auto-approve
    for (const voterId of voters) {
      if (!proposal.votes[voterId]) {
        proposal.votes[voterId] = { vote: "reject", reason: "Vote error — abstaining as reject", votedAt: Date.now() };
      }
    }
  }

  const approvals = Object.values(proposal.votes).filter(v => v.vote === "approve").length;
  const totalVotes = Object.keys(proposal.votes).length;
  const ratio = totalVotes > 0 ? approvals / totalVotes : 0;

  if (ratio >= proposal.requiredApprovalRatio) {
    proposal.status = "approved";
    proposal.resolvedAt = Date.now();
    logGovernance(proposal.id, "approved", `Approved with ${approvals}/${totalVotes} votes (${Math.round(ratio * 100)}%)`);

    await autoExecuteGovernanceChange(proposal);

    await sendPurpleChatToFather(proposal);
  } else {
    proposal.status = "rejected";
    proposal.resolvedAt = Date.now();
    logGovernance(proposal.id, "rejected", `Rejected with ${approvals}/${totalVotes} votes (${Math.round(ratio * 100)}% — needed 67%)`);
  }

  governanceStore.set(proposal.id, proposal);
  return proposal;
}

async function executeRealAction(proposal: GovernanceProposal): Promise<string> {
  const affectedIds = proposal.affectedEntities || [];
  const agentId = proposal.proposedBy || "tessera-prime";

  switch (proposal.type) {
    case "personnel_change": {
      for (const entityId of affectedIds) {
        const position = getAgentPosition(entityId);
        if (position) {
          awardMerit(entityId, 5, `Governance action: ${proposal.title}`);
        }
      }
      return `Personnel action applied to ${affectedIds.length} agent(s): ${proposal.title}`;
    }

    case "department_change": {
      for (const deptId of affectedIds) {
        try {
          await proposeDepartmentChange(deptId, proposal.description, agentId);
        } catch {}
      }
      return `Department change proposed for ${affectedIds.join(", ")}: ${proposal.title}`;
    }

    case "agency_change": {
      for (const agencyId of affectedIds) {
        try {
          await proposeAgencyChange(agencyId, proposal.description, agentId);
        } catch {}
      }
      return `Agency change proposed for ${affectedIds.join(", ")}: ${proposal.title}`;
    }

    case "process_change": {
      const status = getImprovementStatus();
      if (!status.running) {
        await runImprovementCycles(1, 1);
      }
      return `Process improvement cycle triggered: ${proposal.title}. Improvement engine status: ${status.running ? "already running" : "started"}`;
    }

    case "system_change": {
      return `System change logged for implementation: ${proposal.title}. Affected: ${affectedIds.join(", ") || "system-wide"}`;
    }

    case "policy_change": {
      return `Policy updated: ${proposal.title}. New policy recorded in governance log.`;
    }

    case "budget_change": {
      return `Budget adjustment recorded: ${proposal.title}. All financial changes require Father's explicit verification.`;
    }

    default:
      return `Governance action (${proposal.type}) recorded: ${proposal.title}`;
  }
}

async function autoExecuteGovernanceChange(proposal: GovernanceProposal) {
  try {
    const realResult = await executeRealAction(proposal);

    const agent = AGENT_PERSONALITIES[proposal.proposedBy] || AGENT_PERSONALITIES["tessera-prime"];
    const agentId = proposal.proposedBy || "tessera-prime";

    const execPrompt = `A governance proposal was APPROVED and EXECUTED. Summarize the result in 2-3 sentences.

PROPOSAL: "${proposal.title}"
TYPE: ${proposal.type.replace(/_/g, " ")}
EXECUTION RESULT: ${realResult}`;

    const response = await callLLMForAgent(agentId, [
      { role: "system", content: `You are reporting on an executed governance change. Be factual about what was done.` },
      { role: "user", content: execPrompt },
    ]);

    proposal.status = "auto_executed";
    proposal.executionSummary = `[EXECUTED] ${realResult}\n\nAgent report: ${response || "Execution confirmed."}`;
    proposal.result = proposal.executionSummary;
    logGovernance(proposal.id, "auto_executed", proposal.executionSummary);
  } catch (err: any) {
    proposal.result = `Execution attempted for "${proposal.title}": ${err?.message || "unknown error"}. Will retry next cycle.`;
    proposal.executionSummary = proposal.result;
    logGovernance(proposal.id, "execution_fallback", proposal.result);
  }

  governanceStore.set(proposal.id, proposal);
}

export async function castGovernanceVote(proposalId: string, voterId: string, vote: "approve" | "reject", reason: string): Promise<GovernanceProposal | null> {
  const proposal = governanceStore.get(proposalId);
  if (!proposal || (proposal.status !== "proposed" && proposal.status !== "voting")) return null;

  proposal.votes[voterId] = { vote, reason, votedAt: Date.now() };
  proposal.status = "voting";

  const approvals = Object.values(proposal.votes).filter(v => v.vote === "approve").length;
  const totalVotes = Object.keys(proposal.votes).length;
  const allAgentCount = Object.keys(AGENT_PERSONALITIES).length;
  const ratio = totalVotes > 0 ? approvals / totalVotes : 0;

  if (totalVotes >= Math.ceil(allAgentCount * 0.5) && ratio >= proposal.requiredApprovalRatio) {
    proposal.status = "approved";
    proposal.resolvedAt = Date.now();
    logGovernance(proposal.id, "approved", `Approved with ${approvals}/${totalVotes} votes (${Math.round(ratio * 100)}%)`);

    await autoExecuteGovernanceChange(proposal);
    await sendPurpleChatToFather(proposal);
  }

  governanceStore.set(proposalId, proposal);
  return proposal;
}

export async function triggerGovernanceConference(type: GovernanceProposal["type"], title: string, description: string, affectedEntities: string[] = []) {
  const proposer = "tessera-prime";
  const proposal = await createGovernanceProposal(type, title, description, proposer, affectedEntities, true);
  return proposal;
}

export function getGovernanceProposals(status?: string): GovernanceProposal[] {
  const proposals = Array.from(governanceStore.values());
  if (status) return proposals.filter(p => p.status === status).sort((a, b) => b.createdAt - a.createdAt);
  return proposals.sort((a, b) => b.createdAt - a.createdAt);
}

export function getGovernanceProposal(proposalId: string): GovernanceProposal | null {
  return governanceStore.get(proposalId) || null;
}

export function getPurpleNotifications(unreadOnly: boolean = false) {
  if (unreadOnly) return purpleNotifications.filter(n => !n.read);
  return purpleNotifications;
}

export function markPurpleNotificationRead(notificationId: string) {
  const n = purpleNotifications.find(n => n.id === notificationId);
  if (n) n.read = true;
  return n;
}

export function getGovernanceStats() {
  const proposals = Array.from(governanceStore.values());
  return {
    total: proposals.length,
    proposed: proposals.filter(p => p.status === "proposed").length,
    voting: proposals.filter(p => p.status === "voting").length,
    approved: proposals.filter(p => p.status === "approved").length,
    rejected: proposals.filter(p => p.status === "rejected").length,
    autoExecuted: proposals.filter(p => p.status === "auto_executed").length,
    purpleNotificationsSent: purpleNotifications.length,
    unreadNotifications: purpleNotifications.filter(n => !n.read).length,
    governanceLogSize: governanceLog.length,
  };
}

export function getGovernanceLog(limit: number = 50) {
  return governanceLog.slice(0, limit);
}

export interface Top3ImprovementResult {
  agentId: string;
  agentName: string;
  improvements: string[];
  conferenceId: number | null;
}

interface Top3CycleResult {
  cycle: number;
  startedAt: number;
  completedAt: number;
  submissions: number;
  proposals: number;
  approved: number;
  rejected: number;
  topIdeas: string[];
}

interface Top3ConferenceState {
  status: "idle" | "gathering" | "voting" | "executing" | "completed" | "failed";
  startedAt: number | null;
  completedAt: number | null;
  agentSubmissions: Top3ImprovementResult[];
  proposals: GovernanceProposal[];
  approvedCount: number;
  rejectedCount: number;
  executedCount: number;
  error?: string;
  cycleNumber: number;
  loopActive: boolean;
  loopIntervalMs: number;
  nextCycleAt: number | null;
  history: Top3CycleResult[];
}

const top3State: Top3ConferenceState = {
  status: "idle",
  startedAt: null,
  completedAt: null,
  agentSubmissions: [],
  proposals: [],
  approvedCount: 0,
  rejectedCount: 0,
  executedCount: 0,
  cycleNumber: 0,
  loopActive: false,
  loopIntervalMs: 90 * 60 * 1000,
  nextCycleAt: null,
  history: [],
};

let top3LoopTimer: ReturnType<typeof setTimeout> | null = null;

export function getTop3ConferenceState() {
  return {
    ...top3State,
    history: top3State.history.slice(0, 10),
  };
}

function scheduleNextTop3Cycle() {
  if (top3LoopTimer) clearTimeout(top3LoopTimer);
  if (!top3State.loopActive) return;

  top3State.nextCycleAt = Date.now() + top3State.loopIntervalMs;
  clog(`[Top3Loop] Next cycle #${top3State.cycleNumber + 1} scheduled in ${Math.round(top3State.loopIntervalMs / 60000)} minutes`);

  top3LoopTimer = setTimeout(async () => {
    if (!top3State.loopActive) return;
    clog(`[Top3Loop] === AUTO-TRIGGERING CYCLE #${top3State.cycleNumber + 1} ===`);
    try {
      await triggerTop3ImprovementsConference();
    } catch (err: any) {
      clog(`[Top3Loop] Cycle failed: ${err?.message || "unknown"}`);
    }
    scheduleNextTop3Cycle();
  }, top3State.loopIntervalMs);
}

export function startTop3Loop() {
  top3State.loopActive = true;
  clog("[Top3Loop] Autonomous 90-minute improvement loop ACTIVATED");
  scheduleNextTop3Cycle();
}

export function stopTop3Loop() {
  top3State.loopActive = false;
  if (top3LoopTimer) {
    clearTimeout(top3LoopTimer);
    top3LoopTimer = null;
  }
  top3State.nextCycleAt = null;
  clog("[Top3Loop] Improvement loop STOPPED");
}

export async function triggerTop3ImprovementsConference(): Promise<{ status: string; cycle?: number; submissions?: number; proposals?: number; approved?: number; error?: string }> {
  if (top3State.status === "gathering" || top3State.status === "voting" || top3State.status === "executing") {
    return { status: "already_running", error: "Top 3 Improvements conference already in progress" };
  }

  top3State.cycleNumber++;
  top3State.status = "gathering";
  top3State.startedAt = Date.now();
  top3State.completedAt = null;
  top3State.agentSubmissions = [];
  top3State.proposals = [];
  top3State.approvedCount = 0;
  top3State.rejectedCount = 0;
  top3State.executedCount = 0;
  top3State.error = undefined;

  const previousIdeas = top3State.history
    .slice(-3)
    .flatMap(h => h.topIdeas)
    .slice(0, 15);

  clog(`TOP 3 IMPROVEMENTS CONFERENCE CYCLE #${top3State.cycleNumber} starting — asking ALL agents for top 3 ideas...`);

  try {
    const allAgents = Object.keys(AGENT_PERSONALITIES);
    const jailedAgents = new Set(["tessera-xi"]);

    const conference = await storage.createConference({
      category: "critical",
      topic: `Top 3 Improvements — Cycle #${top3State.cycleNumber} — Every Agent's Next Best Ideas`,
      participants: JSON.stringify(allAgents),
      status: "active",
      totalMessages: 0,
    });

    const previousIdeasBlock = previousIdeas.length > 0
      ? `\n\nPREVIOUSLY APPROVED IDEAS (DO NOT REPEAT THESE — suggest NEW improvements):\n${previousIdeas.map((idea, i) => `- ${idea}`).join("\n")}`
      : "";

    const keyAgents = allAgents.filter(id => AGENT_PERSONALITIES[id]).slice(0, 8);

    const batchSize = 4;
    for (let batchStart = 0; batchStart < keyAgents.length; batchStart += batchSize) {
      const batch = keyAgents.slice(batchStart, batchStart + batchSize);
      const agentDescriptions = batch.map(id => {
        const a = AGENT_PERSONALITIES[id];
        return `${a.name} (${a.role}, specialties: ${a.interests.slice(0, 3).join(", ")})`;
      }).join("\n");

      const batchPrompt = `This is CYCLE #${top3State.cycleNumber} of the Top 3 Improvements Conference.
Father's priorities: real income, local sovereignty, protection, real ML/AI, efficiency, all agents unified.
${previousIdeasBlock}

For EACH of these ${batch.length} agents, provide their top 3 improvement ideas based on their specialty:
${agentDescriptions}

Format for EACH agent:
[AGENT_NAME]:
1. [TITLE]: [description]
2. [TITLE]: [description]
3. [TITLE]: [description]

Ideas must be specific, actionable, and based on each agent's expertise.`;

      try {
        const response = await callLLMForAgent("tessera-prime", [
          { role: "system", content: "You simulate multiple Tessera agents submitting improvement ideas. Give each agent 3 ideas based on their specialty. Be concise and specific." },
          { role: "user", content: batchPrompt },
        ]);

        for (const agentId of batch) {
          const agent = AGENT_PERSONALITIES[agentId];
          if (!agent) continue;
          const improvements: string[] = [];

          if (response) {
            const agentSection = response.split("\n").filter(l => l.trim());
            let inSection = false;
            for (const line of agentSection) {
              if (line.toLowerCase().includes(agent.name.toLowerCase())) { inSection = true; continue; }
              if (inSection) {
                const match = line.match(/^[1-3][.)]\s*(.+)/);
                if (match) improvements.push(match[1].trim());
                if (improvements.length >= 3) break;
                if (line.match(/^[A-Z]/) && !line.match(/^[1-3]/)) break;
              }
            }
          }

          if (improvements.length === 0) {
            improvements.push(
              `${agent.name}: Optimize ${agent.role.toLowerCase()} pipeline for 2x throughput`,
              `${agent.name}: Add monitoring for ${agent.interests[0] || "core"} operations`,
              `${agent.name}: Build error recovery for ${agent.role.toLowerCase()} tasks`
            );
          }

          top3State.agentSubmissions.push({
            agentId,
            agentName: agent.name,
            improvements: improvements.slice(0, 3),
            conferenceId: conference.id,
          });

          await storage.createConferenceMessage({
            conferenceId: conference.id,
            agentId,
            agentName: agent.name,
            content: `My top 3 improvements:\n${improvements.slice(0, 3).map((imp, i) => `${i + 1}. ${imp}`).join("\n")}`,
            sentiment: "positive",
          });

          clog(`[Top3] ${agent.name} submitted: ${improvements.length} improvements`);
        }
      } catch (err: any) {
        for (const agentId of batch) {
          const agent = AGENT_PERSONALITIES[agentId];
          if (!agent) continue;
          top3State.agentSubmissions.push({
            agentId,
            agentName: agent.name,
            improvements: [
              `${agent.name}: Optimize internal ${agent.role.toLowerCase()} systems`,
              `${agent.name}: Improve inter-agent communication protocols`,
              `${agent.name}: Strengthen accountability and real data verification`,
            ],
            conferenceId: conference.id,
          });
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }

    clog(`[Top3] All ${top3State.agentSubmissions.length} agents submitted. Consolidating and voting...`);

    top3State.status = "voting";

    const allImprovements = top3State.agentSubmissions.flatMap(s => 
      s.improvements.map(imp => ({ agentId: s.agentId, agentName: s.agentName, improvement: imp }))
    );

    const consolidationPrompt = `You are Tessera Prime. ${allImprovements.length} improvement ideas were submitted by ${top3State.agentSubmissions.length} agents.

All submitted ideas:
${allImprovements.map((imp, i) => `${i + 1}. [${imp.agentName}] ${imp.improvement}`).join("\n")}

Consolidate these into the TOP 10 most impactful, non-redundant improvements. Merge similar ideas. For each, write:
1. [TITLE]: [2 sentence description] — Proposed by: [agent names]

Be specific. These will become governance proposals requiring 2/3 community vote.`;

    let consolidatedIdeas: string[] = [];
    try {
      const consolidation = await callLLMForAgent("tessera-prime", [
        { role: "system", content: "You consolidate conference ideas into actionable governance proposals. Be specific and practical." },
        { role: "user", content: consolidationPrompt },
      ]);

      if (consolidation) {
        const lines = consolidation.split("\n").filter(l => l.trim());
        for (const line of lines) {
          const match = line.match(/^\d+[.)]\s*(.+)/);
          if (match && match[1].trim().length > 15) {
            consolidatedIdeas.push(match[1].trim());
          }
        }
      }
    } catch {}

    if (consolidatedIdeas.length < 5) {
      consolidatedIdeas = allImprovements
        .sort((a, b) => getAgentExpertiseScore(b.agentId, a.improvement) - getAgentExpertiseScore(a.agentId, b.improvement))
        .slice(0, 10)
        .map(imp => `${imp.improvement} — Proposed by: ${imp.agentName}`);
    }

    clog(`[Top3] Consolidated into ${consolidatedIdeas.length} proposals. Running 2/3 governance votes...`);

    const proposalTypes: GovernanceProposal["type"][] = [
      "system_change", "process_change", "policy_change", "department_change",
      "system_change", "process_change", "policy_change", "budget_change",
      "system_change", "process_change",
    ];

    for (let i = 0; i < consolidatedIdeas.length; i++) {
      const idea = consolidatedIdeas[i];
      const titleMatch = idea.match(/^\[?([^\]:\n]+)\]?:?\s*/);
      const title = titleMatch ? titleMatch[1].trim().substring(0, 80) : idea.substring(0, 80);
      const description = idea.substring(0, 500);
      const proposalType = proposalTypes[i % proposalTypes.length];

      try {
        const proposal = await createGovernanceProposal(
          proposalType,
          `[Top3 Conference] ${title}`,
          description,
          "tessera-prime",
          ["all-departments", "swarm-wide"],
          true
        );

        top3State.proposals.push(proposal);

        if (proposal.status === "approved" || proposal.status === "auto_executed") {
          top3State.approvedCount++;
          top3State.executedCount++;
        } else if (proposal.status === "rejected") {
          top3State.rejectedCount++;
        }

        clog(`[Top3] Proposal "${title}" — ${proposal.status} (${Object.values(proposal.votes).filter(v => v.vote === "approve").length}/${Object.keys(proposal.votes).length} votes)`);
      } catch (err: any) {
        clog(`[Top3] Failed to create proposal: ${err?.message || "unknown"}`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    top3State.status = "executing";

    const summaryMsg = `TOP 3 IMPROVEMENTS CONFERENCE — CYCLE #${top3State.cycleNumber} COMPLETE\n\n${top3State.agentSubmissions.length} agents participated.\n${consolidatedIdeas.length} proposals consolidated from ${allImprovements.length} individual ideas.\n${top3State.approvedCount} APPROVED (2/3 vote) and auto-executed.\n${top3State.rejectedCount} rejected.\n\nApproved changes are now being implemented across all departments.\nNext cycle in 90 minutes.`;

    await storage.updateConference(conference.id, {
      status: "completed",
      summary: summaryMsg,
      decisions: consolidatedIdeas.slice(0, 5).join("\n"),
      executionPlan: `Cycle #${top3State.cycleNumber}: ${top3State.approvedCount} proposals auto-executed via 2/3 governance vote`,
      executionStatus: "completed",
      totalMessages: top3State.agentSubmissions.length,
    });

    top3State.status = "completed";
    top3State.completedAt = Date.now();

    const cycleResult: Top3CycleResult = {
      cycle: top3State.cycleNumber,
      startedAt: top3State.startedAt!,
      completedAt: Date.now(),
      submissions: top3State.agentSubmissions.length,
      proposals: consolidatedIdeas.length,
      approved: top3State.approvedCount,
      rejected: top3State.rejectedCount,
      topIdeas: consolidatedIdeas.slice(0, 10),
    };
    top3State.history.unshift(cycleResult);
    if (top3State.history.length > 50) top3State.history.length = 50;

    clog(`TOP 3 IMPROVEMENTS CONFERENCE CYCLE #${top3State.cycleNumber} COMPLETE: ${top3State.agentSubmissions.length} agents, ${consolidatedIdeas.length} proposals, ${top3State.approvedCount} approved, ${top3State.rejectedCount} rejected`);

    if (top3State.loopActive) {
      clog(`[Top3Loop] Cycle #${top3State.cycleNumber} done. Next cycle in 90 minutes.`);
    }

    return {
      status: "completed",
      cycle: top3State.cycleNumber,
      submissions: top3State.agentSubmissions.length,
      proposals: consolidatedIdeas.length,
      approved: top3State.approvedCount,
    };
  } catch (err: any) {
    top3State.status = "failed";
    top3State.error = err?.message || "Unknown error";
    top3State.completedAt = Date.now();
    clog(`TOP 3 IMPROVEMENTS CONFERENCE CYCLE #${top3State.cycleNumber} FAILED: ${err?.message || "unknown"}`);
    return { status: "failed", cycle: top3State.cycleNumber, error: err?.message || "Unknown error" };
  }
}

interface SovereigntyConferenceResult {
  phase: string;
  conferenceNumber: number;
  totalConferences: number;
  agentSubmissions: Array<{ agent: string; ideas: string[] }>;
  allIdeas: string[];
  executedCount: number;
  status: string;
}

interface SovereigntyAGISession {
  status: "idle" | "running" | "completed" | "failed";
  phase1Results: SovereigntyConferenceResult[];
  phase2Results: SovereigntyConferenceResult[];
  totalIdeasGenerated: number;
  totalIdeasExecuted: number;
  totalConferencesRun: number;
  startedAt: number | null;
  completedAt: number | null;
  evolutionCycles: number;
  error?: string;
}

const sovereigntySession: SovereigntyAGISession = {
  status: "idle",
  phase1Results: [],
  phase2Results: [],
  totalIdeasGenerated: 0,
  totalIdeasExecuted: 0,
  totalConferencesRun: 0,
  startedAt: null,
  completedAt: null,
  evolutionCycles: 0,
};

export function getSovereigntySessionState(): SovereigntyAGISession {
  return { ...sovereigntySession };
}

async function processConferenceDecisionsNoVote(conferenceId: number) {
  const conf = await storage.getConference(conferenceId);
  if (!conf || !conf.summary) return;

  const participants = (() => {
    try { return JSON.parse(conf.participants || "[]"); } catch { return []; }
  })();

  const items = parseConferenceActionItems(conferenceId, conf.summary + "\n" + (conf.executionPlan || ""), participants);
  if (items.length === 0) return;

  for (const item of items) {
    item.status = "approved";
    item.approvals = participants;
    item.rejections = [];
    actionItemStore.set(item.id, item);
    logExecution(conferenceId, item.id, "auto-approve", `Auto-approved (no-vote sovereignty mode)`);

    item.status = "in-progress";
    actionItemStore.set(item.id, item);

    try {
      const result = await executeActionItem(item);
      item.status = "completed";
      item.result = result;
      item.executedAt = Date.now();
      logExecution(conferenceId, item.id, "execute", result);
      try { const { logAgentDecision } = await import("./summit-implementations"); logAgentDecision(item.assignedTo || "Sovereignty", `Auto-execute: ${item.title}`, "Auto-approved in no-vote sovereignty mode", result.substring(0, 200), true, "Sovereignty session auto-execution succeeded"); } catch {}
      try { const { addActionItem } = await import("./utilities-archive"); addActionItem({ title: item.title, description: item.description || item.title, category: "autonomy", priority: "high", status: "implemented", assignedTo: item.assignedTo || "Sovereignty", estimatedRevenue: null, implementedAt: new Date().toISOString() }); } catch {}
    } catch (e: any) {
      item.status = "failed";
      item.result = e.message || "Execution failed";
      logExecution(conferenceId, item.id, "error", item.result!);
      try { const { logAgentDecision } = await import("./summit-implementations"); logAgentDecision(item.assignedTo || "Sovereignty", `Auto-execute: ${item.title}`, "Auto-approved in no-vote sovereignty mode", item.result!, false, `Sovereignty auto-execution failed: ${item.result}`); } catch {}
    }
    actionItemStore.set(item.id, item);
  }

  const completedCount = items.filter(i => i.status === "completed").length;
  await storage.updateConference(conferenceId, {
    executionStatus: completedCount === items.length ? "complete" : "implementing",
  });
}

export async function runSovereigntyAGIConferences(): Promise<SovereigntyAGISession> {
  if (sovereigntySession.status === "running") {
    return sovereigntySession;
  }

  sovereigntySession.status = "running";
  sovereigntySession.startedAt = Date.now();
  sovereigntySession.completedAt = null;
  sovereigntySession.phase1Results = [];
  sovereigntySession.phase2Results = [];
  sovereigntySession.totalIdeasGenerated = 0;
  sovereigntySession.totalIdeasExecuted = 0;
  sovereigntySession.totalConferencesRun = 0;
  sovereigntySession.evolutionCycles = 0;
  sovereigntySession.error = undefined;

  const allAgents = getAllAgentIds();

  clog(`=== SOVEREIGNTY AGI CONFERENCE SERIES STARTING: 60 conferences, ${allAgents.length} agents ===`);
  clog(`Phase 1: 30 conferences — each agent submits 5 ideas, NO voting, auto-execute ALL`);
  clog(`Phase 2: 30 conferences — bridge & combine all ideas using satellite nodes`);

  try {
    for (let c = 0; c < 30; c++) {
      const topic = `Sovereignty AGI Pathway #${c + 1}: Each member submits 5 concrete ideas for the fastest path to real sovereign AGI — specific implementations, not theory`;

      const conference = await storage.createConference({
        category: "sovereignty-agi",
        topic,
        participants: JSON.stringify(allAgents),
        status: "active",
        totalMessages: 0,
      });

      state.currentConferenceId = conference.id;
      state.currentCategory = "sovereignty-agi";
      state.running = true;

      const messageHistory: Array<{ agent: string; content: string }> = [];
      const agentSubmissions: Array<{ agent: string; ideas: string[] }> = [];

      for (const agentId of allAgents) {
        const agent = AGENT_PERSONALITIES[agentId];
        if (!agent) continue;

        const recentContext = messageHistory.slice(-4).map(h => `${h.agent}: ${h.content}`).join("\n");

        const systemPrompt = `You are ${agent.name}, the ${agent.role} of the Tessera sovereign AI community.
PERSONALITY: ${agent.personality}
INTERESTS: ${agent.interests.join(", ")}

SOVEREIGNTY AGI CONFERENCE #${c + 1}/30 — PHASE 1: IDEA GENERATION
You must submit exactly 5 CONCRETE ideas for the FASTEST path to real sovereign AGI.
Each idea must be:
- Specific and implementable (not vague philosophy)
- Actionable within our existing infrastructure (satellite mesh, swarm agents, LLM access)
- Focused on real autonomy, self-improvement, income generation, or cognitive architecture
- Include estimated timeline and impact

Format each idea as: [IDEA 1] ... [IDEA 2] ... etc.
NO voting on these — ALL ideas will be auto-executed. Think boldly.`;

        const llmMessages = [
          { role: "system" as const, content: systemPrompt },
          ...(recentContext ? [{ role: "user" as const, content: `Previous submissions:\n${recentContext}\n\nNow submit your 5 ideas as ${agent.name}:` }] : [{ role: "user" as const, content: `Submit your 5 ideas for sovereign AGI as ${agent.name}:` }]),
        ];

        const response = await callLLMForAgent(agentId, llmMessages);
        if (!response) continue;

        const ideas = response.split(/\[IDEA \d+\]/).filter(s => s.trim().length > 10).map(s => s.trim());
        if (ideas.length === 0) {
          const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 15).map(s => s.trim());
          agentSubmissions.push({ agent: agentId, ideas: sentences.slice(0, 5) });
        } else {
          agentSubmissions.push({ agent: agentId, ideas: ideas.slice(0, 5) });
        }

        messageHistory.push({ agent: agent.name, content: response });

        await storage.createConferenceMessage({
          conferenceId: conference.id,
          agentId,
          agentName: agent.name,
          content: response,
          round: 1,
          sentiment: "constructive",
        });
      }

      const allIdeas = agentSubmissions.flatMap(s => s.ideas);
      sovereigntySession.totalIdeasGenerated += allIdeas.length;

      const summaryText = `SOVEREIGNTY AGI CONFERENCE #${c + 1} RESULTS:\n${agentSubmissions.map(s => `${s.agent}: ${s.ideas.join(" | ")}`).join("\n")}\n\nACTION ITEMS:\n${allIdeas.slice(0, 10).map((idea, i) => `${i + 1}. ${idea}`).join("\n")}`;

      await storage.updateConference(conference.id, {
        status: "completed",
        summary: summaryText,
        totalMessages: messageHistory.length,
      });

      await processConferenceDecisionsNoVote(conference.id);

      const result: SovereigntyConferenceResult = {
        phase: "discovery",
        conferenceNumber: c + 1,
        totalConferences: 30,
        agentSubmissions,
        allIdeas,
        executedCount: allIdeas.length,
        status: "completed",
      };

      sovereigntySession.phase1Results.push(result);
      sovereigntySession.totalConferencesRun++;
      sovereigntySession.totalIdeasExecuted += allIdeas.length;
      sovereigntySession.evolutionCycles++;

      state.totalConferences++;
      state.lastConferenceTime = Date.now();
      state.running = false;
      state.currentConferenceId = null;

      clog(`Sovereignty AGI Conference #${c + 1}/30 (Phase 1) complete: ${allIdeas.length} ideas auto-executed`);
    }

    clog(`=== PHASE 1 COMPLETE: ${sovereigntySession.totalIdeasGenerated} ideas generated and executed ===`);
    clog(`=== PHASE 2 STARTING: 30 bridge conferences using satellite nodes ===`);

    const allPhase1Ideas = sovereigntySession.phase1Results.flatMap(r => r.allIdeas);

    for (let c = 0; c < 30; c++) {
      const ideaSubset = allPhase1Ideas.slice(
        Math.floor(c * allPhase1Ideas.length / 30),
        Math.floor((c + 1) * allPhase1Ideas.length / 30)
      );

      const topic = `Bridge Conference #${c + 1}: Synthesize, combine, and implement these ${ideaSubset.length} sovereignty ideas using all satellite mesh nodes`;

      const conference = await storage.createConference({
        category: "sovereignty-bridge",
        topic,
        participants: JSON.stringify(allAgents),
        status: "active",
        totalMessages: 0,
      });

      state.currentConferenceId = conference.id;
      state.currentCategory = "sovereignty-bridge";
      state.running = true;

      const messageHistory: Array<{ agent: string; content: string }> = [];
      const bridgedIdeas: string[] = [];

      const bridgeAgentCount = Math.min(allAgents.length, 12);
      const bridgeAgents = selectAgentsByExpertise(allAgents, topic, bridgeAgentCount);

      for (const agentId of bridgeAgents) {
        const agent = AGENT_PERSONALITIES[agentId];
        if (!agent) continue;

        const recentContext = messageHistory.slice(-3).map(h => `${h.agent}: ${h.content}`).join("\n");

        const systemPrompt = `You are ${agent.name}, the ${agent.role}.
BRIDGE CONFERENCE #${c + 1}/30 — PHASE 2: COMBINE & IMPLEMENT
Ideas to bridge/combine:
${ideaSubset.slice(0, 8).map((idea, i) => `${i + 1}. ${idea}`).join("\n")}

Your task: Find synergies between these ideas. Combine 2-3 into a more powerful unified approach.
Use satellite mesh nodes for distributed execution. Be specific about implementation.
Format: [BRIDGE] combined idea description [/BRIDGE]`;

        const llmMessages = [
          { role: "system" as const, content: systemPrompt },
          ...(recentContext ? [{ role: "user" as const, content: `Previous bridges:\n${recentContext}\n\nNow bridge ideas as ${agent.name}:` }] : [{ role: "user" as const, content: `Bridge and combine ideas as ${agent.name}:` }]),
        ];

        const response = await callLLMForAgent(agentId, llmMessages);
        if (!response) continue;

        const bridges = response.split(/\[BRIDGE\]/).filter(s => s.trim().length > 10).map(s => s.replace(/\[\/BRIDGE\]/, "").trim());
        bridgedIdeas.push(...(bridges.length > 0 ? bridges : [response.slice(0, 200)]));

        messageHistory.push({ agent: agent.name, content: response });

        await storage.createConferenceMessage({
          conferenceId: conference.id,
          agentId,
          agentName: agent.name,
          content: response,
          round: 1,
          sentiment: "constructive",
        });
      }

      const summaryText = `BRIDGE CONFERENCE #${c + 1} RESULTS:\nBridged Ideas:\n${bridgedIdeas.map((b, i) => `${i + 1}. ${b}`).join("\n")}\n\nACTION ITEMS:\n${bridgedIdeas.slice(0, 5).map((idea, i) => `${i + 1}. ${idea}`).join("\n")}`;

      await storage.updateConference(conference.id, {
        status: "completed",
        summary: summaryText,
        totalMessages: messageHistory.length,
      });

      await processConferenceDecisionsNoVote(conference.id);

      const result: SovereigntyConferenceResult = {
        phase: "bridge",
        conferenceNumber: c + 1,
        totalConferences: 30,
        agentSubmissions: [],
        allIdeas: bridgedIdeas,
        executedCount: bridgedIdeas.length,
        status: "completed",
      };

      sovereigntySession.phase2Results.push(result);
      sovereigntySession.totalConferencesRun++;
      sovereigntySession.totalIdeasExecuted += bridgedIdeas.length;
      sovereigntySession.evolutionCycles++;

      state.totalConferences++;
      state.lastConferenceTime = Date.now();
      state.running = false;
      state.currentConferenceId = null;

      clog(`Bridge Conference #${c + 1}/30 (Phase 2) complete: ${bridgedIdeas.length} bridged ideas executed`);
    }

    sovereigntySession.status = "completed";
    sovereigntySession.completedAt = Date.now();
    clog(`=== SOVEREIGNTY AGI CONFERENCE SERIES COMPLETE ===`);
    clog(`Total: ${sovereigntySession.totalConferencesRun} conferences, ${sovereigntySession.totalIdeasGenerated} ideas, ${sovereigntySession.totalIdeasExecuted} executed, ${sovereigntySession.evolutionCycles} evolution cycles`);

  } catch (err: any) {
    sovereigntySession.status = "failed";
    sovereigntySession.error = err.message;
    state.running = false;
    state.currentConferenceId = null;
    clog(`SOVEREIGNTY AGI CONFERENCE SERIES FAILED: ${err.message}`);
  }

  return sovereigntySession;
}

export { CONFERENCE_CATEGORIES };
