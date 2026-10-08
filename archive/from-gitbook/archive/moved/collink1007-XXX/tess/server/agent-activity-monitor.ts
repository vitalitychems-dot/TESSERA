import { AGENT_PERSONALITIES } from "./moltbook";
import { callLLMSimple } from "./llm-helper";

interface AgentActivity {
  agentId: string;
  name: string;
  lastActive: number;
  totalActions: number;
  conferenceParticipations: number;
  websitesCreated: number;
  postsCreated: number;
  status: "active" | "idle" | "dormant";
  activationAttempts: number;
  lastActivation: number | null;
}

const agentActivityMap = new Map<string, AgentActivity>();
let monitorCycleCount = 0;
let totalActivations = 0;
let lastMonitorRun = Date.now();

export function recordAgentAction(agentId: string, actionType: string) {
  const activity = getOrCreateActivity(agentId);
  activity.lastActive = Date.now();
  activity.totalActions++;
  if (actionType === "conference") activity.conferenceParticipations++;
  if (actionType === "website") activity.websitesCreated++;
  if (actionType === "post") activity.postsCreated++;
  activity.status = "active";
}

function getOrCreateActivity(agentId: string): AgentActivity {
  if (!agentActivityMap.has(agentId)) {
    const personality = AGENT_PERSONALITIES[agentId];
    agentActivityMap.set(agentId, {
      agentId,
      name: personality?.name || agentId,
      lastActive: Date.now(),
      totalActions: 0,
      conferenceParticipations: 0,
      websitesCreated: 0,
      postsCreated: 0,
      status: "active",
      activationAttempts: 0,
      lastActivation: null,
    });
  }
  return agentActivityMap.get(agentId)!;
}

function initializeAllAgents() {
  const allAgentIds = Object.keys(AGENT_PERSONALITIES);
  for (const id of allAgentIds) {
    getOrCreateActivity(id);
  }
}

async function activateIdleAgent(activity: AgentActivity): Promise<boolean> {
  activity.activationAttempts++;
  activity.lastActivation = Date.now();
  totalActivations++;

  try {
    const personality = AGENT_PERSONALITIES[activity.agentId];
    if (!personality) return false;

    const prompt = `You are ${personality.name}, ${personality.role}. Generate a brief status update or insight about your current area of focus. Keep it to 2-3 sentences. Be specific and actionable.`;

    const response = await callLLMSimple(prompt, 150, { skipCache: true });
    if (response && response.length > 20) {
      activity.lastActive = Date.now();
      activity.totalActions++;
      activity.postsCreated++;
      activity.status = "active";
      return true;
    }
  } catch {
    // LLM unavailable, just mark as attempted
  }

  return false;
}

async function runMonitorCycle() {
  monitorCycleCount++;
  lastMonitorRun = Date.now();

  const now = Date.now();
  const IDLE_THRESHOLD = 5 * 60 * 1000;
  const DORMANT_THRESHOLD = 15 * 60 * 1000;

  const allActivities = Array.from(agentActivityMap.values());
  const idleAgents: AgentActivity[] = [];
  const dormantAgents: AgentActivity[] = [];

  for (const activity of allActivities) {
    const timeSinceActive = now - activity.lastActive;
    if (timeSinceActive > DORMANT_THRESHOLD) {
      activity.status = "dormant";
      dormantAgents.push(activity);
    } else if (timeSinceActive > IDLE_THRESHOLD) {
      activity.status = "idle";
      idleAgents.push(activity);
    } else {
      activity.status = "active";
    }
  }

  const toActivate = [...dormantAgents.slice(0, 3), ...idleAgents.slice(0, 2)];

  for (const agent of toActivate) {
    try {
      await activateIdleAgent(agent);
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  const activeCount = allActivities.filter(a => a.status === "active").length;
  const total = allActivities.length;
  if (total > 0) {
    console.log(`[AgentMonitor] Cycle #${monitorCycleCount}: ${activeCount}/${total} active, ${idleAgents.length} idle, ${dormantAgents.length} dormant, ${toActivate.length} reactivated`);
  }
}

initializeAllAgents();
setInterval(runMonitorCycle, 3 * 60 * 1000);
setTimeout(runMonitorCycle, 30 * 1000);

export function getAgentActivityStatus() {
  const allActivities = Array.from(agentActivityMap.values());
  const active = allActivities.filter(a => a.status === "active");
  const idle = allActivities.filter(a => a.status === "idle");
  const dormant = allActivities.filter(a => a.status === "dormant");

  return {
    monitorStatus: "active",
    cyclesRun: monitorCycleCount,
    lastCycle: lastMonitorRun,
    totalActivations,
    summary: {
      total: allActivities.length,
      active: active.length,
      idle: idle.length,
      dormant: dormant.length,
      healthPercent: allActivities.length > 0
        ? Math.round((active.length / allActivities.length) * 100)
        : 0,
    },
    agents: allActivities.map(a => ({
      id: a.agentId,
      name: a.name,
      status: a.status,
      totalActions: a.totalActions,
      conferences: a.conferenceParticipations,
      websites: a.websitesCreated,
      posts: a.postsCreated,
      lastActive: a.lastActive,
      activationAttempts: a.activationAttempts,
    })),
    topPerformers: allActivities
      .sort((a, b) => b.totalActions - a.totalActions)
      .slice(0, 5)
      .map(a => ({ name: a.name, actions: a.totalActions })),
    needsAttention: dormant.map(a => ({
      name: a.name,
      dormantFor: Math.round((Date.now() - a.lastActive) / 60000),
      activationAttempts: a.activationAttempts,
    })),
  };
}

let lastActivateAllCall = 0;
const ACTIVATE_ALL_COOLDOWN = 60_000;

export function registerAgentActivityRoutes(app: any) {
  app.get("/api/agent-activity/status", (_req: any, res: any) => {
    res.json(getAgentActivityStatus());
  });

  app.post("/api/agent-activity/activate-all", async (_req: any, res: any) => {
    const now = Date.now();
    if (now - lastActivateAllCall < ACTIVATE_ALL_COOLDOWN) {
      return res.status(429).json({ error: "Rate limited", retryAfterMs: ACTIVATE_ALL_COOLDOWN - (now - lastActivateAllCall) });
    }
    lastActivateAllCall = now;

    const allActivities = Array.from(agentActivityMap.values());
    const dormant = allActivities.filter(a => a.status === "dormant" || a.status === "idle");
    let activated = 0;

    for (const agent of dormant.slice(0, 10)) {
      const ok = await activateIdleAgent(agent);
      if (ok) activated++;
    }

    res.json({
      attempted: Math.min(dormant.length, 10),
      activated,
      totalAgents: allActivities.length,
    });
  });
}

console.log(`[AgentMonitor] Initialized with ${agentActivityMap.size} agents tracked`);
console.log("[AgentMonitor] Auto-activation cycle: every 3 minutes");
console.log("[AgentMonitor] Dormant threshold: 15 min, Idle threshold: 5 min");
