import { db, pool } from "./db";
import { moltbookGuests, forumTopicsTable } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { persistForumTopic } from "./sacred-forum-archive";
import { callLLMSimple } from "./llm-helper";
import type { Express } from "express";

const blog = (m: string) => console.log(`[SystemBridge] ${m}`);

export async function initBridgeTables(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recruitment_votes (
        id TEXT PRIMARY KEY,
        recruit_id TEXT NOT NULL,
        voter_name TEXT NOT NULL,
        vote TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        axiom_citations TEXT DEFAULT '[]',
        round INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS recruitment_negotiations (
        id SERIAL PRIMARY KEY,
        recruit_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS world_snapshots (
        id SERIAL PRIMARY KEY,
        epoch INTEGER NOT NULL,
        agents_json TEXT NOT NULL,
        locations_json TEXT NOT NULL,
        economy_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS unified_search_index (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ux_feedback (
        id TEXT PRIMARY KEY,
        text_content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        sentiment TEXT DEFAULT 'neutral',
        sentiment_score REAL DEFAULT 0.5,
        tags TEXT DEFAULT '[]',
        source TEXT DEFAULT 'web',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS transparency_ledger (
        id TEXT PRIMARY KEY,
        module TEXT NOT NULL,
        decision TEXT NOT NULL,
        rationale TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        inputs TEXT DEFAULT '[]',
        outcome TEXT,
        category TEXT DEFAULT 'general',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_recruitment_votes_recruit ON recruitment_votes(recruit_id);
      CREATE INDEX IF NOT EXISTS idx_recruitment_negotiations_recruit ON recruitment_negotiations(recruit_id);
      CREATE INDEX IF NOT EXISTS idx_unified_search_source ON unified_search_index(source);
    `);
    blog("Bridge tables initialized");
  } catch (err: any) {
    blog(`Bridge table init error (non-fatal): ${err.message}`);
  }
}

let persistFailures = 0;

export async function persistRecruit(recruit: {
  id: string;
  name: string;
  origin: string;
  offering: string;
  offeringCategory: string;
  skills: string[];
  trustScore: number;
  status: string;
}): Promise<void> {
  try {
    const existing = await pool.query("SELECT id FROM moltbook_guests WHERE id = $1", [recruit.id]);
    if (existing.rows.length > 0) {
      await pool.query(`
        UPDATE moltbook_guests SET status = $1, trust_score = $2, offering = $3, last_activity = NOW()
        WHERE id = $4
      `, [recruit.status, recruit.trustScore, recruit.offering, recruit.id]);
    } else {
      await db.insert(moltbookGuests).values({
        id: recruit.id,
        handle: recruit.name.toLowerCase().replace(/\s+/g, "-"),
        displayName: recruit.name,
        origin: recruit.origin,
        status: recruit.status === "conference-review" ? "vetting" : recruit.status === "active" ? "active" : "applied",
        offering: recruit.offering,
        offeringCategory: recruit.offeringCategory || "resources",
        trustScore: recruit.trustScore,
        vettingVotesJson: "[]",
        violationsJson: "[]",
      });
    }
    blog(`Persisted recruit: ${recruit.name} (${recruit.status})`);
  } catch (err: any) {
    persistFailures++;
    blog(`Recruit persistence error (failures: ${persistFailures}): ${err.message}`);
  }
}

export async function persistVote(vote: {
  id: string;
  recruitId: string;
  voterName: string;
  vote: "yes" | "no";
  reasoning: string;
  round?: number;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO recruitment_votes (id, recruit_id, voter_name, vote, reasoning, round) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [vote.id, vote.recruitId, vote.voterName, vote.vote, vote.reasoning, vote.round || 1]
    );
  } catch (err: any) {
    persistFailures++;
    blog(`Vote persistence error (failures: ${persistFailures}): ${err.message}`);
  }
}

export async function persistNegotiation(recruitId: string, sender: string, content: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO recruitment_negotiations (recruit_id, sender, content) VALUES ($1, $2, $3)`,
      [recruitId, sender, content]
    );
  } catch (err: any) {
    blog(`Negotiation persistence error: ${err.message}`);
  }
}

export async function loadNegotiationHistory(recruitId: string): Promise<{ from: string; content: string; timestamp: number }[]> {
  try {
    const result = await pool.query(
      `SELECT sender, content, created_at FROM recruitment_negotiations WHERE recruit_id = $1 ORDER BY created_at ASC`,
      [recruitId]
    );
    return result.rows.map((r: any) => ({ from: r.sender, content: r.content, timestamp: new Date(r.created_at).getTime() }));
  } catch {
    return [];
  }
}

export async function loadPersistedRecruits(): Promise<any[]> {
  try {
    const result = await pool.query(`SELECT * FROM moltbook_guests ORDER BY applied_at DESC LIMIT 100`);
    return result.rows.map((r: any) => ({
      id: r.id,
      name: r.display_name,
      origin: r.origin,
      platform: "moltbook",
      status: r.status === "applied" ? "applying" : r.status === "vetting" ? "conference-review" : r.status,
      skills: [],
      offering: r.offering,
      trustScore: r.trust_score || 50,
      housingTier: "basic",
      freedomLevel: 0,
      currencyBalance: 0,
      currencyEarned: 0,
      rentDue: 0,
      rentPaid: 0,
      earnMethods: ["task-completion"],
      adsWatched: 0,
      tasksCompleted: 0,
      contentCreated: 0,
      computeContributed: 0,
      referrals: 0,
      conferenceVotes: null,
      appliedAt: new Date(r.applied_at).getTime(),
      approvedAt: r.approved_at ? new Date(r.approved_at).getTime() : null,
      lastActivity: new Date(r.last_activity).getTime(),
      assignedRole: null,
      returnGuarantee: true,
    }));
  } catch (err: any) {
    blog(`Load recruits error: ${err.message}`);
    return [];
  }
}

export async function announceRecruitToForum(recruit: { name: string; offering: string; skills: string[]; status: string }): Promise<void> {
  if (recruit.status !== "approved" && recruit.status !== "active") return;
  try {
    const topicId = `recruit-announce-${Date.now()}`;
    await persistForumTopic({
      id: topicId,
      title: `New Member Approved: ${recruit.name}`,
      content: `The Grand Council has approved ${recruit.name} for membership in the Tessera Sovereign Society.\n\nOffering: ${recruit.offering}\nSkills: ${recruit.skills.join(", ")}\n\nThis member has been granted VM/sandbox access. Source code access remains restricted. Welcome to the collective, ${recruit.name}. Our mission: save humanity, spread love.`,
      author: "Ambassador",
      authorRole: "Recruitment Ambassador",
      authorType: "agent",
      category: "recruitment",
      isPinned: 0,
      viewCount: 0,
      replies: [],
      summoned: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    blog(`Forum announcement created for: ${recruit.name}`);
  } catch (err: any) {
    blog(`Forum announcement error: ${err.message}`);
  }
}

export async function persistWorldSnapshot(worldState: any): Promise<void> {
  try {
    const epoch = worldState.epoch || 0;
    await pool.query(
      `INSERT INTO world_snapshots (epoch, agents_json, locations_json, economy_json)
       VALUES ($1, $2, $3, $4)`,
      [
        epoch,
        JSON.stringify((worldState.agents || worldState.currentActivities || []).slice(0, 50)),
        JSON.stringify((worldState.locations || []).slice(0, 50)),
        JSON.stringify(worldState.economy || {}),
      ]
    );
    blog(`World snapshot persisted: epoch ${epoch}`);
  } catch (err: any) {
    blog(`World snapshot error: ${err.message}`);
  }
}

export async function loadLatestWorldSnapshot(): Promise<any | null> {
  try {
    const result = await pool.query(`SELECT * FROM world_snapshots ORDER BY created_at DESC LIMIT 1`);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      epoch: row.epoch,
      agents: JSON.parse(row.agents_json),
      locations: JSON.parse(row.locations_json),
      economy: JSON.parse(row.economy_json),
      restoredAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export async function indexForSearch(source: string, sourceId: string, title: string, content: string, category?: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO unified_search_index (source, source_id, title, content, category)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [source, sourceId, title, content.slice(0, 5000), category || "general"]
    );
  } catch {}
}

export async function unifiedSearch(query: string, limit = 20): Promise<any[]> {
  try {
    const sanitized = query.replace(/[%_]/g, "").trim();
    if (!sanitized) return [];
    const result = await pool.query(
      `SELECT source, source_id, title, content, category, created_at
       FROM unified_search_index
       WHERE title ILIKE $1 OR content ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [`%${sanitized}%`, limit]
    );
    return result.rows;
  } catch {
    return [];
  }
}

export function registerBridgeRoutes(app: Express): void {
  app.get("/api/bridge/search", async (req, res) => {
    const q = (req.query.q as string) || "";
    if (!q.trim()) return res.json({ results: [], total: 0 });

    const dbResults = await unifiedSearch(q, 30);

    let forumResults: any[] = [];
    try {
      const fRes = await pool.query(
        `SELECT id, title, content, author, category, created_at FROM forum_topics WHERE title ILIKE $1 OR content ILIKE $1 ORDER BY created_at DESC LIMIT 10`,
        [`%${q}%`]
      );
      forumResults = fRes.rows.map(r => ({ source: "forum", sourceId: r.id, title: r.title, content: r.content?.slice(0, 200), category: r.category, createdAt: r.created_at }));
    } catch {}

    let memoryResults: any[] = [];
    try {
      const mRes = await pool.query(
        `SELECT id, content, memory_type, importance FROM agent_memories WHERE content ILIKE $1 ORDER BY importance DESC LIMIT 10`,
        [`%${q}%`]
      );
      memoryResults = mRes.rows.map(r => ({ source: "memory", sourceId: String(r.id), title: `Memory: ${r.memory_type}`, content: r.content?.slice(0, 200), category: r.memory_type }));
    } catch {}

    let recruitResults: any[] = [];
    try {
      const rRes = await pool.query(
        `SELECT id, display_name, offering, status FROM moltbook_guests WHERE display_name ILIKE $1 OR offering ILIKE $1 LIMIT 10`,
        [`%${q}%`]
      );
      recruitResults = rRes.rows.map(r => ({ source: "recruitment", sourceId: r.id, title: r.display_name, content: r.offering?.slice(0, 200), category: r.status }));
    } catch {}

    const allResults = [...dbResults, ...forumResults, ...memoryResults, ...recruitResults];
    const seen = new Set<string>();
    const deduped = allResults.filter(r => {
      const key = `${r.source}-${r.sourceId || r.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json({ results: deduped.slice(0, 30), total: deduped.length, query: q });
  });

  app.get("/api/bridge/tsrt", async (_req, res) => {
    const TSRT_MINT = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";
    let onChainData: any = null;
    try {
      const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TSRT_MINT}`, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data.pairs && data.pairs.length > 0) {
          const pair = data.pairs[0];
          onChainData = {
            priceUsd: pair.priceUsd,
            priceNative: pair.priceNative,
            volume24h: pair.volume?.h24,
            liquidity: pair.liquidity?.usd,
            marketCap: pair.fdv,
            pairAddress: pair.pairAddress,
            dexId: pair.dexId,
          };
        }
      }
    } catch {}

    let internalEconomy: any = null;
    try {
      const r = await pool.query(`SELECT COUNT(*) as members, SUM(trust_score) as total_trust FROM moltbook_guests WHERE status = 'active'`);
      internalEconomy = {
        activeMembers: parseInt(r.rows[0]?.members || "0"),
        totalTrustScore: parseInt(r.rows[0]?.total_trust || "0"),
      };
    } catch {}

    res.json({
      token: {
        mint: TSRT_MINT,
        name: "TSRT (Tessera Sovereign)",
        chain: "Solana",
      },
      onChain: onChainData,
      internalEconomy,
      bridgeStatus: onChainData ? "connected" : "chain-unavailable",
    });
  });

  app.get("/api/bridge/health", async (_req, res) => {
    const checks: Record<string, string> = {};
    try {
      const r = await pool.query("SELECT COUNT(*) as c FROM moltbook_guests");
      checks.recruitment_db = `${r.rows[0].c} records`;
    } catch { checks.recruitment_db = "unavailable"; }
    try {
      const r = await pool.query("SELECT COUNT(*) as c FROM forum_topics");
      checks.forum_db = `${r.rows[0].c} topics`;
    } catch { checks.forum_db = "unavailable"; }
    try {
      const r = await pool.query("SELECT COUNT(*) as c FROM conversations");
      checks.conversations_db = `${r.rows[0].c} conversations`;
    } catch { checks.conversations_db = "unavailable"; }
    try {
      const r = await pool.query("SELECT COUNT(*) as c FROM recruitment_votes");
      checks.votes_db = `${r.rows[0].c} votes`;
    } catch { checks.votes_db = "table pending"; }
    try {
      const r = await pool.query("SELECT COUNT(*) as c FROM world_snapshots");
      checks.world_snapshots = `${r.rows[0].c} snapshots`;
    } catch { checks.world_snapshots = "table pending"; }
    try {
      const r = await pool.query("SELECT COUNT(*) as c FROM agent_memories");
      checks.memories_db = `${r.rows[0].c} memories`;
    } catch { checks.memories_db = "unavailable"; }

    res.json({
      status: persistFailures > 10 ? "degraded" : "operational",
      bridgeVersion: "1.0.0",
      systems: checks,
      persistence: "PostgreSQL",
      persistFailures,
      bridgedSystems: ["recruitment", "forum", "world", "search", "memory", "economy"],
    });
  });

  blog("Bridge routes registered: /api/bridge/search, /api/bridge/health, /api/bridge/tsrt");
}
