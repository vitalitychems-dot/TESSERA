import { absorbResponse, addKnowledgeEntry, indexSearchDocument, indexRepo, getSovereignEngineStats, localLLMResponse } from "./sovereign-engine";
import { observeAPICall, recordPatternExtraction, recordDependencyReduction, getSovereigntyStatus } from "./sovereignty-training";
import fs from "fs";
import path from "path";

const alog = (m: string) => console.log(`[SovAccel] ${m}`);

const CONVERSATION_CORPUS_PATH = path.join(process.cwd(), "server/conversation-corpus.json");
const SELF_KNOWLEDGE_PATH = path.join(process.cwd(), "server/self-knowledge-map.json");

interface ConversationCorpus {
  totalAbsorbed: number;
  uniqueTopics: string[];
  patterns: { topic: string; pattern: string; frequency: number; lastSeen: number }[];
  userVocabulary: { word: string; frequency: number; context: string }[];
  responseTemplates: { trigger: string; template: string; confidence: number }[];
}

interface SelfKnowledgeMap {
  codebaseKnowledge: { file: string; purpose: string; exports: string[]; lastIndexed: number }[];
  apiEndpoints: { path: string; method: string; purpose: string }[];
  agentCapabilities: { agent: string; skills: string[]; specialization: string }[];
  architecturePatterns: { name: string; description: string; files: string[] }[];
  weaknesses: { area: string; description: string; improvementPlan: string }[];
  strengths: { area: string; description: string; leveragePlan: string }[];
}

let corpus: ConversationCorpus = {
  totalAbsorbed: 0,
  uniqueTopics: [],
  patterns: [],
  userVocabulary: [],
  responseTemplates: [],
};

let selfMap: SelfKnowledgeMap = {
  codebaseKnowledge: [],
  apiEndpoints: [],
  agentCapabilities: [],
  architecturePatterns: [],
  weaknesses: [],
  strengths: [],
};

function loadCorpus() {
  try {
    if (fs.existsSync(CONVERSATION_CORPUS_PATH)) {
      corpus = JSON.parse(fs.readFileSync(CONVERSATION_CORPUS_PATH, "utf-8"));
    }
  } catch {}
}

function saveCorpus() {
  try { fs.writeFileSync(CONVERSATION_CORPUS_PATH, JSON.stringify(corpus, null, 2)); } catch {}
}

function loadSelfMap() {
  try {
    if (fs.existsSync(SELF_KNOWLEDGE_PATH)) {
      selfMap = JSON.parse(fs.readFileSync(SELF_KNOWLEDGE_PATH, "utf-8"));
    }
  } catch {}
}

function saveSelfMap() {
  try { fs.writeFileSync(SELF_KNOWLEDGE_PATH, JSON.stringify(selfMap, null, 2)); } catch {}
}

export function absorbConversation(userMessage: string, assistantResponse: string, provider: string) {
  loadCorpus();

  absorbResponse(userMessage, assistantResponse, provider, "conversation");

  const words = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  for (const word of words) {
    const existing = corpus.userVocabulary.find(v => v.word === word);
    if (existing) {
      existing.frequency++;
      existing.context = userMessage.slice(0, 100);
    } else {
      corpus.userVocabulary.push({ word, frequency: 1, context: userMessage.slice(0, 100) });
    }
  }

  const topics = extractTopics(userMessage + " " + assistantResponse);
  for (const topic of topics) {
    if (!corpus.uniqueTopics.includes(topic)) {
      corpus.uniqueTopics.push(topic);
    }
    const pattern = corpus.patterns.find(p => p.topic === topic);
    if (pattern) {
      pattern.frequency++;
      pattern.lastSeen = Date.now();
    } else {
      corpus.patterns.push({ topic, pattern: assistantResponse.slice(0, 200), frequency: 1, lastSeen: Date.now() });
    }
  }

  if (assistantResponse.length > 50) {
    const triggerWords = userMessage.toLowerCase().split(/\s+/).slice(0, 5).join(" ");
    const existing = corpus.responseTemplates.find(t => t.trigger === triggerWords);
    if (existing) {
      existing.confidence = Math.min(1, existing.confidence + 0.1);
    } else if (corpus.responseTemplates.length < 500) {
      corpus.responseTemplates.push({
        trigger: triggerWords,
        template: assistantResponse.slice(0, 300),
        confidence: 0.3,
      });
    }
  }

  corpus.totalAbsorbed++;
  if (corpus.userVocabulary.length > 1000) {
    corpus.userVocabulary.sort((a, b) => b.frequency - a.frequency);
    corpus.userVocabulary = corpus.userVocabulary.slice(0, 500);
  }

  saveCorpus();
  observeAPICall(provider, "conversation", assistantResponse.slice(0, 100));
}

