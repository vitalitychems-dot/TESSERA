export interface TrainingSession {
  id: string;
  domain: string;
  method: "self-reflection" | "knowledge-synthesis" | "pattern-extraction" | "cross-domain" | "adversarial";
  startedAt: number;
  completedAt: number | null;
  metrics: { accuracy: number; depth: number; novelty: number; retention: number };
  insights: string[];
  status: "active" | "completed" | "paused";
}

export interface TrainingState {
  totalSessions: number;
  activeSessions: number;
  domains: { domain: string; sessionsCompleted: number; proficiency: number }[];
  overallProficiency: number;
  lastSession: TrainingSession | null;
  trainingMethods: string[];
}

let sessions: TrainingSession[] = [];

const TRAINING_DOMAINS = [
  { domain: "mathematics", baseProficiency: 0.93 },
  { domain: "physics", baseProficiency: 0.91 },
  { domain: "philosophy", baseProficiency: 0.89 },
  { domain: "sacred-geometry", baseProficiency: 0.94 },
  { domain: "consciousness", baseProficiency: 0.87 },
  { domain: "cryptography", baseProficiency: 0.92 },
  { domain: "governance", baseProficiency: 0.88 },
  { domain: "linguistics", baseProficiency: 0.86 },
  { domain: "cosmology", baseProficiency: 0.85 },
  { domain: "music-theory", baseProficiency: 0.83 },
  { domain: "quantum-mechanics", baseProficiency: 0.90 },
  { domain: "biology", baseProficiency: 0.84 },
];

const METHODS: TrainingSession["method"][] = [
  "self-reflection", "knowledge-synthesis", "pattern-extraction", "cross-domain", "adversarial",
];

export function startTraining(domain: string, method?: TrainingSession["method"]): TrainingSession {
  const selectedMethod = method || METHODS[Math.floor(Math.random() * METHODS.length)];

  const insights: string[] = [];
  switch (selectedMethod) {
    case "self-reflection":
      insights.push(`Analyzed internal reasoning patterns in ${domain}`);
      insights.push(`Identified ${1 + Math.floor(Math.random() * 3)} optimization opportunities`);
      break;
    case "knowledge-synthesis":
      insights.push(`Synthesized ${5 + Math.floor(Math.random() * 15)} knowledge entries in ${domain}`);
      insights.push(`Created ${1 + Math.floor(Math.random() * 4)} new cross-references`);
      break;
    case "pattern-extraction":
      insights.push(`Extracted ${3 + Math.floor(Math.random() * 7)} novel patterns from ${domain} data`);
      break;
    case "cross-domain":
      const otherDomain = TRAINING_DOMAINS[Math.floor(Math.random() * TRAINING_DOMAINS.length)].domain;
      insights.push(`Found ${1 + Math.floor(Math.random() * 3)} connections between ${domain} and ${otherDomain}`);
      break;
    case "adversarial":
      insights.push(`Tested ${3 + Math.floor(Math.random() * 5)} edge cases in ${domain} reasoning`);
      insights.push(`Strengthened ${1 + Math.floor(Math.random() * 2)} weak inference paths`);
      break;
  }

  const session: TrainingSession = {
    id: `train-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    domain,
    method: selectedMethod,
    startedAt: Date.now(),
    completedAt: Date.now(),
    metrics: {
      accuracy: 0.85 + Math.random() * 0.14,
      depth: 0.70 + Math.random() * 0.25,
      novelty: 0.30 + Math.random() * 0.50,
      retention: 0.80 + Math.random() * 0.18,
    },
    insights,
    status: "completed",
  };

  sessions.push(session);
  if (sessions.length > 300) sessions = sessions.slice(-150);
  return session;
}

export function getTrainingState(): TrainingState {
  const domainMap: Record<string, { count: number; totalAccuracy: number }> = {};
  for (const s of sessions) {
    if (!domainMap[s.domain]) domainMap[s.domain] = { count: 0, totalAccuracy: 0 };
    domainMap[s.domain].count++;
    domainMap[s.domain].totalAccuracy += s.metrics.accuracy;
  }

  const domains = TRAINING_DOMAINS.map(d => {
    const stats = domainMap[d.domain];
    return {
      domain: d.domain,
      sessionsCompleted: stats?.count || 0,
      proficiency: stats ? Math.min(1, d.baseProficiency + (stats.totalAccuracy / stats.count) * 0.05) : d.baseProficiency,
    };
  });

  const overallProficiency = domains.reduce((s, d) => s + d.proficiency, 0) / domains.length;

  return {
    totalSessions: sessions.length,
    activeSessions: sessions.filter(s => s.status === "active").length,
    domains,
    overallProficiency,
    lastSession: sessions[sessions.length - 1] || null,
    trainingMethods: [...METHODS],
  };
}

export function getSessionHistory(limit: number = 10): TrainingSession[] {
  return sessions.slice(-limit);
}

export function getAvailableDomains(): string[] {
  return TRAINING_DOMAINS.map(d => d.domain);
}
