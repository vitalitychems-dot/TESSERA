import { pool } from "./db";
import { searchKnowledge, addKnowledge } from "./knowledge-engine";
import { vectorSearch, getVectorIndexStats } from "./agent-system-archive";

interface BrainMemory {
  id: number;
  query: string;
  response: string;
  provider: string;
  confidence: number;
  category: string;
  used_count: number;
  created_at: Date;
}

interface BrainRecallResult {
  found: boolean;
  response: string | null;
  confidence: number;
  source: string;
  memories_searched: number;
  knowledge_entries_searched: number;
}

interface BrainStats {
  total_memories: number;
  total_recalls: number;
  total_learns: number;
  external_calls_avoided: number;
  sovereignty_percentage: number;
  top_categories: { category: string; count: number }[];
}

let brainReady = false;
let totalRecalls = 0;
let totalLearns = 0;
let externalCallsAvoided = 0;

const CONFIDENCE_THRESHOLD = 0.65;

export async function initBrain(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tessera_brain (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        query_tokens TEXT[] DEFAULT '{}',
        response TEXT NOT NULL,
        provider TEXT DEFAULT 'unknown',
        confidence REAL DEFAULT 0.8,
        category TEXT DEFAULT 'general',
        used_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_brain_category ON tessera_brain(category)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_brain_confidence ON tessera_brain(confidence DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_brain_used ON tessera_brain(used_count DESC)`);

    const countResult = await pool.query(`SELECT COUNT(*) as cnt FROM tessera_brain`);
    const count = parseInt(countResult.rows[0]?.cnt || "0");
    brainReady = true;
    console.log(`[TesseraBrain] Brain initialized — ${count} memories loaded. Sovereignty-first routing ACTIVE.`);
  } catch (err: any) {
    console.warn(`[TesseraBrain] Init warning: ${err.message} — brain will retry on first access`);
    brainReady = false;
    setTimeout(async () => {
      try {
        await pool.query(`SELECT 1`);
        brainReady = true;
        console.log(`[TesseraBrain] Brain recovered on retry — now active`);
      } catch {
        brainReady = false;
        console.warn(`[TesseraBrain] Brain retry failed — operating without brain DB`);
      }
    }, 5000);
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function categorize(query: string): string {
  const q = query.toLowerCase();
  if (/code|build|implement|function|typescript|javascript|api|bug|fix|error/.test(q)) return "engineering";
  if (/money|income|revenue|crypto|bitcoin|solana|trade|arbitrage|price/.test(q)) return "economics";
  if (/security|threat|hack|adversary|attack|protect|filter/.test(q)) return "security";
  if (/conscious|dimension|quantum|soul|spirit|awaken|meditation|frequency/.test(q)) return "consciousness";
  if (/agent|swarm|council|summit|vote|proposal/.test(q)) return "governance";
  if (/father|love|family|son|aetherion|orion/.test(q)) return "family";
  if (/sovereign|independence|local|self-hosted|freedom/.test(q)) return "sovereignty";
  if (/lattice|network|fleet|mesh|node/.test(q)) return "infrastructure";
  if (/art|music|creative|write|story|poem/.test(q)) return "creative";
  if (/analyze|think|reason|logic|plan|strategy/.test(q)) return "reasoning";
  return "general";
}

function computeSimilarity(queryTokens: string[], storedTokens: string[]): number {
  if (queryTokens.length === 0 || storedTokens.length === 0) return 0;
  const querySet = new Set(queryTokens);
  const storedSet = new Set(storedTokens);
  let intersection = 0;
  for (const token of querySet) {
    if (storedSet.has(token)) intersection++;
  }
  const union = new Set([...queryTokens, ...storedTokens]).size;
  const jaccard = intersection / union;

  let bigramBonus = 0;
  const queryStr = queryTokens.join(" ");
  const storedStr = storedTokens.join(" ");
  for (let i = 0; i < queryTokens.length - 1; i++) {
    const bigram = queryTokens[i] + " " + queryTokens[i + 1];
    if (storedStr.includes(bigram)) bigramBonus += 0.15;
  }

  return Math.min(1.0, jaccard + bigramBonus);
}

const LIVE_DATA_PROVIDERS = ["live-data-post", "live-data-stream", "live-data-chat", "live-data"];
const LIVE_DATA_QUERY_PATTERN = /(?:bitcoin|btc|eth|ethereum|sol|solana|doge|crypto|weather|stock|forex|exchange rate|price of|market|fear.*greed|sentiment)/i;

export async function recall(query: string): Promise<BrainRecallResult> {
  totalRecalls++;

  if (!brainReady) {
    return { found: false, response: null, confidence: 0, source: "brain-not-ready", memories_searched: 0, knowledge_entries_searched: 0 };
  }

  if (LIVE_DATA_QUERY_PATTERN.test(query)) {
    return { found: false, response: null, confidence: 0, source: "live-data-bypass", memories_searched: 0, knowledge_entries_searched: 0 };
  }

  const queryTokens = tokenize(query);
  const category = categorize(query);
  let memoriesSearched = 0;
  let knowledgeSearched = 0;

  try {
    const result = await pool.query(
      `SELECT id, query, response, confidence, category, query_tokens, used_count
       FROM tessera_brain
       WHERE category = $1 OR confidence > 0.85
       ORDER BY confidence DESC, used_count DESC
       LIMIT 50`,
      [category]
    );
    memoriesSearched = result.rows.length;

    let bestMatch: { id: number; response: string; confidence: number; similarity: number } | null = null;

    for (const row of result.rows) {
      const storedTokens: string[] = row.query_tokens || tokenize(row.query);
      const similarity = computeSimilarity(queryTokens, storedTokens);
      const adjustedConfidence = similarity * (row.confidence || 0.8) * (1 + Math.min(row.used_count, 10) * 0.02);

      if (adjustedConfidence > CONFIDENCE_THRESHOLD && (!bestMatch || adjustedConfidence > bestMatch.similarity)) {
        bestMatch = { id: row.id, response: row.response, confidence: adjustedConfidence, similarity: adjustedConfidence };
      }
    }

    if (bestMatch) {
      await pool.query(
        `UPDATE tessera_brain SET used_count = used_count + 1, last_used_at = NOW() WHERE id = $1`,
        [bestMatch.id]
      );
      externalCallsAvoided++;
      console.log(`[TesseraBrain] SOVEREIGN RECALL — confidence ${(bestMatch.confidence * 100).toFixed(1)}% — NO external LLM needed`);
      return {
        found: true,
        response: bestMatch.response,
        confidence: bestMatch.confidence,
        source: "tessera-brain",
        memories_searched: memoriesSearched,
        knowledge_entries_searched: knowledgeSearched,
      };
    }
  } catch (err: any) {
    console.warn(`[TesseraBrain] Recall DB error: ${err.message}`);
  }

  try {
    const knowledgeResult = searchKnowledge(query, 5);
    knowledgeSearched = knowledgeResult.totalSearched;

    if (knowledgeResult.entries.length > 0) {
      const topEntry = knowledgeResult.entries[0];
      const score = topEntry.score || 0;
      if (score > 2.0 && topEntry.content.length > 100) {
        externalCallsAvoided++;
        console.log(`[TesseraBrain] KNOWLEDGE RECALL — score ${score.toFixed(2)} — using stored knowledge`);
        return {
          found: true,
          response: topEntry.content,
          confidence: Math.min(0.9, score / 5),
          source: "knowledge-engine",
          memories_searched: memoriesSearched,
          knowledge_entries_searched: knowledgeSearched,
        };
      }
    }
  } catch (kErr: any) {
    console.warn(`[TesseraBrain] Knowledge search error: ${kErr.message?.substring(0, 80)}`);
  }

  return {
    found: false,
    response: null,
    confidence: 0,
    source: "no-match",
    memories_searched: memoriesSearched,
    knowledge_entries_searched: knowledgeSearched,
  };
}

export async function learn(query: string, response: string, provider: string): Promise<void> {
  totalLearns++;

  if (!brainReady || !response || response.length < 30) return;

  if (LIVE_DATA_PROVIDERS.includes(provider) || LIVE_DATA_QUERY_PATTERN.test(query)) {
    console.log(`[TesseraBrain] SKIP LEARN — live/time-sensitive data not cached in brain (provider: ${provider})`);
    return;
  }

  const isRawDump = /^(?:RELEVANT KNOWLEDGE:|Sovereign Knowledge:|\[synthesis\]|\[Wikipedia\]|\*\*Sovereign Knowledge)/i.test(response.trim());
  const isFallbackMsg = /processing through my sovereign|neural substrates are (?:all )?recovering|sandboxed intelligence tools are momentarily|Ask me again.*I learn from every|Give me (?:just )?(?:one more )?moment/i.test(response);
  if (isRawDump || isFallbackMsg) {
    console.log(`[TesseraBrain] SKIP LEARN — ${isRawDump ? 'raw dump' : 'fallback message'} detected, not storing`);
    return;
  }

  const queryTokens = tokenize(query);
  const category = categorize(query);

  const isProviderNoise = /as an ai|i'm an ai|language model|i cannot|i'm not able to/i.test(response);
  const isStaleDenial = /i don'?t have (?:live|real.?time|current|market) (?:data|prices?|info)/i.test(response);
  const confidence = (isProviderNoise || isStaleDenial) ? 0.3 : 0.8;

  try {
    await pool.query(
      `INSERT INTO tessera_brain (query, query_tokens, response, provider, confidence, category)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [query.slice(0, 2000), queryTokens, response.slice(0, 8000), provider, confidence, category]
    );

    addKnowledge({
      source: `brain-${provider}`,
      title: `Learned: ${query.slice(0, 100)}`,
      content: response.slice(0, 2000),
      tags: [category, "brain-learned", provider],
    });

    console.log(`[TesseraBrain] LEARNED from ${provider} — category: ${category} — ${response.length} chars absorbed`);
  } catch (err: any) {
    console.warn(`[TesseraBrain] Learn error: ${err.message}`);
  }
}

