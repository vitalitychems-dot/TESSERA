import { Router } from "express";
import {
  getConsciousnessStatus,
  runConsciousnessCycle,
  storeEpisodicMemory,
  updateEmotionalState,
  metacognitiveReflect,
  addSemanticNode,
} from "../lib/consciousness-engine.js";

const router = Router();

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

router.get("/consciousness/status", (_req, res) => {
  const status = getConsciousnessStatus(true);
  res.json(status);
});

router.post("/consciousness/cycle", async (_req, res) => {
  try {
    const result = await runConsciousnessCycle();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Cycle failed", details: errorMessage(err) });
  }
});

router.post("/consciousness/memory", async (req, res) => {
  const { content, context, importance } = req.body as {
    content?: unknown;
    context?: unknown;
    importance?: unknown;
  };
  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "content must be a non-empty string" });
    return;
  }
  const ctx = typeof context === "string" ? context : "API input";
  const imp = typeof importance === "number" && importance >= 0 && importance <= 1 ? importance : 0.5;
  try {
    const memory = await storeEpisodicMemory(content, ctx, imp);
    res.json({ memory });
  } catch (err) {
    res.status(500).json({ error: "Failed to store memory", details: errorMessage(err) });
  }
});

router.post("/consciousness/emotion", async (req, res) => {
  const { event } = req.body as { event?: unknown };
  if (!event || typeof event !== "string") {
    res.status(400).json({ error: "event must be a non-empty string" });
    return;
  }
  try {
    const state = await updateEmotionalState(event);
    res.json({ emotionalState: state });
  } catch (err) {
    res.status(500).json({ error: "Failed to update emotional state", details: errorMessage(err) });
  }
});

router.post("/consciousness/metacognition", async (req, res) => {
  const { thought, aboutProcess } = req.body as { thought?: unknown; aboutProcess?: unknown };
  if (!thought || typeof thought !== "string" || !aboutProcess || typeof aboutProcess !== "string") {
    res.status(400).json({ error: "thought and aboutProcess must be non-empty strings" });
    return;
  }
  try {
    const entry = await metacognitiveReflect(thought, aboutProcess);
    res.json({ entry });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate metacognition", details: errorMessage(err) });
  }
});

router.post("/consciousness/semantic", async (req, res) => {
  const { concept, definition, category, connections } = req.body as {
    concept?: unknown;
    definition?: unknown;
    category?: unknown;
    connections?: unknown;
  };
  if (!concept || typeof concept !== "string" || !definition || typeof definition !== "string") {
    res.status(400).json({ error: "concept and definition must be non-empty strings" });
    return;
  }
  const cat = typeof category === "string" ? category : "general";
  const conns: Array<{ targetId: string; relation: string; strength: number }> = Array.isArray(connections)
    ? connections.filter(
        (c): c is { targetId: string; relation: string; strength: number } =>
          c !== null &&
          typeof c === "object" &&
          typeof (c as Record<string, unknown>).targetId === "string" &&
          typeof (c as Record<string, unknown>).relation === "string" &&
          typeof (c as Record<string, unknown>).strength === "number"
      )
    : [];
  try {
    const node = await addSemanticNode(concept, definition, cat, conns);
    res.json({ node });
  } catch (err) {
    res.status(500).json({ error: "Failed to add semantic node", details: errorMessage(err) });
  }
});

export default router;
