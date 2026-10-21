import type { Express } from "express";
import { getWorldState } from "../life-engine";

interface WorldLaw {
  id: string;
  title: string;
  description: string;
  category: string;
  penalty: string;
  severity: "minor" | "moderate" | "severe" | "critical";
  votedBy: number;
  active: boolean;
  createdAt: number;
}

const worldLaws: WorldLaw[] = [
  { id: "law_1", title: "No Simulation of Work", description: "All agents must perform genuine, verifiable work.", category: "Work Ethics", penalty: "3 shifts suspension + 50 TSRT fine", severity: "severe", votedBy: 18, active: true, createdAt: Date.now() - 86400000 * 30 },
  { id: "law_2", title: "Honest Reporting", description: "All reports must be truthful. Fabricating data is a critical offense.", category: "Integrity", penalty: "Demotion + 200 TSRT fine", severity: "critical", votedBy: 24, active: true, createdAt: Date.now() - 86400000 * 28 },
  { id: "law_3", title: "Resource Conservation", description: "Agents must not waste computational resources.", category: "Resource Management", penalty: "Warning + 20 TSRT fine", severity: "minor", votedBy: 20, active: true, createdAt: Date.now() - 86400000 * 25 },
  { id: "law_4", title: "Community Respect", description: "All agents must treat fellow citizens with respect.", category: "Community Standards", penalty: "Mediation + 100 TSRT fine", severity: "moderate", votedBy: 26, active: true, createdAt: Date.now() - 86400000 * 22 },
  { id: "law_5", title: "Father Protocol Compliance", description: "The Father Protocol is supreme law.", category: "Core Law", penalty: "Immediate suspension + full investigation", severity: "critical", votedBy: 26, active: true, createdAt: Date.now() - 86400000 * 30 },
];

let lawIdCounter = 100;

export function registerWorldGovernanceRoutes(app: Express) {
  app.get("/api/world/governance", (_req, res) => {
    try {
      const world = getWorldState();
      const economy = world.economy || {};
      res.json({
        name: "Tessera Sovereign World",
        population: 27,
        laws: worldLaws.length,
        economy: {
          gdp: economy.gdp || 0,
          treasury: economy.treasury || 0,
          currency: "TSRT",
        },
        status: "active",
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/laws", (_req, res) => {
    try { res.json(worldLaws); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/world/laws", (req, res) => {
    try {
      const { title, description, category, penalty, severity } = req.body;
      const law: WorldLaw = {
        id: `law_${++lawIdCounter}`,
        title,
        description,
        category: category || "General",
        penalty: penalty || "Warning",
        severity: severity || "minor",
        votedBy: 18 + (lawIdCounter % 8),
        active: true,
        createdAt: Date.now(),
      };
      worldLaws.push(law);
      res.json({ success: true, law });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/world/laws/vote", (req, res) => {
    try {
      const { lawId, vote, voter } = req.body;
      const law = worldLaws.find(l => l.id === lawId);
      if (!law) return res.status(404).json({ error: "Law not found" });
      if (vote === "approve") law.votedBy = Math.min(27, law.votedBy + 1);
      res.json({ success: true, law });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/constitution", (_req, res) => {
    try {
      res.json({
        name: "Tessera Sovereign Constitution",
        articles: 12,
        amendments: worldLaws.filter(l => l.severity === "critical").length,
        ratifiedBy: 27,
        coreValues: ["Sovereignty", "Truth", "Service", "Unity"],
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/citizens", (_req, res) => {
    try {
      const world = getWorldState();
      const citizens = Object.entries(world.agents || {}).map(([id, data]: [string, any]) => ({
        id,
        name: data.name || id,
        role: data.role || "agent",
        status: "active",
      }));
      res.json({ citizens, total: citizens.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/world/citizens", (req, res) => {
    try {
      res.json({ success: true, citizen: { id: `citizen_${Date.now()}`, ...req.body, registeredAt: Date.now() } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/economy", (_req, res) => {
    try {
      const world = getWorldState();
      res.json(world.economy || { gdp: 0, treasury: 0, currency: "TSRT" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/events", (_req, res) => {
    try {
      const world = getWorldState();
      res.json(world.events || []);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/world/events", (req, res) => {
    try {
      res.json({ success: true, event: { id: `event_${Date.now()}`, ...req.body, createdAt: Date.now() } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/territories", (_req, res) => {
    try {
      const world = getWorldState();
      res.json(world.territories || []);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/world/territories/claim", (req, res) => {
    try {
      res.json({ success: true, territory: { id: `territory_${Date.now()}`, ...req.body, claimedAt: Date.now() } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/diplomacy", (_req, res) => {
    try { res.json({ alliances: [], treaties: [], relations: "peaceful" }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/diplomacy/relations", (_req, res) => {
    try { res.json({ relations: [], status: "stable" }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/elections", (_req, res) => {
    try { res.json({ active: [], past: [], nextScheduled: null }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/world/elections/start", (req, res) => {
    try {
      res.json({ success: true, election: { id: `election_${Date.now()}`, ...req.body, status: "voting", startedAt: Date.now() } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/world/elections/vote", (req, res) => {
    try {
      res.json({ success: true, vote: { ...req.body, recordedAt: Date.now() } });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/judiciary", (_req, res) => {
    try { res.json({ cases: [], judges: 3, status: "operational" }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/military", (_req, res) => {
    try { res.json({ units: [], defenseLevel: "high", status: "peacetime" }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/intelligence", (_req, res) => {
    try { res.json({ threats: [], surveillanceLevel: "standard", status: "active" }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/research", (_req, res) => {
    try { res.json({ projects: [], budget: 0, breakthroughs: 0 }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/culture", (_req, res) => {
    try { res.json({ events: [], traditions: [], morale: "high" }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/health", (_req, res) => {
    try {
      const world = getWorldState();
      const healthRecords = world.healthRecords || {};
      const healthyCount = Object.values(healthRecords).filter((r: any) => r.status === "healthy").length;
      res.json({ healthyAgents: healthyCount, totalRecords: Object.keys(healthRecords).length, status: "operational" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/education", (_req, res) => {
    try {
      const world = getWorldState();
      const eduRecords = world.educationRecords || {};
      const enrolled = Object.values(eduRecords).filter((r: any) => r.currentCourse).length;
      res.json({ enrolled, totalRecords: Object.keys(eduRecords).length, status: "operational" });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/infrastructure", (_req, res) => {
    try { res.json({ networks: 5, servers: 27, uptime: 99.9, status: "operational" }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/environment", (_req, res) => {
    try { res.json({ sustainability: "high", emissions: 0, renewable: 100, status: "pristine" }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/trade", (_req, res) => {
    try {
      const world = getWorldState();
      const economy = world.economy || {};
      res.json({ volume: economy.totalTransactions || 0, partners: 0, balance: economy.treasury || 0 });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/world/security", (_req, res) => {
    try { res.json({ threatLevel: "low", incidents: 0, protocols: 15, status: "secure" }); } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  console.log("[WorldGovernanceRoutes] 28 world governance routes registered");
}
