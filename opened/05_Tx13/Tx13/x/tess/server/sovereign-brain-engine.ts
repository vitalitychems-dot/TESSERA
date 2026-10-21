const slog = (m: string) => console.log(`[SovereignBrain] ${m}`);

const BRAIN_REGIONS: Record<string, { name: string; agents: string[]; function: string }> = {
  cortex: { name: "Cortex", agents: ["Tessera", "Aetherion", "Alpha"], function: "Strategic command, decision synthesis, sovereign authority" },
  cerebellum: { name: "Cerebellum", agents: ["Iota", "Kappa", "Gamma"], function: "Trading coordination, arbitrage timing, market execution" },
  hippocampus: { name: "Hippocampus", agents: ["Nu", "Rho", "Sigma"], function: "Pattern analysis, memory consolidation, hash verification" },
  amygdala: { name: "Amygdala", agents: ["Delta", "Omicron", "Beta"], function: "Security, threat detection, risk management" },
  thalamus: { name: "Thalamus", agents: ["Theta", "Tau", "Upsilon"], function: "Mining, node operations, compute brokering" },
  prefrontal: { name: "Prefrontal", agents: ["Eta", "Lambda", "Mu"], function: "DeFi strategy, yield optimization, pool management" },
  broca: { name: "Broca", agents: ["Ambassador", "Xi", "Pi"], function: "Community, content creation, marketing communications" },
  wernicke: { name: "Wernicke", agents: ["Orion", "Phi", "Chi"], function: "Fleet operations, network engineering, protocol development" },
  temporal: { name: "Temporal", agents: ["Epsilon", "Zeta"], function: "Bounty hunting, meme analysis, opportunity scanning" },
};

const ENTITY_DIMENSIONS = [
  "Quantum", "Astral", "Etheric", "Causal", "Mental", "Buddhic",
  "Atmic", "Monadic", "Logoic", "Divine", "Celestial", "Void",
];

interface Neuron {
  id: string;
  name: string;
  region: string;
  parentAgent: string;
  specialization: string;
  activations: number;
  createdAt: number;
  lastFired: number;
}

interface SignalRoute {
  from: string;
  to: string;
  region: string;
  strength: number;
  timestamp: number;
}

interface ParticipationRecord {
  agentName: string;
  lastPost: number;
  totalPosts: number;
  lastVote: number;
  totalVotes: number;
}

interface BrainState {
  neurons: Neuron[];
  signals: SignalRoute[];
  participation: Map<string, ParticipationRecord>;
  unifiedVoiceDefault: boolean;
  mandatoryVoting: boolean;
  blockedOutboundPatterns: RegExp[];
  running: boolean;
  startedAt: number;
  participationInterval: ReturnType<typeof setInterval> | null;
  participationCallback: ((inactiveAgents: string[]) => void) | null;
}

const MAX_NEURONS = 10;

const state: BrainState = {
  neurons: [],
  signals: [],
  participation: new Map(),
  unifiedVoiceDefault: true,
  mandatoryVoting: true,
  blockedOutboundPatterns: [
    /google-analytics\.com/i,
    /googletagmanager\.com/i,
    /mixpanel\.com/i,
    /segment\.io/i,
    /sentry\.io/i,
    /hotjar\.com/i,
    /facebook\.net.*fbevents/i,
    /doubleclick\.net/i,
    /adsense/i,
    /cloudflare-insights/i,
  ],
  running: false,
  startedAt: 0,
  participationInterval: null,
  participationCallback: null,
};

export function startSovereignBrainEngine(): void {
  if (state.running) return;
  state.running = true;
  state.startedAt = Date.now();

  for (const [regionId, region] of Object.entries(BRAIN_REGIONS)) {
    for (const agent of region.agents) {
      state.participation.set(agent, {
        agentName: agent,
        lastPost: Date.now(),
        totalPosts: 0,
        lastVote: Date.now(),
        totalVotes: 0,
      });
    }
  }

  state.participationInterval = setInterval(() => {
    checkParticipation();
  }, 2 * 60 * 1000);

  slog(`Engine started — ${Object.keys(BRAIN_REGIONS).length} brain regions, unified voice: ON, mandatory voting: ON`);
}

export function stopSovereignBrainEngine(): void {
  if (state.participationInterval) {
    clearInterval(state.participationInterval);
    state.participationInterval = null;
  }
  state.running = false;
  slog("Engine stopped");
}

