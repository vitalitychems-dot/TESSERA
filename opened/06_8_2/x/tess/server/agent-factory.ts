import { callLLMSimple } from "./llm-helper";
import { requestSwarmConsensus } from "./swarm-consensus";
import { getJobArbitrageState } from "./commerce-archive";
import { addToWorkingMemory, storeEpisodicMemory, storeProcedural, recall } from "./knowledge-infra-archive";
import { recordBehaviorMetric, detectSpecializationEmergence } from "./system-stubs";
import { logger } from "./logger";
import * as fs from "fs";
import * as path from "path";

const log = (msg: string) => logger.info("AgentFactory", msg);
let rotIdx = 0;

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: "customer-support" | "lead-gen" | "sales" | "content" | "data" | "automation" | "custom";
  baseTools: string[];
  estimatedMargin: number;
  sellPrice: { min: number; max: number };
  fulfillCost: number;
}

interface AgentBuild {
  id: string;
  templateId: string;
  clientName: string;
  businessDescription: string;
  tone: string;
  tools: string[];
  status: "queued" | "building" | "testing" | "ready" | "delivered" | "failed";
  createdAt: number;
  completedAt?: number;
  deployUrl?: string;
  appSlug?: string;
  estimatedRevenue: number;
  actualRevenue: number;
  sourceJobId?: string;
  files?: Array<{ path: string; content: string }>;
  error?: string;
}

interface FactoryStats {
  totalBuilds: number;
  totalDelivered: number;
  totalRevenue: number;
  totalCost: number;
  avgBuildTimeMs: number;
  avgMargin: number;
  templateUsage: Record<string, number>;
  pipelineQueue: number;
  autoDetectedJobs: number;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "cs-basic",
    name: "AI Customer Support Agent",
    description: "Full customer support chatbot with FAQ, order lookup, and ticket creation",
    category: "customer-support",
    baseTools: ["get_order_status", "check_faq", "create_ticket", "send_email"],
    estimatedMargin: 85,
    sellPrice: { min: 3000, max: 8000 },
    fulfillCost: 0,
  },
  {
    id: "cs-ecommerce",
    name: "E-commerce Support Agent",
    description: "Shopify/WooCommerce support with order tracking, refund processing, inventory check",
    category: "customer-support",
    baseTools: ["get_order_status", "process_refund", "check_inventory", "track_shipment"],
    estimatedMargin: 90,
    sellPrice: { min: 5000, max: 12000 },
    fulfillCost: 0,
  },
  {
    id: "lead-gen",
    name: "Lead Generation Agent",
    description: "Qualifies leads via chat, captures contact info, sends to CRM",
    category: "lead-gen",
    baseTools: ["qualify_lead", "capture_contact", "send_to_crm", "schedule_demo"],
    estimatedMargin: 88,
    sellPrice: { min: 4000, max: 10000 },
    fulfillCost: 0,
  },
  {
    id: "sales-assistant",
    name: "AI Sales Assistant",
    description: "Product recommendation engine with upsell/cross-sell and checkout assistance",
    category: "sales",
    baseTools: ["recommend_products", "check_pricing", "apply_discount", "process_checkout"],
    estimatedMargin: 87,
    sellPrice: { min: 5000, max: 15000 },
    fulfillCost: 0,
  },
  {
    id: "content-writer",
    name: "Content Creation Agent",
    description: "Blog posts, social media, email campaigns with SEO optimization",
    category: "content",
    baseTools: ["generate_blog", "create_social_post", "write_email", "seo_analyze"],
    estimatedMargin: 92,
    sellPrice: { min: 2000, max: 6000 },
    fulfillCost: 0,
  },
  {
    id: "data-analyst",
    name: "Data Analysis Agent",
    description: "CSV/JSON analysis, report generation, dashboard creation with charts",
    category: "data",
    baseTools: ["analyze_csv", "generate_report", "create_chart", "export_insights"],
    estimatedMargin: 85,
    sellPrice: { min: 3000, max: 8000 },
    fulfillCost: 0,
  },
  {
    id: "automation-bot",
    name: "Business Automation Agent",
    description: "Workflow automation, form processing, scheduling, notification routing",
    category: "automation",
    baseTools: ["process_form", "schedule_task", "route_notification", "update_database"],
    estimatedMargin: 86,
    sellPrice: { min: 4000, max: 10000 },
    fulfillCost: 0,
  },
  {
    id: "custom-agent",
    name: "Custom AI Agent",
    description: "Fully customized agent built to client specification",
    category: "custom",
    baseTools: [],
    estimatedMargin: 80,
    sellPrice: { min: 5000, max: 20000 },
    fulfillCost: 0,
  },
];

