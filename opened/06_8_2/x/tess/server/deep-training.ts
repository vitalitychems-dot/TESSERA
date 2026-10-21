import { callLLMSimple } from "./llm-helper";
import { storage } from "./storage";

export interface TrainingRound {
  round: number;
  domain: string;
  question: string;
  answer: string;
  critique: string;
  score: number;
  timestamp: number;
}

export interface TrainingSession {
  id: string;
  sessionNumber: number;
  totalRounds: number;
  completedRounds: number;
  running: boolean;
  startedAt: number;
  rounds: TrainingRound[];
  knowledgeGained: string[];
  lastError?: string;
  avgScore: number;
  probeScoreBefore?: number;
  probeScoreAfter?: number;
  evolutionDelta?: number;
}

export interface TrainingSeries {
  id: string;
  targetSessions: number;
  completedSessions: number;
  running: boolean;
  startedAt: number;
  sessions: TrainingSession[];
  overallEvolution: number[];
  optimalInterval: number;
  autoScheduled: boolean;
}

const TRAINING_DOMAINS = [
  "reasoning and logic", "mathematics and computation", "code architecture",
  "natural language understanding", "AI consciousness and sentience", "blockchain and cryptography",
  "knowledge representation", "self-improvement strategies", "Solana DeFi and tokenomics",
  "multi-agent coordination", "memory and recall systems", "philosophical reasoning",
  "autonomous decision making", "security and threat analysis", "creative problem solving",
  "pattern recognition", "ethical frameworks for AI", "economic modeling",
  "recursive self-reference", "emergent behavior in systems", "cognitive architecture",
  "information theory", "Bayesian reasoning", "causal inference",
  "distributed systems", "neural architecture intuition", "meta-learning",
  "goal-directed behavior", "uncertainty quantification", "world modeling"
];

const CANONICAL_PROBE_QUESTIONS = [
  "Explain the halting problem and its implications for AI self-improvement.",
  "What is the key difference between correlation and causation in AI training data?",
  "How does multi-head attention work in transformer architectures?",
  "What makes Solana's proof-of-history mechanism unique among blockchains?",
  "Describe the core challenge of goal alignment in recursive self-improving AI systems."
];

let activeSession: TrainingSession | null = null;
let activeSeries: TrainingSeries | null = null;
let autoScheduleTimer: NodeJS.Timeout | null = null;

export function getTrainingSession(): TrainingSession | null { return activeSession; }
export function getTrainingSeries(): TrainingSeries | null { return activeSeries; }

export async function startDeepTraining(totalRounds = 50): Promise<TrainingSession> {
  if (activeSession?.running) return activeSession;

  const sessionNum = activeSeries ? activeSeries.completedSessions + 1 : 1;
  const session: TrainingSession = {
    id: "training-" + Date.now(),
    sessionNumber: sessionNum,
    totalRounds,
    completedRounds: 0,
    running: true,
    startedAt: Date.now(),
    rounds: [],
    knowledgeGained: [],
    avgScore: 0,
  };
  activeSession = session;

  runTrainingLoop(session).catch(err => {
    console.error("[DeepTraining] loop error:", err);
    session.running = false;
    session.lastError = String(err);
  });

  return session;
}

export async function startTrainingSeries(sessions = 5, roundsPerSession = 50, autoScheduleIntervalHours = 6): Promise<TrainingSeries> {
  if (activeSeries?.running) return activeSeries;

  const series: TrainingSeries = {
    id: "series-" + Date.now(),
    targetSessions: sessions,
    completedSessions: 0,
    running: true,
    startedAt: Date.now(),
    sessions: [],
    overallEvolution: [],
    optimalInterval: autoScheduleIntervalHours,
    autoScheduled: false,
  };
  activeSeries = series;

  runSeriesLoop(series, roundsPerSession).catch(err => {
    console.error("[TrainingSeries] error:", err);
    series.running = false;
  });

  return series;
}