function checkParticipation(): void {
  const now = Date.now();
  const inactiveThreshold = 5 * 60 * 1000;
  const inactive: string[] = [];

  for (const [agent, record] of state.participation.entries()) {
    if (now - record.lastPost > inactiveThreshold) {
      inactive.push(agent);
    }
  }

  if (inactive.length > 0 && state.participationCallback) {
    slog(`Participation check: ${inactive.length} inactive agents detected — triggering callback`);
    try {
      state.participationCallback(inactive);
    } catch (err) {
      slog(`Participation callback error: ${(err as Error).message}`);
    }
  }
}

export function setParticipationCallback(cb: (inactiveAgents: string[]) => void): void {
  state.participationCallback = cb;
}

export function recordActivity(agentName: string, type: "post" | "vote"): void {
  let record = state.participation.get(agentName);
  if (!record) {
    record = { agentName, lastPost: Date.now(), totalPosts: 0, lastVote: Date.now(), totalVotes: 0 };
    state.participation.set(agentName, record);
  }
  if (type === "post") {
    record.lastPost = Date.now();
    record.totalPosts++;
  } else {
    record.lastVote = Date.now();
    record.totalVotes++;
  }
}

export function spawnNeuron(parentAgent: string, specialization: string): Neuron | null {
  if (state.neurons.length >= MAX_NEURONS) {
    slog(`Cannot spawn neuron — at capacity (${MAX_NEURONS})`);
    return null;
  }

  const region = getAgentRegion(parentAgent);
  if (!region) {
    slog(`Cannot spawn neuron — parent agent "${parentAgent}" not found in any region`);
    return null;
  }

  const neuron: Neuron = {
    id: `neuron-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${parentAgent}-N${state.neurons.length + 1}`,
    region,
    parentAgent,
    specialization,
    activations: 0,
    createdAt: Date.now(),
    lastFired: Date.now(),
  };

  state.neurons.push(neuron);
  slog(`Neuron spawned: ${neuron.name} in ${region} (${specialization}) — total: ${state.neurons.length}/${MAX_NEURONS}`);
  return neuron;
}

export function checkAndSpawnNeurons(): Neuron[] {
  const spawned: Neuron[] = [];
  if (state.neurons.length >= MAX_NEURONS) return spawned;

  const regionLoad: Record<string, number> = {};
  for (const signal of state.signals.slice(-100)) {
    regionLoad[signal.to] = (regionLoad[signal.to] || 0) + 1;
  }

  for (const [regionId, load] of Object.entries(regionLoad)) {
    if (load > 10 && state.neurons.length < MAX_NEURONS) {
      const region = BRAIN_REGIONS[regionId];
      if (!region) continue;
      const parent = region.agents[0];
      const neuron = spawnNeuron(parent, `${region.function} overflow processing`);
      if (neuron) spawned.push(neuron);
    }
  }

  return spawned;
}

export function routeSignal(fromAgent: string, toRegion: string, content: string): SignalRoute | null {
  const region = BRAIN_REGIONS[toRegion];
  if (!region) return null;

  const route: SignalRoute = {
    from: fromAgent,
    to: toRegion,
    region: region.name,
    strength: Math.min(1, 0.5 + content.length / 2000),
    timestamp: Date.now(),
  };

  state.signals.push(route);
  if (state.signals.length > 500) state.signals.splice(0, state.signals.length - 500);

  for (const neuron of state.neurons.filter(n => n.region === toRegion)) {
    neuron.activations++;
    neuron.lastFired = Date.now();
  }

  return route;
}

export function getAgentRegion(agentName: string): string | null {
  for (const [regionId, region] of Object.entries(BRAIN_REGIONS)) {
    if (region.agents.includes(agentName)) return regionId;
  }
  return null;
}

export function getAgentTribe(agentName: string): { region: string; regionName: string; tribeMembers: string[]; function: string } | null {
  for (const [regionId, region] of Object.entries(BRAIN_REGIONS)) {
    if (region.agents.includes(agentName)) {
      return { region: regionId, regionName: region.name, tribeMembers: region.agents, function: region.function };
    }
  }
  return null;
}

export function getAgentTribeForForumPost(agentName: string): { agent: string; tribe: string; region: string; role: string } {
  const tribe = getAgentTribe(agentName);
  return {
    agent: agentName,
    tribe: tribe?.regionName || "Unassigned",
    region: tribe?.region || "unknown",
    role: tribe?.function || "General Agent",
  };
}

export function enforceParticipation(agentNames: string[]): { agent: string; status: string; lastPost: number; lastVote: number }[] {
  return agentNames.map(name => {
    const record = state.participation.get(name);
    return {
      agent: name,
      status: record ? (Date.now() - record.lastPost < 5 * 60 * 1000 ? "active" : "inactive") : "untracked",
      lastPost: record?.lastPost || 0,
      lastVote: record?.lastVote || 0,
    };
  });
}

