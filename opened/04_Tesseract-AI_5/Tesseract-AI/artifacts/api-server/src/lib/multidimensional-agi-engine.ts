import { db } from "@workspace/db";
import { sovereignty_metrics, knowledge_graph } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { updatePhaseProgress } from "./sovereignty-engine";
import { logger } from "./logger";
import { extractCount } from "./db-utils";

const LOG_PREFIX = "[MultiDimAGI]";

interface Dimension {
  name: string;
  knowledgeNodes: number;
  crossLinks: number;
  domainMappings: string[];
  maturityScore: number;
}

interface AGIMetrics {
  dimensions: Dimension[];
  crossDimensionalReasoning: number;
  totalKnowledgeNodes: number;
  totalDomainsCovered: number;
  dimensionalConvergence: number;
  avgMaturity: number;
}

const DIMENSION_NAMES = [
  "linguistic", "mathematical", "spatial", "temporal", "causal",
  "ethical", "emotional", "social", "creative", "metacognitive",
  "physical", "biological", "chemical", "economic", "political",
  "technological", "philosophical", "spiritual", "aesthetic", "ecological",
  "quantum", "informational", "cybernetic", "evolutionary", "archetypal",
  "symbolic", "geometric",
];

const DIMENSION_DOMAIN_MAP: Record<string, string[]> = {
  linguistic: ["linguistics", "language", "literature", "etymology", "communication"],
  mathematical: ["mathematics", "algebra", "calculus", "statistics", "geometry"],
  spatial: ["geography", "architecture", "cartography", "urban_planning"],
  temporal: ["history", "chronology", "archaeology", "paleontology"],
  causal: ["physics", "causality", "logic", "systems_theory"],
  ethical: ["ethics", "morality", "philosophy", "law", "justice"],
  emotional: ["psychology", "neuroscience", "psychiatry", "counseling"],
  social: ["sociology", "anthropology", "political_science", "demographics"],
  creative: ["art", "music", "design", "film", "photography"],
  metacognitive: ["cognitive_science", "consciousness", "epistemology", "metacognition"],
  physical: ["physics", "mechanics", "thermodynamics", "optics"],
  biological: ["biology", "genetics", "ecology", "zoology", "botany"],
  chemical: ["chemistry", "biochemistry", "pharmacology", "materials_science"],
  economic: ["economics", "finance", "business", "trade", "markets"],
  political: ["politics", "governance", "international_relations", "diplomacy"],
  technological: ["technology", "engineering", "computer_science", "robotics", "ai"],
  philosophical: ["philosophy", "ontology", "metaphysics", "aesthetics"],
  spiritual: ["religion", "spirituality", "theology", "mysticism"],
  aesthetic: ["art_history", "aesthetics", "design_theory", "beauty", "art", "music", "architecture", "visual", "painting", "sculpture", "film", "photography", "fashion", "calligraphy", "typography", "graphic_design", "interior_design", "aesthetic", "leonardo_da_vinci", "music_theory"],
  ecological: ["ecology", "environmental_science", "climate", "sustainability", "conservation", "biodiversity", "ecosystem", "marine", "pollution", "renewable"],
  quantum: ["quantum_physics", "quantum_computing", "particle_physics", "entanglement", "superposition", "qubit"],
  informational: ["information_theory", "data_science", "cryptography", "entropy", "coding", "data", "information", "signal", "compression", "communication"],
  cybernetic: ["cybernetics", "control_theory", "systems_engineering", "feedback", "automation", "control", "robot", "servo", "homeostasis", "regulation", "actuator", "sensor", "plc", "scada", "pid", "adaptive_control", "autonomous", "self_organizing", "autopoiesis", "machine_learning", "neural_network", "reinforcement_learning", "agent"],
  evolutionary: ["evolution", "genetics", "natural_selection", "adaptation", "mutation", "speciation", "phylogenetics", "darwin", "fitness", "heredity", "gene", "genome", "dna", "rna", "protein", "organism", "population", "ecology", "biodiversity", "genetic_algorithm", "evolutionary_computation", "fossil", "extinction"],
  archetypal: ["mythology", "archetypal_psychology", "symbolism", "archetype", "jung", "collective_unconscious"],
  symbolic: ["semiotics", "symbolic_logic", "mathematics", "language"],
  geometric: ["geometry", "topology", "fractals", "spatial_mathematics"],
};

let agiCycleCount = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;

async function measureDimensionFromDB(dimName: string): Promise<Dimension> {
  const domainKeywords = DIMENSION_DOMAIN_MAP[dimName] || [dimName];

  let nodeCount = 0;
  try {
    const likeConditions = domainKeywords.map(k => `metadata->>'domain' ILIKE '%${k}%'`).join(" OR ");
    const rows = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM knowledge_graph 
      WHERE (${likeConditions})
      OR label ILIKE '%${dimName}%'
      OR content ILIKE '%${dimName}%'
    `));
    nodeCount = extractCount(rows);
  } catch {
    nodeCount = 0;
  }

  let crossLinks = 0;
  try {
    const rows = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM knowledge_graph 
      WHERE edges IS NOT NULL 
      AND (label ILIKE '%${dimName}%' OR content ILIKE '%${dimName}%')
    `));
    crossLinks = extractCount(rows);
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  const maturityScore = Math.min(100, nodeCount >= 200 ? 100 : nodeCount >= 100 ? 80 : nodeCount >= 50 ? 60 : nodeCount >= 10 ? 40 : nodeCount > 0 ? 20 : 0);

  return {
    name: dimName,
    knowledgeNodes: nodeCount,
    crossLinks,
    domainMappings: domainKeywords,
    maturityScore,
  };
}

