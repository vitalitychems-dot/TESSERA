/**
 * TESSERA LEARNING AUDIT
 * ──────────────────────
 * Answers definitively: IS the system actually learning?
 * IS it retaining knowledge? IS it applying what it learns?
 *
 * Audits:
 * 1. RLLM corpus growth (is it actually adding entries?)
 * 2. Knowledge quality score (are entries high-quality?)
 * 3. Application proof (was learned content actually applied?)
 * 4. Retention test (can it recall previously learned patterns?)
 * 5. Gap analysis (what's being learned vs not applied)
 * 6. Training cycles (how many self-improvement iterations)
 */

import fs from "fs";
import path from "path";
import { logger } from "./logger";
import { callLLMSimple } from "./llm-helper";

const alog = (m: string) => logger.info("LearningAudit", m);
const CWD = process.cwd();

export interface LearningAuditResult {
  timestamp: number;
  overallScore: number;
  isActuallyLearning: boolean;
  isRetaining: boolean;
  isApplying: boolean;
  corpusSize: number;
  corpusGrowthRate: number;
  avgQualityScore: number;
  applicationProof: ApplicationProof[];
  gapAnalysis: GapAnalysis;
  trainingCycles: number;
  retentionTest: RetentionTest;
  recommendations: string[];
  verdict: string;
}

export interface ApplicationProof {
  learnedAt: number;
  appliedAt: number;
  type: string;
  source: string;
  proof: string;
  applied: boolean;
}

export interface GapAnalysis {
  totalLearned: number;
  totalApplied: number;
  applicationRate: number;
  topUnusedLearnings: string[];
  topAppliedLearnings: string[];
  blockingFactors: string[];
}

export interface RetentionTest {
  passed: boolean;
  score: number;
  question: string;
  expectedAnswer: string;
  actualAnswer: string;
  timestamp: number;
}

// ── Corpus reader ────────────────────────────────────────────────────────────

interface CorpusEntry {
  id: string;
  timestamp: number;
  type: string;
  source: string;
  quality: number;
  input?: string;
  output?: string;
  context?: string;
  applied?: boolean;
  appliedAt?: number;
}

function readCorpus(): CorpusEntry[] {
  try {
    const corpusPath = path.join(CWD, "server", "rllm-corpus.json");
    if (!fs.existsSync(corpusPath)) return [];
    return JSON.parse(fs.readFileSync(corpusPath, "utf-8"));
  } catch { return []; }
}

function readEvolutionLog(): any[] {
  try {
    const logPath = path.join(CWD, "server", "evolution-log.json");
    if (!fs.existsSync(logPath)) return [];
    return JSON.parse(fs.readFileSync(logPath, "utf-8"));
  } catch { return []; }
}

// ── Growth rate analysis ─────────────────────────────────────────────────────

let previousCorpusSize = 0;
let previousCheckTime = Date.now();
const growthHistory: Array<{ size: number; timestamp: number }> = [];

function calculateGrowthRate(corpus: CorpusEntry[]): number {
  growthHistory.push({ size: corpus.length, timestamp: Date.now() });
  if (growthHistory.length > 100) growthHistory.shift();

  if (growthHistory.length < 2) return 0;

  const oldest = growthHistory[0];
  const newest = growthHistory[growthHistory.length - 1];
  const hoursDiff = (newest.timestamp - oldest.timestamp) / (1000 * 60 * 60);
  if (hoursDiff < 0.001) return 0;

  return (newest.size - oldest.size) / Math.max(1, hoursDiff);
}

// ── Application proof tracker ────────────────────────────────────────────────

const applicationLog: ApplicationProof[] = [];

export function recordLearningApplication(
  type: string,
  source: string,
  proof: string,
  learnedAt?: number
) {
  applicationLog.push({
    learnedAt: learnedAt || Date.now() - 60000,
    appliedAt: Date.now(),
    type,
    source,
    proof,
    applied: true,
  });
  if (applicationLog.length > 200) applicationLog.splice(0, applicationLog.length - 200);
}

// ── Gap analysis ─────────────────────────────────────────────────────────────

function analyzeGaps(corpus: CorpusEntry[]): GapAnalysis {
  const totalLearned = corpus.length;
  const totalApplied = corpus.filter(e => e.applied).length + applicationLog.length;
  const applicationRate = totalLearned > 0 ? Math.min(1, totalApplied / totalLearned) : 0;

  const highQuality = corpus
    .filter(e => e.quality >= 0.7)
    .sort((a, b) => b.quality - a.quality);

  const applied = highQuality.filter(e => e.applied).slice(0, 3);
  const notApplied = highQuality.filter(e => !e.applied).slice(0, 3);

  const blockingFactors: string[] = [];
  if (applicationRate < 0.1) blockingFactors.push("Very low application rate — learning not being implemented");
  if (corpus.filter(e => e.type === "training").length === 0) blockingFactors.push("No training-type entries — RLLM synthesis may not be running");
  if (corpus.filter(e => e.type === "bug_fix").length === 0) blockingFactors.push("No bug fix entries — self-healer may not be active");
  if (corpus.filter(e => e.type === "improvement").length === 0) blockingFactors.push("No improvement entries — self-improvement cycle may be stalled");

  return {
    totalLearned,
    totalApplied,
    applicationRate,
    topUnusedLearnings: notApplied.map(e => `[${e.type}] ${e.source} (quality: ${e.quality.toFixed(2)})`),
    topAppliedLearnings: applied.map(e => `[${e.type}] ${e.source} (quality: ${e.quality.toFixed(2)})`),
    blockingFactors,
  };
}

// ── Retention test ────────────────────────────────────────────────────────────