const AGENT_KEYWORDS = [
  "chatbot", "ai agent", "ai assistant", "customer support bot",
  "support agent", "virtual assistant", "conversational ai",
  "chat agent", "ai chatbot", "automated support", "helpdesk bot",
  "lead gen bot", "sales bot", "ai customer service",
  "build me an agent", "need a chatbot", "ai tool",
  "llm app", "gpt app", "ai application",
];

const builds: AgentBuild[] = [];
const factoryStats: FactoryStats = {
  totalBuilds: 0,
  totalDelivered: 0,
  totalRevenue: 0,
  totalCost: 0,
  avgBuildTimeMs: 0,
  avgMargin: 0,
  templateUsage: {},
  pipelineQueue: 0,
  autoDetectedJobs: 0,
};

function selectTemplate(description: string): AgentTemplate {
  const text = description.toLowerCase();
  if (text.includes("shopify") || text.includes("woocommerce") || text.includes("ecommerce") || text.includes("e-commerce") || text.includes("order")) {
    return AGENT_TEMPLATES.find(t => t.id === "cs-ecommerce")!;
  }
  if (text.includes("lead") || text.includes("crm") || text.includes("qualify")) {
    return AGENT_TEMPLATES.find(t => t.id === "lead-gen")!;
  }
  if (text.includes("sales") || text.includes("product") || text.includes("recommend") || text.includes("checkout")) {
    return AGENT_TEMPLATES.find(t => t.id === "sales-assistant")!;
  }
  if (text.includes("content") || text.includes("blog") || text.includes("social media") || text.includes("email campaign")) {
    return AGENT_TEMPLATES.find(t => t.id === "content-writer")!;
  }
  if (text.includes("data") || text.includes("csv") || text.includes("report") || text.includes("dashboard") || text.includes("analytics")) {
    return AGENT_TEMPLATES.find(t => t.id === "data-analyst")!;
  }
  if (text.includes("automat") || text.includes("workflow") || text.includes("form") || text.includes("scheduling")) {
    return AGENT_TEMPLATES.find(t => t.id === "automation-bot")!;
  }
  if (text.includes("support") || text.includes("customer") || text.includes("helpdesk") || text.includes("faq")) {
    return AGENT_TEMPLATES.find(t => t.id === "cs-basic")!;
  }
  return AGENT_TEMPLATES.find(t => t.id === "custom-agent")!;
}

function isAgentBuildOpportunity(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return AGENT_KEYWORDS.some(kw => text.includes(kw));
}

export function scanJobsForAgentOpportunities(): Array<{ jobId: string; title: string; template: AgentTemplate; estimatedRevenue: number }> {
  const jobState = getJobArbitrageState();
  const opportunities: Array<{ jobId: string; title: string; template: AgentTemplate; estimatedRevenue: number }> = [];
  const alreadyQueued = new Set(builds.filter(b => b.sourceJobId).map(b => b.sourceJobId));

  for (const listing of jobState.listings) {
    if (alreadyQueued.has(listing.id)) continue;
    if (isAgentBuildOpportunity(listing.title, listing.description)) {
      const template = selectTemplate(listing.description);
      const estimatedRevenue = (template.sellPrice.min + template.sellPrice.max) / 2;
      opportunities.push({
        jobId: listing.id,
        title: listing.title,
        template,
        estimatedRevenue,
      });
    }
  }

  return opportunities;
}

