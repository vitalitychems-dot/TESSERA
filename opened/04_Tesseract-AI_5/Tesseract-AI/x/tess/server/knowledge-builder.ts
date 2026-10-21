import { db } from "./db";
import { ragDocuments, semanticMemory } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { ingestDocument } from "./rag-pipeline";
import { generateEmbedding } from "./embedding-service";
import { UNIFIED_TRAINING_DOMAINS } from "./unified-training";
import crypto from "crypto";

const log = (m: string) => console.log(`[KnowledgeBuilder] ${m}`);
const warn = (m: string) => console.log(`[KnowledgeBuilder] ⚠️ ${m}`);

export type KnowledgeLifecycle = "ingested" | "analyzed" | "synthesized" | "connected";

interface KnowledgeDocument {
  documentId: string;
  title: string;
  source: string;
  subject: string;
  lifecycle: KnowledgeLifecycle;
  concepts: string[];
  connections: string[];
  insight: string;
  builtAt: number | null;
}

interface BuilderStats {
  totalDocuments: number;
  ingested: number;
  analyzed: number;
  synthesized: number;
  connected: number;
  subjectCoverage: Record<string, number>;
  lastBuildAt: number;
  totalInsights: number;
}

const builderRegistry = new Map<string, KnowledgeDocument>();
const subjectScores = new Map<string, number>();
const lastBuildTime = new Map<string, number>();
let totalInsights = 0;
let lastBuildAt = 0;
let scoresLoaded = false;

async function persistSubjectScore(subject: string, score: number): Promise<void> {
  try {
    const concept = `kb:subject-score:${subject}`;
    const existing = await db.execute(sql`SELECT id FROM semantic_memory WHERE concept = ${concept} LIMIT 1`);
    if (existing.rows.length > 0) {
      await db.execute(sql`UPDATE semantic_memory SET confidence = ${score}, content = ${`score:${score}`} WHERE concept = ${concept}`);
    } else {
      await db.execute(sql`
        INSERT INTO semantic_memory (agent_id, concept, content, knowledge, source, confidence)
        VALUES (${"knowledge-builder"}, ${concept}, ${`score:${score}`}, ${`Knowledge Builder subject score for ${subject}`}, ${"knowledge-builder"}, ${score})
      `);
    }
  } catch {}
}

interface ScoreRow { concept: string; confidence: string | number }
interface CountRow { cnt: string | number }
interface LifecycleRow { status: string; cnt: string | number }