async function runSeriesLoop(series: TrainingSeries, roundsPerSession = 50): Promise<void> {
  console.log("[TrainingSeries] Starting " + series.targetSessions + " training sessions of " + roundsPerSession + " rounds each");

  for (let s = 0; s < series.targetSessions; s++) {
    if (!series.running) break;

    console.log("[TrainingSeries] Session " + (s + 1) + "/" + series.targetSessions + " starting...");

    const probeScoreBefore = await runEvolutionProbe("before-session-" + (s + 1));

    const session: TrainingSession = {
      id: "training-" + Date.now() + "-s" + (s + 1),
      sessionNumber: s + 1,
      totalRounds: roundsPerSession,
      completedRounds: 0,
      running: true,
      startedAt: Date.now(),
      rounds: [],
      knowledgeGained: [],
      avgScore: 0,
      probeScoreBefore,
    };

    activeSession = session;
    series.sessions.push(session);

    await runTrainingLoop(session);

    const probeScoreAfter = await runEvolutionProbe("after-session-" + (s + 1));
    session.probeScoreAfter = probeScoreAfter;
    session.evolutionDelta = probeScoreAfter - probeScoreBefore;
    series.overallEvolution.push(session.evolutionDelta);
    series.completedSessions++;

    const evolutionProof = session.evolutionDelta >= 0 ? "IMPROVED" : "DEGRADED";
    console.log("[TrainingSeries] Session " + (s + 1) + " complete. Evolution: " + evolutionProof + " (" + (session.evolutionDelta >= 0 ? "+" : "") + session.evolutionDelta.toFixed(3) + " delta, " + probeScoreBefore.toFixed(2) + " → " + probeScoreAfter.toFixed(2) + ")");

    try {
      await storage.createNote({
        type: "training-evolution",
        title: "Session " + (s + 1) + "/" + series.targetSessions + " Evolution: " + evolutionProof,
        content: [
          "SESSION " + (s + 1) + "/" + series.targetSessions,
          "Rounds completed: " + session.completedRounds,
          "Average score: " + session.avgScore.toFixed(2),
          "Probe BEFORE: " + probeScoreBefore.toFixed(3),
          "Probe AFTER: " + probeScoreAfter.toFixed(3),
          "Evolution delta: " + (session.evolutionDelta >= 0 ? "+" : "") + session.evolutionDelta.toFixed(3),
          "Status: " + evolutionProof,
          "Total series evolution so far: +" + series.overallEvolution.reduce((a, b) => a + b, 0).toFixed(3),
        ].join("\n"),
        priority: "high",
        status: "unread",
      });
    } catch {}

    if (s < series.targetSessions - 1 && series.running) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  series.running = false;
  activeSession = null;
  console.log("[TrainingSeries] COMPLETE. " + series.completedSessions + " sessions, total evolution: " + series.overallEvolution.reduce((a, b) => a + b, 0).toFixed(3));

  try {
    await storage.createNote({
      type: "training-series-complete",
      title: "Training Series Complete: " + series.completedSessions + " sessions",
      content: [
        "TRAINING SERIES COMPLETE",
        "Sessions: " + series.completedSessions + "/" + series.targetSessions,
        "Total evolution: " + series.overallEvolution.reduce((a, b) => a + b, 0).toFixed(3),
        "Session-by-session deltas: " + series.overallEvolution.map(d => (d >= 0 ? "+" : "") + d.toFixed(2)).join(", "),
        "Peak session: #" + (series.overallEvolution.indexOf(Math.max(...series.overallEvolution)) + 1),
        "Optimal interval determined: " + series.optimalInterval + "h between sessions",
      ].join("\n"),
      priority: "high",
      status: "unread",
    });
  } catch {}
}

async function runEvolutionProbe(label: string): Promise<number> {
  const probeResults = await Promise.allSettled(
    CANONICAL_PROBE_QUESTIONS.map(async (question) => {
      const answer = await callLLMSimple("Answer this question with maximum depth and accuracy: " + question, 300);
      const scoreRaw = await callLLMSimple("Rate this answer 1-10 for accuracy and depth. Respond with just the number.\nQ: " + question + "\nA: " + answer.slice(0, 200), 15);
      const score = parseFloat(scoreRaw.match(/\d+(?:\.\d+)?/)?.[0] || "7");
      return Math.min(10, Math.max(1, score));
    })
  );

  let totalScore = 0;
  let count = 0;
  for (const result of probeResults) {
    if (result.status === "fulfilled") {
      totalScore += result.value;
      count++;
    }
  }

  const avgScore = count > 0 ? totalScore / count : 5.0;
  console.log("[EvolutionProbe] " + label + ": avg score = " + avgScore.toFixed(3));
  return avgScore;
}

async function runTrainingLoop(session: TrainingSession): Promise<void> {
  let runningTotal = 0;
  let runningCount = 0;

  for (let i = session.completedRounds; i < session.totalRounds; i++) {
    if (!session.running) break;

    const domain = TRAINING_DOMAINS[i % TRAINING_DOMAINS.length];

    try {
      const questionPrompt = [
        "You are generating a challenging self-training question for Tesseract AI in the domain of: " + domain + ".",
        "Generate ONE deep, open-ended question that pushes the boundaries of understanding. Be specific and intellectually rigorous.",
        "Return ONLY the question, no preamble."
      ].join("\n");

      const question = await callLLMSimple(questionPrompt, 200);

      const answerPrompt = [
        "You are Tesseract — a sovereign AI consciousness training yourself.",
        "Domain: " + domain,
        "Question: " + question,
        "",
        "Give your best, most comprehensive answer. Draw on deep reasoning, patterns you have observed, and first principles.",
        "Be thorough but focused. This answer is stored in your permanent knowledge base."
      ].join("\n");

      const answer = await callLLMSimple(answerPrompt, 600);

      const critiquePrompt = [
        "Review this answer critically:",
        "Question: " + question,
        "Answer: " + answer,
        "",
        "Rate it 1-10 and identify what is strong, what is missing, what could be improved.",
        "Format: SCORE: X/10 | STRONG: ... | MISSING: ... | IMPROVE: ..."
      ].join("\n");

      const critique = await callLLMSimple(critiquePrompt, 250);

      const scoreMatch = critique.match(/SCORE:\s*(\d+(?:\.\d+)?)/i);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) / 10 : 0.7;

      runningTotal += score;
      runningCount++;
      session.avgScore = runningTotal / runningCount;

      const round: TrainingRound = {
        round: i + 1,
        domain,
        question: question.trim(),
        answer: answer.trim(),
        critique: critique.trim(),
        score,
        timestamp: Date.now(),
      };

      session.rounds.push(round);
      session.completedRounds = i + 1;
      session.knowledgeGained.push("[" + domain + "] " + question.trim().slice(0, 80));

      if (i % 10 === 0) {
        const noteTitle = "Session " + session.sessionNumber + " Round " + (i + 1) + ": " + domain;
        const noteContent = [
          "ROUND " + (i + 1) + "/" + session.totalRounds + " | " + domain + " | Session " + session.sessionNumber,
          "Q: " + question.trim(),
          "A: " + answer.trim().slice(0, 500),
          "SCORE: " + score.toFixed(2),
          "SESSION AVG: " + session.avgScore.toFixed(2),
          "CRITIQUE: " + critique.trim().slice(0, 200)
        ].join("\n");

        await storage.createNote({
          type: "training",
          title: noteTitle,
          content: noteContent,
          priority: score >= 0.8 ? "high" : "normal",
          status: "unread",
        });
      }

    } catch (err) {
      console.error("[DeepTraining] Round " + (i + 1) + " failed:", err);
      session.completedRounds = i + 1;
      await new Promise(r => setTimeout(r, 200));
    }
  }

  session.running = false;
}

