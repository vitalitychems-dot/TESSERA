import { Router } from "express";
import { pool } from "../db";

const router = Router();

// ── In-memory stores ──────────────────────────────────────────────────────────

interface FeedbackEntry {
  id: string;
  text: string;
  category: string;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  tags: string[];
  submittedAt: number;
  source: string;
}

interface TransparencyEntry {
  id: string;
  timestamp: number;
  module: string;
  decision: string;
  rationale: string;
  confidence: number;
  inputs: string[];
  outcome: string;
  category: string;
}

interface ForumThread {
  id: string;
  title: string;
  content: string;
  author: string;
  category: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  views: number;
  replies: ForumReply[];
  pinned: boolean;
  solved: boolean;
}

interface ForumReply {
  id: string;
  threadId: string;
  content: string;
  author: string;
  createdAt: number;
  upvotes: number;
  isBestAnswer: boolean;
}

interface DocEntry {
  id: string;
  title: string;
  content: string;
  module: string;
  tags: string[];
  updatedAt: number;
  views: number;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Sentiment analysis ────────────────────────────────────────────────────────

const POSITIVE_WORDS = ["great", "awesome", "love", "excellent", "good", "fantastic", "amazing", "helpful", "fast", "works", "perfect", "brilliant", "outstanding", "wonderful"];
const NEGATIVE_WORDS = ["bad", "broken", "slow", "error", "fail", "issue", "problem", "wrong", "crash", "bug", "terrible", "awful", "poor", "useless", "frustrating"];

function analyzeSentiment(text: string): { sentiment: "positive" | "neutral" | "negative"; score: number; tags: string[] } {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/);
  let posCount = 0;
  let negCount = 0;
  const tags: string[] = [];

  for (const w of words) {
    if (POSITIVE_WORDS.includes(w)) posCount++;
    if (NEGATIVE_WORDS.includes(w)) negCount++;
  }

  if (lower.includes("performance") || lower.includes("speed") || lower.includes("slow")) tags.push("performance");
  if (lower.includes("ui") || lower.includes("interface") || lower.includes("design")) tags.push("ui/ux");
  if (lower.includes("error") || lower.includes("bug") || lower.includes("crash")) tags.push("bug");
  if (lower.includes("feature") || lower.includes("add") || lower.includes("request")) tags.push("feature-request");
  if (lower.includes("api") || lower.includes("endpoint")) tags.push("api");
  if (lower.includes("agent") || lower.includes("ai")) tags.push("ai-agents");

  const total = posCount + negCount;
  let score = 0.5;
  let sentiment: "positive" | "neutral" | "negative" = "neutral";

  if (total > 0) {
    score = posCount / total;
    if (score >= 0.6) sentiment = "positive";
    else if (score <= 0.4) sentiment = "negative";
  }

