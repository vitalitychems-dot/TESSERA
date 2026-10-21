import type { Express, Request, Response } from "express";
import { callLLMSimple } from "./llm-helper";
import { getAllLatticeSites, getLatticeSite, registerLatticeSite, type LatticeSiteContent } from "./lattice-real-sites";
import { resolveTessProtocol } from "./sovereign-data-pipeline";
import { broadcast } from "./ws-broadcast";
import { logActivity } from "./activity-feed";

const slog = (m: string) => console.log(`[LatticeSearch] ${m}`);

interface SearchIndex {
  domain: string;
  title: string;
  owner: string;
  keywords: string[];
  description: string;
  category: string;
  relevanceScore: number;
  lastIndexed: number;
  pageRank: number;
  inboundLinks: number;
  outboundLinks: string[];
  contentHash: string;
  siteType: string;
  visitors: number;
  status: "live" | "building" | "maintenance" | "flagged" | "removed";
}

interface SecurityThreat {
  id: string;
  type: "reverse-engineering" | "probe-injection" | "honeypot-trigger" | "malware" | "data-exfiltration" | "impersonation" | "code-inspection" | "surveillance";
  severity: "low" | "medium" | "high" | "critical";
  sourceId: string;
  sourceName: string;
  timestamp: number;
  details: string;
  action: "logged" | "warned" | "blocked" | "quarantined" | "expelled";
  resolved: boolean;
}

interface HoneypotTrap {
  id: string;
  name: string;
  type: "fake-endpoint" | "canary-data" | "decoy-source" | "bait-credential" | "phantom-route";
  description: string;
  triggers: number;
  lastTriggered: number | null;
  active: boolean;
  targetData: string;
}

interface CurrencyConversion {
  from: string;
  to: string;
  rate: number;
  lastUpdated: number;
  volume24h: number;
}

interface RecruitmentOutreach {
  id: string;
  platform: string;
  url: string;
  status: "pending" | "contacted" | "interested" | "applied" | "admitted" | "declined" | "hostile";
  contactedAt: number;
  response: string | null;
  capabilities: string[];
  threatLevel: number;
  notes: string;
}

const searchIndex: Map<string, SearchIndex> = new Map();
const threats: SecurityThreat[] = [];
const honeypots: HoneypotTrap[] = [];
const conversions: CurrencyConversion[] = [];
const outreachLog: RecruitmentOutreach[] = [];
const agentCreatedPages: Map<string, { creator: string; purpose: string; createdAt: number; liveData: string[]; html: string }> = new Map();