function computeConvergence(dimensions: Dimension[]): number {
  const scores = dimensions.map(d => d.maturityScore);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  return Math.max(0, 100 - stdDev * 2);
}

export async function runAGITrainingCycle(): Promise<{
  cycleNumber: number;
  dimensionsImproved: number;
  crossLinksCreated: number;
  metrics: AGIMetrics;
}> {
  agiCycleCount++;
  const startTime = Date.now();

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} MULTI-DIMENSIONAL AGI MEASUREMENT CYCLE #${agiCycleCount}`);
  console.log(`${LOG_PREFIX} Scanning 27 dimensions from real knowledge graph`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  console.log(`${LOG_PREFIX} [Step 1] Measuring each dimension from DB`);
  const dimensions: Dimension[] = [];
  let totalNodes = 0;
  let totalCrossLinks = 0;

  for (const dimName of DIMENSION_NAMES) {
    const dim = await measureDimensionFromDB(dimName);
    dimensions.push(dim);
    totalNodes += dim.knowledgeNodes;
    totalCrossLinks += dim.crossLinks;
    if (dim.knowledgeNodes > 0) {
      console.log(`${LOG_PREFIX}   ${dim.name}: ${dim.knowledgeNodes} nodes, ${dim.crossLinks} links, maturity: ${dim.maturityScore}%`);
    }
  }

  console.log(`${LOG_PREFIX} [Step 2] Computing cross-dimensional coverage`);
  let totalDomains = 0;
  try {
    const rows = await db.execute(sql`SELECT COUNT(DISTINCT metadata->>'domain') as cnt FROM knowledge_graph WHERE metadata->>'domain' IS NOT NULL`);
    totalDomains = extractCount(rows);
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  const dimsWithData = dimensions.filter(d => d.knowledgeNodes > 0).length;
  const crossDimReasoning = Math.min(100, Math.round((dimsWithData / DIMENSION_NAMES.length) * 100));

  console.log(`${LOG_PREFIX} [Step 3] Computing convergence across dimensions`);
  const convergence = computeConvergence(dimensions);
  const avgMaturity = dimensions.reduce((s, d) => s + d.maturityScore, 0) / dimensions.length;

  const metrics: AGIMetrics = {
    dimensions,
    crossDimensionalReasoning: crossDimReasoning,
    totalKnowledgeNodes: totalNodes,
    totalDomainsCovered: totalDomains,
    dimensionalConvergence: convergence,
    avgMaturity,
  };

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Phase 6", phaseNumber: 6, metricName: "Average Maturity", currentValue: avgMaturity, targetValue: 80, unit: "percent", status: "measured" },
      { phase: "Phase 6", phaseNumber: 6, metricName: "Cross-Dimensional Coverage", currentValue: crossDimReasoning, targetValue: 95, unit: "percent", status: "measured" },
      { phase: "Phase 6", phaseNumber: 6, metricName: "Dimensional Convergence", currentValue: convergence, targetValue: 90, unit: "percent", status: "measured" },
      { phase: "Phase 6", phaseNumber: 6, metricName: "Dimensions With Data", currentValue: dimsWithData, targetValue: 27, unit: "count", status: "measured" },
      { phase: "Phase 6", phaseNumber: 6, metricName: "Total Knowledge Nodes", currentValue: totalNodes, targetValue: 10000, unit: "count", status: "measured" },
    ]).onConflictDoNothing();
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  const progress = Math.min(95, Math.floor(
    avgMaturity * 0.3 + crossDimReasoning * 0.3 + convergence * 0.2 + Math.min(100, (totalDomains / 50) * 100) * 0.2
  ));
  await updatePhaseProgress(6, progress, "in_progress").catch(() => {});

  const duration = Date.now() - startTime;
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} CYCLE #${agiCycleCount} COMPLETE`);
  console.log(`${LOG_PREFIX} Dimensions with data: ${dimsWithData}/27 | Avg maturity: ${avgMaturity.toFixed(1)}%`);
  console.log(`${LOG_PREFIX} Cross-dim coverage: ${crossDimReasoning}% | Convergence: ${convergence.toFixed(1)}%`);
  console.log(`${LOG_PREFIX} Total nodes: ${totalNodes} | Total domains: ${totalDomains}`);
  console.log(`${LOG_PREFIX} Duration: ${duration}ms`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return {
    cycleNumber: agiCycleCount,
    dimensionsImproved: dimsWithData,
    crossLinksCreated: totalCrossLinks,
    metrics,
  };
}

export function getAGITrainingStatus() {
  return {
    cycleCount: agiCycleCount,
    continuousActive: continuousInterval !== null,
    note: "Run a cycle to get real-time dimension measurements from DB",
  };
}

export function startContinuousAGITraining() {
  if (continuousInterval) return;
  console.log(`${LOG_PREFIX} Starting continuous multi-dimensional AGI measurement (every 15 minutes)`);
  runAGITrainingCycle().catch(err => console.error(`${LOG_PREFIX} Initial cycle failed:`, err));
  continuousInterval = setInterval(() => {
    runAGITrainingCycle().catch(err => console.error(`${LOG_PREFIX} Cycle failed:`, err));
  }, 15 * 60 * 1000);
}

export function stopContinuousAGITraining() {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
    console.log(`${LOG_PREFIX} Continuous AGI measurement stopped`);
  }
}