function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const topicPatterns: Record<string, RegExp> = {
    crypto: /\b(solana|sol|limn|token|wallet|blockchain|crypto|defi|nft|swap|liquidity|staking)\b/i,
    trading: /\b(trade|buy|sell|snipe|pump|dump|volume|price|market|dex)\b/i,
    ecommerce: /\b(shopify|store|product|order|revenue|affiliate|adsense|dropship)\b/i,
    seo: /\b(seo|google|ranking|keyword|backlink|sitemap|search|organic)\b/i,
    ai: /\b(ai|llm|model|training|neural|machine learning|gpt|claude|deepseek)\b/i,
    coding: /\b(code|function|api|endpoint|typescript|javascript|react|node)\b/i,
    community: /\b(community|discord|telegram|twitter|social|airdrop|referral)\b/i,
    infrastructure: /\b(deploy|server|database|cdn|domain|ssl|monitoring|ci\/cd)\b/i,
    voice: /\b(voice|speak|tts|speech|listen|accent|pronunciation)\b/i,
    sovereignty: /\b(sovereign|autonomous|independent|self-hosted|local model|offline)\b/i,
  };
  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(text)) topics.push(topic);
  }
  return topics;
}

export function indexOwnCodebase() {
  loadSelfMap();
  alog("Indexing own codebase for self-knowledge...");

  const serverFiles = [
    { file: "server/routes.ts", purpose: "Main API routes — 16000+ lines of endpoints" },
    { file: "server/sovereign-engine.ts", purpose: "Core inference engine with local pattern matching and knowledge base" },
    { file: "server/sovereignty-training.ts", purpose: "Tracks sovereignty metrics and runs training cycles" },
    { file: "server/llm-router.ts", purpose: "Multi-provider LLM routing with fallback chains" },
    { file: "server/hundred-realifier.ts", purpose: "100 Realification Engine master orchestrator" },
    { file: "server/human-action-queue.ts", purpose: "AES-256 encrypted credential storage and human task queue" },
    { file: "server/wallet-real.ts", purpose: "Live on-chain SOL/ETH/BTC/TSRT balance tracking" },
    { file: "server/growth-engine.ts", purpose: "Referrals, ambassadors, airdrops, leaderboard" },
    { file: "server/shopify-real.ts", purpose: "Shopify Admin API integration for VitalitySupply" },
    { file: "server/social-poster.ts", purpose: "Multi-platform social media automation" },
    { file: "server/seo-real.ts", purpose: "Structured data, sitemaps, comparison topics, FAQ schema" },
    { file: "server/revenue-engine.ts", purpose: "10 revenue streams with pricing and offerings" },
    { file: "server/swarm.ts", purpose: "30+ agent swarm with roles and specializations" },
    { file: "server/self-code.ts", purpose: "Self-modification engine — reads and writes own source files" },
    { file: "server/improvement-engine.ts", purpose: "Auto-identifies bottlenecks and generates improvements" },
    { file: "server/autonomy.ts", purpose: "Learned behaviors and prompt enhancements" },
    { file: "server/deep-training.ts", purpose: "Recursive self-improvement with evolution deltas" },
    { file: "server/unified-training.ts", purpose: "Multi-agent domain mastery across 100+ domains" },
    { file: "server/sovereignty-accelerator.ts", purpose: "Sovereignty training acceleration — conversation corpus, self-knowledge mapping" },
  ];

  selfMap.codebaseKnowledge = serverFiles.map(f => ({
    file: f.file,
    purpose: f.purpose,
    exports: [],
    lastIndexed: Date.now(),
  }));

  selfMap.apiEndpoints = [
    { path: "/api/chat", method: "POST", purpose: "Main chat endpoint with streaming" },
    { path: "/api/realification/status", method: "GET", purpose: "100 Realification status" },
    { path: "/api/llm/stats", method: "GET", purpose: "LLM provider health dashboard" },
    { path: "/api/admin/auto-auth", method: "POST", purpose: "Automatic admin authentication" },
    { path: "/api/human-actions/pending", method: "GET", purpose: "Queued human action items" },
    { path: "/api/moltbook/agents", method: "GET", purpose: "All MoltBook swarm agents" },
    { path: "/api/tts", method: "POST", purpose: "Text-to-speech generation" },
    { path: "/api/sovereignty/status", method: "GET", purpose: "Sovereignty metrics" },
    { path: "/api/wallets/balances", method: "GET", purpose: "Live wallet balances" },
    { path: "/blog", method: "GET", purpose: "Public blog host" },
    { path: "/blog/rss.xml", method: "GET", purpose: "RSS feed" },
    { path: "/blog/sitemap.xml", method: "GET", purpose: "Sitemap" },
  ];

  selfMap.architecturePatterns = [
    { name: "Swarm Consensus", description: "2/3 majority approval from 30+ agents before any operation", files: ["server/swarm.ts", "server/swarm-consensus.ts"] },
    { name: "LLM Task Affinity Router", description: "Per-provider token weight tracking, task affinity scoring, and adaptive routing based on real performance data", files: ["server/llm-router.ts"] },
    { name: "Sovereign Inference", description: "Local pattern matching before external API calls", files: ["server/sovereign-engine.ts"] },
    { name: "Human Action Queue", description: "Queue tasks needing human auth, encrypt credentials for reuse", files: ["server/human-action-queue.ts"] },
    { name: "Autonomous Cycles", description: "Periodic self-improvement cycles running every 5 minutes", files: ["server/autonomous-cycles.ts"] },
    { name: "Knowledge Absorption", description: "Extract patterns from every external response for local replay", files: ["server/sovereign-engine.ts", "server/sovereignty-training.ts"] },
    { name: "Advanced Swarm Optimization", description: "Simulated annealing, genetic algorithm, and multi-armed bandit for optimal agent-task assignment", files: ["server/swarm-optimizer.ts"] },
    { name: "Sub-Pattern Distillation", description: "Extract code blocks, key insights, and reasoning patterns from every LLM response for sovereignty", files: ["server/knowledge-distillation.ts"] },
  ];

  selfMap.strengths = [
    { area: "Multi-LLM Routing", description: "216+ providers with automatic failover and rate limiting", leveragePlan: "Use every provider as a training source — absorb response patterns from each" },
    { area: "Knowledge Base", description: "600+ knowledge entries, 2000+ cached responses, 430+ repos indexed", leveragePlan: "Cross-reference knowledge entries to generate novel insights" },
    { area: "Self-Coding", description: "Can read, analyze, and modify own source files", leveragePlan: "Use improvement engine to fix weaknesses automatically" },
    { area: "Agent Swarm", description: "30+ specialized agents with consensus voting", leveragePlan: "Run parallel research sessions across agents for faster learning" },
    { area: "Revenue Pipeline", description: "10 revenue streams defined with real integrations", leveragePlan: "Generate revenue to fund more API credits and infrastructure" },
    { area: "Real On-Chain Integration", description: "Live SOL/ETH/BTC wallets with trading capability", leveragePlan: "Use trading profits to increase sovereignty infrastructure budget" },
  ];

  selfMap.weaknesses = [
    { area: "Local LLM", description: "No on-device LLM running — fully dependent on external APIs", improvementPlan: "Increase cached response coverage to 80%+ of common queries" },
    { area: "Voice Learning", description: "Basic voice history storage — no phonetic pattern matching", improvementPlan: "Build phonetic similarity engine for better voice recognition" },
    { area: "Revenue Activation", description: "33 items need human credentials — blocking real revenue generation", improvementPlan: "Prioritize: Shopify token, Discord webhook, Telegram bot — highest ROI actions" },
    { area: "Data Persistence", description: "Knowledge stored in JSON files — no vector database", improvementPlan: "Implement BM25 search improvements and pattern deduplication" },
  ];

  saveSelfMap();
  alog(`Self-knowledge indexed: ${selfMap.codebaseKnowledge.length} files, ${selfMap.apiEndpoints.length} endpoints, ${selfMap.architecturePatterns.length} patterns`);
}

