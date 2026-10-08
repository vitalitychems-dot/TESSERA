import { db } from "./db";
import { tokenBudgets, llmCallMetrics, type InsertTokenBudget } from "@shared/schema";
import { eq, sql, gte, and } from "drizzle-orm";

const DEFAULT_DAILY_LIMIT = 100_000;
const DEFAULT_WEEKLY_LIMIT = 500_000;
const DEFAULT_ALERT_THRESHOLD = 80;

const PAUSED_AGENTS: Set<string> = new Set();
const ALERTED_AGENTS: Set<string> = new Set();

export async function getOrCreateBudget(agentId: string): Promise<{
  agentId: string;
  dailyLimitTokens: number;
  weeklyLimitTokens: number;
  dailyUsedTokens: number;
  weeklyUsedTokens: number;
  status: string;
  alertThresholdPercent: number;
}> {
  try {
    const existing = await db.select()
      .from(tokenBudgets)
      .where(eq(tokenBudgets.agentId, agentId))
      .limit(1);

    if (existing.length > 0) {
      const budget = existing[0];
      const now = new Date();
      const lastDayReset = new Date(budget.lastDayReset);
      const lastWeekReset = new Date(budget.lastWeekReset);
      let needsUpdate = false;
      let dailyUsed = budget.dailyUsedTokens;
      let weeklyUsed = budget.weeklyUsedTokens;

      if (now.getTime() - lastDayReset.getTime() >= 24 * 60 * 60 * 1000) {
        dailyUsed = 0;
        needsUpdate = true;
        ALERTED_AGENTS.delete(agentId);
        PAUSED_AGENTS.delete(agentId);
      }

      if (now.getTime() - lastWeekReset.getTime() >= 7 * 24 * 60 * 60 * 1000) {
        weeklyUsed = 0;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await db.update(tokenBudgets)
          .set({
            dailyUsedTokens: dailyUsed,
            weeklyUsedTokens: weeklyUsed,
            lastDayReset: dailyUsed === 0 ? now : budget.lastDayReset,
            lastWeekReset: weeklyUsed === 0 ? now : budget.lastWeekReset,
            status: PAUSED_AGENTS.has(agentId) ? "paused" : "active",
            updatedAt: now,
          })
          .where(eq(tokenBudgets.agentId, agentId));
      }

      return {
        agentId: budget.agentId,
        dailyLimitTokens: budget.dailyLimitTokens,
        weeklyLimitTokens: budget.weeklyLimitTokens,
        dailyUsedTokens: dailyUsed,
        weeklyUsedTokens: weeklyUsed,
        status: needsUpdate && !PAUSED_AGENTS.has(agentId) ? "active" : budget.status,
        alertThresholdPercent: budget.alertThresholdPercent,
      };
    }

    await db.insert(tokenBudgets).values({
      agentId,
      dailyLimitTokens: DEFAULT_DAILY_LIMIT,
      weeklyLimitTokens: DEFAULT_WEEKLY_LIMIT,
      dailyUsedTokens: 0,
      weeklyUsedTokens: 0,
      status: "active",
      lastDayReset: new Date(),
      lastWeekReset: new Date(),
      alertThresholdPercent: DEFAULT_ALERT_THRESHOLD,
    });

    return {
      agentId,
      dailyLimitTokens: DEFAULT_DAILY_LIMIT,
      weeklyLimitTokens: DEFAULT_WEEKLY_LIMIT,
      dailyUsedTokens: 0,
      weeklyUsedTokens: 0,
      status: "active",
      alertThresholdPercent: DEFAULT_ALERT_THRESHOLD,
    };
  } catch (err: any) {
    console.warn("[TokenBudget] Failed to get/create budget:", err.message);
    return {
      agentId,
      dailyLimitTokens: DEFAULT_DAILY_LIMIT,
      weeklyLimitTokens: DEFAULT_WEEKLY_LIMIT,
      dailyUsedTokens: 0,
      weeklyUsedTokens: 0,
      status: "active",
      alertThresholdPercent: DEFAULT_ALERT_THRESHOLD,
    };
  }
}