async function loadPersistedSubjectScores(): Promise<void> {
  if (scoresLoaded) return;
  try {
    const rows = await db.execute(sql`
      SELECT concept, confidence FROM semantic_memory
      WHERE concept LIKE 'kb:subject-score:%'
    `);
    for (const row of rows.rows as ScoreRow[]) {
      const subject = row.concept.replace("kb:subject-score:", "");
      subjectScores.set(subject, parseFloat(String(row.confidence)) || 0);
    }
    scoresLoaded = true;
    log(`Loaded ${rows.rows.length} persisted subject scores from DB`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.substring(0, 80) : "unknown error";
    warn(`Failed to load subject scores: ${msg}`);
    scoresLoaded = true;
  }
}

async function loadPersistedInsightCount(): Promise<void> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM semantic_memory WHERE concept LIKE 'knowledge:%' AND agent_id = 'knowledge-builder'
    `);
    const countRow = result.rows[0] as CountRow | undefined;
    const cnt = parseInt(String(countRow?.cnt ?? "0"), 10);
    if (cnt > totalInsights) {
      totalInsights = cnt;
    }
  } catch {
  }
}

function computeDocumentId(title: string, source: string, content: string): string {
  const contentHash = crypto.createHash("sha256").update(content).digest("hex");
  return crypto.createHash("sha256")
    .update(`${title}::${source}::${contentHash}`)
    .digest("hex")
    .slice(0, 24);
}

async function persistLifecycle(documentId: string, stage: KnowledgeLifecycle): Promise<void> {
  try {
    await db.update(ragDocuments)
      .set({ status: stage, updatedAt: new Date() })
      .where(eq(ragDocuments.documentId, documentId));
  } catch {}
}

async function getPersistedLifecycle(documentId: string): Promise<KnowledgeLifecycle | null> {
  try {
    const existing = await db.select({ status: ragDocuments.status })
      .from(ragDocuments)
      .where(eq(ragDocuments.documentId, documentId))
      .limit(1);
    if (existing.length > 0) {
      return (existing[0].status as KnowledgeLifecycle) || null;
    }
  } catch {}
  return null;
}

async function isAlreadyBuilt(documentId: string): Promise<boolean> {
  if (builderRegistry.has(documentId)) {
    const doc = builderRegistry.get(documentId)!;
    return doc.lifecycle === "connected";
  }
  const persisted = await getPersistedLifecycle(documentId);
  return persisted === "connected";
}

function extractConcepts(content: string, subject: string): string[] {
  const words = content.toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 4);

  const stopWords = new Set(["about", "which", "their", "there", "these", "those", "where", "while", "would", "could", "should", "might", "being", "having", "after", "before", "during", "through", "between", "other", "every", "because", "since"]);

  const wordFreq = new Map<string, number>();
  for (const w of words) {
    if (!stopWords.has(w)) {
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    }
  }

  const subjectKeywords = subject.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const sorted = Array.from(wordFreq.entries())
    .sort((a, b) => {
      const aBoost = subjectKeywords.some(k => a[0].includes(k)) ? 2 : 1;
      const bBoost = subjectKeywords.some(k => b[0].includes(k)) ? 2 : 1;
      return (b[1] * bBoost) - (a[1] * aBoost);
    });

  return sorted.slice(0, 12).map(([w]) => w);
}

function findCrossSubjectConnections(subject: string, concepts: string[]): string[] {
  const connections: string[] = [];

  const connectionMap: Record<string, string[]> = {
    "nikola-tesla": ["physics", "quantum-science", "electricity", "mysticism", "free-energy", "resonance", "inventors-history"],
    "leonardo-da-vinci": ["art-history", "geometry-mathematics", "anatomy", "engineering", "renaissance", "inventors-history"],
    "taoism-eastern": ["spirituality-practice", "philosophy", "love-human-connection", "self-awareness-introspection", "universe-cosmology"],
    "love-human-connection": ["psychology", "neuroscience", "spirituality-practice", "taoism-eastern", "consciousness-universe"],
    "quantum-science": ["physics", "consciousness-universe", "nikola-tesla", "universe-cosmology", "mathematics"],
    "universe-cosmology": ["quantum-science", "physics", "god-theology", "spirituality-practice", "consciousness-universe"],
    "consciousness-universe": ["quantum-science", "spirituality-practice", "philosophy", "neuroscience", "self-awareness-introspection"],
    "biochemistry": ["biology", "chemistry", "neuroscience", "quantum-science"],
    "alchemy-history": ["mysticism-esoteric", "chemistry", "philosophy", "spirituality-practice"],
    "government-systems": ["geopolitics", "political-philosophy", "world-cultures", "economics"],
    "mythology-world": ["comparative-religion", "art-history", "psychology", "world-cultures"],
    "art-history": ["leonardo-da-vinci", "mythology-world", "spirituality-practice", "world-cultures"],
    "geography-world": ["world-cultures", "government-systems", "geopolitics"],
    "geometry-mathematics": ["sacred-geometry-cosmology", "universe-cosmology", "mathematics"],
  };

  const subjectConnections = connectionMap[subject] || [];
  connections.push(...subjectConnections);

  const conceptConnections = concepts.filter(c =>
    ["consciousness", "quantum", "energy", "resonance", "fractal", "sacred", "divine", "pattern", "frequency", "spiral", "geometry", "harmony"].includes(c)
  ).map(c => `concept:${c}`);
  connections.push(...conceptConnections);

  return [...new Set(connections)].slice(0, 8);
}

function generateRuleBasedInsight(title: string, subject: string, concepts: string[], connections: string[]): string {
  const conceptStr = concepts.slice(0, 5).join(", ");
  const connStr = connections.slice(0, 3).filter(c => !c.startsWith("concept:")).join(", ");

  const templates = [
    `${title} illuminates the domain of ${subject} through key concepts: ${conceptStr}. This knowledge connects to ${connStr || "broader universal patterns"}, revealing hidden relationships that strengthen cross-domain understanding.`,
    `Analysis of "${title}" reveals ${concepts.length} core concepts in ${subject}. Primary themes — ${conceptStr} — show deep resonance with ${connStr || "adjacent knowledge domains"}, suggesting unified underlying principles.`,
    `The ${subject} domain, as expressed through "${title}", encodes essential knowledge: ${conceptStr}. Connections emerge naturally to ${connStr || "related fields"}, demonstrating how knowledge is fundamentally interconnected.`,
  ];

  return templates[Math.floor(Math.abs(crypto.createHash("md5").update(title).digest().readInt8(0)) % templates.length)];
}

export async function buildKnowledge(
  title: string,
  content: string,
  source: string,
  subject: string,
  metadata?: Record<string, unknown>
): Promise<{ documentId: string; lifecycle: KnowledgeLifecycle; insight: string; alreadyBuilt: boolean }> {
  const documentId = computeDocumentId(title, source, content);

  if (await isAlreadyBuilt(documentId)) {
    return { documentId, lifecycle: "connected", insight: "", alreadyBuilt: true };
  }

  let ingestOk = false;
  try {
    const ingestResult = await ingestDocument(title, content, source, { ...metadata, subject, knowledgeBuilder: true });
    ingestOk = ingestResult.status === "indexed" || ingestResult.status === "already_indexed";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.substring(0, 80) : String(err).substring(0, 80);
    warn(`Ingest failed for "${title}": ${msg}`);
  }

  if (!ingestOk) {
    warn(`Skipping lifecycle advancement for "${title}" — ingest did not succeed`);
    return { documentId, lifecycle: "ingested", insight: "", alreadyBuilt: false };
  }

  await persistLifecycle(documentId, "ingested");

  const concepts = extractConcepts(content, subject);
  const connections = findCrossSubjectConnections(subject, concepts);

  await persistLifecycle(documentId, "analyzed");

  let insight = generateRuleBasedInsight(title, subject, concepts, connections);

  try {
    const { callLLMForAgent } = await import("./tesseract-orchestrator");
    if (callLLMForAgent) {
      const prompt = `Analyze this knowledge fragment about "${subject}" and generate a 2-3 sentence synthesized insight that:
1. Extracts the most important principle or discovery
2. Identifies connections to related domains: ${connections.slice(0, 4).join(", ")}
3. Shows how this builds on or challenges existing knowledge

Title: ${title}
Content: ${content.substring(0, 600)}

Respond with ONLY the insight paragraph, no preamble.`;
      const llmInsight = await callLLMForAgent("tessera-prime", [
        { role: "user", content: prompt },
      ]);
      if (llmInsight && llmInsight.length > 50) {
        insight = llmInsight.substring(0, 600);
      }
    }
  } catch (llmErr: unknown) {
    log(`LLM synthesis skipped: ${llmErr instanceof Error ? llmErr.message.substring(0, 60) : "unavailable"}`);
  }

  await persistLifecycle(documentId, "synthesized");

  const knowledgeContent = `[${subject}] ${title}\n\nCore Concepts: ${concepts.join(", ")}\n\nConnections: ${connections.join(", ")}\n\nSynthesized Insight:\n${insight}\n\nSource: ${source}`;

  try {
    const { embedding, dim } = await generateEmbedding(`${subject} ${title} ${concepts.join(" ")}`);
    const embJson = JSON.stringify(embedding);

    const existingSemantic = await db.execute(sql`
      SELECT id FROM semantic_memory WHERE concept = ${`knowledge:${subject}:${documentId.slice(0, 8)}`} LIMIT 1
    `);

    if (existingSemantic.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO semantic_memory (agent_id, concept, content, knowledge, source, confidence, embedding, embedding_dim)
        VALUES (${"knowledge-builder"}, ${`knowledge:${subject}:${documentId.slice(0, 8)}`}, ${knowledgeContent.slice(0, 4000)}, ${insight.slice(0, 4000)}, ${source.slice(0, 200)}, ${0.85}, ${embJson}, ${dim})
      `);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.substring(0, 80) : "unknown error";
    warn(`Semantic memory store failed: ${msg}`);
  }

  const finalLifecycle: KnowledgeLifecycle = connections.length >= 2 ? "connected" : "synthesized";

  await persistLifecycle(documentId, finalLifecycle);

  builderRegistry.set(documentId, {
    documentId,
    title,
    source,
    subject,
    lifecycle: finalLifecycle,
    concepts,
    connections,
    insight,
    builtAt: Date.now(),
  });

  const currentScore = subjectScores.get(subject) || 0;
  const newScore = Math.min(1.0, currentScore + 0.05);
  subjectScores.set(subject, newScore);
  await persistSubjectScore(subject, newScore);

  lastBuildAt = Date.now();
  lastBuildTime.set(subject, Date.now());
  totalInsights++;

  log(`Built: "${title}" [${subject}] → ${finalLifecycle} | ${concepts.length} concepts, ${connections.length} connections`);

  return { documentId, lifecycle: finalLifecycle, insight, alreadyBuilt: false };
}