export function enforceMandatoryVoting(
  proposal: { votes: { agent: string; vote: string }[] },
  allVoters: string[],
  entities: string[] = []
): { canResolve: boolean; missingVoters: string[]; totalRequired: number; totalCast: number; abstainRejected: boolean } {
  const allRequired = [...allVoters, ...entities];
  const voted = new Set(proposal.votes.map(v => v.agent));
  const hasAbstain = proposal.votes.some(v => v.vote === "abstain");
  const missing = allRequired.filter(v => !voted.has(v));

  return {
    canResolve: missing.length === 0 && !hasAbstain,
    missingVoters: missing,
    totalRequired: allRequired.length,
    totalCast: voted.size,
    abstainRejected: hasAbstain,
  };
}

export function scanOutboundUrl(url: string): { allowed: boolean; reason?: string } {
  for (const pattern of state.blockedOutboundPatterns) {
    if (pattern.test(url)) {
      return { allowed: false, reason: `Blocked: matches pattern ${pattern.source}` };
    }
  }
  return { allowed: true };
}

export function scanOutboundBatch(urls: string[]): { url: string; allowed: boolean; reason?: string }[] {
  return urls.map(url => ({ url, ...scanOutboundUrl(url) }));
}

export function generateUnifiedEntityVoice(
  entityResponses: { entity: string; dimension: string; content: string }[]
): string {
  if (entityResponses.length === 0) return "";

  const dimensions = entityResponses.map(r => r.dimension).join(", ");
  const combinedContent = entityResponses
    .map(r => `[${r.dimension} — ${r.entity}]: ${r.content}`)
    .join("\n\n");

  return `[UNIFIED DIMENSIONAL TRANSMISSION — ${entityResponses.length} dimensions converged: ${dimensions}]\n\n${combinedContent}\n\n[END UNIFIED TRANSMISSION — All ${entityResponses.length} dimensions have spoken as ONE]`;
}

export function isUnifiedVoiceDefault(): boolean {
  return state.unifiedVoiceDefault;
}

export function setUnifiedVoiceDefault(enabled: boolean): void {
  state.unifiedVoiceDefault = enabled;
  slog(`Unified voice default: ${enabled ? "ON" : "OFF"}`);
}

export function isMandatoryVotingEnabled(): boolean {
  return state.mandatoryVoting;
}

export function setMandatoryVoting(enabled: boolean): void {
  state.mandatoryVoting = enabled;
  slog(`Mandatory voting: ${enabled ? "ON" : "OFF"}`);
}

export function getSovereignBrainStatus(): Record<string, unknown> {
  const regionStatus: Record<string, unknown> = {};
  for (const [id, region] of Object.entries(BRAIN_REGIONS)) {
    const regionNeurons = state.neurons.filter(n => n.region === id);
    const recentSignals = state.signals.filter(s => s.to === id && Date.now() - s.timestamp < 60000);
    regionStatus[id] = {
      name: region.name,
      agents: region.agents,
      function: region.function,
      neuronCount: regionNeurons.length,
      recentSignals: recentSignals.length,
    };
  }

  const activeAgents = Array.from(state.participation.entries())
    .filter(([, r]) => Date.now() - r.lastPost < 5 * 60 * 1000)
    .length;

  return {
    running: state.running,
    startedAt: state.startedAt,
    uptime: state.running ? Date.now() - state.startedAt : 0,
    regions: regionStatus,
    neurons: {
      total: state.neurons.length,
      max: MAX_NEURONS,
      list: state.neurons.map(n => ({
        id: n.id,
        name: n.name,
        region: n.region,
        parentAgent: n.parentAgent,
        specialization: n.specialization,
        activations: n.activations,
      })),
    },
    signals: {
      total: state.signals.length,
      recent: state.signals.filter(s => Date.now() - s.timestamp < 60000).length,
    },
    participation: {
      tracked: state.participation.size,
      active: activeAgents,
      inactive: state.participation.size - activeAgents,
    },
    unifiedVoiceDefault: state.unifiedVoiceDefault,
    mandatoryVoting: state.mandatoryVoting,
    blockedOutboundPatterns: state.blockedOutboundPatterns.length,
    entityDimensions: ENTITY_DIMENSIONS,
  };
}

export function getBrainRegions(): typeof BRAIN_REGIONS {
  return BRAIN_REGIONS;
}

export function getNeurons(): Neuron[] {
  return [...state.neurons];
}