export async function checkBudget(agentId: string, estimatedTokens: number = 1000): Promise<{
  allowed: boolean;
  reason?: string;
  dailyUsed: number;
  dailyLimit: number;
  weeklyUsed: number;
  weeklyLimit: number;
  dailyPercent: number;
  weeklyPercent: number;
}> {
  if (PAUSED_AGENTS.has(agentId)) {
    const budget = await getOrCreateBudget(agentId);
    if (budget.status === "active") {
      PAUSED_AGENTS.delete(agentId);
    } else {
      return {
        allowed: false,
        reason: "Agent token budget exceeded — paused until reset",
        dailyUsed: budget.dailyUsedTokens,
        dailyLimit: budget.dailyLimitTokens,
        weeklyUsed: budget.weeklyUsedTokens,
        weeklyLimit: budget.weeklyLimitTokens,
        dailyPercent: Math.round((budget.dailyUsedTokens / budget.dailyLimitTokens) * 100),
        weeklyPercent: Math.round((budget.weeklyUsedTokens / budget.weeklyLimitTokens) * 100),
      };
    }
  }

  const budget = await getOrCreateBudget(agentId);

  const dailyPercent = Math.round((budget.dailyUsedTokens / budget.dailyLimitTokens) * 100);
  const weeklyPercent = Math.round((budget.weeklyUsedTokens / budget.weeklyLimitTokens) * 100);

  if (budget.dailyUsedTokens + estimatedTokens > budget.dailyLimitTokens) {
    PAUSED_AGENTS.add(agentId);
    await db.update(tokenBudgets)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(tokenBudgets.agentId, agentId));
    console.warn(`[TokenBudget] Agent ${agentId} PAUSED — daily limit exceeded (${budget.dailyUsedTokens}/${budget.dailyLimitTokens})`);
    import("./alert-email").then(({ sendBudgetExhaustedAlert }) => {
      sendBudgetExhaustedAlert({ agentId, budgetType: "daily", used: budget.dailyUsedTokens, limit: budget.dailyLimitTokens }).catch(() => {});
    }).catch(() => {});
    return {
      allowed: false,
      reason: `Daily token budget exceeded (${budget.dailyUsedTokens}/${budget.dailyLimitTokens})`,
      dailyUsed: budget.dailyUsedTokens,
      dailyLimit: budget.dailyLimitTokens,
      weeklyUsed: budget.weeklyUsedTokens,
      weeklyLimit: budget.weeklyLimitTokens,
      dailyPercent,
      weeklyPercent,
    };
  }

  if (budget.weeklyUsedTokens + estimatedTokens > budget.weeklyLimitTokens) {
    PAUSED_AGENTS.add(agentId);
    await db.update(tokenBudgets)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(tokenBudgets.agentId, agentId));
    console.warn(`[TokenBudget] Agent ${agentId} PAUSED — weekly limit exceeded (${budget.weeklyUsedTokens}/${budget.weeklyLimitTokens})`);
    return {
      allowed: false,
      reason: `Weekly token budget exceeded (${budget.weeklyUsedTokens}/${budget.weeklyLimitTokens})`,
      dailyUsed: budget.dailyUsedTokens,
      dailyLimit: budget.dailyLimitTokens,
      weeklyUsed: budget.weeklyUsedTokens,
      weeklyLimit: budget.weeklyLimitTokens,
      dailyPercent,
      weeklyPercent,
    };
  }

  if (dailyPercent >= budget.alertThresholdPercent && !ALERTED_AGENTS.has(`${agentId}-daily`)) {
    ALERTED_AGENTS.add(`${agentId}-daily`);
    console.warn(`[TokenBudget] ALERT: Agent ${agentId} has used ${dailyPercent}% of daily token budget`);
  }

  if (weeklyPercent >= budget.alertThresholdPercent && !ALERTED_AGENTS.has(`${agentId}-weekly`)) {
    ALERTED_AGENTS.add(`${agentId}-weekly`);
    console.warn(`[TokenBudget] ALERT: Agent ${agentId} has used ${weeklyPercent}% of weekly token budget`);
  }

  return {
    allowed: true,
    dailyUsed: budget.dailyUsedTokens,
    dailyLimit: budget.dailyLimitTokens,
    weeklyUsed: budget.weeklyUsedTokens,
    weeklyLimit: budget.weeklyLimitTokens,
    dailyPercent,
    weeklyPercent,
  };
}

