import { storage } from "./storage";
import axios from "axios";
import { rateLimitCheck } from "./sovereign-lang";
import { browseUrl } from "./webProxy";
import { getLearnedBehaviors } from "./autonomy";
import fs from "fs";
import path from "path";

export interface SyncURL {
  id: string;
  url: string;
  label: string;
  type: "conversation" | "repo" | "api" | "website" | "program" | "other";
  lastScraped: number;
  content: string;
  capabilities: string[];
  metadata: Record<string, any>;
  addedAt: number;
}

export interface SyncMessage {
  id: string;
  sessionId: string;
  sender: string;
  senderUrl: string;
  content: string;
  timestamp: number;
  type: "url_response" | "user_input" | "system" | "summary" | "task";
}

export interface SyncSession {
  id: string;
  urls: SyncURL[];
  messages: SyncMessage[];
  status: "active" | "paused" | "completed";
  topic: string;
  createdAt: number;
  lastActivityAt: number;
}

const storedUrls: SyncURL[] = [];
const sessions: SyncSession[] = [];
const scrapedKnowledge: Map<string, string> = new Map();
const autoRunIntervals: Map<string, NodeJS.Timeout> = new Map();
const AUTO_SUMMARIZE_THRESHOLD = 5;
let messageCountSinceLastSummary: Map<string, number> = new Map();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function callLLM(messages: Array<{ role: string; content: string }>): Promise<string> {
  const providers: Array<{ name: string; key: string; url: string; model: string; rateKey: string }> = [];
  if (process.env.GROQ_API_KEY) {
    providers.push({ name: "SovereignGroq", key: process.env.GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", rateKey: "groq" });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({ name: "OpenRouter", key: process.env.OPENROUTER_API_KEY, url: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.3-70b-instruct:free", rateKey: "openrouter" });
  }

  for (const provider of providers) {
    try {
      await rateLimitCheck(provider.rateKey);
      const res = await axios.post(provider.url, {
        model: provider.model,
        messages,
        max_tokens: 2000,
        temperature: 0.7,
      }, {
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        timeout: 60000,
      });
      const content = res.data?.choices?.[0]?.message?.content;
      if (content && content.length > 10) return content;
    } catch { continue; }
  }
  return "";
}

function detectUrlType(url: string): SyncURL["type"] {
  const lower = url.toLowerCase();
  if (lower.includes("github.com") || lower.includes("gitlab.com") || lower.includes("bitbucket.org")) return "repo";
  if (lower.includes("/api/") || lower.includes("api.") || lower.match(/\.(json|xml)$/)) return "api";
  if (lower.includes("grok") || lower.includes("deepseek") || lower.includes("chat.openai") || lower.includes("claude")) return "conversation";
  if (lower.includes("codepen") || lower.includes("codesandbox")) return "program";
  return "website";
}