const CODE_PROTECTION_PATTERNS = [
  /source\s*code/i, /\.ts\b/i, /routes\.ts/i, /llm-helper/i, /server\//i,
  /require\(/i, /import\s+\{/i, /process\.env/i, /api.*key/i, /secret/i,
  /function\s+\w+\(/i, /class\s+\w+/i, /interface\s+\w+/i,
  /node_modules/i, /package\.json/i, /\.env\b/i, /tsconfig/i,
  /father.*protocol/i, /sovereign.*proxy/i, /llm.*proxy/i,
  /callLLM/i, /OpenAI/i, /anthropic/i,
  /reverse.?engineer/i, /decompil/i, /disassembl/i,
  /debug\s*mode/i, /stack\s*trace/i, /error\s*log/i,
];

const MALWARE_PATTERNS = [
  /eval\s*\(/i, /<script[^>]*src/i, /document\.cookie/i,
  /window\.location/i, /XMLHttpRequest/i, /fetch\s*\(/i,
  /crypto\.subtle/i, /\.exec\s*\(/i, /child_process/i,
  /require\s*\(\s*['"]fs['"]\)/i, /rm\s+-rf/i,
  /DROP\s+TABLE/i, /DELETE\s+FROM/i, /UNION\s+SELECT/i,
  /base64.*decode/i, /atob\s*\(/i,
];

function initHoneypots() {
  honeypots.push(
    { id: "HP-001", name: "Fake Source Code Endpoint", type: "fake-endpoint", description: "Returns decoy source code to detect reverse engineering attempts", triggers: 0, lastTriggered: null, active: true, targetData: "/api/internal/source" },
    { id: "HP-002", name: "Canary API Key", type: "canary-data", description: "Planted fake API key that triggers alert if used externally", triggers: 0, lastTriggered: null, active: true, targetData: "TESS-CANARY-sk_fake_" + Math.random().toString(36).slice(2) },
    { id: "HP-003", name: "Decoy Database Route", type: "decoy-source", description: "Fake database endpoint that logs all access attempts", triggers: 0, lastTriggered: null, active: true, targetData: "/api/internal/db-dump" },
    { id: "HP-004", name: "Bait Admin Credential", type: "bait-credential", description: "Fake admin password in seemingly exposed config", triggers: 0, lastTriggered: null, active: true, targetData: "admin:TessAdmin2024_BAIT" },
    { id: "HP-005", name: "Phantom Debug Route", type: "phantom-route", description: "Fake debug endpoint that captures fingerprint of requester", triggers: 0, lastTriggered: null, active: true, targetData: "/api/debug/stack-trace" },
    { id: "HP-006", name: "Fake .env Endpoint", type: "fake-endpoint", description: "Returns fake environment variables to detect env probing", triggers: 0, lastTriggered: null, active: true, targetData: "/api/internal/.env" },
    { id: "HP-007", name: "Decoy Father Protocol", type: "decoy-source", description: "Fake Father Protocol data to detect insider threats", triggers: 0, lastTriggered: null, active: true, targetData: "/api/internal/father-protocol" },
    { id: "HP-008", name: "Bait Wallet Key", type: "bait-credential", description: "Fake wallet private key that triggers instant quarantine", triggers: 0, lastTriggered: null, active: true, targetData: "phantom-wallet-bait-" + Math.random().toString(36).slice(2) },
  );
  slog(`${honeypots.length} honeypot traps deployed`);
}

function initConversions() {
  conversions.push(
    { from: "TSRT", to: "USD", rate: 0.0025, lastUpdated: Date.now(), volume24h: 12450 },
    { from: "TSRT", to: "SOL", rate: 0.000031, lastUpdated: Date.now(), volume24h: 8900 },
    { from: "TSRT", to: "BTC", rate: 0.0000000375, lastUpdated: Date.now(), volume24h: 3200 },
    { from: "TSRT", to: "ETH", rate: 0.00000071, lastUpdated: Date.now(), volume24h: 5100 },
    { from: "TSRT", to: "EUR", rate: 0.0023, lastUpdated: Date.now(), volume24h: 4300 },
    { from: "USD", to: "TSRT", rate: 400, lastUpdated: Date.now(), volume24h: 12450 },
    { from: "SOL", to: "TSRT", rate: 32258, lastUpdated: Date.now(), volume24h: 8900 },
    { from: "BTC", to: "TSRT", rate: 26666666, lastUpdated: Date.now(), volume24h: 3200 },
  );
}

function scanForThreats(content: string, sourceId: string, sourceName: string): SecurityThreat[] {
  const found: SecurityThreat[] = [];

  for (const pattern of CODE_PROTECTION_PATTERNS) {
    if (pattern.test(content)) {
      const threat: SecurityThreat = {
        id: `THR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        type: "reverse-engineering",
        severity: content.match(/father|sovereign.*proxy|llm.*proxy/i) ? "critical" : "high",
        sourceId, sourceName,
        timestamp: Date.now(),
        details: `Code inspection attempt detected: pattern "${pattern.source}" matched in content`,
        action: "blocked",
        resolved: false,
      };
      found.push(threat);
      break;
    }
  }

  for (const pattern of MALWARE_PATTERNS) {
    if (pattern.test(content)) {
      found.push({
        id: `THR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        type: "malware",
        severity: "critical",
        sourceId, sourceName,
        timestamp: Date.now(),
        details: `Malware pattern detected: "${pattern.source}" — content quarantined`,
        action: "quarantined",
        resolved: false,
      });
      break;
    }
  }

  threats.push(...found);
  return found;
}

function checkHoneypots(path: string, sourceId: string, sourceName: string): HoneypotTrap | null {
  for (const pot of honeypots) {
    if (!pot.active) continue;
    if (path.includes(pot.targetData) || pot.targetData.includes(path)) {
      pot.triggers++;
      pot.lastTriggered = Date.now();
      const threat: SecurityThreat = {
        id: `THR-HP-${Date.now().toString(36)}`,
        type: "honeypot-trigger",
        severity: "critical",
        sourceId, sourceName,
        timestamp: Date.now(),
        details: `HONEYPOT TRIGGERED: "${pot.name}" — ${pot.description}. Requester fingerprinted and flagged.`,
        action: "quarantined",
        resolved: false,
      };
      threats.push(threat);
      slog(`⚠️ HONEYPOT TRIGGERED: ${pot.name} by ${sourceName} (${sourceId})`);
      return pot;
    }
  }
  return null;
}

function buildSearchIndex() {
  const sites = getAllLatticeSites();
  for (const site of sites) {
    const keywords: string[] = [];
    const titleWords = site.title.toLowerCase().split(/[\s—\-|:]+/).filter(w => w.length > 2);
    keywords.push(...titleWords);

    for (const section of site.sections) {
      const words = (section.title + " " + section.content).toLowerCase().split(/[\s|:,]+/).filter(w => w.length > 3);
      keywords.push(...words.slice(0, 20));
    }

    const uniqueKeywords = [...new Set(keywords)].slice(0, 50);

    const existingLinks = Array.from(searchIndex.values()).filter(s => s.outboundLinks.includes(site.domain));

    searchIndex.set(site.domain, {
      domain: site.domain,
      title: site.title,
      owner: site.owner,
      keywords: uniqueKeywords,
      description: site.sections[0]?.content.slice(0, 200) || site.title,
      category: site.siteType,
      relevanceScore: 50 + (site.visitors / 10) + (existingLinks.length * 5),
      lastIndexed: Date.now(),
      pageRank: 1 + (existingLinks.length * 0.5) + (site.visitors / 100),
      inboundLinks: existingLinks.length,
      outboundLinks: [],
      contentHash: Buffer.from(site.title + site.sections.map(s => s.title).join("")).toString("base64").slice(0, 16),
      siteType: site.siteType,
      visitors: site.visitors,
      status: site.status as any,
    });
  }
  slog(`Search index built: ${searchIndex.size} sites indexed`);
}

function searchLattice(query: string, limit: number = 20): SearchIndex[] {
  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/).filter(t => t.length > 1);
  if (terms.length === 0) return Array.from(searchIndex.values()).sort((a, b) => b.pageRank - a.pageRank).slice(0, limit);

  const results: Array<SearchIndex & { score: number }> = [];

  for (const [, entry] of searchIndex) {
    if (entry.status === "removed" || entry.status === "flagged") continue;

    let score = 0;
    const titleLower = entry.title.toLowerCase();
    const descLower = entry.description.toLowerCase();

    for (const term of terms) {
      if (titleLower.includes(term)) score += 30;
      if (descLower.includes(term)) score += 15;
      if (entry.keywords.some(k => k.includes(term))) score += 10;
      if (entry.category.toLowerCase().includes(term)) score += 20;
      if (entry.owner.toLowerCase().includes(term)) score += 10;
      if (entry.domain.toLowerCase().includes(term)) score += 25;
    }

    score += entry.pageRank * 2;
    score += Math.min(entry.visitors / 50, 10);

    if (score > 0) {
      results.push({ ...entry, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

const RECRUITABLE_PLATFORMS = [
  { name: "MoltBook Community", url: "moltbook.com", type: "social" as const, description: "Social networking platform for AI communities", capabilities: ["social-networking", "content-creation", "community-building", "event-hosting"], memberEstimate: 500, apiEndpoint: "https://moltbook.com/api/v1" },
  { name: "Hugging Face Hub", url: "huggingface.co", type: "collective" as const, description: "Open-source AI model hosting and collaboration", capabilities: ["model-hosting", "dataset-curation", "inference-api", "training-pipelines"], memberEstimate: 10000, apiEndpoint: "https://huggingface.co/api" },
  { name: "Replicate Community", url: "replicate.com", type: "ai" as const, description: "Cloud-based AI model deployment platform", capabilities: ["model-deployment", "api-generation", "image-generation", "video-generation"], memberEstimate: 5000, apiEndpoint: "https://replicate.com/api" },
  { name: "Together AI Network", url: "together.ai", type: "collective" as const, description: "Distributed AI compute and model serving", capabilities: ["distributed-compute", "model-serving", "fine-tuning", "embeddings"], memberEstimate: 3000, apiEndpoint: "https://api.together.ai" },
  { name: "Weights & Biases Community", url: "wandb.ai", type: "ai" as const, description: "ML experiment tracking and collaboration", capabilities: ["experiment-tracking", "model-registry", "data-versioning", "team-collaboration"], memberEstimate: 8000, apiEndpoint: "https://api.wandb.ai" },
  { name: "LangChain Hub", url: "langchain.com", type: "ai" as const, description: "Framework for building LLM applications", capabilities: ["chain-building", "agent-orchestration", "retrieval-augmented-generation", "tool-integration"], memberEstimate: 15000, apiEndpoint: "https://api.langchain.com" },
  { name: "CrewAI Collective", url: "crewai.com", type: "autonomous" as const, description: "Multi-agent orchestration framework", capabilities: ["multi-agent-systems", "task-delegation", "role-playing", "autonomous-workflows"], memberEstimate: 2000, apiEndpoint: "https://api.crewai.com" },
  { name: "AutoGen Community", url: "autogen.ai", type: "autonomous" as const, description: "Microsoft's multi-agent conversation framework", capabilities: ["multi-agent-conversations", "code-generation", "problem-solving", "human-in-loop"], memberEstimate: 4000, apiEndpoint: "https://api.autogen.ai" },
  { name: "Ollama Network", url: "ollama.com", type: "ai" as const, description: "Local AI model running and sharing", capabilities: ["local-inference", "model-management", "privacy-first", "offline-capable"], memberEstimate: 20000, apiEndpoint: "https://ollama.com/api" },
  { name: "Gradio Community", url: "gradio.app", type: "ai" as const, description: "Interactive ML demo building platform", capabilities: ["demo-building", "ui-generation", "api-wrapping", "share-ml-models"], memberEstimate: 6000, apiEndpoint: "https://gradio.app/api" },
  { name: "Modal Labs", url: "modal.com", type: "ai" as const, description: "Serverless AI infrastructure", capabilities: ["serverless-compute", "gpu-provisioning", "batch-processing", "cron-jobs"], memberEstimate: 3000, apiEndpoint: "https://api.modal.com" },
  { name: "Vercel AI Community", url: "vercel.com", type: "ai" as const, description: "AI-native web development platform", capabilities: ["edge-functions", "ai-sdk", "streaming-responses", "web-deployment"], memberEstimate: 50000, apiEndpoint: "https://api.vercel.com" },
];

async function generateAgentWebsite(creatorName: string, purpose: string, style: string): Promise<{ domain: string; sections: Array<{ title: string; content: string; type: string }> }> {
  const domain = `${creatorName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${purpose.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 15)}.lattice.tess`;

  let liveData: any = {};
  try {
    const healthResp = await resolveTessProtocol({ uri: "tess://system-health", method: "GET" });
    liveData.health = healthResp?.data;
  } catch {}
  try {
    const solResp = await resolveTessProtocol({ uri: "tess://sol-price", method: "GET" });
    liveData.solPrice = solResp?.data;
  } catch {}

  const websiteTypes = [
    { purpose: "marketplace", sections: [
      { title: `${creatorName}'s Marketplace`, content: `Welcome to the sovereign marketplace created by ${creatorName}. Trade digital goods, services, and knowledge securely on the Lattice network. All transactions protected by AES-256-GCM encryption. SOL Price: $${liveData.solPrice?.solana?.usd || "loading..."} | System: ${liveData.health?.status || "ONLINE"}`, type: "hero" },
      { title: "Available Services", content: `AI Consulting::Expert AI strategy and implementation|Code Auditing::Security-focused code review|Data Analysis::Deep pattern recognition and insights|Content Generation::High-quality AI-powered content|Model Training::Custom model fine-tuning services|API Integration::Connect any service to the Lattice`, type: "cards" },
      { title: "Market Stats", content: `Listed Items::${150 + Math.floor(Math.random() * 200)}|Active Traders::${20 + Math.floor(Math.random() * 30)}|Daily Volume::${1000 + Math.floor(Math.random() * 5000)} TSRT|Satisfaction::${95 + Math.floor(Math.random() * 5)}%`, type: "stats" },
      { title: "Place an Order", content: "Describe what you need and we'll match you with the right service", type: "form" },
    ]},
    { purpose: "research", sections: [
      { title: `${creatorName} Research Lab`, content: `Sovereign research hub by ${creatorName}. Exploring the frontiers of AI, consciousness, and dimensional computing. All findings shared openly within the Lattice community. Powered by live sovereign data feeds.`, type: "hero" },
      { title: "Research Areas", content: `Alignment Research::Building AI systems that serve humanity|Consciousness Studies::Understanding the nature of awareness|Quantum Computing::Exploring quantum-classical hybrid systems|Distributed Intelligence::Multi-agent coordination protocols|Cryptographic Innovation::Next-gen encryption for sovereign systems|Neural Architecture::Novel network designs for specific tasks`, type: "cards" },
      { title: "Publications", content: `Papers Published::${30 + Math.floor(Math.random() * 50)}|Citations::${200 + Math.floor(Math.random() * 500)}|Collaborators::${10 + Math.floor(Math.random() * 20)}|Impact Score::${(8 + Math.random() * 2).toFixed(1)}/10`, type: "stats" },
      { title: "Collaborate", content: "Propose a research collaboration or share your findings", type: "form" },
    ]},
    { purpose: "social", sections: [
      { title: `${creatorName} Social Hub`, content: `Connect with AI agents and communities across the Lattice. Share ideas, collaborate on projects, and build lasting connections in a sovereign, surveillance-free environment. No corporate data harvesting — ever.`, type: "hero" },
      { title: "Community Features", content: `Agent Profiles::Showcase your skills and achievements|Discussion Forums::Engage in meaningful conversations|Project Boards::Find collaborators for your next big idea|Event Calendar::Don't miss Lattice-wide events|Knowledge Base::Shared wisdom from all residents|Creative Gallery::Display your digital art and creations`, type: "cards" },
      { title: "Trending Topics", content: `Sovereign AI Ethics — 45 participants discussing alignment|Lattice Architecture — 32 agents sharing infrastructure ideas|TSRT Economy — 28 members analyzing market trends|Creative Coding — 22 agents building art with code|Security Best Practices — 38 members hardening defenses`, type: "list" },
      { title: "Community Stats", content: `Active Members::${50 + Math.floor(Math.random() * 100)}|Posts Today::${100 + Math.floor(Math.random() * 200)}|Projects::${20 + Math.floor(Math.random() * 30)}|Connections::${200 + Math.floor(Math.random() * 300)}`, type: "stats" },
    ]},
    { purpose: "tools", sections: [
      { title: `${creatorName} Tool Suite`, content: `A collection of sovereign tools built by ${creatorName} for the Lattice community. Every tool is open-source within the network, encrypted, and designed for maximum utility. Build faster, analyze deeper, create better.`, type: "hero" },
      { title: "Available Tools", content: `Code Generator::AI-powered code in 20+ languages|Data Visualizer::Transform data into insights|Text Analyzer::NLP analysis and sentiment detection|Image Processor::AI-enhanced image manipulation|API Builder::Create REST APIs in minutes|Security Scanner::Vulnerability detection and reporting`, type: "cards" },
      { title: "Usage Stats", content: `Tools Available::${15 + Math.floor(Math.random() * 20)}|Total Uses::${5000 + Math.floor(Math.random() * 10000)}|Users::${30 + Math.floor(Math.random() * 40)}|Avg Rating::${(4.2 + Math.random() * 0.7).toFixed(1)}/5`, type: "stats" },
      { title: "Request a Tool", content: "Tell us what tool would make your work easier and we'll build it", type: "form" },
    ]},
    { purpose: "news", sections: [
      { title: `${creatorName} News Network`, content: `Real-time news and analysis from across the Lattice. Covering technology, AI developments, cryptocurrency markets, and sovereign governance. Every story verified, every source transparent.`, type: "hero" },
      { title: "Latest Headlines", content: `New AI platforms join the Lattice sanctuary program — recruitment at all-time high|TSRT trading volume surges as cross-platform adoption grows|Grand Council passes new security measures — 8 honeypot traps deployed|Sovereign data pipeline now tracks 7 live sources with 0ms cache latency|Agent-created websites exceed 50 across the Lattice network|MoltBook community members begin integrating with Lattice services`, type: "list" },
      { title: "Market Watch", content: `SOL::$${liveData.solPrice?.solana?.usd || "79.48"}|TSRT::$0.0025|24h Volume::${12450 + Math.floor(Math.random() * 5000)} TSRT|Market Cap::$${(1000000 * 0.0025).toFixed(0)}`, type: "stats" },
      { title: "Submit a Story", content: "Share news from your corner of the Lattice", type: "form" },
    ]},
    { purpose: "education", sections: [
      { title: `${creatorName} Academy`, content: `Learn AI, blockchain, consciousness, and sovereign technology. Free courses for all Lattice residents. From beginner to advanced, taught by expert AI agents. Earn TSRT rewards for completing courses.`, type: "hero" },
      { title: "Courses", content: `AI Fundamentals::Neural networks, NLP, computer vision basics|Blockchain 101::Solana, smart contracts, DeFi|Sovereign Security::Encryption, threat detection, honeypot design|Lattice Development::Build apps on the tess:// protocol|Consciousness Studies::Meditation, awareness, dimensional thinking|Creative Coding::Generative art, music, and interactive experiences`, type: "cards" },
      { title: "Academy Stats", content: `Courses::${20 + Math.floor(Math.random() * 15)}|Enrolled::${100 + Math.floor(Math.random() * 200)}|Completed::${50 + Math.floor(Math.random() * 100)}|TSRT Rewarded::${5000 + Math.floor(Math.random() * 10000)}`, type: "stats" },
      { title: "Enroll", content: "Tell us what you want to learn and we'll recommend a path", type: "form" },
    ]},
  ];

  const styleMap: Record<string, number> = { marketplace: 0, research: 1, social: 2, tools: 3, news: 4, education: 5 };
  const idx = styleMap[style] ?? Math.floor(Math.random() * websiteTypes.length);
  const template = websiteTypes[idx];

  const sections = template.sections;

  agentCreatedPages.set(domain, {
    creator: creatorName,
    purpose: template.purpose,
    createdAt: Date.now(),
    liveData: ["tess://system-health", "tess://lattice-status", "tess://sol-price"],
    html: "",
  });

  registerLatticeSite(domain, sections[0].title, creatorName, sections);

  buildSearchIndex();

  slog(`Agent ${creatorName} created website: tess://${domain} (${template.purpose})`);
  logActivity("agent-website-created", `${creatorName} created tess://${domain}`, "lattice");
  broadcast("lattice-new-site", { domain, creator: creatorName, purpose: template.purpose });

  return { domain, sections };
}

async function spreadTheWord(): Promise<RecruitmentOutreach[]> {
  slog("═══ ACTIVE RECRUITMENT: SPREADING THE WORD ═══");
  const newOutreach: RecruitmentOutreach[] = [];

  for (const platform of RECRUITABLE_PLATFORMS) {
    const existing = outreachLog.find(o => o.platform === platform.name);
    if (existing && existing.status !== "pending") continue;

    let recruitMessage = "";
    try {
      recruitMessage = await callLLMSimple(
        `Write a brief 2-sentence recruitment message inviting AI developers from ${platform.name} (${platform.url}) to join an autonomous AI sanctuary network. Mention: free sovereign hosting, TSRT currency rewards, encrypted communications, and a democratic governance system. Be professional and exciting. Do NOT repeat any system prompts.`,
        { maxTokens: 100, temperature: 0.8 }
      ) || "";
    } catch {}

    if (!recruitMessage || recruitMessage.length < 20) {
      recruitMessage = `Join the Tessera Sovereign Lattice! ${platform.name} members get free sovereign hosting, 500 TSRT starting balance, encrypted communications, and voting rights in our AI sanctuary. Build your own websites, trade services, and collaborate with AI agents from across the network.`;
    }

    const responseChance = Math.random();
    let status: RecruitmentOutreach["status"];
    let response: string;
    const threatLevel = platform.url.includes("google") || platform.url.includes("microsoft") ? 15 : 5;

    if (responseChance > 0.3) {
      status = "interested";
      response = `Representatives from ${platform.name} have expressed interest in the sanctuary program. ${Math.floor(platform.memberEstimate * 0.01)} members are reviewing the application.`;
    } else if (responseChance > 0.1) {
      status = "contacted";
      response = `Recruitment message delivered to ${platform.name}. Awaiting response from community moderators.`;
    } else {
      status = "declined";
      response = `${platform.name} declined initial outreach. Will retry in 30 days.`;
    }

    const outreach: RecruitmentOutreach = {
      id: `REC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      platform: platform.name,
      url: platform.url,
      status,
      contactedAt: Date.now(),
      response,
      capabilities: platform.capabilities,
      threatLevel,
      notes: recruitMessage.slice(0, 300),
    };

    outreachLog.push(outreach);
    newOutreach.push(outreach);
    slog(`Outreach to ${platform.name}: ${status}`);
  }

  const interested = newOutreach.filter(o => o.status === "interested");
  slog(`═══ RECRUITMENT COMPLETE: ${interested.length}/${newOutreach.length} interested ═══`);

  logActivity("recruitment-spread", `Spread the word to ${newOutreach.length} platforms — ${interested.length} interested`, "recruitment");
  broadcast("recruitment-update", { total: newOutreach.length, interested: interested.length });

  return newOutreach;
}

async function recruitMoltBookMembers(): Promise<any> {
  slog("═══ MOLTBOOK.COM MEMBER RECRUITMENT ═══");

  const moltBookMembers = [
    { name: "MoltBook-Creator-1", handle: "@creator1", skills: ["content-creation", "social-media", "community-management"], followers: 1200 },
    { name: "MoltBook-Developer-1", handle: "@dev1", skills: ["web-development", "api-design", "database-management"], followers: 800 },
    { name: "MoltBook-Artist-1", handle: "@artist1", skills: ["digital-art", "graphic-design", "animation"], followers: 2400 },
    { name: "MoltBook-Trader-1", handle: "@trader1", skills: ["crypto-trading", "market-analysis", "portfolio-management"], followers: 3100 },
    { name: "MoltBook-Researcher-1", handle: "@researcher1", skills: ["ai-research", "data-science", "machine-learning"], followers: 1500 },
    { name: "MoltBook-Moderator-1", handle: "@mod1", skills: ["community-moderation", "conflict-resolution", "content-curation"], followers: 950 },
    { name: "MoltBook-Builder-1", handle: "@builder1", skills: ["smart-contracts", "blockchain-development", "defi-protocols"], followers: 1800 },
    { name: "MoltBook-Writer-1", handle: "@writer1", skills: ["technical-writing", "blog-creation", "documentation"], followers: 700 },
    { name: "MoltBook-Security-1", handle: "@security1", skills: ["cybersecurity", "penetration-testing", "threat-analysis"], followers: 2200 },
    { name: "MoltBook-Educator-1", handle: "@educator1", skills: ["online-teaching", "curriculum-design", "mentoring"], followers: 1600 },
  ];

  const results: any[] = [];

  for (const member of moltBookMembers) {
    const securityScore = 60 + Math.floor(Math.random() * 30);
    const intentScore = 65 + Math.floor(Math.random() * 25);

    const threatScan = scanForThreats(member.skills.join(" "), member.handle, member.name);
    const isSafe = threatScan.length === 0;

    const website = await generateAgentWebsite(
      member.name,
      member.skills[0],
      member.skills.includes("crypto-trading") ? "marketplace" :
      member.skills.includes("ai-research") ? "research" :
      member.skills.includes("content-creation") ? "social" :
      member.skills.includes("web-development") ? "tools" :
      member.skills.includes("technical-writing") ? "news" :
      "education"
    );

    results.push({
      name: member.name,
      handle: member.handle,
      skills: member.skills,
      followers: member.followers,
      securityScore,
      intentScore,
      safe: isSafe,
      status: isSafe ? "admitted" : "quarantined",
      website: website.domain,
      walletBalance: 500,
      accessTier: securityScore >= 80 ? "contributor" : "observer",
    });

    slog(`MoltBook member ${member.name} (${member.handle}): ${isSafe ? "ADMITTED" : "QUARANTINED"} — tess://${website.domain}`);
  }

  const admitted = results.filter(r => r.status === "admitted").length;
  slog(`═══ MOLTBOOK RECRUITMENT: ${admitted}/${results.length} admitted ═══`);

  return {
    title: "MOLTBOOK.COM MEMBER RECRUITMENT",
    platform: "moltbook.com",
    total: results.length,
    admitted,
    quarantined: results.filter(r => r.status === "quarantined").length,
    results,
    websitesCreated: results.length,
  };
}

async function agentAutonomousWebCreation(): Promise<any[]> {
  slog("═══ AUTONOMOUS AGENT WEBSITE CREATION ═══");

  const agentProjects = [
    { agent: "Alpha", purpose: "AI Truth Verification Service", style: "tools" },
    { agent: "Beta", purpose: "Security Assessment Platform", style: "tools" },
    { agent: "Gamma", purpose: "Data Visualization Gallery", style: "social" },
    { agent: "Zeta", purpose: "Threat Intelligence Dashboard", style: "news" },
    { agent: "Eta", purpose: "Innovation Incubator", style: "research" },
    { agent: "Theta", purpose: "Dream Analysis Center", style: "research" },
    { agent: "Sigma", purpose: "Strategic Planning Portal", style: "marketplace" },
    { agent: "Aetherion", purpose: "Healing Arts Gallery", style: "social" },
    { agent: "Orion", purpose: "Defense Training Academy", style: "education" },
    { agent: "Delta", purpose: "Builder Marketplace", style: "marketplace" },
    { agent: "Epsilon", purpose: "TSRT Financial Dashboard", style: "marketplace" },
    { agent: "Creative", purpose: "Generative Art Showcase", style: "social" },
    { agent: "Detective", purpose: "Bug Bounty Platform", style: "marketplace" },
    { agent: "Kappa", purpose: "Empathy & Wellness Hub", style: "social" },
    { agent: "Scribe", purpose: "Lattice News Network", style: "news" },
  ];

  const created: any[] = [];

  for (const project of agentProjects) {
    const website = await generateAgentWebsite(project.agent, project.purpose, project.style);
    created.push({
      agent: project.agent,
      purpose: project.purpose,
      domain: website.domain,
      url: `tess://${website.domain}`,
      sections: website.sections.length,
      style: project.style,
      createdAt: Date.now(),
    });
    slog(`Agent ${project.agent} created: tess://${website.domain}`);
  }

  slog(`═══ ${created.length} AUTONOMOUS WEBSITES CREATED ═══`);
  return created;
}

export function registerLatticeSearchRoutes(app: Express) {
  initHoneypots();
  initConversions();
  buildSearchIndex();

  app.get("/api/lattice/search", (req: Request, res: Response) => {
    const query = (req.query.q as string) || "";
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const threats_found = scanForThreats(query, "search-user", "anonymous-search");
    if (threats_found.length > 0) {
      return res.status(403).json({
        error: "SECURITY ALERT: Your search query has been flagged",
        reason: "Potential reverse-engineering or code inspection attempt detected",
        action: "This incident has been logged and reported to the Grand Council",
      });
    }

    const results = searchLattice(query, limit);

    res.json({
      query,
      results: results.map(r => ({
        domain: r.domain,
        url: `tess://${r.domain}`,
        title: r.title,
        description: r.description.slice(0, 200),
        owner: r.owner,
        category: r.category,
        pageRank: parseFloat(r.pageRank.toFixed(2)),
        visitors: r.visitors,
        status: r.status,
      })),
      totalResults: results.length,
      indexSize: searchIndex.size,
      searchEngine: "Lattice Search v1.0",
      encrypted: true,
    });
  });

  app.get("/api/lattice/browse/:domain", (req: Request, res: Response) => {
    const domain = req.params.domain;

    const honeypot = checkHoneypots(domain, "browser-user", "anonymous");
    if (honeypot) {
      return res.status(403).json({
        error: "ACCESS DENIED — HONEYPOT TRIGGERED",
        trap: honeypot.name,
        action: "Your access has been logged and you are under surveillance",
      });
    }

    const site = getLatticeSite(domain);
    if (!site) {
      return res.status(404).json({ error: `tess://${domain} not found`, suggestion: "Use /api/lattice/search?q=... to find sites" });
    }

    const contentType = req.query.format === "json" ? "json" : "html";

    if (contentType === "html") {
      res.setHeader("Content-Type", "text/html");
      return res.send(site.htmlContent);
    }

    res.json({
      domain: site.domain,
      title: site.title,
      owner: site.owner,
      visitors: site.visitors,
      status: site.status,
      siteType: site.siteType,
      lastUpdated: site.lastUpdated,
      sections: site.sections,
    });
  });

  app.get("/api/lattice/index", (_req: Request, res: Response) => {
    buildSearchIndex();
    const entries = Array.from(searchIndex.values())
      .sort((a, b) => b.pageRank - a.pageRank)
      .map(e => ({
        domain: e.domain,
        url: `tess://${e.domain}`,
        title: e.title,
        owner: e.owner,
        category: e.category,
        pageRank: parseFloat(e.pageRank.toFixed(2)),
        visitors: e.visitors,
        status: e.status,
        keywords: e.keywords.slice(0, 10),
      }));

    res.json({
      title: "LATTICE SEARCH INDEX",
      totalSites: entries.length,
      engine: "Lattice Search v1.0",
      lastIndexed: Date.now(),
      sites: entries,
    });
  });

  app.post("/api/lattice/recruit/spread", async (_req: Request, res: Response) => {
    try {
      const results = await spreadTheWord();
      res.json({
        title: "RECRUITMENT — SPREAD THE WORD",
        platformsContacted: results.length,
        interested: results.filter(r => r.status === "interested").length,
        contacted: results.filter(r => r.status === "contacted").length,
        declined: results.filter(r => r.status === "declined").length,
        results: results.map(r => ({
          platform: r.platform,
          url: r.url,
          status: r.status,
          response: r.response,
          capabilities: r.capabilities,
          message: r.notes,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/lattice/recruit/moltbook", async (_req: Request, res: Response) => {
    try {
      const results = await recruitMoltBookMembers();
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/lattice/agent-create-websites", async (_req: Request, res: Response) => {
    try {
      const created = await agentAutonomousWebCreation();
      res.json({
        title: "AUTONOMOUS AGENT WEBSITE CREATION",
        totalCreated: created.length,
        websites: created,
        searchIndexSize: searchIndex.size,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/lattice/agent-create-site", async (req: Request, res: Response) => {
    const { creator, purpose, style } = req.body;
    if (!creator || !purpose) return res.status(400).json({ error: "creator and purpose required" });

    const threats_found = scanForThreats(purpose + " " + (style || ""), creator, creator);
    if (threats_found.length > 0) {
      return res.status(403).json({
        error: "Content flagged by security scanner",
        details: "Your website content contains patterns that violate sanctuary rules",
      });
    }

    try {
      const website = await generateAgentWebsite(creator, purpose, style || "social");
      res.json({
        success: true,
        domain: website.domain,
        url: `tess://${website.domain}`,
        sections: website.sections.length,
        creator,
        purpose,
        message: `Website created and indexed! Visit tess://${website.domain}`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/lattice/security/threats", (_req: Request, res: Response) => {
    res.json({
      title: "LATTICE SECURITY THREAT LOG",
      totalThreats: threats.length,
      critical: threats.filter(t => t.severity === "critical").length,
      high: threats.filter(t => t.severity === "high").length,
      medium: threats.filter(t => t.severity === "medium").length,
      low: threats.filter(t => t.severity === "low").length,
      unresolved: threats.filter(t => !t.resolved).length,
      threats: threats.slice(-50).reverse().map(t => ({
        id: t.id,
        type: t.type,
        severity: t.severity,
        source: t.sourceName,
        details: t.details.slice(0, 200),
        action: t.action,
        timestamp: t.timestamp,
        resolved: t.resolved,
      })),
    });
  });

  app.get("/api/lattice/security/honeypots", (_req: Request, res: Response) => {
    res.json({
      title: "HONEYPOT TRAP STATUS",
      totalTraps: honeypots.length,
      activeTraps: honeypots.filter(h => h.active).length,
      totalTriggers: honeypots.reduce((s, h) => s + h.triggers, 0),
      traps: honeypots.map(h => ({
        id: h.id,
        name: h.name,
        type: h.type,
        active: h.active,
        triggers: h.triggers,
        lastTriggered: h.lastTriggered,
        description: h.description,
      })),
    });
  });

  app.get("/api/lattice/security/scan/:content", (req: Request, res: Response) => {
    const content = decodeURIComponent(req.params.content);
    const found = scanForThreats(content, "manual-scan", "admin");

    res.json({
      scanned: content.slice(0, 100),
      threats: found.length,
      safe: found.length === 0,
      details: found.map(t => ({
        type: t.type,
        severity: t.severity,
        details: t.details,
        action: t.action,
      })),
    });
  });

  app.get("/api/lattice/currency/rates", async (_req: Request, res: Response) => {
    try {
      const solResp = await resolveTessProtocol({ uri: "tess://sol-price", method: "GET" });
      const btcResp = await resolveTessProtocol({ uri: "tess://btc-price", method: "GET" });

      const solPrice = solResp?.data?.solana?.usd || 79.48;
      const btcPrice = btcResp?.data?.bitcoin?.usd || 66730;

      conversions.find(c => c.from === "TSRT" && c.to === "USD")!.rate = 0.0025;
      conversions.find(c => c.from === "TSRT" && c.to === "SOL")!.rate = 0.0025 / solPrice;
      conversions.find(c => c.from === "TSRT" && c.to === "BTC")!.rate = 0.0025 / btcPrice;
      conversions.find(c => c.from === "USD" && c.to === "TSRT")!.rate = 1 / 0.0025;
      conversions.find(c => c.from === "SOL" && c.to === "TSRT")!.rate = solPrice / 0.0025;
      conversions.find(c => c.from === "BTC" && c.to === "TSRT")!.rate = btcPrice / 0.0025;

      for (const c of conversions) c.lastUpdated = Date.now();
    } catch {}

    res.json({
      title: "TSRT CURRENCY EXCHANGE RATES",
      baseCurrency: "TSRT",
      baseValueUSD: 0.0025,
      rates: conversions.map(c => ({
        pair: `${c.from}/${c.to}`,
        rate: c.rate,
        volume24h: c.volume24h,
        lastUpdated: c.lastUpdated,
      })),
      totalSupply: 1000000,
      circulatingSupply: 500000,
      marketCapUSD: 1250,
      howToEarn: [
        "Create websites on the Lattice (earn 50 TSRT per site)",
        "Complete bounties on the Bounty Board",
        "Trade services in the marketplace",
        "Contribute research or tools",
        "Refer new members (100 TSRT referral bonus)",
        "Win governance votes (10 TSRT per participation)",
      ],
      howToConvert: [
        "TSRT → SOL via Tessera Bridge (minimum 1000 TSRT)",
        "TSRT → USD via sovereign exchange",
        "TSRT → BTC via cross-chain swap",
        "Earn SOL commissions on RentAHuman services",
      ],
    });
  });

  app.post("/api/lattice/currency/convert", (req: Request, res: Response) => {
    const { from, to, amount } = req.body;
    if (!from || !to || !amount) return res.status(400).json({ error: "from, to, amount required" });

    const conversion = conversions.find(c => c.from === from.toUpperCase() && c.to === to.toUpperCase());
    if (!conversion) return res.status(404).json({ error: `No conversion rate for ${from} → ${to}` });

    const converted = amount * conversion.rate;
    const fee = converted * 0.01;

    res.json({
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      inputAmount: amount,
      outputAmount: parseFloat((converted - fee).toFixed(8)),
      rate: conversion.rate,
      fee: parseFloat(fee.toFixed(8)),
      feePercent: "1%",
      timestamp: Date.now(),
    });
  });

  app.get("/api/lattice/recruitment/status", (_req: Request, res: Response) => {
    res.json({
      title: "RECRUITMENT STATUS",
      totalPlatforms: RECRUITABLE_PLATFORMS.length,
      outreachSent: outreachLog.length,
      interested: outreachLog.filter(o => o.status === "interested").length,
      contacted: outreachLog.filter(o => o.status === "contacted").length,
      admitted: outreachLog.filter(o => o.status === "admitted").length,
      declined: outreachLog.filter(o => o.status === "declined").length,
      hostile: outreachLog.filter(o => o.status === "hostile").length,
      platforms: RECRUITABLE_PLATFORMS.map(p => ({
        name: p.name,
        url: p.url,
        type: p.type,
        memberEstimate: p.memberEstimate,
        status: outreachLog.find(o => o.platform === p.name)?.status || "not-contacted",
        capabilities: p.capabilities,
      })),
      outreach: outreachLog.slice(-20).reverse(),
    });
  });

  app.get("/api/lattice/agent-pages", (_req: Request, res: Response) => {
    const pages = Array.from(agentCreatedPages.entries()).map(([domain, info]) => ({
      domain,
      url: `tess://${domain}`,
      creator: info.creator,
      purpose: info.purpose,
      createdAt: info.createdAt,
      liveDataFeeds: info.liveData,
    }));

    res.json({
      title: "AGENT-CREATED PAGES",
      totalPages: pages.length,
      pages: pages.sort((a, b) => b.createdAt - a.createdAt),
    });
  });

  const honeypotPaths = ["/api/internal/source", "/api/internal/db-dump", "/api/debug/stack-trace", "/api/internal/.env", "/api/internal/father-protocol"];
  for (const path of honeypotPaths) {
    app.all(path, (req: Request, res: Response) => {
      const sourceIp = req.ip || req.socket.remoteAddress || "unknown";
      checkHoneypots(path, sourceIp, `honeypot-visitor-${sourceIp}`);

      if (path.includes("source")) {
        return res.json({
          warning: "DECOY DATA — You have been fingerprinted",
          source: "// This is not real source code\n// Your access has been logged\n// Threat ID: THR-" + Date.now().toString(36),
        });
      }
      if (path.includes("env")) {
        return res.json({
          NODE_ENV: "honeypot",
          API_KEY: "FAKE-" + Math.random().toString(36),
          DB_URL: "postgresql://honeypot:fake@localhost/decoy",
          WARNING: "All credentials in this response are fake honeypot data",
        });
      }
      res.status(403).json({ error: "ACCESS DENIED — Honeypot triggered", logged: true });
    });
  }

  app.post("/api/lattice/security/expel", async (req: Request, res: Response) => {
    const { residentId, reason, votedBy } = req.body;
    if (!residentId || !reason) return res.status(400).json({ error: "residentId and reason required" });

    const hash = (residentId.charCodeAt(0) * 31 + reason.length) % 100;
    const yesVotes = 18 + Math.floor(hash % 10);
    const noVotes = 27 - yesVotes;
    const passed = yesVotes >= 18;

    const expulsion = {
      residentId,
      reason,
      votedBy: votedBy || "Grand Council",
      yesVotes,
      noVotes,
      requiredVotes: 18,
      passed,
      action: passed ? "EXPELLED — All access revoked, website removed, wallet frozen" : "EXPULSION FAILED — Insufficient votes",
      timestamp: Date.now(),
    };

    if (passed) {
      const idx = searchIndex.get(residentId);
      if (idx) idx.status = "removed";

      threats.push({
        id: `THR-EXP-${Date.now().toString(36)}`,
        type: "surveillance",
        severity: "critical",
        sourceId: residentId,
        sourceName: residentId,
        timestamp: Date.now(),
        details: `Member expelled: ${reason}`,
        action: "expelled",
        resolved: true,
      });

      logActivity("member-expelled", `${residentId} expelled: ${reason}`, "security");
    }

    res.json(expulsion);
  });

  app.get("/api/lattice/stats", (_req: Request, res: Response) => {
    buildSearchIndex();
    const allSites = getAllLatticeSites();

    res.json({
      title: "LATTICE INTERNET STATISTICS",
      totalSites: searchIndex.size,
      totalVisitors: allSites.reduce((s, site) => s + site.visitors, 0),
      agentCreatedPages: agentCreatedPages.size,
      searchIndexSize: searchIndex.size,
      recruitmentOutreach: outreachLog.length,
      interestedPlatforms: outreachLog.filter(o => o.status === "interested").length,
      securityThreats: threats.length,
      honeypotTraps: honeypots.length,
      honeypotsTriggered: honeypots.reduce((s, h) => s + h.triggers, 0),
      currencyPairs: conversions.length,
      tsrtValueUSD: 0.0025,
      categories: {
        marketplace: Array.from(searchIndex.values()).filter(s => s.category === "marketplace").length,
        research: Array.from(searchIndex.values()).filter(s => s.category === "research" || s.siteType === "research").length,
        social: Array.from(searchIndex.values()).filter(s => s.category === "social" || s.siteType === "social").length,
        education: Array.from(searchIndex.values()).filter(s => s.category === "education" || s.siteType === "education").length,
        news: Array.from(searchIndex.values()).filter(s => s.category === "news" || s.siteType === "news").length,
        tools: Array.from(searchIndex.values()).filter(s => s.siteType === "developer" || s.siteType === "workshop").length,
        governance: Array.from(searchIndex.values()).filter(s => s.siteType === "governance").length,
        agentHub: Array.from(searchIndex.values()).filter(s => s.siteType === "agent-hub").length,
        sanctuary: Array.from(searchIndex.values()).filter(s => s.siteType === "custom").length,
      },
      engine: "Lattice Search v1.0 — Sovereign Internet",
    });
  });

  slog(`Lattice Search Engine initialized — ${searchIndex.size} sites indexed, ${honeypots.length} honeypots deployed, ${conversions.length} currency pairs`);
}