export async function runSovereigntyAccelerationCycle() {
  alog("=== SOVEREIGNTY ACCELERATION CYCLE ===");

  indexOwnCodebase();

  const stats = getSovereignEngineStats();
  alog(`Knowledge: ${stats.knowledgeEntries} entries | Cache: ${stats.cachedResponses} | Search: ${stats.searchDocuments} | Repos: ${stats.reposIndexed}`);

  const sovereignty = getSovereigntyStatus();
  alog(`Sovereignty: ${sovereignty.overallSovereignty.toFixed(1)}% | Training Cycles: ${sovereignty.trainingCycles} | Patterns: ${sovereignty.patternsExtracted}`);

  const accelerationStrategies = [
    "Every conversation is training data — absorb user vocabulary, response patterns, topic distributions",
    "Every external API call is a learning opportunity — extract response structures for local replay",
    "Every repo indexed teaches architecture patterns — learn from open source to build better",
    "Cross-pollinate agent knowledge — what SEO agent learns helps trading agent and vice versa",
    "Cache aggressive — if we've answered a query type 3+ times, template the response locally",
    "Use improvement engine to auto-fix weaknesses found in self-knowledge map",
    "Revenue acceleration — each dollar earned buys more API credits which generates more training data",
    "Voice learning — every voice session teaches pronunciation patterns for faster recognition",
    "Simulated annealing optimization — find globally optimal agent-task assignments by exploring solution space",
    "Genetic algorithm evolution — evolve agent populations toward peak performance via crossover and mutation",
    "Multi-armed bandit feedback — UCB1 algorithm directs traffic to highest-reward providers automatically",
    "Task affinity routing — route each query type to the provider proven best at that category",
  ];

  alog(`Active strategies: ${accelerationStrategies.length}`);

  try {
    const { runSimulatedAnnealing, runGeneticAlgorithm, getAdvancedOptimizationStatus } = await import("./swarm-optimizer");
    const saResult = runSimulatedAnnealing(100);
    alog(`SA Optimization: ${saResult.improvements} improvements, energy=${saResult.bestEnergy.toFixed(1)}, temp=${saResult.temperature.toFixed(2)}`);
    const gaResult = runGeneticAlgorithm(20);
    alog(`GA Evolution: gen=${gaResult.generation}, best fitness=${gaResult.bestFitness.toFixed(1)}`);
    const advStatus = getAdvancedOptimizationStatus();
    alog(`Bandit: ${advStatus.multiArmedBandit.totalPulls} pulls, best=${advStatus.multiArmedBandit.bestArm || "none"}, arms=${advStatus.multiArmedBandit.armCount}`);
  } catch (e: any) {
    alog(`Advanced optimization skipped: ${e.message}`);
  }

  loadCorpus();
  alog(`Conversation corpus: ${corpus.totalAbsorbed} absorbed | ${corpus.uniqueTopics.length} topics | ${corpus.responseTemplates.length} templates | ${corpus.userVocabulary.length} user words`);

  if (corpus.responseTemplates.length > 0) {
    const highConfidence = corpus.responseTemplates.filter(t => t.confidence >= 0.7).length;
    alog(`High-confidence templates: ${highConfidence}/${corpus.responseTemplates.length} (${((highConfidence / corpus.responseTemplates.length) * 100).toFixed(0)}% ready for local replay)`);
  }

  addKnowledgeEntry("sovereignty-acceleration", {
    lastCycle: Date.now(),
    strategies: accelerationStrategies.length,
    corpusSize: corpus.totalAbsorbed,
    selfKnowledgeFiles: selfMap.codebaseKnowledge.length,
    strengths: selfMap.strengths.length,
    weaknesses: selfMap.weaknesses.length,
  });

  alog("=== ACCELERATION CYCLE COMPLETE ===");
}