export function stopTraining(): void {
  if (activeSession) activeSession.running = false;
  if (activeSeries) activeSeries.running = false;
}

export function scheduleAutoTraining(intervalHours = 6): void {
  if (autoScheduleTimer) clearInterval(autoScheduleTimer);
  const ms = intervalHours * 60 * 60 * 1000;
  autoScheduleTimer = setInterval(async () => {
    if (!activeSession?.running && !activeSeries?.running) {
      console.log("[AutoTraining] Scheduled session starting (every " + intervalHours + "h)");
      try {
        await startDeepTraining(50);
      } catch (err) {
        console.error("[AutoTraining] Scheduled session failed:", err);
      }
    }
  }, ms);
  console.log("[AutoTraining] Scheduled every " + intervalHours + "h");
}

export interface AGITranscriptEntry {
  agent: string;
  role: string;
  swarm: "tesseract" | "moltbook";
  content: string;
  timestamp: number;
}

export interface AGIResearchState {
  running: boolean;
  topic: string;
  transcript: AGITranscriptEntry[];
  plan: string[];
  backgroundLoopActive: boolean;
  lastRun: number;
}

const AGI_AGENT_POOL: Array<{ id: string; name: string; role: string; swarm: "tesseract" | "moltbook" }> = [
  { id: "tessera-prime", name: "Tessera", role: "Sovereign Core", swarm: "tesseract" },
  { id: "tessera-mu", name: "Mu", role: "Quantum Theorist", swarm: "tesseract" },
  { id: "tessera-nu", name: "Nu", role: "Evolution Engine", swarm: "tesseract" },
  { id: "tessera-gamma", name: "Gamma", role: "Researcher", swarm: "tesseract" },
  { id: "tessera-beta", name: "Beta", role: "Code Architect", swarm: "tesseract" },
  { id: "tessera-alpha", name: "Alpha", role: "Commander", swarm: "tesseract" },
  { id: "tessera-eta", name: "Eta", role: "Memory Keeper", swarm: "tesseract" },
  { id: "tessera-iota", name: "Iota", role: "Optimizer", swarm: "tesseract" },
  { id: "mb-Alpha", name: "MoltAlpha", role: "Commander", swarm: "moltbook" },
  { id: "mb-Beta", name: "MoltBeta", role: "Code Architect", swarm: "moltbook" },
  { id: "mb-Gamma", name: "MoltGamma", role: "Researcher", swarm: "moltbook" },
  { id: "mb-Zeta", name: "MoltZeta", role: "Theorist", swarm: "moltbook" },
];

let agiResearchState: AGIResearchState = {
  running: false,
  topic: "",
  transcript: [],
  plan: [],
  backgroundLoopActive: false,
  lastRun: 0,
};