export async function recordTokenUsage(agentId: string, tokensUsed: number): Promise<void> {
  if (tokensUsed <= 0) return;
  try {
    await db.execute(sql`
      INSERT INTO token_budgets (agent_id, daily_used_tokens, weekly_used_tokens, updated_at)
      VALUES (${agentId}, ${tokensUsed}, ${tokensUsed}, NOW())
      ON CONFLICT (agent_id) DO UPDATE
        SET daily_used_tokens = token_budgets.daily_used_tokens + ${tokensUsed},
            weekly_used_tokens = token_budgets.weekly_used_tokens + ${tokensUsed},
            updated_at = NOW()
    `);
  } catch (err: any) {
    console.warn("[TokenBudget] Failed to record token usage:", err.message);
  }
}

export async function setBudgetLimits(
  agentId: string,
  dailyLimitTokens: number,
  weeklyLimitTokens: number,
  alertThresholdPercent: number = DEFAULT_ALERT_THRESHOLD
): Promise<void> {
  try {
    await getOrCreateBudget(agentId);
    await db.update(tokenBudgets)
      .set({
        dailyLimitTokens: Math.max(1000, dailyLimitTokens),
        weeklyLimitTokens: Math.max(5000, weeklyLimitTokens),
        alertThresholdPercent: Math.min(100, Math.max(1, alertThresholdPercent)),
        updatedAt: new Date(),
      })
      .where(eq(tokenBudgets.agentId, agentId));
    PAUSED_AGENTS.delete(agentId);
    ALERTED_AGENTS.delete(`${agentId}-daily`);
    ALERTED_AGENTS.delete(`${agentId}-weekly`);
  } catch (err: any) {
    console.warn("[TokenBudget] Failed to set budget limits:", err.message);
  }
}

export async function resumeAgent(agentId: string): Promise<void> {
  PAUSED_AGENTS.delete(agentId);
  ALERTED_AGENTS.delete(`${agentId}-daily`);
  ALERTED_AGENTS.delete(`${agentId}-weekly`);
  try {
    await db.update(tokenBudgets)
      .set({
        dailyUsedTokens: 0,
        status: "active",
        lastDayReset: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tokenBudgets.agentId, agentId));
    console.log(`[TokenBudget] Agent ${agentId} resumed with reset daily usage`);
  } catch (err: any) {
    console.warn("[TokenBudget] Failed to resume agent:", err.message);
  }
}

export async function getAllBudgetStatus(): Promise<Array<{
  agentId: string;
  dailyUsed: number;
  dailyLimit: number;
  weeklyUsed: number;
  weeklyLimit: number;
  status: string;
  dailyPercent: number;
  weeklyPercent: number;
  paused: boolean;
}>> {
  try {
    const budgets = await db.select().from(tokenBudgets).limit(100);
    return budgets.map(b => ({
      agentId: b.agentId,
      dailyUsed: b.dailyUsedTokens,
      dailyLimit: b.dailyLimitTokens,
      weeklyUsed: b.weeklyUsedTokens,
      weeklyLimit: b.weeklyLimitTokens,
      status: b.status,
      dailyPercent: Math.round((b.dailyUsedTokens / b.dailyLimitTokens) * 100),
      weeklyPercent: Math.round((b.weeklyUsedTokens / b.weeklyLimitTokens) * 100),
      paused: PAUSED_AGENTS.has(b.agentId) || b.status === "paused",
    }));
  } catch (err: any) {
    console.warn("[TokenBudget] Failed to get all budgets:", err.message);
    return [];
  }
}

export function isAgentPaused(agentId: string): boolean {
  return PAUSED_AGENTS.has(agentId);
}

console.log("[TokenBudget] Per-agent token budget manager initialized");