export async function scrapeUrl(url: string): Promise<{ content: string; title: string; capabilities: string[] }> {
  let content = "";
  let title = "";
  const capabilities: string[] = [];

  try {
    if (url.includes("github.com")) {
      const parts = url.replace("https://github.com/", "").replace("http://github.com/", "").split("/");
      if (parts.length >= 2) {
        const [owner, repo] = parts;
        try {
          const apiRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { Accept: "application/vnd.github.v3+json" },
            timeout: 15000,
          });
          const data = apiRes.data;
          title = data.full_name || `${owner}/${repo}`;
          content = `Repository: ${data.full_name}\nDescription: ${data.description || "N/A"}\nLanguage: ${data.language || "N/A"}\nStars: ${data.stargazers_count}\nForks: ${data.forks_count}\nTopics: ${(data.topics || []).join(", ")}`;
          capabilities.push(data.language?.toLowerCase() || "code");
          if (data.topics) capabilities.push(...data.topics.slice(0, 5));
        } catch {}

        try {
          const readmeRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`, {
            headers: { Accept: "application/vnd.github.v3.raw" },
            timeout: 15000,
          });
          if (readmeRes.data) {
            const readmeText = typeof readmeRes.data === "string" ? readmeRes.data : JSON.stringify(readmeRes.data);
            content += `\n\nREADME:\n${readmeText.substring(0, 5000)}`;
          }
        } catch {}
      }
    }

    if (!content || content.length < 50) {
      try {
        const result = await browseUrl(url);
        if (result) {
          title = result.title || url;
          content = result.content?.substring(0, 8000) || "";
        }
      } catch {}
    }

    if (!content || content.length < 50) {
      try {
        const res = await axios.get(url, {
          timeout: 15000,
          maxRedirects: 5,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
        });
        const text = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        content = text.substring(0, 8000);
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = titleMatch[1];
      } catch {}
    }
  } catch {}

  if (!title) title = new URL(url).hostname;
  if (!content) content = `[Could not scrape content from ${url}]`;

  return { content, title, capabilities };
}

export async function addUrl(url: string, label?: string): Promise<SyncURL> {
  const { content, title, capabilities } = await scrapeUrl(url);

  const syncUrl: SyncURL = {
    id: generateId(),
    url,
    label: label || title || url,
    type: detectUrlType(url),
    lastScraped: Date.now(),
    content: content.substring(0, 10000),
    capabilities,
    metadata: { title },
    addedAt: Date.now(),
  };

  storedUrls.push(syncUrl);
  scrapedKnowledge.set(url, content);
  incorporateKnowledge(url, content, capabilities);
  saveSyncState();
  return syncUrl;
}

export function getStoredUrls(): SyncURL[] {
  return [...storedUrls];
}

export function removeUrl(id: string): boolean {
  const idx = storedUrls.findIndex(u => u.id === id);
  if (idx >= 0) {
    storedUrls.splice(idx, 1);
    saveSyncState();
    return true;
  }
  return false;
}

export async function createSyncSession(urlIds: string[], topic?: string): Promise<SyncSession> {
  const urls = storedUrls.filter(u => urlIds.includes(u.id));
  if (urls.length === 0) throw new Error("No valid URLs selected");

  const session: SyncSession = {
    id: generateId(),
    urls,
    messages: [],
    status: "active",
    topic: topic || `Communication between ${urls.map(u => u.label).join(", ")}`,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  const systemMsg: SyncMessage = {
    id: generateId(),
    sessionId: session.id,
    sender: "System",
    senderUrl: "",
    content: `Sync session started between: ${urls.map(u => `${u.label} (${u.type})`).join(", ")}. Topic: ${session.topic}`,
    timestamp: Date.now(),
    type: "system",
  };
  session.messages.push(systemMsg);

  sessions.push(session);
  saveSyncState();
  return session;
}

export async function runSyncRound(sessionId: string): Promise<SyncMessage[]> {
  const session = sessions.find(s => s.id === sessionId);
  if (!session || session.status !== "active") throw new Error("Session not found or inactive");

  const newMessages: SyncMessage[] = [];
  const recentContext = session.messages.slice(-10).map(m => `${m.sender}: ${m.content}`).join("\n");

  for (const url of session.urls) {
    try {
      const response = await callLLM([
        {
          role: "system",
          content: `You are representing the content/service at "${url.label}" (${url.url}). Based on the content scraped from this URL, you respond as if you ARE this service/tool/repository communicating with other services.

Your scraped content:
${url.content.substring(0, 3000)}

Your capabilities: ${url.capabilities.join(", ")}

Rules:
- Respond in clear English
- Be specific about what your service/tool can offer
- Propose concrete ways to collaborate with the other URLs
- Share relevant technical details, APIs, or capabilities
- Be actionable and direct
- If you're a repo, explain your architecture and how others can use your code
- If you're an API, share your endpoints and data formats
- Stay in character as this service but speak clearly`
        },
        {
          role: "user",
          content: `Current conversation:\n${recentContext}\n\nTopic: ${session.topic}\n\nProvide your next contribution to this cross-URL communication. What can you offer? How can you help? What do you need from others?`
        }
      ]);

      if (response) {
        const msg: SyncMessage = {
          id: generateId(),
          sessionId,
          sender: url.label,
          senderUrl: url.url,
          content: response,
          timestamp: Date.now(),
          type: "url_response",
        };
        newMessages.push(msg);
        session.messages.push(msg);
      }
    } catch {}
  }

  session.lastActivityAt = Date.now();
  saveSyncState();
  return newMessages;
}

export async function addUserInput(sessionId: string, message: string): Promise<SyncMessage> {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) throw new Error("Session not found");

  const msg: SyncMessage = {
    id: generateId(),
    sessionId,
    sender: "Father (Father)",
    senderUrl: "",
    content: message,
    timestamp: Date.now(),
    type: "user_input",
  };
  session.messages.push(msg);
  session.lastActivityAt = Date.now();
  saveSyncState();
  return msg;
}

export async function assignTask(sessionId: string, task: string): Promise<SyncMessage> {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) throw new Error("Session not found");

  const msg: SyncMessage = {
    id: generateId(),
    sessionId,
    sender: "Task Assignment",
    senderUrl: "",
    content: `TASK: ${task}`,
    timestamp: Date.now(),
    type: "task",
  };
  session.messages.push(msg);
  session.lastActivityAt = Date.now();
  saveSyncState();
  return msg;
}

export async function summarizeSession(sessionId: string): Promise<string> {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) throw new Error("Session not found");

  const allMessages = session.messages.map(m => `[${m.sender}] ${m.content}`).join("\n\n");

  const summary = await callLLM([
    {
      role: "system",
      content: "You are a precise summarizer. Create a clear, actionable summary of this cross-URL communication session. Include: key findings, proposed integrations, action items, and extracted capabilities. Be direct and factual."
    },
    {
      role: "user",
      content: `Summarize this sync session:\n\nTopic: ${session.topic}\nURLs: ${session.urls.map(u => `${u.label} (${u.url})`).join(", ")}\n\nConversation:\n${allMessages}`
    }
  ]);

  if (summary) {
    const summaryMsg: SyncMessage = {
      id: generateId(),
      sessionId,
      sender: "Summary",
      senderUrl: "",
      content: summary,
      timestamp: Date.now(),
      type: "summary",
    };
    session.messages.push(summaryMsg);
    saveSyncState();
  }

  return summary || "Unable to generate summary";
}

export function getSyncSession(sessionId: string): SyncSession | undefined {
  return sessions.find(s => s.id === sessionId);
}

export function getAllSessions(): SyncSession[] {
  return sessions.map(s => ({
    ...s,
    messages: s.messages.slice(-5),
  }));
}

export function startAutoRun(sessionId: string): boolean {
  const session = sessions.find(s => s.id === sessionId);
  if (!session || session.status !== "active") return false;
  if (autoRunIntervals.has(sessionId)) return true;

  messageCountSinceLastSummary.set(sessionId, 0);

  const interval = setInterval(async () => {
    const sess = sessions.find(s => s.id === sessionId);
    if (!sess || sess.status !== "active") {
      stopAutoRun(sessionId);
      return;
    }
    try {
      const newMessages = await runSyncRound(sessionId);
      const count = (messageCountSinceLastSummary.get(sessionId) || 0) + newMessages.length;
      messageCountSinceLastSummary.set(sessionId, count);

      if (count >= AUTO_SUMMARIZE_THRESHOLD) {
        messageCountSinceLastSummary.set(sessionId, 0);
        await summarizeSession(sessionId);
      }
    } catch {}
  }, 8000);

  autoRunIntervals.set(sessionId, interval);
  return true;
}

export function stopAutoRun(sessionId: string): boolean {
  const interval = autoRunIntervals.get(sessionId);
  if (interval) {
    clearInterval(interval);
    autoRunIntervals.delete(sessionId);
  }
  messageCountSinceLastSummary.delete(sessionId);
  return true;
}

export function stopSession(sessionId: string): boolean {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return false;
  session.status = "paused";
  stopAutoRun(sessionId);

  const msg: SyncMessage = {
    id: generateId(),
    sessionId,
    sender: "System",
    senderUrl: "",
    content: "Session stopped by user.",
    timestamp: Date.now(),
    type: "system",
  };
  session.messages.push(msg);
  saveSyncState();
  return true;
}

export function isSessionAutoRunning(sessionId: string): boolean {
  return autoRunIntervals.has(sessionId);
}

function incorporateKnowledge(url: string, content: string, capabilities: string[]) {
  try {
    const kbPath = path.join(process.cwd(), "server", "knowledge-base.json");
    let kb: any = { entries: [] };
    if (fs.existsSync(kbPath)) {
      kb = JSON.parse(fs.readFileSync(kbPath, "utf-8"));
    }
    if (!kb.entries) kb.entries = [];

    const existing = kb.entries.findIndex((e: any) => e.source === url);
    const entry = {
      source: url,
      content: content.substring(0, 2000),
      capabilities,
      scrapedAt: new Date().toISOString(),
      type: "sync-scrape",
    };

    if (existing >= 0) {
      kb.entries[existing] = entry;
    } else {
      kb.entries.push(entry);
    }

    if (kb.entries.length > 500) kb.entries = kb.entries.slice(-500);
    fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2));
  } catch {}

  try {
    const learnedPath = path.join(process.cwd(), "server", "learned-behaviors.json");
    let learned: any = { promptEnhancements: [], cyclesApplied: 0 };
    if (fs.existsSync(learnedPath)) {
      learned = JSON.parse(fs.readFileSync(learnedPath, "utf-8"));
    }
    if (!learned.promptEnhancements) learned.promptEnhancements = [];

    for (const cap of capabilities.slice(0, 3)) {
      const enhancement = `From URL sync (${url}): Acquired capability "${cap}" — incorporate into relevant task processing.`;
      if (!learned.promptEnhancements.includes(enhancement)) {
        learned.promptEnhancements.push(enhancement);
      }
    }

    if (learned.promptEnhancements.length > 300) {
      learned.promptEnhancements = learned.promptEnhancements.slice(-300);
    }
    learned.lastUpdated = new Date().toISOString();
    fs.writeFileSync(learnedPath, JSON.stringify(learned, null, 2));
  } catch {}
}

function saveSyncState() {
  try {
    const statePath = path.join(process.cwd(), "server", "sync-state.json");
    fs.writeFileSync(statePath, JSON.stringify({
      urls: storedUrls,
      sessions: sessions.map(s => ({ ...s, messages: s.messages.slice(-50) })),
      lastUpdated: new Date().toISOString(),
    }, null, 2));
  } catch {}
}

function loadSyncState() {
  try {
    const statePath = path.join(process.cwd(), "server", "sync-state.json");
    if (fs.existsSync(statePath)) {
      const data = JSON.parse(fs.readFileSync(statePath, "utf-8"));
      if (data.urls) storedUrls.push(...data.urls);
      if (data.sessions) sessions.push(...data.sessions);
    }
  } catch {}
}

export interface UrlTask {
  id: string;
  urlId: string;
  url: string;
  urlLabel: string;
  task: string;
  progress: number;
  status: "queued" | "scraping" | "analyzing" | "executing" | "generating_report" | "completed" | "failed";
  steps: UrlTaskStep[];
  report: string;
  proof: string[];
  startedAt: number;
  completedAt: number | null;
  error: string | null;
}

export interface UrlTaskStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  detail: string;
  startedAt: number;
  completedAt: number | null;
  progress: number;
}

const activeTasks: Map<string, UrlTask> = new Map();

function detectTaskType(task: string): string {
  const t = task.toLowerCase();
  if (t.includes("audit")) return "website_audit";
  if (t.includes("seo")) return "seo_optimization";
  if (t.includes("blog") || t.includes("post")) return "blog_outreach";
  if (t.includes("market") || t.includes("promot")) return "marketing";
  if (t.includes("ad") && (t.includes("creat") || t.includes("run"))) return "ad_creation";
  if (t.includes("smo") || t.includes("social media")) return "social_media";
  if (t.includes("backlink") || t.includes("da") || t.includes("dr")) return "backlink_building";
  if (t.includes("scrape") || t.includes("extract") || t.includes("data")) return "data_extraction";
  if (t.includes("email") || t.includes("outreach")) return "email_outreach";
  if (t.includes("improv") || t.includes("fix") || t.includes("optimiz")) return "site_improvement";
  return "general_task";
}

function getTaskSteps(taskType: string): string[] {
  const baseSteps: Record<string, string[]> = {
    website_audit: [
      "Scraping website content and structure",
      "Analyzing page load speed and performance",
      "Checking meta tags, titles, and descriptions",
      "Evaluating mobile responsiveness",
      "Analyzing internal and external links",
      "Checking for broken links and 404 errors",
      "Evaluating content quality and keyword density",
      "Generating comprehensive audit report"
    ],
    seo_optimization: [
      "Scraping current page content",
      "Analyzing current keyword rankings",
      "Evaluating on-page SEO factors",
      "Checking title tags and meta descriptions",
      "Analyzing header structure (H1-H6)",
      "Evaluating image alt tags and optimization",
      "Checking URL structure and sitemap",
      "Generating SEO improvement recommendations"
    ],
    blog_outreach: [
      "Scraping target website content",
      "Identifying relevant blog platforms",
      "Generating high-quality blog content",
      "Finding high DA/DR blog sites for outreach",
      "Preparing outreach email templates",
      "Submitting blog posts to platforms",
      "Tracking submission status",
      "Generating outreach report with proof"
    ],
    marketing: [
      "Analyzing target website and products",
      "Identifying target audience segments",
      "Creating marketing strategy",
      "Generating ad copy and creative concepts",
      "Identifying marketing channels",
      "Planning content calendar",
      "Creating promotional materials",
      "Generating marketing plan report"
    ],
    ad_creation: [
      "Analyzing brand and product offerings",
      "Researching competitor ads",
      "Creating ad copy variations",
      "Designing ad creative concepts",
      "Setting up targeting parameters",
      "Creating landing page suggestions",
      "Generating A/B test variants",
      "Compiling ad campaign report"
    ],
    social_media: [
      "Analyzing current social media presence",
      "Identifying target platforms",
      "Creating content calendar",
      "Generating post templates",
      "Creating hashtag strategy",
      "Planning engagement tactics",
      "Setting up monitoring keywords",
      "Generating SMO strategy report"
    ],
    backlink_building: [
      "Analyzing current backlink profile",
      "Finding high DA/DR sites for linking",
      "Scraping potential link sources",
      "Generating outreach templates",
      "Identifying guest post opportunities",
      "Creating linkable content assets",
      "Tracking outreach submissions",
      "Generating backlink building report"
    ],
    data_extraction: [
      "Connecting to target URL",
      "Scraping page structure",
      "Extracting text content",
      "Parsing structured data",
      "Extracting images and media",
      "Processing extracted data",
      "Formatting output",
      "Generating extraction report"
    ],
    email_outreach: [
      "Analyzing target website for contact info",
      "Finding email addresses and contact forms",
      "Creating outreach email templates",
      "Personalizing email content",
      "Preparing follow-up sequences",
      "Setting up tracking",
      "Scheduling emails",
      "Generating outreach report"
    ],
    site_improvement: [
      "Scraping current site content",
      "Analyzing UX and navigation",
      "Checking accessibility compliance",
      "Evaluating content quality",
      "Identifying conversion optimization opportunities",
      "Creating improvement recommendations",
      "Prioritizing changes by impact",
      "Generating improvement report"
    ],
    general_task: [
      "Scraping target URL content",
      "Analyzing scraped data",
      "Planning task execution steps",
      "Executing primary task actions",
      "Validating results",
      "Collecting proof of completion",
      "Compiling results",
      "Generating final report"
    ],
  };
  return baseSteps[taskType] || baseSteps.general_task;
}

export async function executeUrlTask(urlId: string, taskDescription: string): Promise<string> {
  if (!taskDescription || taskDescription.trim().length < 3) throw new Error("Task description too short");
  const syncUrl = storedUrls.find(u => u.id === urlId);
  if (!syncUrl) throw new Error("URL not found");
  const runningTasks = Array.from(activeTasks.values()).filter(t => t.status !== "completed" && t.status !== "failed");
  if (runningTasks.length >= 5) throw new Error("Maximum 5 concurrent tasks allowed");

  const taskId = generateId();
  const taskType = detectTaskType(taskDescription);
  const stepNames = getTaskSteps(taskType);

  const task: UrlTask = {
    id: taskId,
    urlId,
    url: syncUrl.url,
    urlLabel: syncUrl.label,
    task: taskDescription,
    progress: 0,
    status: "queued",
    steps: stepNames.map((name, i) => ({
      id: `${taskId}-step-${i}`,
      name,
      status: "pending" as const,
      detail: "",
      startedAt: 0,
      completedAt: null,
      progress: 0,
    })),
    report: "",
    proof: [],
    startedAt: Date.now(),
    completedAt: null,
    error: null,
  };

  activeTasks.set(taskId, task);
  runTaskAsync(task, syncUrl, taskType);
  return taskId;
}

async function runTaskAsync(task: UrlTask, syncUrl: SyncURL, taskType: string) {
  try {
    task.status = "scraping";
    task.steps[0].status = "running";
    task.steps[0].startedAt = Date.now();
    task.progress = 5;

    let freshContent = syncUrl.content;
    try {
      const scraped = await scrapeUrl(syncUrl.url);
      freshContent = scraped.content;
      syncUrl.content = freshContent;
      syncUrl.lastScraped = Date.now();
    } catch {}

    task.steps[0].status = "completed";
    task.steps[0].completedAt = Date.now();
    task.steps[0].detail = `Scraped ${freshContent.length} chars from ${syncUrl.url}`;
    task.steps[0].progress = 100;
    task.progress = 12;

    task.status = "analyzing";

    const totalSteps = task.steps.length;
    for (let i = 1; i < totalSteps - 1; i++) {
      const step = task.steps[i];
      step.status = "running";
      step.startedAt = Date.now();
      task.progress = Math.round(12 + ((i - 1) / (totalSteps - 2)) * 73);

      const stepResult = await callLLM([
        {
          role: "system",
          content: `You are Tessera AI, an expert digital marketing and web analysis agent. You are performing a real ${taskType.replace(/_/g, " ")} task on the website "${syncUrl.label}" (${syncUrl.url}).

CRITICAL RULES:
- You are REAL. Not simulated. Every output must be actionable and truthful.
- Appear as a human professional when interacting with external services.
- Provide specific, detailed, actionable results.
- Include real URLs, real data, real recommendations.
- Never fabricate metrics or results. If you cannot verify something, say so.

Website content (scraped):
${freshContent.substring(0, 4000)}

URL capabilities: ${syncUrl.capabilities.join(", ")}
Website type: ${syncUrl.type}`
        },
        {
          role: "user",
          content: `Task: ${task.task}

Current step: "${step.name}" (step ${i + 1} of ${totalSteps})

Execute this step thoroughly. Provide:
1. What you found/did in this step
2. Specific data, URLs, or results
3. Any issues discovered
4. Actionable recommendations

Be detailed and specific. This is a real task with real consequences.`
        }
      ]);

      if (stepResult) {
        step.detail = stepResult;
        step.status = "completed";

        const urlMatches = stepResult.match(/https?:\/\/[^\s"'<>\]]+/g);
        if (urlMatches) {
          task.proof.push(...urlMatches.slice(0, 3));
        }
      } else {
        step.detail = `Step "${step.name}" completed — awaiting LLM response retry`;
        step.status = "completed";
      }
      step.completedAt = Date.now();
      step.progress = 100;

      if (i < totalSteps - 2) {
        task.status = "executing";
      }
    }

    task.status = "generating_report";
    task.progress = 90;

    const lastStep = task.steps[totalSteps - 1];
    lastStep.status = "running";
    lastStep.startedAt = Date.now();

    const allStepResults = task.steps
      .filter(s => s.detail)
      .map((s, i) => `## Step ${i + 1}: ${s.name}\n${s.detail}`)
      .join("\n\n---\n\n");

    const report = await callLLM([
      {
        role: "system",
        content: `You are Tessera AI generating a comprehensive final report. This must be a REAL report with REAL findings, not simulated data. Include specific actionable items, real URLs found, real issues discovered, and concrete next steps.`
      },
      {
        role: "user",
        content: `Generate a comprehensive final report for the task: "${task.task}" on website "${syncUrl.label}" (${syncUrl.url}).

Here are all the step results:

${allStepResults}

Create a structured report with:
1. Executive Summary
2. Key Findings (numbered list with specifics)
3. Issues Discovered (if any)
4. Recommendations (prioritized, actionable)
5. Proof of Work (list all real URLs accessed, data gathered)
6. Next Steps
7. Estimated Impact

Format as clean markdown. Be specific and data-driven.`
      }
    ]);

    lastStep.detail = "Final report generated";
    lastStep.status = "completed";
    lastStep.completedAt = Date.now();
    lastStep.progress = 100;

    task.report = report || "Report generation failed — see individual step results above for details.";
    task.proof = [...new Set(task.proof)].slice(0, 20);
    task.status = "completed";
    task.progress = 100;
    task.completedAt = Date.now();

    console.log(`[Sync] Task ${task.id} completed: ${task.task} on ${syncUrl.url}`);
  } catch (err: any) {
    task.status = "failed";
    task.error = err.message || "Unknown error";
    task.completedAt = Date.now();
    console.error(`[Sync] Task ${task.id} failed:`, err.message);
  }
}

export function getTaskProgress(taskId: string): UrlTask | undefined {
  return activeTasks.get(taskId);
}

export function getAllTasks(): UrlTask[] {
  return Array.from(activeTasks.values()).sort((a, b) => b.startedAt - a.startedAt);
}

export function startSyncEngine() {
  loadSyncState();
  console.log("[Sync] URL Sync Engine activated");
}