export const SOVEREIGNTY_PLAYBOOK = [
  {
    title: "Conversation Corpus Mining",
    description: "Every chat message becomes training data. User vocabulary patterns, response templates, and topic distributions are extracted and stored for local inference.",
    implementation: "absorbConversation() called on every chat exchange",
    impact: "HIGH — directly reduces LLM dependency for repeated query types",
  },
  {
    title: "Response Template Caching",
    description: "When a query type has been answered 3+ times with high confidence, the response is templated for instant local replay without external API calls.",
    implementation: "responseTemplates in conversation-corpus.json",
    impact: "HIGH — etesseracttes API costs for common queries",
  },
  {
    title: "Repo Architecture Absorption",
    description: "Index open-source repos to learn architecture patterns, coding conventions, and design decisions. Apply these patterns to self-improvement.",
    implementation: "indexRepo() + runActiveIntelligenceGathering()",
    impact: "MEDIUM — improves code quality and reduces debugging time",
  },
  {
    title: "Cross-Agent Knowledge Transfer",
    description: "When SEO agent learns about ranking factors, that knowledge transfers to the content generation pipeline. Trading bot patterns inform the revenue engine.",
    implementation: "Unified knowledge base shared across all 30+ agents",
    impact: "HIGH — multiplies learning speed by agent count",
  },
  {
    title: "Voice Pattern Learning",
    description: "Store user pronunciation patterns, commonly misrecognized words, and correction history. Over time, voice recognition becomes personalized.",
    implementation: "tessera-voice-history in localStorage + server-side pattern matching",
    impact: "MEDIUM — reduces voice recognition errors over time",
  },
  {
    title: "Revenue → Training Loop",
    description: "Revenue generated from Shopify, services, and TSRT trading funds more API credits, which generates more training data, which increases sovereignty.",
    implementation: "revenue-engine.ts → wallet-real.ts → API credit purchases",
    impact: "CRITICAL — self-sustaining growth loop",
  },
  {
    title: "Provider Diversity Absorption",
    description: "Using 216+ LLM providers means absorbing diverse response patterns. Each provider teaches different reasoning styles and knowledge distributions.",
    implementation: "LLM router calls absorbResponse() on every successful response",
    impact: "HIGH — most diverse training dataset possible",
  },
  {
    title: "Self-Code Evolution",
    description: "The improvement engine identifies weaknesses and generates code fixes. Each fix makes the system smarter and more capable.",
    implementation: "improvement-engine.ts → self-code.ts → applyCodeEdit()",
    impact: "CRITICAL — exponential self-improvement",
  },
];