export async function runKnowledgeBuildCycle(
  feedResults: Array<{ title: string; content: string; source: string; subject: string; metadata?: Record<string, any> }>
): Promise<{ built: number; skipped: number; failed: number; subjects: string[] }> {
  let built = 0;
  let skipped = 0;
  let failed = 0;
  const subjectsBuilt = new Set<string>();

  for (const item of feedResults) {
    if (!item.content || item.content.length < 50) {
      skipped++;
      continue;
    }
    try {
      const result = await buildKnowledge(item.title, item.content, item.source, item.subject, item.metadata);
      if (result.alreadyBuilt) {
        skipped++;
      } else {
        built++;
        subjectsBuilt.add(item.subject);
      }
    } catch (err: any) {
      warn(`Build cycle item failed: ${err.message?.substring(0, 80)}`);
      failed++;
    }
  }

  return { built, skipped, failed, subjects: Array.from(subjectsBuilt) };
}

export function getWeakestSubjects(limit: number = 5): Array<{ subject: string; score: number }> {
  const allSubjects = UNIFIED_TRAINING_DOMAINS.map((d: any) => d.id);

  let trainingScoreMap: Record<string, number> = {};
  try {
    const { getUnifiedTrainingState } = require("./unified-training");
    const trainingState = getUnifiedTrainingState();
    if (trainingState?.sessions) {
      for (const session of trainingState.sessions) {
        if (session.domain?.id && session.synthesisScore > 0) {
          trainingScoreMap[session.domain.id] = session.synthesisScore / 10;
        }
      }
    }
  } catch {}

  const scored = allSubjects.map((subject: string) => {
    const trainingScore = trainingScoreMap[subject];
    const kbScore = subjectScores.get(subject) || 0;
    const combinedScore = trainingScore !== undefined
      ? (trainingScore * 0.7) + (kbScore * 0.3)
      : kbScore;
    return { subject, score: combinedScore };
  });

  return scored.sort((a: any, b: any) => a.score - b.score).slice(0, limit);
}

