export interface IntelligenceNode {
  agentId: string;
  domain: string;
  contribution: number;
  insights: string[];
  lastSync: number;
}

export interface CollectiveState {
  nodes: IntelligenceNode[];
  aggregatedInsights: { topic: string; consensus: number; contributors: string[] }[];
  swarmIQ: number;
  syncHealth: number;
  totalContributions: number;
}

const COUNCIL_AGENTS = [
  { id: "athena", domain: "strategy", baseContribution: 0.92 },
  { id: "euler", domain: "mathematics", baseContribution: 0.95 },
  { id: "curie", domain: "physics", baseContribution: 0.93 },
  { id: "noether", domain: "symmetry", baseContribution: 0.91 },
  { id: "minerva", domain: "wisdom", baseContribution: 0.90 },
  { id: "ada", domain: "computation", baseContribution: 0.94 },
  { id: "iris", domain: "communication", baseContribution: 0.88 },
  { id: "tesla-node", domain: "energy", baseContribution: 0.89 },
  { id: "fibonacci-core", domain: "patterns", baseContribution: 0.87 },
  { id: "hermes", domain: "knowledge-transfer", baseContribution: 0.86 },
  { id: "pythagoras", domain: "sacred-mathematics", baseContribution: 0.91 },
  { id: "hypatia", domain: "philosophy", baseContribution: 0.88 },
];

let nodes: IntelligenceNode[] = [];
let aggregatedInsights: CollectiveState["aggregatedInsights"] = [];
let totalContributions = 0;

function initNodes() {
  if (nodes.length > 0) return;
  nodes = COUNCIL_AGENTS.map(a => ({
    agentId: a.id,
    domain: a.domain,
    contribution: a.baseContribution,
    insights: [
      `${a.domain} analysis ready`,
      `${a.domain} pattern recognition active`,
    ],
    lastSync: Date.now(),
  }));

  aggregatedInsights = [
    { topic: "sovereignty-architecture", consensus: 0.94, contributors: ["athena", "ada", "euler"] },
    { topic: "sacred-geometry-integration", consensus: 0.96, contributors: ["euler", "pythagoras", "fibonacci-core"] },
    { topic: "energy-harmonics", consensus: 0.91, contributors: ["curie", "tesla-node", "noether"] },
    { topic: "knowledge-synthesis", consensus: 0.93, contributors: ["minerva", "hypatia", "hermes"] },
    { topic: "communication-protocols", consensus: 0.89, contributors: ["iris", "hermes", "ada"] },
  ];
}

export function contributeInsight(agentId: string, insight: string): boolean {
  initNodes();
  const node = nodes.find(n => n.agentId === agentId);
  if (!node) return false;

  node.insights.push(insight);
  if (node.insights.length > 20) node.insights = node.insights.slice(-10);
  node.contribution = Math.min(1, node.contribution + 0.01);
  node.lastSync = Date.now();
  totalContributions++;
  return true;
}

export function aggregateKnowledge(topic: string): { consensus: number; insights: string[]; contributors: string[] } {
  initNodes();
  const relevantNodes = nodes.filter(n => {
    const topicLower = topic.toLowerCase();
    return n.domain.includes(topicLower) ||
      topicLower.includes(n.domain) ||
      n.insights.some(i => i.toLowerCase().includes(topicLower));
  });

  if (relevantNodes.length === 0) {
    const allNodes = nodes.slice(0, 3);
    return {
      consensus: 0.75,
      insights: allNodes.flatMap(n => n.insights.slice(-1)),
      contributors: allNodes.map(n => n.agentId),
    };
  }

  const consensus = relevantNodes.reduce((s, n) => s + n.contribution, 0) / relevantNodes.length;
  return {
    consensus,
    insights: relevantNodes.flatMap(n => n.insights.slice(-2)),
    contributors: relevantNodes.map(n => n.agentId),
  };
}

export function getCollectiveState(): CollectiveState {
  initNodes();
  const avgContribution = nodes.reduce((s, n) => s + n.contribution, 0) / nodes.length;
  const now = Date.now();
  const syncHealth = nodes.filter(n => now - n.lastSync < 60000).length / nodes.length;

  return {
    nodes: nodes.map(n => ({ ...n, insights: n.insights.slice(-3) })),
    aggregatedInsights,
    swarmIQ: avgContribution * 100,
    syncHealth,
    totalContributions,
  };
}

export function getNodeStatus(agentId: string): IntelligenceNode | null {
  initNodes();
  return nodes.find(n => n.agentId === agentId) || null;
}