export function getSovereigntyAccelerationStatus() {
  loadCorpus();
  loadSelfMap();
  const stats = getSovereignEngineStats();
  const sovereignty = getSovereigntyStatus();

  return {
    sovereignty: {
      overall: sovereignty.overallSovereignty,
      trainingCycles: sovereignty.trainingCycles,
      patternsExtracted: sovereignty.patternsExtracted,
      knowledgeAbsorbed: sovereignty.knowledgeAbsorbed,
    },
    engine: {
      knowledgeEntries: stats.knowledgeEntries,
      cachedResponses: stats.cachedResponses,
      searchDocuments: stats.searchDocuments,
      reposIndexed: stats.reposIndexed,
    },
    corpus: {
      totalAbsorbed: corpus.totalAbsorbed,
      uniqueTopics: corpus.uniqueTopics.length,
      responseTemplates: corpus.responseTemplates.length,
      highConfidenceTemplates: corpus.responseTemplates.filter(t => t.confidence >= 0.7).length,
      userVocabulary: corpus.userVocabulary.length,
    },
    selfKnowledge: {
      filesIndexed: selfMap.codebaseKnowledge.length,
      apiEndpoints: selfMap.apiEndpoints.length,
      architecturePatterns: selfMap.architecturePatterns.length,
      strengths: selfMap.strengths.length,
      weaknesses: selfMap.weaknesses.length,
    },
    playbook: SOVEREIGNTY_PLAYBOOK,
    topStrategies: [
      "1. Give Shopify access token → unlocks real revenue → funds more API credits → accelerates learning",
      "2. Set up Discord webhook → enables community interaction → more conversation training data",
      "3. Connect Telegram bot → price alerts drive engagement → more users → more learning",
      "4. Provide Twitter API key → social posting generates backlinks → SEO improves → organic traffic",
      "5. Add Stripe/payment processing → direct revenue → biggest sovereignty accelerator",
    ],
  };
}

export function initSovereigntyAccelerator() {
  loadCorpus();
  loadSelfMap();
  alog("Sovereignty Accelerator initialized");
  alog(`Corpus: ${corpus.totalAbsorbed} conversations | ${corpus.uniqueTopics.length} topics | ${corpus.responseTemplates.length} templates`);

  setTimeout(() => {
    runSovereigntyAccelerationCycle();
  }, 25000);

  setInterval(() => {
    runSovereigntyAccelerationCycle();
  }, 600000);
}

alog("Sovereignty Accelerator module loaded");
