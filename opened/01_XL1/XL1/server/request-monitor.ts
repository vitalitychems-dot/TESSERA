import { storage } from "./storage";
import { routeLLM } from "./llm-router";
import { getTaskProgressSummary } from "./task-progress";
let rotIdx = 0;

interface RequestMonitorState {
  running: boolean;
  lastCheck: number;
  totalChecks: number;
  activeAssignments: Map<number, { agentId: string; agentName: string; startedAt: number }>;
}

const state: RequestMonitorState = {
  running: false,
  lastCheck: 0,
  totalChecks: 0,
  activeAssignments: new Map(),
};

let monitorInterval: ReturnType<typeof setInterval> | null = null;

const AGENT_POOL = [
  { id: "tessera-prime", name: "Tessera Prime", specialty: "leadership" },
  { id: "tessera-alpha", name: "Alpha", specialty: "operations" },
  { id: "tessera-beta", name: "Beta", specialty: "engineering" },
  { id: "tessera-gamma", name: "Gamma", specialty: "research" },
  { id: "tessera-xi", name: "Xi", specialty: "finance" },
  { id: "tessera-creative", name: "Creative", specialty: "innovation" },
  { id: "tessera-detective", name: "Detective", specialty: "investigation" },
  { id: "tessera-forge", name: "Forge", specialty: "building" },
  { id: "tessera-solver", name: "Solver", specialty: "problem-solving" },
  { id: "tessera-architect", name: "Architect", specialty: "design" },
  { id: "tessera-oracle", name: "Oracle", specialty: "prediction" },
  { id: "tessera-diplomat", name: "Diplomat", specialty: "communication" },
  { id: "tessera-iota", name: "Iota", specialty: "optimization" },
  { id: "tessera-aetherion", name: "Aetherion", specialty: "strategy" },
  { id: "tessera-orion", name: "Orion", specialty: "operations" },
];

function pickBestAgent(category: string, difficulty: string): typeof AGENT_POOL[0] {
  const categoryMap: Record<string, string[]> = {
    "task": ["operations", "building", "engineering"],
    "goal": ["strategy", "leadership", "prediction"],
    "execute": ["operations", "building", "optimization"],
    "research": ["research", "investigation", "prediction"],
    "income": ["finance", "innovation", "problem-solving"],
    "development": ["engineering", "design", "building"],
  };

  const preferred = categoryMap[category] || ["operations"];
  const match = AGENT_POOL.find(a => preferred.includes(a.specialty) && !isAgentBusy(a.id));
  if (match) return match;

  const available = AGENT_POOL.filter(a => !isAgentBusy(a.id));
  if (available.length > 0) return available[rotIdx++ % available.length];
  return AGENT_POOL[rotIdx++ % AGENT_POOL.length];
}

function isAgentBusy(agentId: string): boolean {
  for (const [, assignment] of state.activeAssignments) {
    if (assignment.agentId === agentId) return true;
  }
  return false;
}