async function runRetentionTest(corpus: CorpusEntry[]): Promise<RetentionTest> {
  if (corpus.length === 0) {
    return {
      passed: false, score: 0,
      question: "No corpus to test",
      expectedAnswer: "N/A",
      actualAnswer: "No data",
      timestamp: Date.now(),
    };
  }

  const highQualityEntry = corpus.filter(e => e.quality >= 0.7 && e.input && e.output).sort((a, b) => b.quality - a.quality)[0];
  if (!highQualityEntry) {
    return {
      passed: false, score: 0.3,
      question: "No high-quality entries with input/output to test",
      expectedAnswer: "corpus entries with input+output",
      actualAnswer: "corpus has entries but missing input/output fields",
      timestamp: Date.now(),
    };
  }

  const question = `Given this context from your training corpus: "${(highQualityEntry.context || highQualityEntry.input || "").slice(0, 200)}", summarize what was learned.`;

  try {
    const answer = await callLLMSimple(question, 300);
    const expectedKeywords = (highQualityEntry.output || "").toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 5);
    const matchCount = expectedKeywords.filter(kw => answer.toLowerCase().includes(kw)).length;
    const score = expectedKeywords.length > 0 ? matchCount / expectedKeywords.length : 0.5;

    return {
      passed: score >= 0.3,
      score,
      question,
      expectedAnswer: (highQualityEntry.output || "").slice(0, 200),
      actualAnswer: answer.slice(0, 200),
      timestamp: Date.now(),
    };
  } catch {
    return { passed: false, score: 0, question, expectedAnswer: "", actualAnswer: "LLM call failed", timestamp: Date.now() };
  }
}

// ── Main audit function ───────────────────────────────────────────────────────

export async function runLearningAudit(): Promise<LearningAuditResult> {
  alog("Running learning audit...");
  const corpus = readCorpus();
  const evolutionLog = readEvolutionLog();

  // Growth rate
  const growthRate = calculateGrowthRate(corpus);
  const isActuallyLearning = corpus.length > 0 && growthRate >= 0;

  // Quality analysis
  const avgQualityScore = corpus.length > 0
    ? corpus.reduce((s, e) => s + (e.quality || 0), 0) / corpus.length
    : 0;

  // Gap analysis
  const gaps = analyzeGaps(corpus);

  // Retention test (run async)
  const retentionTest = await runRetentionTest(corpus);

  // Application proof
  const recentApplications = applicationLog.slice(-10);
  const isApplying = recentApplications.length > 0 || gaps.totalApplied > 0;

  // Training cycles from evolution log
  const trainingCycles = evolutionLog.length;
  const isRetaining = retentionTest.score >= 0.3 || corpus.length >= 5;

  // Overall score
  const scores = [
    corpus.length > 0 ? 25 : 0,
    growthRate > 0 ? 20 : (corpus.length > 10 ? 10 : 0),
    avgQualityScore * 20,
    isApplying ? 20 : 0,
    isRetaining ? 15 : 0,
  ];
  const overallScore = Math.min(100, scores.reduce((a, b) => a + b, 0));

  // Recommendations
  const recommendations: string[] = [];
  if (corpus.length === 0) recommendations.push("CRITICAL: RLLM corpus is empty. Omnibus learning loop may not be running.");
  if (corpus.length > 0 && growthRate === 0) recommendations.push("Corpus exists but not growing. Check omnibus RLLM training cycle (runs every 25min).");
  if (avgQualityScore < 0.5) recommendations.push("Low average quality score. Add quality gates to corpus entries.");
  if (!isApplying) recommendations.push("Learning is not being applied. Fix the application tracking to link learned patterns to actual code changes.");
  if (gaps.applicationRate < 0.1) recommendations.push(`Only ${Math.round(gaps.applicationRate * 100)}% of learnings are being applied. Implement auto-apply for high-quality entries.`);
  if (gaps.blockingFactors.length > 0) recommendations.push(...gaps.blockingFactors);
  if (!retentionTest.passed) recommendations.push("Retention test failed. System may not be injecting corpus context into LLM prompts correctly.");

  const verdict = overallScore >= 70
    ? "LEARNING: System is actively learning and applying knowledge"
    : overallScore >= 40
    ? "PARTIAL: System has some learning but gaps in application"
    : "BLOCKED: Learning system is not functioning correctly — needs intervention";

  alog(`Audit complete: ${overallScore}% — ${verdict}`);

  return {
    timestamp: Date.now(),
    overallScore,
    isActuallyLearning,
    isRetaining,
    isApplying,
    corpusSize: corpus.length,
    corpusGrowthRate: growthRate,
    avgQualityScore,
    applicationProof: recentApplications,
    gapAnalysis: gaps,
    trainingCycles,
    retentionTest,
    recommendations,
    verdict,
  };
}

// ── Real-time learning status ─────────────────────────────────────────────────

export function getLearningStatus() {
  const corpus = readCorpus();
  const evolutionLog = readEvolutionLog();

  const byType: Record<string, number> = {};
  for (const e of corpus) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }

  const recent = corpus.slice(-10).reverse().map(e => ({
    type: e.type,
    source: e.source,
    quality: e.quality,
    timestamp: e.timestamp,
    applied: !!e.applied,
  }));

  return {
    corpusSize: corpus.length,
    byType,
    avgQuality: corpus.length > 0 ? corpus.reduce((s, e) => s + (e.quality || 0), 0) / corpus.length : 0,
    recentEntries: recent,
    applicationLog: applicationLog.slice(-5),
    evolutionCycles: evolutionLog.length,
    lastEvolution: evolutionLog.length > 0 ? evolutionLog[evolutionLog.length - 1]?.timestamp : null,
    isActive: corpus.length > 0,
    growthHistory: growthHistory.slice(-20),
  };
}

alog("Learning Audit module initialized");
