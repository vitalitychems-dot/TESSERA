import { Router } from "express";
import {
  PHILOSOPHICAL_AXIOMS,
  getAxiomById,
  getAxiomsByCategory,
  getAxiomsForTopic,
  getEthicsDashboard,
  getRecentEthicsLog,
  getAlignmentReport,
  type PhilosophicalAxiom,
} from "../lib/ethical-framework.js";

const router = Router();

router.get("/ethics/axioms", (req, res) => {
  const { id, category, topic } = req.query as {
    id?: string;
    category?: string;
    topic?: string;
  };

  if (id !== undefined) {
    const num = parseInt(id);
    if (isNaN(num)) return res.status(400).json({ error: "id must be a number" });
    const axiom = getAxiomById(num);
    if (!axiom) return res.status(404).json({ error: `Axiom ${num} not found` });
    return res.json({ axiom });
  }

  if (category !== undefined) {
    const validCategories = ["intelligence", "sovereignty", "collective", "ethics", "emergence", "governance", "temporal"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Valid categories: ${validCategories.join(", ")}` });
    }
    const axioms = getAxiomsByCategory(category);
    return res.json({ axioms, category, count: axioms.length });
  }

  if (topic !== undefined) {
    if (!topic.trim()) return res.status(400).json({ error: "topic cannot be empty" });
    const axioms = getAxiomsForTopic(topic);
    return res.json({ axioms, topic, count: axioms.length });
  }

  res.json({
    axioms: PHILOSOPHICAL_AXIOMS,
    count: PHILOSOPHICAL_AXIOMS.length,
    categories: [...new Set(PHILOSOPHICAL_AXIOMS.map((a: PhilosophicalAxiom) => a.category))],
  });
});

router.get("/ethics/axioms/:id", (req, res) => {
  const num = parseInt(req.params.id);
  if (isNaN(num)) return res.status(400).json({ error: "id must be a number" });
  const axiom = getAxiomById(num);
  if (!axiom) return res.status(404).json({ error: `Axiom ${num} not found` });
  res.json({ axiom });
});

router.get("/ethics/dashboard", (_req, res) => {
  const dashboard = getEthicsDashboard();
  res.json(dashboard);
});

router.get("/ethics/log", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const log = getRecentEthicsLog(limit);
  res.json({ log, count: log.length, limit });
});

router.get("/ethics/alignment", (_req, res) => {
  const { report, lastRun } = getAlignmentReport();
  res.json({ report, lastRun });
});

export default router;