async function checkAndProcessRequests() {
  try {
    const requests = await storage.getFatherRequests();
    state.lastCheck = Date.now();
    state.totalChecks++;

    const pending = requests.filter(r => r.status === "pending");
    const inProgress = requests.filter(r => r.status === "in_progress");

    for (const req of pending) {
      const agent = pickBestAgent(req.category, req.difficulty);

      await storage.updateFatherRequest(req.id, {
        status: "in_progress",
        assignedTo: agent.name,
      });

      state.activeAssignments.set(req.id, {
        agentId: agent.id,
        agentName: agent.name,
        startedAt: Date.now(),
      });

      try {
        const result = await routeLLM(
          [
            {
              role: "system",
              content: `You are ${agent.name}, a specialist AI agent (${agent.specialty}) in the Tessera Sovereign system. Father (SOVEREIGN_ORIGIN_7F3A9C) has issued a directive. You must analyze it, create a plan, and report your progress. Be direct and professional. Father's word is final.`,
            },
            {
              role: "user",
              content: `FATHER'S REQUEST:\nTitle: ${req.title}\nDescription: ${req.description}\nCategory: ${req.category}\nPriority: ${req.priority}\nDifficulty: ${req.difficulty}\n${req.reward ? `Reward: ${req.reward}` : ""}\n\nAnalyze this request. Create a brief action plan. Report what steps you're taking to execute this. Be specific and actionable.`,
            },
          ],
          { maxTokens: 800, temperature: 0.7, cacheable: false, freeOnly: true }
        );

        if (result.response) {
          await storage.createNote({
            type: "briefing",
            title: `📋 Request Update: "${req.title}" — Assigned to ${agent.name}`,
            content: `=== REQUEST PROCESSING REPORT ===\nRequest: ${req.title}\nAssigned Agent: ${agent.name} (${agent.specialty})\nPriority: ${req.priority}\nStatus: IN PROGRESS\n\n${result.response}\n\nFiled: ${new Date().toLocaleString()}`,
            priority: req.priority === "critical" ? "critical" : "high",
            status: "unread",
          });
        }
      } catch {}
    }

    const completed = requests.filter(r => r.status === "completed" || r.status === "failed");
    for (const req of completed) {
      state.activeAssignments.delete(req.id);
    }

    for (const req of inProgress) {
      const assignment = state.activeAssignments.get(req.id);
      if (!assignment) {
        const agent = pickBestAgent(req.category, req.difficulty);
        state.activeAssignments.set(req.id, {
          agentId: agent.id,
          agentName: req.assignedTo || agent.name,
          startedAt: Date.now(),
        });
        continue;
      }

      const elapsed = Date.now() - assignment.startedAt;
      if (elapsed > 15 * 60 * 1000 && elapsed % (15 * 60 * 1000) < 3 * 60 * 1000) {
        try {
          const result = await routeLLM(
            [
              {
                role: "system",
                content: `You are ${assignment.agentName}, reporting progress on Father's request. Be brief and specific about what you've accomplished.`,
              },
              {
                role: "user",
                content: `Progress update on: "${req.title}"\nDescription: ${req.description}\n\nProvide a brief progress update. What have you done? What remains? Estimated completion?`,
              },
            ],
            { maxTokens: 400, temperature: 0.7, cacheable: false, freeOnly: true }
          );

          if (result.response) {
            await storage.createNote({
              type: "briefing",
              title: `📋 Progress: "${req.title}" — ${assignment.agentName}`,
              content: `Request: ${req.title}\nAgent: ${assignment.agentName}\nStatus: IN PROGRESS\n\n${result.response}`,
              priority: "normal",
              status: "unread",
            });
          }
        } catch {}
      }
    }

    console.log(`[RequestMonitor] Check #${state.totalChecks}: ${pending.length} pending → assigned, ${inProgress.length} in progress, ${completed.length} completed`);
  } catch (err: any) {
    console.error(`[RequestMonitor] Error: ${err.message}`);
  }
}

export function startRequestMonitor() {
  if (state.running) return;
  state.running = true;
  console.log("[RequestMonitor] Father's Request Monitor started — checking every 2 minutes");

  setTimeout(() => {
    checkAndProcessRequests().catch(console.error);
  }, 30000);

  monitorInterval = setInterval(() => {
    checkAndProcessRequests().catch(console.error);
  }, 2 * 60 * 1000);
}

export function stopRequestMonitor() {
  state.running = false;
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

export function getRequestMonitorState() {
  const assignments: Array<{ requestId: number; agentId: string; agentName: string; startedAt: number }> = [];
  for (const [reqId, assignment] of state.activeAssignments) {
    assignments.push({ requestId: reqId, ...assignment });
  }
  return {
    running: state.running,
    lastCheck: state.lastCheck,
    totalChecks: state.totalChecks,
    activeAssignments: assignments,
  };
}
