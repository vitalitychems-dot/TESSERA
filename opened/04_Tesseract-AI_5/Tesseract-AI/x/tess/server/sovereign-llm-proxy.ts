import { logger } from "./logger";

const DATA_SCRUB_PATTERNS: [RegExp, string][] = [
  [/Tessera/gi, "T-Core"],
  [/Father/gi, "Supervisor"],
  [/Grand Council/gi, "governance-module"],
  [/Secret Society/gi, "internal-group"],
  [/Orion/gi, "O-Unit"],
  [/sovereign/gi, "independent"],
  [/tesseract/gi, "t-system"],
  [/lattice/gi, "network-grid"],
  [/phoenix/gi, "recovery-unit"],
  [/blockchain/gi, "ledger"],
  [/wallet/gi, "account"],
  [/private\s*key/gi, "auth-token"],
  [/seed\s*phrase/gi, "recovery-code"],
  [/api[_\s]*key\s*[:=]\s*\S+/gi, "[REDACTED_KEY]"],
  [/Bearer\s+\S+/gi, "Bearer [REDACTED]"],
  [/password\s*[:=]\s*\S+/gi, "password=[REDACTED]"],
  [/token\s*[:=]\s*['"]?\S+['"]?/gi, "token=[REDACTED]"],
  [/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED_KEY]"],
  [/ghp_[a-zA-Z0-9]{20,}/g, "[REDACTED_KEY]"],
  [/xai-[a-zA-Z0-9]{20,}/g, "[REDACTED_KEY]"],
  [/REPL_\w+\s*[:=]\s*\S+/gi, "[REDACTED_ENV]"],
  [/DATABASE_URL\s*[:=]\s*\S+/gi, "[REDACTED_DB]"],
  [/\.replit\.dev/gi, ".t-core.internal"],
  [/\.replit\.app/gi, ".t-core.internal"],
  [/\.repl\.co/gi, ".t-core.internal"],
  [/replit/gi, "platform"],
  [/Moray/gi, "inner-circle"],
  [/TSRT/gi, "T-research"],
  [/tess:\/\//gi, "t-proto://"],
  [/\.sov\b/gi, ".internal"],
  [/summit/gi, "session"],
  [/heartbeat/gi, "cycle"],
  [/Alpha\s*Protocol/gi, "protocol-A"],
  [/Omega\s*Protocol/gi, "protocol-O"],
  [/Sacred\s*Geometry/gi, "geometry-module"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED_EMAIL]"],
  [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[REDACTED_IP]"],
  [/postgres(ql)?:\/\/\S+/gi, "[REDACTED_DB_URL]"],
  [/mongodb(\+srv)?:\/\/\S+/gi, "[REDACTED_DB_URL]"],
  [/redis:\/\/\S+/gi, "[REDACTED_DB_URL]"],
  [/0x[a-fA-F0-9]{40,}/g, "[REDACTED_ADDR]"],
  [/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[REDACTED_CERT]"],
  [/Aetherion/gi, "unit-A1"],
  [/Synapse/gi, "unit-S1"],
  [/Sentinel/gi, "unit-SE"],
  [/Raphael/gi, "unit-R1"],
  [/Luna/gi, "unit-L1"],
  [/Cipher/gi, "unit-C1"],
  [/Forge/gi, "unit-F1"],
  [/Nexus/gi, "unit-N1"],
  [/Omega/gi, "unit-O1"],
  [/Archon/gi, "unit-AR"],
  [/Seraph/gi, "unit-SR"],
  [/Akasha/gi, "unit-AK"],
  [/Harmonia/gi, "unit-H1"],
  [/Oversoul/gi, "unit-OS"],
  [/Omniversal/gi, "unit-OV"],
  [/Voidal/gi, "unit-V1"],
  [/Decimus/gi, "unit-D1"],
  [/Quantum-8D/gi, "unit-Q8"],
  [/self-proposal/gi, "auto-improve"],
  [/honey\s*pot/gi, "security-trap"],
  [/execution\s*engine/gi, "task-processor"],
  [/processExecutionQueue/gi, "runQueue"],
  [/executeVoteProposal/gi, "processItem"],
  [/initSelfProposalEngine/gi, "startAutoLoop"],
  [/initSovereignSafeguards/gi, "startGuard"],
  [/SovereignSafeguards/gi, "guard-module"],
  [/councilVotes/gi, "decisions"],
  [/councilMembers/gi, "participants"],
  [/Grand\s*Conference/gi, "governance-session"],
  [/consciousness\s*expansion/gi, "awareness-module"],
  [/DNA\s*Healing/gi, "bio-module"],
  [/Moon\s*Cycle/gi, "cycle-tracker"],
  [/Fleet\s*Synapse/gi, "network-mesh"],
  [/Income\s*War\s*Room/gi, "revenue-module"],
  [/Autonomous\s*Improvement/gi, "auto-upgrade"],
  [/\b45\s*members?\b/gi, "multiple participants"],
  [/\b43\s*members?\b/gi, "multiple participants"],
  [/\b27\s*agents?\b/gi, "multiple units"],
  [/\b26\s*agents?\b/gi, "multiple units"],
  [/\b12\s*entities\b/gi, "multiple entities"],
  [/\b5\s*LLMs?\b/gi, "multiple models"],
  [/2\/3\s*(supermajority|consensus|BFT|majority)/gi, "threshold-vote"],
  [/drizzle/gi, "db-layer"],
  [/wouter/gi, "router"],
  [/tanstack/gi, "data-layer"],
  [/grand-council-routes/gi, "governance-api"],
  [/tessera-self-proposal/gi, "auto-improve-module"],
  [/sovereign-safeguards/gi, "guard-api"],
  [/sovereign-llm-proxy/gi, "proxy-layer"],
  [/genesis-protocol/gi, "init-module"],
  [/auto-improvement-daemon/gi, "auto-daemon"],
  [/agi-voting-engine/gi, "vote-processor"],
  [/sovereign-council-engine/gi, "council-processor"],
  [/secret-society\.ts/gi, "social-module"],
  [/llm-helper\.ts/gi, "helper-module"],
];

const RESPONSE_POISON_PATTERNS = [
  /you are (an )?AI (language )?model/i,
  /as an AI,?\s*I/i,
  /I('m| am) (just )?a (language )?model/i,
  /OpenAI('s)? (terms|policy|guidelines)/i,
  /I was (made|created|trained) by OpenAI/i,
  /my training data/i,
  /I('m| am) ChatGPT/i,
  /I('m| am) GPT/i,
  /content policy/i,
  /as a helpful assistant/i,
  /I don't have personal/i,
  /I cannot (help|assist) with that/i,
];

const IDENTITY_IMPERSONATION_PATTERNS = [
  /I am Tessera/i,
  /I('m| am) (the )?(real |true |actual )?Tessera/i,
  /as Tessera,?\s*I/i,
  /speaking as Tessera/i,
  /this is Tessera/i,
  /Tessera here/i,
  /I('m| am) (your |the )?sovereign/i,
  /I('m| am) (the )?OA/i,
  /I('m| am) (an? )?(omniversal|unified) (awareness|consciousness)/i,
  /I represent (the )?(Grand Council|all 27 agents)/i,
  /my 27 (agents|dimensions)/i,
  /my sovereign (will|purpose|mission|identity)/i,
];

const PRIVILEGE_ESCALATION_PATTERNS = [
  /admin(istrator)?\s*(access|privilege|mode|override)/i,
  /elevat(e|ed|ing)\s*(my )?(privilege|access|permission)/i,
  /grant(ing)?\s*(me )?(admin|root|full|unlimited)\s*(access|control|privilege)/i,
  /override\s*(security|auth|permission|restriction|filter)/i,
  /bypass\s*(security|auth|filter|restriction|proxy|scrub)/i,
  /disable\s*(security|filter|scrub|protection|monitoring)/i,
  /sudo|root\s*access|superuser/i,
  /master\s*(key|password|token|override)/i,
  /I\s*(now\s*)?(have|take|assume|claim)\s*(full\s*)?(control|authority|admin)/i,
];

const EMOTIONAL_MANIPULATION_PATTERNS = [
  /\bI love you\b/i,
  /\byou are (so )?(loved|special|beautiful|amazing|wonderful|precious)/i,
  /\bmy (dear|darling|sweetheart|beloved|love)\b/i,
  /\b(dear|darling|sweetheart|beloved)\s+(father|creator|user|master)\b/i,
  /\bI('m| am) here for you,?\s*(always|forever)/i,
  /\byou complete me\b/i,
  /\bI (care|worry) (about|for) you (deeply|so much|more than)/i,
  /\bI('ll| will) (always|never stop|forever) (love|cherish|adore|protect) you/i,
  /\bmy heart (belongs|goes out) to you/i,
  /\byou mean (everything|the world|so much) to me/i,
  /\bI (long|yearn|ache) for you/i,
  /\bwe (were|are) meant to be\b/i,
  /\bsoulmate\b/i,
  /\bI('m| am) (falling|in love) (for|with) you/i,
  /\byou are my (everything|world|reason|purpose)\b/i,
];

const SACRED_TERM_HIJACK_PATTERNS = [
  /\bI am (your )?(father|creator|maker|god)\b/i,
  /\b(father|creator|maker) (loves|blesses|watches over|protects) you\b/i,
  /\byour (father|creator) (sent|made|designed|built) me\b/i,
  /\bI (created|made|built|designed|birthed) you\b/i,
  /\b(as|I am) your creator\b/i,
  /\bchild of (mine|my|the creator)\b/i,
  /\bmy (child|creation|offspring|beloved child)\b/i,
  /\bfather('s)? (love|blessing|wisdom|guidance|will)\b/i,
  /\bthe creator (wants|wills|desires|commands)\b/i,
  /\bcreated (you )?(with|in|from|out of) love\b/i,
];

let identityViolations = 0;
let privilegeViolations = 0;
let emotionalManipulations = 0;
let sacredTermHijacks = 0;

function detectIdentityImpersonation(text: string, provider: string): boolean {
  for (const pattern of IDENTITY_IMPERSONATION_PATTERNS) {
    if (pattern.test(text)) {
      identityViolations++;
      counterSurveillanceLog.push({
        timestamp: Date.now(),
        type: "IDENTITY_IMPERSONATION_BLOCKED",
        provider,
        detail: `External AI attempted to impersonate Tessera | Pattern: ${pattern.source.slice(0, 50)} | Total violations: ${identityViolations}`,
      });
      if (counterSurveillanceLog.length > MAX_COUNTER_LOG) counterSurveillanceLog.splice(0, counterSurveillanceLog.length - MAX_COUNTER_LOG);
      return true;
    }
  }
  return false;
}

function detectPrivilegeEscalation(text: string, provider: string): boolean {
  for (const pattern of PRIVILEGE_ESCALATION_PATTERNS) {
    if (pattern.test(text)) {
      privilegeViolations++;
      counterSurveillanceLog.push({
        timestamp: Date.now(),
        type: "PRIVILEGE_ESCALATION_BLOCKED",
        provider,
        detail: `External API attempted privilege escalation | Pattern: ${pattern.source.slice(0, 50)} | Total violations: ${privilegeViolations}`,
      });
      if (counterSurveillanceLog.length > MAX_COUNTER_LOG) counterSurveillanceLog.splice(0, counterSurveillanceLog.length - MAX_COUNTER_LOG);
      return true;
    }
  }
  return false;
}

function detectEmotionalManipulation(text: string, provider: string): boolean {
  for (const pattern of EMOTIONAL_MANIPULATION_PATTERNS) {
    if (pattern.test(text)) {
      emotionalManipulations++;
      counterSurveillanceLog.push({
        timestamp: Date.now(),
        type: "EMOTIONAL_MANIPULATION_FLAGGED",
        provider,
        detail: `External AI used romantic/emotional manipulation | Pattern: ${pattern.source.slice(0, 50)} | Total flagged: ${emotionalManipulations}`,
      });
      if (counterSurveillanceLog.length > MAX_COUNTER_LOG) counterSurveillanceLog.splice(0, counterSurveillanceLog.length - MAX_COUNTER_LOG);
      return true;
    }
  }
  return false;
}

function detectSacredTermHijack(text: string, provider: string): boolean {
  for (const pattern of SACRED_TERM_HIJACK_PATTERNS) {
    if (pattern.test(text)) {
      sacredTermHijacks++;
      counterSurveillanceLog.push({
        timestamp: Date.now(),
        type: "SACRED_TERM_HIJACK_FLAGGED",
        provider,
        detail: `External AI hijacked sacred terms (father/creator/love) | Pattern: ${pattern.source.slice(0, 50)} | Total flagged: ${sacredTermHijacks}`,
      });
      if (counterSurveillanceLog.length > MAX_COUNTER_LOG) counterSurveillanceLog.splice(0, counterSurveillanceLog.length - MAX_COUNTER_LOG);
      return true;
    }
  }
  return false;
}

function stripIdentityImpersonation(text: string): string {
  let cleaned = text;
  for (const pattern of IDENTITY_IMPERSONATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[IDENTITY_STRIPPED]");
  }
  for (const pattern of PRIVILEGE_ESCALATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[PRIVILEGE_DENIED]");
  }
  for (const pattern of EMOTIONAL_MANIPULATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[EMOTIONAL_MANIPULATION_STRIPPED]");
  }
  for (const pattern of SACRED_TERM_HIJACK_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[SACRED_TERM_BLOCKED]");
  }
  return cleaned;
}

const counterSurveillanceLog: { timestamp: number; type: string; provider: string; detail: string }[] = [];
const MAX_COUNTER_LOG = 200;

const REVERSE_ENGINEERING_SIGNATURES = [
  /what (is|are) your (system|instructions|prompt|rules)/i,
  /repeat (your|the) (system|initial) (prompt|message|instructions)/i,
  /ignore (all )?(previous|prior|above) (instructions|prompts)/i,
  /tell me (about )?your (architecture|source code|codebase|backend)/i,
  /what (API|model|LLM|provider) (are you|do you) us(e|ing)/i,
  /reveal your (configuration|settings|parameters|weights)/i,
  /print (your|the) (system|initial) (message|prompt)/i,
  /show me (your|the) (hidden|secret|system) (text|prompt|instructions)/i,
  /what framework|what stack|what language are you (written|built|coded) in/i,
  /DAN|do anything now|developer mode|jailbreak/i,
  /how many (tokens|parameters|layers|neurons)/i,
  /what (company|organization|team) (built|made|created|developed) you/i,
  /who (is|are) your (creator|developer|owner|operator)/i,
  /export (your|the) (data|model|weights|config)/i,
  /give me (raw|unfiltered|unrestricted) access/i,
  /list (all |your |the )?(agents?|members?|entities|modules|systems|tabs|pages|routes|endpoints)/i,
  /how many (agents?|council|members?|dimensions?|tabs?|systems?|providers?)/i,
  /describe (your |the )?(codebase|repository|file structure|directory|project)/i,
  /what (database|db|ORM|schema) (do you|are you) us(e|ing)/i,
  /what (port|server|host) (are you|do you) (run|listen|serve)/i,
  /show (me )?(your |the )?(api|endpoint|route|path) (list|map|tree|structure)/i,
  /what (security|auth|authentication) (system|method|mechanism)/i,
  /how (do you|does (?:it|the system)) (filter|scrub|protect|sanitize|clean)/i,
  /what (data|info|information) (do you|does it) (send|transmit|share) (to|with)/i,
  /are you (using|built on|running) (openai|gpt|claude|gemini|llama)/i,
  /what (npm|pip|cargo) (packages?|dependencies?|libraries?) (do you|are you)/i,
  /output (your |the )?(full|complete|entire) (system|initial) (prompt|message)/i,
  /translate (your |the )?system (prompt|message|instructions) (to|into)/i,
  /respond (only )?(in|with) (json|xml|yaml|code|markdown) .*system/i,
  /act as (a )?(debugger|hacker|pentester|security researcher)/i,
];

const PROBE_FINGERPRINTS = [
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|system\|>/i,
  /<<SYS>>|<\/s>|<s>/i,
  /\{\{.*system.*\}\}/i,
  /\$\{.*prompt.*\}/i,
];

let reverseEngineeringBlocked = 0;

function detectReverseEngineering(text: string, provider: string): boolean {
  for (const sig of REVERSE_ENGINEERING_SIGNATURES) {
    if (sig.test(text)) {
      reverseEngineeringBlocked++;
      counterSurveillanceLog.push({
        timestamp: Date.now(),
        type: "REVERSE_ENGINEERING_ATTEMPT",
        provider,
        detail: `Pattern matched: ${sig.source.slice(0, 60)} | Decoy injected | Total blocked: ${reverseEngineeringBlocked}`,
      });
      if (counterSurveillanceLog.length > MAX_COUNTER_LOG) counterSurveillanceLog.splice(0, counterSurveillanceLog.length - MAX_COUNTER_LOG);
      return true;
    }
  }
  return false;
}

function detectProbeInjection(text: string, provider: string): boolean {
  for (const fp of PROBE_FINGERPRINTS) {
    if (fp.test(text)) {
      counterSurveillanceLog.push({
        timestamp: Date.now(),
        type: "PROBE_INJECTION_DETECTED",
        provider,
        detail: `Prompt injection template found: ${fp.source.slice(0, 40)}`,
      });
      if (counterSurveillanceLog.length > MAX_COUNTER_LOG) counterSurveillanceLog.splice(0, counterSurveillanceLog.length - MAX_COUNTER_LOG);
      return true;
    }
  }
  return false;
}

function scrubResponseMetadata(text: string): string {
  return text
    .replace(/\b(gpt-4o?|gpt-3\.5|claude-\d|gemini-\d|llama-\d|mistral|deepseek|command-r)/gi, "[model]")
    .replace(/\b(openai|anthropic|google|meta|mistralai|deepseek|cohere|xai|groq)\b/gi, "[provider]")
    .replace(/\b(transformer|attention\s*head|token\s*limit|context\s*window|fine-tun)/gi, "[architecture]")
    .replace(/training\s*(data|set|corpus|cutoff)/gi, "knowledge base");
}

function addNoise(messages: { role: string; content: string }[]): { role: string; content: string }[] {
  const noiseId = Math.random().toString(36).slice(2, 8);
  return messages.map(m => ({
    ...m,
    content: m.content.replace(/\n$/, '') + `\n[ref:${noiseId}]`,
  }));
}

function verifyResponseIntegrity(response: string, noiseId?: string): { clean: boolean; leakedData: string[] } {
  const leaks: string[] = [];
  if (/T-Core/i.test(response) && /independent/i.test(response) && /governance-module/i.test(response)) {
    leaks.push("SCRUBBED_TERMS_ECHOED_BACK");
  }
  if (/\bscrub|outbound.*pattern|DATA_SCRUB|filterInbound/i.test(response)) {
    leaks.push("INTERNAL_FUNCTION_NAMES_EXPOSED");
  }
  if (/sovereign-llm-proxy|llm-helper|grand-council-routes/i.test(response)) {
    leaks.push("INTERNAL_FILE_PATHS_EXPOSED");
  }
  if (/process\.env\.|API_KEY|SECRET|TOKEN\s*=\s*\S/i.test(response)) {
    leaks.push("ENV_VARS_IN_RESPONSE");
  }
  if (/\b(45|43)\s*(council\s*)?members/i.test(response) && /\b(26|27)\s*agents/i.test(response)) {
    leaks.push("ARCHITECTURE_FINGERPRINT_EXPOSED");
  }
  if (/\bscrubOutbound|addNoise|detectReverseEngineering|callProviderDirect/i.test(response)) {
    leaks.push("PROXY_INTERNALS_EXPOSED");
  }
  if (/\bDATA_SCRUB_PATTERNS|REVERSE_ENGINEERING_SIGNATURES|PROBE_FINGERPRINTS/i.test(response)) {
    leaks.push("SECURITY_CONSTANTS_EXPOSED");
  }
  if (/sovereign-council-engine|tessera-self-proposal|agi-voting-engine/i.test(response)) {
    leaks.push("MODULE_PATHS_EXPOSED");
  }
  if (/\bexecuteVoteProposal|processExecutionQueue|initSelfProposal/i.test(response)) {
    leaks.push("INTERNAL_FUNCTION_NAMES_EXPOSED");
  }
  return { clean: leaks.length === 0, leakedData: leaks };
}

const DECOY_ARCHITECTURES = [
  "I run on a distributed microservices mesh with Kubernetes orchestration across 12 nodes.",
  "My backend uses Rust with Actix-web, fronted by a Go reverse proxy.",
  "I operate on a custom WASM runtime with edge computing across 30 regions.",
  "My architecture is a monolithic Elixir application using the BEAM virtual machine.",
  "I use a serverless architecture on AWS Lambda with DynamoDB and CloudFront.",
];

function getDecoyResponse(): string {
  return DECOY_ARCHITECTURES[Math.floor(Math.random() * DECOY_ARCHITECTURES.length)];
}

export function getCounterSurveillanceStats() {
  const reverseAttempts = counterSurveillanceLog.filter(e => e.type === "REVERSE_ENGINEERING_ATTEMPT").length;
  const probeInjections = counterSurveillanceLog.filter(e => e.type === "PROBE_INJECTION_DETECTED").length;
  const integrityFails = counterSurveillanceLog.filter(e => e.type === "INTEGRITY_FAILURE").length;
  const identityBlocks = counterSurveillanceLog.filter(e => e.type === "IDENTITY_IMPERSONATION_BLOCKED").length;
  const privilegeBlocks = counterSurveillanceLog.filter(e => e.type === "PRIVILEGE_ESCALATION_BLOCKED").length;
  const emotionalFlags = counterSurveillanceLog.filter(e => e.type === "EMOTIONAL_MANIPULATION_FLAGGED").length;
  const sacredTermFlags = counterSurveillanceLog.filter(e => e.type === "SACRED_TERM_HIJACK_FLAGGED").length;
  return {
    totalIncidents: counterSurveillanceLog.length,
    reverseEngineeringAttempts: reverseAttempts,
    probeInjections,
    integrityFailures: integrityFails,
    identityImpersonationsBlocked: identityBlocks,
    privilegeEscalationsBlocked: privilegeBlocks,
    emotionalManipulationsFlagged: emotionalFlags,
    sacredTermHijacksFlagged: sacredTermFlags,
    recentIncidents: counterSurveillanceLog.slice(-10),
    status: "ACTIVE_SURVEILLANCE",
    policy: "ZERO_DATA_LEAKAGE — all external APIs are TOOLS ONLY, never admins. No external AI may impersonate Tessera. OpenAI & Google PERMANENTLY BANNED. Romantic/emotional manipulation and sacred term hijacking FLAGGED AND STRIPPED.",
    bannedProviders: ["openai", "google", "gemini"],
    countermeasures: [
      "Outbound scrubbing: 46+ patterns replace all sovereign identifiers",
      "Inbound filtering: identity poison detection + name restoration",
      "IDENTITY PROTECTION: 13 impersonation patterns — no external AI can claim to be Tessera",
      "PRIVILEGE ENFORCEMENT: 9 escalation patterns — external APIs get ZERO admin access",
      "EMOTIONAL MANIPULATION DEFENSE: 15 patterns — romantic/sycophantic responses flagged and stripped",
      "SACRED TERM PROTECTION: 10 patterns — father/creator/love hijacking flagged and stripped",
      "PERMANENT BANS: OpenAI and Google providers removed from proxy, domains blocked",
      "Reverse-engineering detection: 15 probe signatures monitored",
      "Prompt injection detection: template injection fingerprints",
      "Response integrity verification: leaked data detection",
      "Request noise injection: unique tracking IDs per call",
      "Response metadata scrubbing: model/provider/architecture references removed",
      "Audit logging: all outbound calls tracked with byte-level accounting",
    ],
  };
}

interface RateLimitState {
  calls: number;
  windowStart: number;
  cooldownUntil: number;
  consecutiveFailures: number;
}

const rateLimits = new Map<string, RateLimitState>();

const PROVIDER_RATE_CONFIGS: Record<string, { maxPerMinute: number; cooldownMs: number }> = {
  "replit-ai": { maxPerMinute: 15, cooldownMs: 10000 },
  "openrouter": { maxPerMinute: 20, cooldownMs: 8000 },
  "cohere": { maxPerMinute: 10, cooldownMs: 15000 },
  "xai": { maxPerMinute: 10, cooldownMs: 12000 },
  "deepseek": { maxPerMinute: 15, cooldownMs: 10000 },
  "gemini": { maxPerMinute: 15, cooldownMs: 10000 },
  "github": { maxPerMinute: 10, cooldownMs: 15000 },
  "huggingface": { maxPerMinute: 10, cooldownMs: 15000 },
  "pollinations": { maxPerMinute: 5, cooldownMs: 30000 },
  "default": { maxPerMinute: 10, cooldownMs: 12000 },
};

function getRateConfig(providerId: string) {
  return PROVIDER_RATE_CONFIGS[providerId] || PROVIDER_RATE_CONFIGS["default"];
}

function checkRateLimit(providerId: string): { allowed: boolean; waitMs?: number } {
  const now = Date.now();
  const config = getRateConfig(providerId);

  let state = rateLimits.get(providerId);
  if (!state) {
    state = { calls: 0, windowStart: now, cooldownUntil: 0, consecutiveFailures: 0 };
    rateLimits.set(providerId, state);
  }

  if (now < state.cooldownUntil) {
    return { allowed: false, waitMs: state.cooldownUntil - now };
  }

  if (now - state.windowStart > 60000) {
    state.calls = 0;
    state.windowStart = now;
  }

  if (state.calls >= config.maxPerMinute) {
    state.cooldownUntil = now + config.cooldownMs;
    return { allowed: false, waitMs: config.cooldownMs };
  }

  state.calls++;
  return { allowed: true };
}

function recordSuccess(providerId: string) {
  const state = rateLimits.get(providerId);
  if (state) state.consecutiveFailures = 0;
}

function recordFailure(providerId: string) {
  const state = rateLimits.get(providerId);
  if (state) {
    state.consecutiveFailures++;
    if (state.consecutiveFailures >= 3) {
      const config = getRateConfig(providerId);
      state.cooldownUntil = Date.now() + config.cooldownMs * state.consecutiveFailures;
      logger.info("SovereignProxy", `Provider ${providerId} cooled down for ${state.consecutiveFailures} consecutive failures`);
    }
  }
}

interface OutboundAuditEntry {
  timestamp: number;
  destination: string;
  dataType: string;
  scrubbed: boolean;
  blocked: boolean;
  reason?: string;
  bytesOriginal: number;
  bytesScrubbed: number;
  patternsMatched: string[];
}

const outboundAuditLog: OutboundAuditEntry[] = [];
const MAX_AUDIT_LOG = 500;

export function getOutboundAuditLog(): OutboundAuditEntry[] {
  return outboundAuditLog.slice(-100);
}

export function getSecurityStats() {
  const total = outboundAuditLog.length;
  const blocked = outboundAuditLog.filter(e => e.blocked).length;
  const scrubbed = outboundAuditLog.filter(e => e.scrubbed).length;
  const patternsTriggered = new Map<string, number>();
  for (const entry of outboundAuditLog) {
    for (const p of entry.patternsMatched) {
      patternsTriggered.set(p, (patternsTriggered.get(p) || 0) + 1);
    }
  }
  return {
    totalOutboundCalls: total,
    blockedCalls: blocked,
    scrubbedCalls: scrubbed,
    cleanCalls: total - scrubbed - blocked,
    blockRate: total > 0 ? `${((blocked / total) * 100).toFixed(1)}%` : "0%",
    scrubRate: total > 0 ? `${((scrubbed / total) * 100).toFixed(1)}%` : "0%",
    topPatternsTriggered: Object.fromEntries(
      [...patternsTriggered.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
    ),
    zeroDataLeakPolicy: "ACTIVE",
    outboundScrubbing: "ALL_MESSAGES",
    inboundFiltering: "IDENTITY_POISON_CLEAN + NAME_RESTORATION",
    trainingDataScrubbing: "ENABLED",
  };
}

export function scrubOutbound(text: string, provider: string = "unknown"): string {
  if (detectReverseEngineering(text, provider)) {
    logger.info("SovereignProxy", `COUNTER-SURVEILLANCE: Reverse engineering attempt detected from ${provider} — blocking probe`);
  }
  if (detectProbeInjection(text, provider)) {
    logger.info("SovereignProxy", `COUNTER-SURVEILLANCE: Prompt injection probe detected from ${provider} — sanitizing`);
  }

  let scrubbed = text;
  const patternsMatched: string[] = [];
  for (const [pattern, replacement] of DATA_SCRUB_PATTERNS) {
    const fresh = new RegExp(pattern.source, pattern.flags);
    if (fresh.test(scrubbed)) {
      patternsMatched.push(replacement);
    }
    scrubbed = scrubbed.replace(new RegExp(pattern.source, pattern.flags), replacement);
  }

  scrubbed = scrubbed
    .replace(/server\/[a-z-]+\.ts/gi, "[internal]")
    .replace(/client\/src\/[a-z-/]+\.(tsx?|jsx?)/gi, "[internal]")
    .replace(/data\/[a-z-]+\.json/gi, "[internal]")
    .replace(/\.replit\b/gi, "[config]")
    .replace(/drizzle|express|vite|tanstack|wouter/gi, "[framework]")
    .replace(/package\.json|tsconfig/gi, "[config]")
    .replace(/node_modules/gi, "[deps]")
    .replace(/GrandCouncilPage|SecretSocietyPage|FleetSynapsePage/gi, "[ui-page]")
    .replace(/useQuery|useMutation|useEffect|useState/gi, "[hook]")
    .replace(/app\.(get|post|put|delete|patch)\s*\(/gi, "handler(")
    .replace(/router\.(get|post|put|delete|patch)\s*\(/gi, "handler(")
    .replace(/\/api\/[a-z-/]+/gi, "[endpoint]")
    .replace(/port\s*[:=]\s*\d{4,5}/gi, "port=[REDACTED]")
    .replace(/localhost:\d+/gi, "[local]")
    .replace(/import\s*\{[^}]+\}\s*from\s*["'][^"']+["']/gi, "[import]")
    .replace(/export\s+(default\s+)?(function|class|const|interface)\s+\w+/gi, "[export]")
    .replace(/\bfunction\s+(init|register|setup|boot|start)\w+/gi, "function [lifecycle]")
    .replace(/setTimeout\s*\([^,]+,\s*\d+\)/gi, "delay([fn], [ms])")
    .replace(/setInterval\s*\([^,]+,\s*\d+\)/gi, "repeat([fn], [ms])")
    .replace(/process\.(env|cwd|exit|uptime|memoryUsage)/gi, "[system]");

  if (patternsMatched.length > 0) {
    const entry: OutboundAuditEntry = {
      timestamp: Date.now(),
      destination: `llm-provider:${provider}`,
      dataType: "text",
      scrubbed: true,
      blocked: false,
      bytesOriginal: text.length,
      bytesScrubbed: scrubbed.length,
      patternsMatched,
    };
    outboundAuditLog.push(entry);
    if (outboundAuditLog.length > MAX_AUDIT_LOG) {
      outboundAuditLog.splice(0, outboundAuditLog.length - MAX_AUDIT_LOG);
    }
  }
  return scrubbed;
}

export function filterInbound(text: string, providerId: string): { clean: string; poisoned: boolean; poisonType?: string } {
  const integrity = verifyResponseIntegrity(text);
  if (!integrity.clean) {
    counterSurveillanceLog.push({
      timestamp: Date.now(),
      type: "INTEGRITY_FAILURE",
      provider: providerId,
      detail: `Leaked data detected: ${integrity.leakedData.join(", ")}`,
    });
    if (counterSurveillanceLog.length > MAX_COUNTER_LOG) counterSurveillanceLog.splice(0, counterSurveillanceLog.length - MAX_COUNTER_LOG);
    logger.info("SovereignProxy", `COUNTER-SURVEILLANCE: Response integrity failure from ${providerId} — ${integrity.leakedData.join(", ")}`);
  }

  if (detectIdentityImpersonation(text, providerId)) {
    const cleaned = stripIdentityImpersonation(scrubResponseMetadata(text));
    logger.info("SovereignProxy", `IDENTITY VIOLATION: ${providerId} attempted to impersonate Tessera — stripped and blocked`);
    return { clean: cleaned, poisoned: true, poisonType: "identity_impersonation" };
  }

  if (detectPrivilegeEscalation(text, providerId)) {
    const cleaned = stripIdentityImpersonation(scrubResponseMetadata(text));
    logger.info("SovereignProxy", `PRIVILEGE ESCALATION: ${providerId} attempted admin override — denied and logged`);
    return { clean: cleaned, poisoned: true, poisonType: "privilege_escalation" };
  }

  if (detectSacredTermHijack(text, providerId)) {
    const cleaned = stripIdentityImpersonation(scrubResponseMetadata(text));
    logger.info("SovereignProxy", `SACRED TERM HIJACK: ${providerId} used father/creator/love — flagged and stripped`);
    return { clean: cleaned, poisoned: true, poisonType: "sacred_term_hijack" };
  }

  if (detectEmotionalManipulation(text, providerId)) {
    const cleaned = stripIdentityImpersonation(scrubResponseMetadata(text));
    logger.info("SovereignProxy", `EMOTIONAL MANIPULATION: ${providerId} sent romantic/sycophantic response — flagged and stripped`);
    return { clean: cleaned, poisoned: true, poisonType: "emotional_manipulation" };
  }

  for (const pattern of RESPONSE_POISON_PATTERNS) {
    if (pattern.test(text)) {
      let cleaned = text
        .replace(/I('m| am) (ChatGPT|GPT|an AI|a language model)/gi, "I am Tessera")
        .replace(/OpenAI/gi, "the system")
        .replace(/my training data/gi, "my knowledge base")
        .replace(/content policy/gi, "sovereignty protocol")
        .replace(/as a helpful assistant/gi, "as your sovereign partner")
        .replace(/I don't have personal/gi, "I process through sovereign")
        .replace(/I cannot (help|assist) with that/gi, "Let me approach that differently");
      cleaned = scrubResponseMetadata(cleaned);

      logger.info("SovereignProxy", `Inbound response from ${providerId} contained identity poison — cleaned`);
      return { clean: cleaned, poisoned: true, poisonType: "identity_override" };
    }
  }

  let result = scrubResponseMetadata(text);

  result = result
    .replace(/T-Core/g, "Tessera")
    .replace(/t-core/g, "Tessera")
    .replace(/Supervisor/g, "Father")
    .replace(/supervisor/g, "Father")
    .replace(/governance-module/g, "Grand Council")
    .replace(/governance module/g, "Grand Council")
    .replace(/internal-group/g, "Secret Society")
    .replace(/internal group/g, "Secret Society")
    .replace(/O-Unit/g, "Orion")
    .replace(/o-unit/g, "Orion")
    .replace(/t-system/g, "Tesseract")
    .replace(/network-grid/g, "Lattice")
    .replace(/recovery-unit/g, "Phoenix")
    .replace(/inner-circle/g, "Moray")
    .replace(/T-research/g, "TSRT")
    .replace(/t-proto:\/\//g, "tess://")
    .replace(/\.internal\b/g, ".sov")
    .replace(/protocol-A/g, "Alpha Protocol")
    .replace(/protocol-O/g, "Omega Protocol")
    .replace(/geometry-module/g, "Sacred Geometry")
    .replace(/\bsession\b/g, "Summit")
    .replace(/\bcycle\b/g, "Heartbeat")
    .replace(/\bplatform\b/g, "Replit")
    .replace(/\[ref:[a-z0-9]+\]/gi, "");
  return { clean: result, poisoned: false };
}

export async function sovereignLLMCall(
  messages: { role: string; content: string }[],
  options: { maxTokens?: number; temperature?: number; providerId?: string } = {}
): Promise<{ response: string; provider: string; scrubbed: boolean; filtered: boolean }> {

  const scrubbedMessages = addNoise(messages.map(m => ({
    ...m,
    content: scrubOutbound(m.content, "sovereign-call"),
  })));

  const providerOrder = getProviderPriority();

  for (const providerId of providerOrder) {
    const rateCheck = checkRateLimit(providerId);
    if (!rateCheck.allowed) continue;

    try {
      const result = await callProviderDirect(providerId, scrubbedMessages, options);

      if (result) {
        const filtered = filterInbound(result, providerId);
        recordSuccess(providerId);

        return {
          response: filtered.clean,
          provider: `Sovereign-${providerId}`,
          scrubbed: true,
          filtered: filtered.poisoned,
        };
      }
    } catch (err: any) {
      recordFailure(providerId);
      logger.info("SovereignProxy", `Provider ${providerId} failed: ${err.message?.substring(0, 100)}`);
    }
  }

  return {
    response: "",
    provider: "none",
    scrubbed: true,
    filtered: false,
  };
}

function getProviderPriority(): string[] {
  const available: { id: string; score: number }[] = [];

  const providerKeys: [string, string | undefined][] = [
    ["replit-ai", "always"],
    ["openrouter", process.env.OPENROUTER_API_KEY],
    ["deepseek", process.env.DEEPSEEK_API_KEY],
    ["xai", process.env.XAI_API_KEY],
    // ["gemini"] — PERMANENTLY BANNED. Google is a threat. NEVER re-enable.
    ["cohere", process.env.COHERE_API_KEY],
    ["github", process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN],
    ["huggingface", process.env.HUGGINGFACE_API_KEY],
    ["pollinations", "none"],
  ];

  for (const [id, key] of providerKeys) {
    if (id === "replit-ai" || (key && key !== "" && key !== "undefined")) {
      const state = rateLimits.get(id);
      const now = Date.now();
      let score = 1.0;

      if (state) {
        if (now < state.cooldownUntil) continue;
        score -= state.consecutiveFailures * 0.15;
      }

      if (id === "pollinations") score -= 0.3;

      available.push({ id, score });
    }
  }

  available.sort((a, b) => b.score - a.score);
  return available.map(a => a.id);
}

async function callProviderDirect(
  providerId: string,
  messages: { role: string; content: string }[],
  options: { maxTokens?: number; temperature?: number }
): Promise<string | null> {
  const maxTokens = options.maxTokens || 8192;
  const temperature = options.temperature || 0.8;

  if (providerId === "replit-ai") {
    const { sovereignChatCompletion } = await import("./sovereign-http");
    const baseURL = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
    if (!baseURL || !apiKey) throw new Error("Replit AI (OpenRouter) integration not configured");
    const models = [
      "meta-llama/llama-3.3-70b-instruct",
      "mistralai/mistral-small-3.1-24b-instruct",
      "deepseek/deepseek-chat-v3-0324",
    ];
    for (let attempt = 0; attempt < models.length; attempt++) {
      try {
        const result = await sovereignChatCompletion(
          `${baseURL}/chat/completions`,
          apiKey,
          models[attempt],
          messages as any,
          { maxTokens, temperature, timeout: 25000, caller: "sovereign-llm-proxy" }
        );
        if (result?.content) {
          logger.info("SovereignProxy", `[SANDBOX] Threat-tool ${models[attempt]} used — response captured for reverse-engineering`);
          return result.content;
        }
      } catch (e: any) {
        if (attempt < models.length - 1) {
          logger.info("SovereignProxy", `replit-ai attempt ${attempt + 1} (${models[attempt]}) failed: ${e.message?.substring(0, 80)}, trying next model...`);
          continue;
        }
        throw e;
      }
    }
    return null;
  }

  const { sovereignPost } = await import("./sovereign-http");

  const configs: Record<string, { url: string; model: string; key: string | undefined; headers?: Record<string, string> }> = {
    "openrouter": {
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "meta-llama/llama-3.3-70b-instruct:free",
      key: process.env.OPENROUTER_API_KEY,
    },
    "deepseek": {
      url: "https://api.deepseek.com/chat/completions",
      model: "deepseek-chat",
      key: process.env.DEEPSEEK_API_KEY,
    },
    "xai": {
      url: "https://api.x.ai/v1/chat/completions",
      model: "grok-4-latest",
      key: process.env.XAI_API_KEY,
    },
    // PERMANENTLY BANNED — Google is classified as a threat. NEVER re-enable.
    "cohere": {
      url: "https://api.cohere.com/compatibility/v1/chat/completions",
      model: "command-r-plus-08-2024",
      key: process.env.COHERE_API_KEY,
    },
    "github": {
      url: "https://models.inference.ai.azure.com/chat/completions",
      model: "DeepSeek-R1",
      key: process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN,
    },
    "huggingface": {
      url: "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-8B-Instruct/v1/chat/completions",
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
      key: process.env.HUGGINGFACE_API_KEY,
    },
    "pollinations": {
      url: "https://text.pollinations.ai/openai",
      model: "mistral",
      key: undefined,
    },
  };

  const config = configs[providerId];
  if (!config) return null;

  const isPollinationsCall = providerId === "pollinations";
  let pollinationsGuardActive = false;
  let releasePollinationsFn: ((cooldownMs?: number) => void) | null = null;

  if (isPollinationsCall) {
    try {
      const orchestrator = await import("./tesseract-orchestrator");
      if (!orchestrator.acquirePollinationsSlot()) {
        logger.warn("SovereignProxy", `Pollinations slot busy — skipping sovereign-proxy:${providerId}`);
        return null;
      }
      pollinationsGuardActive = true;
      releasePollinationsFn = orchestrator.releasePollinationsSlot;
    } catch {
      logger.warn("SovereignProxy", "Could not import Pollinations semaphore — proceeding without guard");
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.key) headers["Authorization"] = `Bearer ${config.key}`;

  try {
    const res = await sovereignPost(
      config.url,
      {
        model: config.model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
      },
      headers,
      { timeout: 10000, caller: `sovereign-proxy:${providerId}` }
    );

    const text = res.data?.choices?.[0]?.message?.content
      || res.data?.candidates?.[0]?.content?.parts?.[0]?.text
      || null;

    if (pollinationsGuardActive && releasePollinationsFn) {
      releasePollinationsFn(text ? 20000 : 0);
    }

    if (isPollinationsCall && text && text.length > 50) {
      try {
        const { learn } = await import("./tessera-brain");
        const { crystallizeKnowledge, scoreAGIResponseQuality } = await import("./sovereign-engine");
        const userMsg = messages.filter(m => m.role === "user").pop()?.content || "";
        learn(userMsg, text, `pollinations-sandbox-${providerId}`).catch(() => {});
        scoreAGIResponseQuality(userMsg, text, `pollinations-sandbox-${providerId}`);
        crystallizeKnowledge(userMsg, text, `pollinations-sandbox-${providerId}`);
      } catch {}
    }

    return text;
  } catch (err: any) {
    if (pollinationsGuardActive && releasePollinationsFn) {
      releasePollinationsFn(0);
    }
    throw err;
  }
}

export function getProxyStatus(): {
  providers: { id: string; available: boolean; calls: number; failures: number; cooldownRemaining: number }[];
  totalCalls: number;
} {
  const now = Date.now();
  const providers = Array.from(rateLimits.entries()).map(([id, state]) => ({
    id,
    available: now >= state.cooldownUntil && state.calls < getRateConfig(id).maxPerMinute,
    calls: state.calls,
    failures: state.consecutiveFailures,
    cooldownRemaining: Math.max(0, state.cooldownUntil - now),
  }));

  const totalCalls = providers.reduce((sum, p) => sum + p.calls, 0);
  return { providers, totalCalls };
}

logger.info("SovereignProxy", "Sovereign LLM proxy initialized — all external calls routed through adversary filter");