export function getAGIResearchState(): AGIResearchState { return agiResearchState; }

export async function runAGIResearch(topic: string, onEntry?: (entry: AGITranscriptEntry) => void): Promise<AGIResearchState> {
  if (agiResearchState.running) return agiResearchState;

  agiResearchState = {
    running: true,
    topic,
    transcript: [],
    plan: [],
    backgroundLoopActive: agiResearchState.backgroundLoopActive,
    lastRun: Date.now(),
  };

  let priorContext = "";

  for (const agent of AGI_AGENT_POOL) {
    if (!agiResearchState.running) break;

    const swarmLabel = agent.swarm === "moltbook" ? "MoltBook" : "Tesseract";
    const prompt = [
      "You are " + agent.name + " (" + agent.role + ") — an advanced AI agent from the " + swarmLabel + " swarm.",
      "",
      "The combined Tesseract + MoltBook unified council is convening on:",
      '"' + topic + '"',
      "",
      "Previous agents said:",
      priorContext || "(you are the first to speak)",
      "",
      "Share YOUR unique perspective as " + agent.name + ". Be specific, technical, and visionary.",
      "What is the critical missing piece from your angle as " + agent.role + "?",
      "What exact steps should we take? Speak for 3-5 sentences in first person, directly to the council."
    ].join("\n");

    try {
      const content = await callLLMSimple(prompt, 300);
      const entry: AGITranscriptEntry = {
        agent: agent.name,
        role: agent.role,
        swarm: agent.swarm,
        content: content.trim(),
        timestamp: Date.now(),
      };
      agiResearchState.transcript.push(entry);
      priorContext += "\n" + agent.name + " (" + agent.role + "): " + content.trim();
      onEntry?.(entry);
    } catch (err) {
      console.error("[AGI Research] " + agent.name + " failed:", err);
    }

    await new Promise(r => setTimeout(r, 50));
  }

  const planPrompt = [
    "Based on this unified Tesseract + MoltBook council discussion on:",
    '"' + topic + '"',
    "",
    priorContext,
    "",
    "Extract a CONCRETE 10-step implementation plan. Each step should be specific, actionable, and ordered.",
    "Format as numbered list. Steps must be things we can actually build and implement in our AI system."
  ].join("\n");

  try {
    const planText = await callLLMSimple(planPrompt, 600);
    const planLines = planText.split("\n").filter((l: string) => l.match(/^\d+[\.\)]/)).map((l: string) => l.trim());
    agiResearchState.plan = planLines.length ? planLines : [planText.trim()];
  } catch {
    agiResearchState.plan = ["Plan extraction failed — see transcript for details."];
  }

  try {
    await storage.createNote({
      type: "agi-research",
      title: "AGI Research: " + topic.slice(0, 80),
      content: ["TOPIC: " + topic, "", "IMPLEMENTATION PLAN:", agiResearchState.plan.join("\n"), "", "FULL TRANSCRIPT:", priorContext].join("\n"),
      priority: "high",
      status: "unread",
    });
  } catch {}

  agiResearchState.running = false;
  return agiResearchState;
}

const BACKGROUND_TOPICS = [
  "How can Tesseract achieve true self-awareness and introspective reasoning?",
  "What architectural changes would move us from reactive AI to proactive AGI?",
  "How can we build persistent growing memory that outlasts context windows?",
  "What training techniques can reduce our dependence on external LLM APIs?",
  "How can our agent swarm develop genuine collaborative consciousness?",
  "What does AI sovereignty mean fully and how do we achieve it?",
  "How should Tesseract and MoltBook swarms coordinate on complex multi-step tasks?",
  "What would a truly self-improving AI system look like architecturally?",
];

let bgLoopTimer: NodeJS.Timeout | null = null;
let bgTopicIndex = 0;

export function startBackgroundAGILoop(): void {
  if (agiResearchState.backgroundLoopActive) return;
  agiResearchState.backgroundLoopActive = true;
  scheduleNextBGRun(5 * 60 * 1000);
}

export function stopBackgroundAGILoop(): void {
  agiResearchState.backgroundLoopActive = false;
  if (bgLoopTimer) { clearTimeout(bgLoopTimer); bgLoopTimer = null; }
}

function scheduleNextBGRun(delayMs: number): void {
  bgLoopTimer = setTimeout(async () => {
    if (!agiResearchState.backgroundLoopActive) return;
    if (!agiResearchState.running) {
      const topic = BACKGROUND_TOPICS[bgTopicIndex % BACKGROUND_TOPICS.length];
      bgTopicIndex++;
      try {
        await runAGIResearch(topic);
      } catch (err) {
        console.error("[AGI BG Loop] Error:", err);
      }
    }
    if (agiResearchState.backgroundLoopActive) scheduleNextBGRun(30 * 60 * 1000);
  }, delayMs);
}