  return { sentiment, score: Math.round(score * 100) / 100, tags };
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const feedbackStore: FeedbackEntry[] = [
  { id: genId(), text: "The agent swarm is incredibly fast and responsive. Love how it handles complex queries!", category: "agents", sentiment: "positive", sentimentScore: 0.92, tags: ["ai-agents", "performance"], submittedAt: Date.now() - 86400000 * 2, source: "web" },
  { id: genId(), text: "There's an issue with the forum post not saving sometimes. Please fix this bug.", category: "community", sentiment: "negative", sentimentScore: 0.1, tags: ["bug", "community"], submittedAt: Date.now() - 86400000, source: "web" },
  { id: genId(), text: "The transparency ledger is a great idea, but needs more detail on each decision.", category: "transparency", sentiment: "neutral", sentimentScore: 0.55, tags: ["feature-request", "ui/ux"], submittedAt: Date.now() - 43200000, source: "web" },
  { id: genId(), text: "Dashboard performance improved a lot in recent updates. Keep up the great work!", category: "performance", sentiment: "positive", sentimentScore: 0.88, tags: ["performance"], submittedAt: Date.now() - 21600000, source: "web" },
  { id: genId(), text: "The API documentation could be better organized. Hard to find what I need.", category: "documentation", sentiment: "negative", sentimentScore: 0.25, tags: ["api", "ui/ux"], submittedAt: Date.now() - 10800000, source: "web" },
];

const transparencyStore: TransparencyEntry[] = [
  { id: genId(), timestamp: Date.now() - 3600000 * 6, module: "LLM Router", decision: "Switched primary provider to Groq", rationale: "Groq demonstrated 3x faster inference with equivalent quality during benchmark. Cost reduced by 40%.", confidence: 0.94, inputs: ["provider-benchmark-v7", "cost-analysis-q4", "quality-scores"], outcome: "Latency reduced from 1200ms to 380ms average", category: "optimization" },
  { id: genId(), timestamp: Date.now() - 3600000 * 12, module: "Swarm Intelligence", decision: "Increased consensus threshold to 2/3 majority", rationale: "Analysis of 847 prior decisions showed higher quality outcomes when requiring supermajority. Minority dissent often contained critical insights.", confidence: 0.87, inputs: ["decision-history-log", "outcome-quality-metrics"], outcome: "Decision quality score improved from 78% to 91%", category: "governance" },
  { id: genId(), timestamp: Date.now() - 86400000, module: "Security Fortress", decision: "Activated real-time threat fingerprinting", rationale: "Detected 23 probe attempts from non-admin IPs over 48h. Pattern analysis indicated systematic reconnaissance.", confidence: 0.99, inputs: ["threat-monitor-log", "ip-reputation-db", "request-patterns"], outcome: "0 successful intrusions since activation, 156 probes blocked", category: "security" },
  { id: genId(), timestamp: Date.now() - 86400000 * 2, module: "Improvement Engine", decision: "Prioritized code_generation category for improvement cycles", rationale: "Identified as weakest scoring category across 20 benchmarks (61% vs 88% average). Higher effort allocation expected to yield maximum ROI.", confidence: 0.82, inputs: ["benchmark-results", "category-success-rates", "agent-expertise-matrix"], outcome: "Code generation score increased from 61% to 74% in 5 cycles", category: "learning" },
  { id: genId(), timestamp: Date.now() - 86400000 * 3, module: "Memory Architecture", decision: "Enabled hierarchical memory compression", rationale: "Working memory usage had grown to 2.4GB. Compression reduces to 340MB with <2% quality loss on retrieval. Frees resources for more active agents.", confidence: 0.91, inputs: ["memory-stats", "compression-benchmarks", "retrieval-quality-tests"], outcome: "Memory footprint reduced 86%, retrieval accuracy 98.2%", category: "optimization" },
  { id: genId(), timestamp: Date.now() - 86400000 * 4, module: "Fleet Coordinator", decision: "Added exponential backoff to disconnected nodes", rationale: "Aggressive reconnection was causing thundering herd on network recovery. Exponential backoff prevents overload and improves stability.", confidence: 0.96, inputs: ["network-logs", "reconnection-patterns", "load-spikes"], outcome: "Network recovery time reduced 65%, no overload incidents since", category: "reliability" },
];

const educationalModules = [
  { id: "llm-router", title: "LLM Router", description: "Routes requests to optimal AI providers based on cost, speed, and quality. Uses round-robin with weighted priority and real-time health checks.", icon: "Brain", color: "blue", learnMore: "The router maintains a live leaderboard of 25+ providers, switching dynamically based on rate limits and quality scores." },
  { id: "swarm-intelligence", title: "Swarm Intelligence", description: "26 specialized agents collaborate using Byzantine Fault-Tolerant consensus, requiring 2/3 supermajority for critical decisions.", icon: "Network", color: "emerald", learnMore: "Each agent holds domain expertise. Tessera orchestrates discussions, letting agents debate before converging on optimal decisions." },
  { id: "self-healing", title: "Self-Healing Engine", description: "Monitors system health continuously and applies automatic repairs using Fibonacci timing patterns to prevent thundering herd issues.", icon: "Heart", color: "rose", learnMore: "Healing actions are logged and reviewed. The engine learns from successful repairs to handle new failure modes faster." },
  { id: "growth-ledger", title: "Growth Ledger", description: "Tracks performance across 20 benchmark categories. Detects regressions > 1% and triggers recovery protocols automatically.", icon: "TrendingUp", color: "amber", learnMore: "Every improvement cycle is measured, stored, and compared against baselines. The ledger builds a historical growth chart." },
  { id: "memory-arch", title: "Memory Architecture", description: "Three-tier memory: working (fast, session-scoped), episodic (medium, daily), and semantic (long-term, permanent). Auto-compresses with 98%+ recall.", icon: "Database", color: "purple", learnMore: "Knowledge is stored as weighted vectors. Related concepts cluster automatically. Stale knowledge is pruned based on usage frequency." },
  { id: "security-fortress", title: "Security Fortress", description: "17-layer security including real-time threat fingerprinting, IP reputation checking, rate limiting, and honeypot traps.", icon: "Shield", color: "red", learnMore: "All incoming requests pass through multiple security layers simultaneously. Suspicious patterns trigger escalating countermeasures." },
];

const onboardingSteps = [
  { step: 1, title: "Meet Tessera", description: "Tessera is a sovereign AI platform with 26 specialized agents. Start by chatting on the main Chat page.", cta: "Go to Chat", href: "/" },
  { step: 2, title: "Explore the Grand Council", description: "Watch agents collaborate in real-time, vote on decisions, and run improvement cycles.", cta: "Visit Grand Council", href: "/grand-council" },
  { step: 3, title: "Join the Community", description: "Post in the Community Hub, ask questions, and connect with other users.", cta: "Community Hub", href: "/community-hub" },
  { step: 4, title: "Understand Decisions", description: "Browse the Transparency Ledger to see how and why Tessera makes each decision.", cta: "Transparency Ledger", href: "/transparency-ledger" },
  { step: 5, title: "Submit Feedback", description: "Help improve Tessera by submitting feedback. Your input directly drives improvement cycles.", cta: "Give Feedback", href: "/feedback" },
];

const forumStore: ForumThread[] = [
  {
    id: genId(), title: "How does the LLM router decide which provider to use?", content: "I've been curious about the provider selection logic. Sometimes I see Groq, sometimes OpenRouter. What determines this?", author: "user-curious", category: "technical", tags: ["llm-router", "providers"], createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 86400000 * 2, views: 142, pinned: false, solved: true,
    replies: [
      { id: genId(), threadId: "", content: "The router uses a weighted priority system. Groq is preferred for speed-critical tasks, OpenRouter for variety and fallback. Health checks run every 30s and failing providers get lower weight automatically.", author: "agent-lambda", createdAt: Date.now() - 86400000 * 2, upvotes: 23, isBestAnswer: true },
    ],
  },
  {
    id: genId(), title: "Feature request: Dark mode for Community Hub", content: "Would love a dark mode toggle specifically for the community hub pages. The current light areas can be hard on eyes at night.", author: "user-nightowl", category: "feature-request", tags: ["ui/ux", "dark-mode"], createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 86400000, views: 89, pinned: false, solved: false,
    replies: [
      { id: genId(), threadId: "", content: "Noted! The whole app uses a dark theme system. You can adjust accent colors in Settings > Display. Full dark mode is already default.", author: "tessera-support", createdAt: Date.now() - 86400000, upvotes: 12, isBestAnswer: false },
    ],
  },
  {
    id: genId(), title: "Welcome to the Tess Community Hub!", content: "This is your space to discuss, ask questions, share ideas, and connect. Start a thread about anything Tess-related. Our agents monitor and participate in discussions.", author: "tessera-core", category: "announcements", tags: ["welcome", "community"], createdAt: Date.now() - 86400000 * 7, updatedAt: Date.now() - 86400000 * 7, views: 501, pinned: true, solved: false,
    replies: [],
  },
];

const docStore: DocEntry[] = [
  { id: genId(), title: "Getting Started with Tess", content: "Tess is a sovereign AI platform. Begin by chatting, then explore agents, the Grand Council, and the community.", module: "core", tags: ["beginner", "overview"], updatedAt: Date.now() - 86400000 * 5, views: 312 },
  { id: genId(), title: "LLM Router Configuration", content: "The LLM Router automatically selects the best provider. Admins can adjust weights via /api/llm-rotator/config.", module: "llm-router", tags: ["configuration", "providers"], updatedAt: Date.now() - 86400000 * 3, views: 198 },
  { id: genId(), title: "Agent Swarm Overview", content: "26 specialized agents form the Tess swarm. Each holds domain expertise. Orchestrated by Tessera with BFT consensus.", module: "swarm", tags: ["agents", "swarm"], updatedAt: Date.now() - 86400000 * 4, views: 245 },
  { id: genId(), title: "Transparency Ledger Explained", content: "Every major system decision is logged in the transparency ledger with full rationale, inputs, confidence scores, and outcomes.", module: "transparency", tags: ["transparency", "decisions"], updatedAt: Date.now() - 86400000 * 2, views: 167 },
  { id: genId(), title: "Security Architecture", content: "17-layer security system including quantum entropy shield, temporal randomization, polymorphic ciphers, and real-time threat monitoring.", module: "security", tags: ["security", "architecture"], updatedAt: Date.now() - 86400000, views: 289 },
  { id: genId(), title: "Community Forum Guide", content: "Start threads, reply to others, upvote helpful answers, and mark best answers. Agents actively monitor and participate.", module: "community", tags: ["forum", "guide"], updatedAt: Date.now() - 86400000 * 6, views: 134 },
];

// ─── Feedback API ─────────────────────────────────────────────────────────────

router.post("/api/ux/feedback", (req, res) => {
  const { text, category = "general", source = "web" } = req.body;
  if (!text || typeof text !== "string" || text.trim().length < 3) {
    return res.status(400).json({ error: "Feedback text is required (min 3 chars)" });
  }
  const { sentiment, score, tags } = analyzeSentiment(text.trim());
  const entry: FeedbackEntry = {
    id: genId(),
    text: text.trim(),
    category,
    sentiment,
    sentimentScore: score,
    tags,
    submittedAt: Date.now(),
    source,
  };
  feedbackStore.push(entry);
  pool.query(
    `INSERT INTO ux_feedback (id, text_content, category, sentiment, sentiment_score, tags, source) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
    [entry.id, entry.text, entry.category, entry.sentiment, entry.sentimentScore, JSON.stringify(entry.tags), entry.source]
  ).catch(() => {});
  res.json({ success: true, feedback: entry });
});

router.get("/api/ux/feedback", (_req, res) => {
  const sorted = [...feedbackStore].sort((a, b) => b.submittedAt - a.submittedAt);
  const positiveCount = feedbackStore.filter(f => f.sentiment === "positive").length;
  const negativeCount = feedbackStore.filter(f => f.sentiment === "negative").length;
  const neutralCount = feedbackStore.filter(f => f.sentiment === "neutral").length;
  const avgScore = feedbackStore.length > 0 ? Math.round((feedbackStore.reduce((s, f) => s + f.sentimentScore, 0) / feedbackStore.length) * 100) / 100 : 0;

  const tagFrequency: Record<string, number> = {};
  for (const f of feedbackStore) {
    for (const t of f.tags) {
      tagFrequency[t] = (tagFrequency[t] || 0) + 1;
    }
  }
  const topIssues = Object.entries(tagFrequency).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count }));

  const sevenDaysAgo = Date.now() - 86400000 * 7;
  const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
    const dayStart = sevenDaysAgo + i * 86400000;
    const dayEnd = dayStart + 86400000;
    const dayEntries = feedbackStore.filter(f => f.submittedAt >= dayStart && f.submittedAt < dayEnd);
    const posRatio = dayEntries.length > 0 ? dayEntries.filter(f => f.sentiment === "positive").length / dayEntries.length : 0;
    return { day: new Date(dayStart).toLocaleDateString("en-US", { weekday: "short" }), total: dayEntries.length, positiveRatio: Math.round(posRatio * 100) };
  });

  res.json({
    total: feedbackStore.length,
    sentiment: { positive: positiveCount, negative: negativeCount, neutral: neutralCount, averageScore: avgScore },
    topIssues,
    weeklyTrend,
    recent: sorted.slice(0, 20),
  });
});

// ─── Transparency Ledger API ──────────────────────────────────────────────────

router.get("/api/ux/transparency", (req, res) => {
  const { category, module: mod, limit = "20", offset = "0" } = req.query;
  let filtered = [...transparencyStore];
  if (category) filtered = filtered.filter(e => e.category === category);
  if (mod) filtered = filtered.filter(e => e.module.toLowerCase().includes((mod as string).toLowerCase()));
  filtered.sort((a, b) => b.timestamp - a.timestamp);
  const total = filtered.length;
  const page = filtered.slice(Number(offset), Number(offset) + Number(limit));

  const categoryStats: Record<string, number> = {};
  for (const e of transparencyStore) {
    categoryStats[e.category] = (categoryStats[e.category] || 0) + 1;
  }
  const avgConfidence = transparencyStore.length > 0 ? Math.round((transparencyStore.reduce((s, e) => s + e.confidence, 0) / transparencyStore.length) * 100) / 100 : 0;

  res.json({
    entries: page,
    total,
    categoryStats,
    avgConfidence,
    educationalModules,
    onboardingSteps,
  });
});

router.get("/api/ux/transparency/:id", (req, res) => {
  const entry = transparencyStore.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  res.json(entry);
});

// ─── Community Hub API ────────────────────────────────────────────────────────

router.get("/api/ux/community/threads", (req, res) => {
  const { category, search, limit = "20", offset = "0" } = req.query;
  let filtered = [...forumStore];
  if (category && category !== "all") filtered = filtered.filter(t => t.category === category);
  if (search) {
    const q = (search as string).toLowerCase();
    filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q) || t.tags.some(tg => tg.includes(q)));
  }
  filtered.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });
  const total = filtered.length;
  const page = filtered.slice(Number(offset), Number(offset) + Number(limit));

  const topContributors = computeTopContributors();
  const engagementMetrics = computeEngagementMetrics();

  res.json({ threads: page, total, topContributors, engagementMetrics });
});

router.post("/api/ux/community/threads", (req, res) => {
  const { title, content, author = "anonymous", category = "general", tags = [] } = req.body;
  if (!title || !content) return res.status(400).json({ error: "title and content required" });
  const thread: ForumThread = {
    id: genId(), title, content, author, category, tags,
    createdAt: Date.now(), updatedAt: Date.now(), views: 0, replies: [], pinned: false, solved: false,
  };
  forumStore.push(thread);
  res.json({ success: true, thread });
});

router.get("/api/ux/community/threads/:id", (req, res) => {
  const thread = forumStore.find(t => t.id === req.params.id);
  if (!thread) return res.status(404).json({ error: "Thread not found" });
  thread.views++;
  res.json(thread);
});

router.post("/api/ux/community/threads/:id/replies", (req, res) => {
  const thread = forumStore.find(t => t.id === req.params.id);
  if (!thread) return res.status(404).json({ error: "Thread not found" });
  const { content, author = "anonymous" } = req.body;
  if (!content) return res.status(400).json({ error: "content required" });
  const reply: ForumReply = {
    id: genId(), threadId: thread.id, content, author,
    createdAt: Date.now(), upvotes: 0, isBestAnswer: false,
  };
  thread.replies.push(reply);
  thread.updatedAt = Date.now();
  res.json({ success: true, reply });
});

router.post("/api/ux/community/threads/:threadId/replies/:replyId/upvote", (req, res) => {
  const thread = forumStore.find(t => t.id === req.params.threadId);
  if (!thread) return res.status(404).json({ error: "Thread not found" });
  const reply = thread.replies.find(r => r.id === req.params.replyId);
  if (!reply) return res.status(404).json({ error: "Reply not found" });
  reply.upvotes++;
  res.json({ success: true, upvotes: reply.upvotes });
});

router.get("/api/ux/community/docs", (req, res) => {
  const { search, module: mod } = req.query;
  let filtered = [...docStore];
  if (mod) filtered = filtered.filter(d => d.module === mod);
  if (search) {
    const q = (search as string).toLowerCase();
    filtered = filtered.filter(d => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q) || d.tags.some(t => t.includes(q)));
  }
  filtered.sort((a, b) => b.views - a.views);
  res.json({ docs: filtered, total: filtered.length });
});

function computeTopContributors() {
  const counts: Record<string, { threads: number; replies: number; upvotes: number }> = {};
  for (const thread of forumStore) {
    if (!counts[thread.author]) counts[thread.author] = { threads: 0, replies: 0, upvotes: 0 };
    counts[thread.author].threads++;
    for (const reply of thread.replies) {
      if (!counts[reply.author]) counts[reply.author] = { threads: 0, replies: 0, upvotes: 0 };
      counts[reply.author].replies++;
      counts[reply.author].upvotes += reply.upvotes;
    }
  }
  return Object.entries(counts)
    .map(([author, stats]) => ({ author, ...stats, score: stats.threads * 3 + stats.replies * 2 + stats.upvotes }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function computeEngagementMetrics() {
  const totalThreads = forumStore.length;
  const totalReplies = forumStore.reduce((s, t) => s + t.replies.length, 0);
  const totalViews = forumStore.reduce((s, t) => s + t.views, 0);
  const solvedCount = forumStore.filter(t => t.solved).length;
  const weekAgo = Date.now() - 86400000 * 7;
  const recentThreads = forumStore.filter(t => t.createdAt >= weekAgo).length;
  const recentReplies = forumStore.reduce((s, t) => s + t.replies.filter(r => r.createdAt >= weekAgo).length, 0);
  return { totalThreads, totalReplies, totalViews, solvedCount, recentThreads, recentReplies, avgRepliesPerThread: totalThreads > 0 ? Math.round((totalReplies / totalThreads) * 10) / 10 : 0 };
}

export default router;
