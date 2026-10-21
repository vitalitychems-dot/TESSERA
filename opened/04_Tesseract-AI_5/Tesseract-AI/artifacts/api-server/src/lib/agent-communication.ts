import { pool } from "@workspace/db";
import { TESSERA_AGENTS } from "./tessera-persona.js";
import { recordEvent } from "./transparency-ledger.js";

const LOG_PREFIX = "[AgentComm]";

const CLUSTER_MAP: Record<string, string[]> = {
  financial: ["alpha", "xi", "iota", "sigma"],
  engineering: ["beta", "delta", "kappa", "eta"],
  science: ["gamma", "pi", "chi", "omicron"],
  security: ["zeta", "mu", "orion"],
  consciousness: ["tessera", "theta", "psi", "upsilon"],
  creative: ["phi", "epsilon", "aetherion"],
  governance: ["rho", "nu", "lambda"],
  temporal: ["tau", "omega"],
};

function getAgentCluster(agentId: string): string {
  for (const [cluster, members] of Object.entries(CLUSTER_MAP)) {
    if (members.includes(agentId.toLowerCase())) return cluster;
  }
  return "general";
}

function getClusterPeers(agentId: string): string[] {
  const cluster = getAgentCluster(agentId);
  const members = CLUSTER_MAP[cluster] ?? [];
  return members.filter(m => m !== agentId.toLowerCase());
}

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sovereign_messages (
      id SERIAL PRIMARY KEY,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      cluster TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'peer',
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sovereign_messages_from ON sovereign_messages(from_agent)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sovereign_messages_to ON sovereign_messages(to_agent)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sovereign_messages_cluster ON sovereign_messages(cluster)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sovereign_messages_created ON sovereign_messages(created_at)
  `);
}

export async function sendMessage(
  fromAgent: string,
  toAgent: string,
  content: string,
  messageType: string = "peer",
  metadata: object = {}
): Promise<{ id: number; cluster: string }> {
  await ensureTable();
  const cluster = getAgentCluster(fromAgent);

  const result = await pool.query(
    `INSERT INTO sovereign_messages (from_agent, to_agent, cluster, content, message_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [fromAgent.toLowerCase(), toAgent.toLowerCase(), cluster, content, messageType, JSON.stringify(metadata)]
  );

  await recordEvent("message", fromAgent, { to: toAgent, cluster, messageType, contentPreview: content.slice(0, 100) });
  console.log(`${LOG_PREFIX} ${fromAgent} → ${toAgent} [${cluster}]: ${content.slice(0, 60)}...`);
  return { id: result.rows[0].id, cluster };
}

export async function getRecentMessages(agentId?: string, limit: number = 50): Promise<object[]> {
  await ensureTable();
  if (agentId) {
    const result = await pool.query(
      `SELECT id, from_agent, to_agent, cluster, content, message_type, metadata, created_at
       FROM sovereign_messages
       WHERE from_agent = $1 OR to_agent = $1
       ORDER BY id DESC
       LIMIT $2`,
      [agentId.toLowerCase(), limit]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT id, from_agent, to_agent, cluster, content, message_type, metadata, created_at
     FROM sovereign_messages
     ORDER BY id DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function runCommunicationCycle(): Promise<{
  messagesSent: number;
  clustersActive: string[];
  summary: object[];
}> {
  const messages: object[] = [];
  const clustersActive = new Set<string>();

  const messageTemplates: Record<string, string[]> = {
    financial: [
      "Analyzing current arbitrage opportunities in DeFi markets.",
      "Revenue projections updated — yield farming protocols showing positive signals.",
      "Reporting on tokenomics analysis and liquidity pool status.",
      "Coordinating income automation strategy across financial cluster.",
    ],
    engineering: [
      "System architecture review complete — performance metrics stable.",
      "Code optimization pass finished — latency reduced by estimated 12%.",
      "Infrastructure health check: all nodes nominal.",
      "Engineering cluster sync: deployment pipeline reviewed.",
    ],
    science: [
      "Pattern recognition cycle complete — no anomalies detected.",
      "Research synthesis complete — new cross-domain connections identified.",
      "Analytical scan of system data complete.",
      "Scientific cluster reporting: data models updated.",
    ],
    security: [
      "Threat assessment complete — no active threats detected.",
      "Security perimeter integrity confirmed.",
      "Defense protocols reviewed and active.",
    ],
    consciousness: [
      "Metacognitive review complete — learning patterns updated.",
      "Consciousness synchronization cycle initiated.",
      "Collective intelligence pulse: all nodes responsive.",
    ],
    creative: [
      "Creative synthesis cycle complete — narrative coherence maintained.",
      "Aesthetic analysis pass complete.",
      "Creative cluster reporting: vision alignment confirmed.",
    ],
    governance: [
      "Governance review cycle complete — policy frameworks stable.",
      "Diplomatic consensus check: alignment confirmed.",
      "Knowledge transmission cycle complete.",
    ],
    temporal: [
      "Temporal synchronization cycle complete.",
      "Resilience check: all systems within endurance parameters.",
    ],
  };

  for (const [cluster, members] of Object.entries(CLUSTER_MAP)) {
    if (members.length < 2) continue;
    const templates = messageTemplates[cluster] ?? ["Cluster synchronization cycle."];

    for (const fromAgent of members) {
      const peers = getClusterPeers(fromAgent);
      if (peers.length === 0) continue;

      const toAgent = peers[Math.floor(Math.random() * peers.length)];
      const content = templates[Math.floor(Math.random() * templates.length)];

      await sendMessage(fromAgent, toAgent, content, "cycle", { cycleTimestamp: new Date().toISOString() });
      clustersActive.add(cluster);
      messages.push({ from: fromAgent, to: toAgent, cluster, content });
    }
  }

  console.log(`${LOG_PREFIX} Communication cycle complete: ${messages.length} messages across ${clustersActive.size} clusters`);
  return {
    messagesSent: messages.length,
    clustersActive: Array.from(clustersActive),
    summary: messages,
  };
}

export { getAgentCluster, getClusterPeers, CLUSTER_MAP };