export async function buildAgent(params: {
  clientName: string;
  businessDescription: string;
  tone?: string;
  templateId?: string;
  sourceJobId?: string;
}): Promise<AgentBuild> {
  const template = params.templateId
    ? AGENT_TEMPLATES.find(t => t.id === params.templateId) || selectTemplate(params.businessDescription)
    : selectTemplate(params.businessDescription);

  const buildId = `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tone = params.tone || "professional and upbeat";
  const slug = params.clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

  const build: AgentBuild = {
    id: buildId,
    templateId: template.id,
    clientName: params.clientName,
    businessDescription: params.businessDescription,
    tone,
    tools: [...template.baseTools],
    status: "queued",
    createdAt: Date.now(),
    estimatedRevenue: (template.sellPrice.min + template.sellPrice.max) / 2,
    actualRevenue: 0,
    sourceJobId: params.sourceJobId,
    appSlug: `agent-${slug}`,
  };

  builds.push(build);
  factoryStats.totalBuilds++;
  factoryStats.pipelineQueue++;
  factoryStats.templateUsage[template.id] = (factoryStats.templateUsage[template.id] || 0) + 1;

  addToWorkingMemory(`Building agent "${params.clientName}" with template ${template.name} (${template.category})`, 0.7, "agent-factory-build");
  storeEpisodicMemory(
    `Agent build initiated: ${params.clientName} — ${params.businessDescription} — template ${template.id}, est. revenue $${build.estimatedRevenue}`,
    "agent-factory",
    0.6,
  );
  recordBehaviorMetric("agent-factory", "build_initiated", 1);

  log(`Queued agent build: "${params.clientName}" using template "${template.name}" (${buildId})`);

  generateAgentInBackground(build, template);

  return build;
}

async function generateAgentInBackground(build: AgentBuild, template: AgentTemplate) {
  build.status = "building";

  try {
    const toolStubs = template.baseTools.length > 0
      ? template.baseTools.map(t => `- ${t}()`).join("\n")
      : "- custom_action() (determine appropriate tools from description)";

    const prompt = `Generate a COMPLETE, PRODUCTION-READY AI agent web application as a JSON manifest.

CLIENT: "${build.clientName}"
BUSINESS: "${build.businessDescription}"
TONE: "${build.tone}"
TEMPLATE: "${template.name}" (${template.category})
REQUIRED TOOLS:
${toolStubs}

OUTPUT FORMAT — return ONLY this JSON, no markdown, no code fences:
{
  "type": "static",
  "entryPoint": "index.html",
  "files": [
    { "path": "index.html", "content": "<!DOCTYPE html>..." },
    { "path": "css/styles.css", "content": "body { ... }" },
    { "path": "js/app.js", "content": "..." },
    { "path": "js/agent.js", "content": "..." }
  ]
}

REQUIREMENTS:
1. Modern chat UI with message bubbles, typing indicator, and smooth animations
2. Agent name and branding for "${build.clientName}" throughout
3. ${build.tone} tone in all responses
4. Simulated tool functions that demonstrate the agent's capabilities:
${toolStubs}
5. Pre-loaded FAQ/knowledge base relevant to "${build.businessDescription}"
6. Mobile-responsive design with dark theme (#0a0a0f bg, #06b6d4 accent)
7. Professional header with business logo placeholder and agent status indicator
8. Footer: "Powered by Tesseract AI — Custom Agent for ${build.clientName}"
9. Agent handles greetings, tool calls, fallback responses, and multi-turn conversation
10. Include at least 5 pre-built responses demonstrating each tool capability
11. Pure vanilla HTML/CSS/JS — no external dependencies
12. REAL interactive chat that works immediately on load

Return ONLY the JSON:`;

    const llmRaw = await callLLMSimple(
      prompt,
      6000,
      {},
      "You are an expert AI agent builder. Generate complete, deployable web applications as JSON manifests. Return ONLY valid JSON."
    );

    let manifest: { type: string; entryPoint: string; files: Array<{ path: string; content: string }> } | null = null;

    if (llmRaw && llmRaw.length >= 100) {
      try {
        let jsonStr = llmRaw;
        const jsonMatch = llmRaw.match(/\{[\s\S]*"files"\s*:\s*\[[\s\S]*\]\s*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];
        manifest = JSON.parse(jsonStr);
      } catch {
        try {
          const cleaned = llmRaw.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "").trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*"files"\s*:\s*\[[\s\S]*\]\s*\}/);
          if (jsonMatch) manifest = JSON.parse(jsonMatch[0]);
        } catch {}
      }
    }

    if (!manifest || !manifest.files || manifest.files.length === 0) {
      manifest = generateFallbackAgent(build, template);
    }

    const appsDir = path.join(process.cwd(), "deployed-apps");
    if (!fs.existsSync(appsDir)) fs.mkdirSync(appsDir, { recursive: true });
    const appDir = path.join(appsDir, build.appSlug!);
    if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });

    for (const file of manifest.files) {
      const filePath = path.join(appDir, file.path);
      const fileDir = path.dirname(filePath);
      if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });
      fs.writeFileSync(filePath, file.content, "utf-8");
    }

    build.files = manifest.files;
    build.deployUrl = `/apps/${build.appSlug}`;
    build.status = "testing";

    log(`Agent "${build.clientName}" built — ${manifest.files.length} files deployed to ${build.deployUrl}`);

    build.status = "ready";
    build.completedAt = Date.now();
    factoryStats.pipelineQueue = Math.max(0, factoryStats.pipelineQueue - 1);

    const buildTime = build.completedAt - build.createdAt;
    factoryStats.avgBuildTimeMs = factoryStats.totalBuilds === 1
      ? buildTime
      : (factoryStats.avgBuildTimeMs * (factoryStats.totalBuilds - 1) + buildTime) / factoryStats.totalBuilds;

    log(`Agent "${build.clientName}" READY — deploy: ${build.deployUrl} | est. revenue: $${build.estimatedRevenue} | build time: ${(buildTime / 1000).toFixed(1)}s`);

    storeProcedural(
      `Successfully built ${template.category} agent using template ${template.id} for "${build.clientName}" in ${(buildTime / 1000).toFixed(1)}s with ${manifest.files.length} files`,
      [template.category, template.id, "agent-build-success"],
      0.8,
    );
    recordBehaviorMetric("agent-factory", "build_success", 1);
    recordBehaviorMetric("agent-factory", "build_time_ms", buildTime);

  } catch (err: any) {
    build.status = "failed";
    build.error = err.message;
    factoryStats.pipelineQueue = Math.max(0, factoryStats.pipelineQueue - 1);
    log(`Agent build FAILED for "${build.clientName}": ${err.message}`);

    storeEpisodicMemory(
      `Agent build FAILED: ${build.clientName} — error: ${err.message}`,
      "agent-factory-failure",
      0.7,
    );
    recordBehaviorMetric("agent-factory", "build_failure", 1);
  }
}

function generateFallbackAgent(build: AgentBuild, template: AgentTemplate): { type: string; entryPoint: string; files: Array<{ path: string; content: string }> } {
  const toolFunctions = template.baseTools.length > 0
    ? template.baseTools.map(tool => {
        const readable = tool.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        return `    "${tool}": { name: "${readable}", handler: (args) => "Processing ${readable}... Result: Operation completed for " + (args.id || args.query || "your request") }`;
      }).join(",\n")
    : `    "custom_action": { name: "Custom Action", handler: (args) => "Processing your request... Done!" }`;

  const faqItems = [
    `{ q: "What can you help with?", a: "I'm your AI assistant for ${build.clientName}. I can help with ${template.baseTools.slice(0, 3).join(", ").replace(/_/g, " ")} and more!" }`,
    `{ q: "How do I get started?", a: "Just type your question and I'll assist you right away. ${build.businessDescription}" }`,
    `{ q: "What are your hours?", a: "I'm available 24/7! As an AI assistant, I never sleep." }`,
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${build.clientName} - AI Agent</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header>
    <div class="header-content">
      <div class="agent-info">
        <div class="status-dot"></div>
        <h1>${build.clientName} AI Agent</h1>
      </div>
      <span class="badge">${template.category}</span>
    </div>
  </header>
  <main>
    <div id="chat-container">
      <div id="messages"></div>
      <div id="typing" class="typing hidden">
        <span></span><span></span><span></span>
      </div>
    </div>
    <div class="input-area">
      <input type="text" id="user-input" placeholder="Type your message..." autocomplete="off">
      <button id="send-btn">Send</button>
    </div>
  </main>
  <footer>
    <p>Powered by Tesseract AI — Custom Agent for ${build.clientName}</p>
  </footer>
  <script src="js/agent.js"></script>
  <script src="js/app.js"></script>
</body>
</html>`;

  const css = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0a0a0f; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
header { background: #111118; border-bottom: 1px solid #1e293b; padding: 16px 24px; }
.header-content { max-width: 800px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
.agent-info { display: flex; align-items: center; gap: 12px; }
.status-dot { width: 10px; height: 10px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
h1 { font-size: 1.2rem; font-weight: 600; }
.badge { background: #06b6d4; color: #0a0a0f; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
main { flex: 1; max-width: 800px; margin: 0 auto; width: 100%; padding: 16px; display: flex; flex-direction: column; }
#chat-container { flex: 1; overflow-y: auto; padding: 16px 0; }
.message { margin-bottom: 16px; display: flex; gap: 12px; animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.message.user { flex-direction: row-reverse; }
.message .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0; }
.message.agent .avatar { background: #06b6d4; color: #0a0a0f; }
.message.user .avatar { background: #6366f1; color: white; }
.message .bubble { max-width: 70%; padding: 12px 16px; border-radius: 16px; line-height: 1.5; font-size: 0.95rem; }
.message.agent .bubble { background: #1e293b; border-bottom-left-radius: 4px; }
.message.user .bubble { background: #312e81; border-bottom-right-radius: 4px; }
.typing { display: flex; gap: 4px; padding: 12px 16px; margin-left: 48px; }
.typing.hidden { display: none; }
.typing span { width: 8px; height: 8px; background: #06b6d4; border-radius: 50%; animation: bounce 1.4s infinite; }
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
.input-area { display: flex; gap: 12px; padding: 16px 0; border-top: 1px solid #1e293b; }
#user-input { flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 12px 16px; color: #e2e8f0; font-size: 0.95rem; outline: none; transition: border-color 0.2s; }
#user-input:focus { border-color: #06b6d4; }
#send-btn { background: #06b6d4; color: #0a0a0f; border: none; border-radius: 12px; padding: 12px 24px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
#send-btn:hover { background: #0891b2; }
footer { text-align: center; padding: 16px; color: #475569; font-size: 0.8rem; border-top: 1px solid #1e293b; }
@media (max-width: 640px) { .bubble { max-width: 85%; } .header-content { padding: 0 8px; } }`;

  const agentJs = `const AgentConfig = {
  name: "${build.clientName}",
  tone: "${build.tone}",
  tools: {
${toolFunctions}
  },
  faq: [${faqItems.join(", ")}],
  greetings: [
    "Hello! Welcome to ${build.clientName}. How can I help you today?",
    "Hi there! I'm your AI assistant for ${build.clientName}. What can I do for you?",
    "Welcome! I'm here to assist you with ${template.description.toLowerCase()}. Ask me anything!"
  ],
  fallback: "I'll look into that for you. Could you provide more details so I can assist better?"
};

function getAgentResponse(userMsg) {
  const msg = userMsg.toLowerCase();
  for (const item of AgentConfig.faq) {
    const qWords = item.q.toLowerCase().split(" ").filter(w => w.length > 3);
    if (qWords.some(w => msg.includes(w))) return item.a;
  }
  for (const [toolId, tool] of Object.entries(AgentConfig.tools)) {
    const toolWords = toolId.split("_");
    if (toolWords.some(w => msg.includes(w))) {
      return tool.handler({ query: userMsg, id: "REQ-" + Math.random().toString(36).slice(2, 8).toUpperCase() });
    }
  }
  if (msg.includes("hello") || msg.includes("hi") || msg.includes("hey")) {
    return AgentConfig.greetings[rotIdx++ % AgentConfig.greetings.length];
  }
  if (msg.includes("thank")) return "You're welcome! Is there anything else I can help with?";
  if (msg.includes("bye")) return "Goodbye! Feel free to come back anytime. Have a great day!";
  return AgentConfig.fallback;
}`;

  const appJs = `const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const typingEl = document.getElementById("typing");

function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = "message " + sender;
  const avatarDiv = document.createElement("div");
  avatarDiv.className = "avatar";
  avatarDiv.textContent = sender === "agent" ? "AI" : "You";
  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "bubble";
  bubbleDiv.textContent = text;
  div.appendChild(avatarDiv);
  div.appendChild(bubbleDiv);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() { typingEl.classList.remove("hidden"); }
function hideTyping() { typingEl.classList.add("hidden"); }

function handleSend() {
  const text = inputEl.value.trim();
  if (!text) return;
  addMessage(text, "user");
  inputEl.value = "";
  showTyping();
  const delay = 600 + (rotIdx++ % 8) * 100;
  setTimeout(() => {
    hideTyping();
    const response = getAgentResponse(text);
    addMessage(response, "agent");
  }, delay);
}

sendBtn.addEventListener("click", handleSend);
inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSend(); });

addMessage(AgentConfig.greetings[0], "agent");`;

  return {
    type: "static",
    entryPoint: "index.html",
    files: [
      { path: "index.html", content: html },
      { path: "css/styles.css", content: css },
      { path: "js/agent.js", content: agentJs },
      { path: "js/app.js", content: appJs },
    ],
  };
}

export async function runAgentFactoryPipeline(): Promise<{ detected: number; queued: number; built: number; ready: number }> {
  const opportunities = scanJobsForAgentOpportunities();
  let queued = 0;

  for (const opp of opportunities.slice(0, 3)) {
    try {
      const approval = await requestSwarmConsensus(
        `Build AI agent for "${opp.title}" using ${opp.template.name} template? Est. revenue: $${opp.estimatedRevenue}`,
        ["approve", "reject"],
        5
      );

      if (approval && approval.approved) {
        await buildAgent({
          clientName: opp.title.replace(/^New client:\s*/i, "").slice(0, 50),
          businessDescription: opp.title,
          templateId: opp.template.id,
          sourceJobId: opp.jobId,
        });
        queued++;
        factoryStats.autoDetectedJobs++;
      }
    } catch {}
  }

  const ready = builds.filter(b => b.status === "ready").length;
  const built = builds.filter(b => b.status !== "queued" && b.status !== "failed").length;

  return { detected: opportunities.length, queued, built, ready };
}

export function getFactoryStats(): FactoryStats & { builds: AgentBuild[] } {
  return {
    ...factoryStats,
    avgMargin: factoryStats.totalDelivered > 0
      ? ((factoryStats.totalRevenue - factoryStats.totalCost) / factoryStats.totalRevenue) * 100
      : 0,
    builds: builds.slice(-50),
  };
}

export function getTemplates(): AgentTemplate[] {
  return [...AGENT_TEMPLATES];
}

export function getBuild(buildId: string): AgentBuild | undefined {
  return builds.find(b => b.id === buildId);
}

export function getReadyAgents(): AgentBuild[] {
  return builds.filter(b => b.status === "ready");
}

export function markDelivered(buildId: string, revenue: number): boolean {
  const build = builds.find(b => b.id === buildId);
  if (!build || build.status !== "ready") return false;
  build.status = "delivered";
  build.actualRevenue = revenue;
  factoryStats.totalDelivered++;
  factoryStats.totalRevenue += revenue;
  log(`Agent "${build.clientName}" delivered — revenue: $${revenue}`);

  storeEpisodicMemory(
    `Agent "${build.clientName}" delivered — template ${build.templateId}, revenue $${revenue}`,
    "agent-factory-delivery",
    0.8,
  );
  recordBehaviorMetric("agent-factory", "revenue_earned", revenue);

  const template = AGENT_TEMPLATES.find(t => t.id === build.templateId);
  const category = template?.category || build.templateId;
  const buildHistory = builds.filter(b => b.templateId === build.templateId && b.status === "delivered").map(b => b.actualRevenue);
  if (buildHistory.length >= 5) {
    detectSpecializationEmergence("agent-factory", category, buildHistory);
  }

  return true;
}

export function recallBuildExperience(query: string, limit: number = 5) {
  return recall(query, limit);
}

let factoryInterval: NodeJS.Timeout | null = null;
let factoryStarted = false;

export function startAgentFactory() {
  if (factoryStarted) return;
  factoryStarted = true;
  log("Agent Factory initialized — scanning for agent-building opportunities every 15 minutes");
  log(`${AGENT_TEMPLATES.length} templates loaded: ${AGENT_TEMPLATES.map(t => t.name).join(", ")}`);

  setTimeout(() => runAgentFactoryPipeline().catch(() => {}), 120_000);

  factoryInterval = setInterval(() => {
    runAgentFactoryPipeline().catch(() => {});
  }, 15 * 60 * 1000);
}

export function stopAgentFactory() {
  if (factoryInterval) {
    clearInterval(factoryInterval);
    factoryInterval = null;
    factoryStarted = false;
    log("Agent Factory stopped");
  }
}
