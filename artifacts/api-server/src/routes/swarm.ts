import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { swarmTasksTable, swarmReasoningTracesTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { validateMeshToken } from "../lib/mesh-auth";
import { meshBroadcast } from "../lib/mesh-bus";

const router: IRouter = Router();

router.get("/swarm/status", (_req, res) => {
  res.json({
    ok: true,
    system: "Tessera Swarm v2.0",
    agents: [
      { id: "math-agent", name: "Euler", domain: "math", modelId: "deepseek-chat", status: "idle" },
      { id: "physics-agent", name: "Curie", domain: "physics", modelId: "gemini-2.5-flash-preview-05-20", status: "idle" },
      { id: "symbolic-agent", name: "Noether", domain: "symbolic", modelId: "claude-sonnet-4-20250514", status: "idle" },
      { id: "retrieval-agent", name: "Athena", domain: "retrieval", modelId: "gpt-4.1", status: "idle" },
      { id: "planning-agent", name: "Minerva", domain: "planning", modelId: "grok-3", status: "idle" },
      { id: "architecture-agent", name: "Ada", domain: "architecture", modelId: "claude-sonnet-4-20250514", status: "idle" },
      { id: "routing-agent", name: "Iris", domain: "routing", modelId: "mistral-large-latest", status: "idle" },
    ],
    coordinator: { id: "swarm-coordinator", status: "active", tasksProcessed: 0 },
    metaAgent: { id: "meta-agent", status: "active", reportsGenerated: 0 },
    routingGraph: {
      nodes: 11,
      edges: 14,
      algorithm: "BFS shortest-path + load-balanced routing",
    },
    capabilities: ["PLAN", "EXECUTE", "REFLECT", "IMPROVE", "METACOGNITION"],
    timestamp: Date.now(),
  });
});

router.get("/swarm/routing-graph", (_req, res) => {
  res.json({
    ok: true,
    nodes: [
      { id: "swarm-coordinator", label: "Swarm Coordinator", type: "coordinator", load: 0, capacity: 100 },
      { id: "meta-agent", label: "Meta Agent", type: "meta", load: 0, capacity: 10 },
      { id: "math-agent", label: "Euler (Math)", type: "agent", domain: "math", load: 0, capacity: 5 },
      { id: "physics-agent", label: "Curie (Physics)", type: "agent", domain: "physics", load: 0, capacity: 5 },
      { id: "symbolic-agent", label: "Noether (Symbolic)", type: "agent", domain: "symbolic", load: 0, capacity: 5 },
      { id: "retrieval-agent", label: "Athena (Retrieval)", type: "agent", domain: "retrieval", load: 0, capacity: 5 },
      { id: "planning-agent", label: "Minerva (Planning)", type: "agent", domain: "planning", load: 0, capacity: 5 },
      { id: "architecture-agent", label: "Ada (Architecture)", type: "agent", domain: "architecture", load: 0, capacity: 5 },
      { id: "routing-agent", label: "Iris (Routing)", type: "agent", domain: "routing", load: 0, capacity: 5 },
      { id: "provider-anthropic", label: "Anthropic", type: "provider", load: 0, capacity: 50 },
      { id: "provider-openai", label: "OpenAI", type: "provider", load: 0, capacity: 50 },
      { id: "provider-google", label: "Google", type: "provider", load: 0, capacity: 50 },
      { id: "provider-mistral", label: "Mistral", type: "provider", load: 0, capacity: 50 },
      { id: "provider-xai", label: "xAI", type: "provider", load: 0, capacity: 50 },
      { id: "provider-deepseek", label: "DeepSeek", type: "provider", load: 0, capacity: 50 },
    ],
    edges: [
      { from: "swarm-coordinator", to: "math-agent", weight: 1, latencyMs: 10 },
      { from: "swarm-coordinator", to: "physics-agent", weight: 1, latencyMs: 10 },
      { from: "swarm-coordinator", to: "symbolic-agent", weight: 1, latencyMs: 10 },
      { from: "swarm-coordinator", to: "retrieval-agent", weight: 1, latencyMs: 10 },
      { from: "swarm-coordinator", to: "planning-agent", weight: 1, latencyMs: 10 },
      { from: "swarm-coordinator", to: "architecture-agent", weight: 1, latencyMs: 10 },
      { from: "swarm-coordinator", to: "routing-agent", weight: 1, latencyMs: 10 },
      { from: "swarm-coordinator", to: "meta-agent", weight: 0.8, latencyMs: 5 },
      { from: "math-agent", to: "provider-deepseek", weight: 1, latencyMs: 200 },
      { from: "physics-agent", to: "provider-google", weight: 1, latencyMs: 200 },
      { from: "symbolic-agent", to: "provider-anthropic", weight: 1, latencyMs: 200 },
      { from: "retrieval-agent", to: "provider-openai", weight: 1, latencyMs: 200 },
      { from: "planning-agent", to: "provider-xai", weight: 1, latencyMs: 200 },
      { from: "architecture-agent", to: "provider-anthropic", weight: 1, latencyMs: 200 },
      { from: "routing-agent", to: "provider-mistral", weight: 1, latencyMs: 200 },
    ],
    algorithm: "Dijkstra + load-balanced BFS",
    timestamp: Date.now(),
  });
});

router.post("/swarm/classify", (req, res) => {
  try {
    const { task } = req.body as { task: string };
    if (!task || typeof task !== "string") {
      return res.status(400).json({ ok: false, error: "task is required" });
    }

    const lower = task.toLowerCase();
    const domains: string[] = [];

    if (lower.match(/\b(math|calcul|equation|algebra|integral|derivative|probability|statistic|number|formula|proof)\b/)) {
      domains.push("math");
    }
    if (lower.match(/\b(physics|force|energy|quantum|relativity|gravity|wave|particle|thermodynamic|electr)\b/)) {
      domains.push("physics");
    }
    if (lower.match(/\b(symbol|logic|pattern|abstract|formal|theorem|axiom|category|structure|relation)\b/)) {
      domains.push("symbolic");
    }
    if (lower.match(/\b(find|search|research|what is|explain|history|fact|information|knowledge|who|when|where)\b/)) {
      domains.push("retrieval");
    }
    if (lower.match(/\b(plan|strategy|roadmap|step|how to|goal|milestone|schedule|timeline|phase)\b/)) {
      domains.push("planning");
    }
    if (lower.match(/\b(design|architect|system|api|database|scale|service|component|module|pattern)\b/)) {
      domains.push("architecture");
    }
    if (lower.match(/\b(route|dispatch|coordinate|optimize|distribute|balance|assign|orchestrate)\b/)) {
      domains.push("routing");
    }

    if (domains.length === 0) domains.push("retrieval", "planning");

    return res.json({ ok: true, task, domains, agentCount: domains.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/swarm/tasks", async (_req, res) => {
  try {
    const tasks = await db.select().from(swarmTasksTable).orderBy(desc(swarmTasksTable.createdAt)).limit(20);
    return res.json({ ok: true, tasks, count: tasks.length });
  } catch (err) {
    logger.error({ err }, "Failed to fetch swarm tasks");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/swarm/tasks/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const tasks = await db.select().from(swarmTasksTable).where(eq(swarmTasksTable.taskId, taskId)).limit(1);
    if (tasks.length === 0) return res.status(404).json({ ok: false, error: "Task not found" });

    const traces = await db.select().from(swarmReasoningTracesTable).where(eq(swarmReasoningTracesTable.taskId, taskId)).orderBy(swarmReasoningTracesTable.createdAt);

    return res.json({ ok: true, task: tasks[0], traces });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/swarm/tasks", async (req, res) => {
  try {
    const { task, selectedDomains, agentResults, metaReport, finalAnswer } = req.body as {
      task: string;
      selectedDomains: string[];
      agentResults: any[];
      metaReport?: any;
      finalAnswer?: string;
    };

    if (!task || typeof task !== "string") {
      return res.status(400).json({ ok: false, error: "task is required" });
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [inserted] = await db.insert(swarmTasksTable).values({
      taskId,
      task,
      selectedDomains: selectedDomains ?? [],
      agentResults: agentResults ?? [],
      metaReport: metaReport ?? null,
      finalAnswer: finalAnswer ?? null,
      status: "complete",
      agentCount: agentResults?.length ?? 0,
      overallQuality: metaReport?.overallQuality ?? null,
    }).returning();

    if (agentResults?.length > 0) {
      const traceInserts = agentResults.flatMap((r: any) =>
        (r.reasoningTrace || []).map((t: any) => ({
          taskId,
          agentId: r.agentId,
          agentName: r.agentName,
          domain: r.domain,
          phase: t.phase,
          content: t.content?.slice(0, 2000) ?? "",
          quality: t.quality ?? null,
          selfAssessmentScore: r.selfAssessmentScore ?? null,
        }))
      );
      if (traceInserts.length > 0) {
        await db.insert(swarmReasoningTracesTable).values(traceInserts);
      }
    }

    const rawToken = req.headers["x-admin-token"];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    const keyHash = validateMeshToken(token ?? "");
    if (keyHash) {
      meshBroadcast(keyHash, "swarm:task-saved", {
        taskId,
        task: task.slice(0, 120),
        domains: selectedDomains ?? [],
        agentCount: agentResults?.length ?? 0,
        quality: metaReport?.overallQuality ?? null,
      });
    }

    return res.json({ ok: true, taskId, task: inserted });
  } catch (err) {
    logger.error({ err }, "Failed to save swarm task");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/swarm/metacognition/reports", async (_req, res) => {
  try {
    const tasks = await db
      .select()
      .from(swarmTasksTable)
      .orderBy(desc(swarmTasksTable.createdAt))
      .limit(10);

    const reports = tasks
      .filter(t => t.metaReport)
      .map(t => ({
        taskId: t.taskId,
        task: t.task,
        overallQuality: t.overallQuality,
        metaReport: t.metaReport,
        agentCount: t.agentCount,
        createdAt: t.createdAt,
      }));

    return res.json({ ok: true, reports, count: reports.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/swarm/reasoning-traces", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
    const domain = req.query.domain ? String(req.query.domain) : undefined;

    let query = db.select().from(swarmReasoningTracesTable).orderBy(desc(swarmReasoningTracesTable.createdAt)).$dynamic();

    if (domain) {
      query = query.where(eq(swarmReasoningTracesTable.domain, domain));
    }

    const traces = await query.limit(limit);
    return res.json({ ok: true, traces, count: traces.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