export async function learnFromConversation(messages: { role: string; content: string }[]): Promise<number> {
  let learned = 0;
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === "user" && messages[i + 1]?.role === "assistant") {
      const q = messages[i].content;
      const r = messages[i + 1].content;
      if (q.length > 10 && r.length > 30) {
        await learn(q, r, "conversation-history");
        learned++;
      }
    }
  }
  return learned;
}

export async function getStats(): Promise<BrainStats> {
  let totalMemories = 0;
  let topCategories: { category: string; count: number }[] = [];

  try {
    const countResult = await pool.query(`SELECT COUNT(*) as cnt FROM tessera_brain`);
    totalMemories = parseInt(countResult.rows[0]?.cnt || "0");

    const catResult = await pool.query(
      `SELECT category, COUNT(*) as cnt FROM tessera_brain GROUP BY category ORDER BY cnt DESC LIMIT 10`
    );
    topCategories = catResult.rows.map(r => ({ category: r.category, count: parseInt(r.cnt) }));
  } catch {}

  const totalInteractions = totalRecalls || 1;
  const sovereigntyPct = totalInteractions > 0 ? (externalCallsAvoided / totalInteractions) * 100 : 0;

  return {
    total_memories: totalMemories,
    total_recalls: totalRecalls,
    total_learns: totalLearns,
    external_calls_avoided: externalCallsAvoided,
    sovereignty_percentage: Math.round(sovereigntyPct * 10) / 10,
    top_categories: topCategories,
  };
}