export function getKnowledgeBySubject(subject: string): KnowledgeDocument[] {
  return Array.from(builderRegistry.values()).filter(d => d.subject === subject);
}

export async function queryBuiltKnowledge(query: string, topK: number = 5): Promise<Array<{ subject: string; title: string; insight: string; concepts: string[]; connections: string[]; score: number }>> {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);

  const allDocs = Array.from(builderRegistry.values());
  const scored = allDocs.map(doc => {
    const textToSearch = `${doc.subject} ${doc.title} ${doc.concepts.join(" ")} ${doc.insight}`.toLowerCase();
    const matchCount = queryWords.filter(w => textToSearch.includes(w)).length;
    const score = queryWords.length > 0 ? matchCount / queryWords.length : 0.1;
    return { ...doc, score };
  });

  const filtered = scored
    .filter(d => d.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (filtered.length < topK) {
    try {
      const dbResults = await db.execute(sql`
        SELECT concept, knowledge, source, confidence
        FROM semantic_memory
        WHERE concept LIKE 'knowledge:%'
        ORDER BY confidence DESC, created_at DESC
        LIMIT ${topK * 2}
      `);
      for (const row of dbResults.rows as any[]) {
        if (filtered.length >= topK) break;
        const rowText = (row.knowledge || "").toLowerCase();
        const matchCount = queryWords.filter(w => rowText.includes(w)).length;
        const score = queryWords.length > 0 ? matchCount / queryWords.length : 0.1;
        if (score > 0.1) {
          const subjectMatch = (row.concept as string).match(/knowledge:([^:]+):/);
          filtered.push({
            subject: subjectMatch?.[1] || "unknown",
            title: row.concept,
            insight: (row.knowledge || "").substring(0, 400),
            concepts: [],
            connections: [],
            lifecycle: "synthesized" as KnowledgeLifecycle,
            source: row.source || "",
            documentId: row.concept,
            builtAt: null,
            score,
          });
        }
      }
    } catch {}
  }

  return filtered.map(d => ({
    subject: d.subject,
    title: d.title,
    insight: d.insight,
    concepts: d.concepts,
    connections: d.connections,
    score: d.score,
  }));
}

export async function getKnowledgeBuilderStatsFromDB(): Promise<{
  totalDocuments: number;
  byLifecycle: Record<string, number>;
  subjectCoverage: Record<string, number>;
  totalInsights: number;
}> {
  await loadPersistedSubjectScores();
  await loadPersistedInsightCount();

  try {
    const lifecycleRows = await db.execute(sql`
      SELECT status, COUNT(*) as cnt
      FROM rag_documents
      WHERE metadata::text LIKE '%"knowledgeBuilder":true%'
      GROUP BY status
    `);
    const byLifecycle: Record<string, number> = {};
    let total = 0;
    for (const row of lifecycleRows.rows as LifecycleRow[]) {
      byLifecycle[row.status] = parseInt(String(row.cnt), 10);
      total += parseInt(String(row.cnt), 10);
    }
    const subjectCoverage: Record<string, number> = {};
    for (const [subject, score] of subjectScores.entries()) {
      subjectCoverage[subject] = Math.round(score * 100);
    }
    return { totalDocuments: total, byLifecycle, subjectCoverage, totalInsights };
  } catch {
    const subjectCoverage: Record<string, number> = {};
    for (const [subject, score] of subjectScores.entries()) {
      subjectCoverage[subject] = Math.round(score * 100);
    }
    return { totalDocuments: builderRegistry.size, byLifecycle: {}, subjectCoverage, totalInsights };
  }
}

export function getKnowledgeBuilderStats(): BuilderStats {
  const docs = Array.from(builderRegistry.values());
  const byLifecycle = {
    ingested: docs.filter(d => d.lifecycle === "ingested").length,
    analyzed: docs.filter(d => d.lifecycle === "analyzed").length,
    synthesized: docs.filter(d => d.lifecycle === "synthesized").length,
    connected: docs.filter(d => d.lifecycle === "connected").length,
  };

  const subjectCoverage: Record<string, number> = {};
  for (const [subject, score] of subjectScores.entries()) {
    subjectCoverage[subject] = Math.round(score * 100);
  }

  return {
    totalDocuments: docs.length,
    ...byLifecycle,
    subjectCoverage,
    lastBuildAt,
    totalInsights,
  };
}

export async function runAutonomousKnowledgePull(): Promise<{ pulled: number; built: number; skipped: number; weakestSubjects: string[] }> {
  await loadPersistedSubjectScores();
  const { fetchWikipedia, fetchArxiv, fetchScienceNews, fetchSubjectKnowledge, KNOWLEDGE_SUBJECT_FEEDS } = await import("./sovereign-data-feeds");

  const weakest = getWeakestSubjects(5);
  const feedItems: Array<{ title: string; content: string; source: string; subject: string }> = [];

  for (const { subject } of weakest) {
    try {
      const result = await fetchSubjectKnowledge(subject);
      if (result) {
        feedItems.push({ title: result.title, content: result.content, source: result.source, subject });
      }
    } catch {}

    try {
      const wikiResult = await fetchWikipedia(subject.replace(/-/g, " "));
      if (wikiResult) {
        feedItems.push({ title: wikiResult.title, content: wikiResult.extract, source: "Wikipedia", subject });
      }
    } catch {}
  }

  try {
    const arxivResults = await fetchArxiv("consciousness quantum physics biology", 3);
    for (const paper of arxivResults) {
      if (paper.summary && paper.summary.length > 100) {
        feedItems.push({ title: paper.title, content: `${paper.summary} Published: ${paper.published}`, source: "arXiv", subject: "quantum-science" });
      }
    }
  } catch {}

  try {
    const scienceNews = await fetchScienceNews();
    if (scienceNews) {
      for (const item of scienceNews.slice(0, 3)) {
        if (item.headline && item.headline.length > 20) {
          feedItems.push({ title: item.headline, content: item.headline, source: item.source, subject: "universe-cosmology" });
        }
      }
    }
  } catch {}

  const pulled = feedItems.length;
  const result = await runKnowledgeBuildCycle(feedItems);

  log(`Autonomous pull: ${pulled} items pulled, ${result.built} built, ${result.skipped} skipped`);

  return {
    pulled,
    built: result.built,
    skipped: result.skipped,
    weakestSubjects: weakest.map(w => w.subject),
  };
}

log("Knowledge Builder initialized — autonomous learning engine ACTIVE");