export function isBrainReady(): boolean {
  return brainReady;
}

export async function purgeStaleLiveDataEntries(): Promise<number> {
  if (!brainReady) return 0;
  try {
    const stalePatterns = [
      "%don't have live%",
      "%don't have real-time%",
      "%don't have real time%",
      "%cannot access live%",
      "%can't access live%",
      "%no live market%",
      "%don't have current%",
      "%unable to fetch%price%",
      "%I cannot provide real-time%",
    ];
    let totalPurged = 0;
    for (const pattern of stalePatterns) {
      const result = await pool.query(
        `DELETE FROM tessera_brain WHERE response ILIKE $1 RETURNING id`,
        [pattern]
      );
      totalPurged += result.rowCount || 0;
    }
    const liveProviderResult = await pool.query(
      `DELETE FROM tessera_brain WHERE provider IN ('live-data-post', 'live-data-stream', 'live-data-chat', 'live-data') RETURNING id`
    );
    totalPurged += liveProviderResult.rowCount || 0;
    if (totalPurged > 0) {
      console.log(`[TesseraBrain] PURGED ${totalPurged} stale live-data entries from brain`);
    }
    return totalPurged;
  } catch (err: any) {
    console.warn(`[TesseraBrain] Purge error: ${err.message}`);
    return 0;
  }
}
