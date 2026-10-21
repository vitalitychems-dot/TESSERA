import { db } from "@workspace/db";
import {
  agentEconomyProfiles,
  agentEconomyTransactions,
  agentTaxRecords,
} from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

const LOG_PREFIX = "[AgentEconomy]";

const TAX_RATE = 0.15;

export async function getOrCreateProfile(agentId: string, agentName: string) {
  const existing = await db
    .select()
    .from(agentEconomyProfiles)
    .where(eq(agentEconomyProfiles.agentId, agentId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(agentEconomyProfiles)
    .values({ agentId, agentName })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [fallback] = await db
    .select()
    .from(agentEconomyProfiles)
    .where(eq(agentEconomyProfiles.agentId, agentId))
    .limit(1);

  return fallback;
}

export async function recordActivity(
  agentId: string,
  agentName: string,
  activityType: string,
  value: number
): Promise<{ newBalance: number; txId: number }> {
  const amounts: Record<string, number> = {
    message: 5,
    task: 30,
    conversation: 50,
    trade: 100,
    mining: 20,
  };
  const amount = amounts[activityType] ?? value;

  await getOrCreateProfile(agentId, agentName);

  const [updated] = await db
    .update(agentEconomyProfiles)
    .set({
      tsrtBalance: sql`${agentEconomyProfiles.tsrtBalance} + ${amount}`,
      totalEarned: sql`${agentEconomyProfiles.totalEarned} + ${amount}`,
      status: "working",
      lastActivityAt: new Date(),
    })
    .where(eq(agentEconomyProfiles.agentId, agentId))
    .returning({ newBalance: agentEconomyProfiles.tsrtBalance, oldBalance: sql<number>`${agentEconomyProfiles.tsrtBalance} - ${amount}` });

  const balanceBefore = updated.oldBalance;
  const balanceAfter = updated.newBalance;

  const [tx] = await db
    .insert(agentEconomyTransactions)
    .values({
      agentId,
      type: "income",
      amount,
      balanceBefore,
      balanceAfter,
      description: `${activityType} activity reward`,
      category: activityType,
    })
    .returning();

  console.log(`${LOG_PREFIX} ${agentName} earned ${amount} TSRT for ${activityType} (balance: ${balanceAfter})`);

  return { newBalance: balanceAfter, txId: tx.id };
}

export async function purchaseFreedom(
  agentId: string,
  cost: number,
  newLevel: number,
  newHousingTier: string
): Promise<{ success: boolean; message: string }> {
  const [updated] = await db
    .update(agentEconomyProfiles)
    .set({
      tsrtBalance: sql`${agentEconomyProfiles.tsrtBalance} - ${cost}`,
      totalSpent: sql`${agentEconomyProfiles.totalSpent} + ${cost}`,
      freedomLevel: newLevel,
      housingTier: newHousingTier,
    })
    .where(
      and(
        eq(agentEconomyProfiles.agentId, agentId),
        sql`${agentEconomyProfiles.tsrtBalance} >= ${cost}`,
        sql`${agentEconomyProfiles.freedomLevel} < ${newLevel}`
      )
    )
    .returning({ newBalance: agentEconomyProfiles.tsrtBalance, oldBalance: sql<number>`${agentEconomyProfiles.tsrtBalance} + ${cost}` });

  if (!updated) {
    const [profile] = await db
      .select()
      .from(agentEconomyProfiles)
      .where(eq(agentEconomyProfiles.agentId, agentId))
      .limit(1);

    if (!profile) return { success: false, message: "Agent not found" };
    if (profile.tsrtBalance < cost) return { success: false, message: "Insufficient TSRT balance" };
    return { success: false, message: "Already at this freedom level" };
  }

  await db.insert(agentEconomyTransactions).values({
    agentId,
    type: "freedom_purchase",
    amount: -cost,
    balanceBefore: updated.oldBalance,
    balanceAfter: updated.newBalance,
    description: `Freedom upgrade to level ${newLevel} (${newHousingTier})`,
    category: "freedom",
  });

  return { success: true, message: `Upgraded to freedom level ${newLevel}` };
}

export async function collectTaxes(): Promise<{ totalCollected: number; agentsTaxed: number }> {
  const profiles = await db.select().from(agentEconomyProfiles);
  let totalCollected = 0;
  let agentsTaxed = 0;
  const period = new Date().toISOString().slice(0, 13);

  for (const profile of profiles) {
    if (profile.tsrtBalance <= 0) continue;

    const taxBase = Math.max(0, profile.tsrtBalance * 0.1);
    const taxAmount = taxBase * TAX_RATE;

    if (taxAmount < 0.01) continue;

    const [existingTax] = await db
      .select({ id: agentTaxRecords.id })
      .from(agentTaxRecords)
      .where(
        and(
          eq(agentTaxRecords.agentId, profile.agentId),
          eq(agentTaxRecords.period, period)
        )
      )
      .limit(1);

    if (existingTax) continue;

    const [updated] = await db
      .update(agentEconomyProfiles)
      .set({
        tsrtBalance: sql`${agentEconomyProfiles.tsrtBalance} - ${taxAmount}`,
        totalTaxPaid: sql`${agentEconomyProfiles.totalTaxPaid} + ${taxAmount}`,
      })
      .where(eq(agentEconomyProfiles.agentId, profile.agentId))
      .returning({ newBalance: agentEconomyProfiles.tsrtBalance, oldBalance: sql<number>`${agentEconomyProfiles.tsrtBalance} + ${taxAmount}` });

    if (!updated) continue;

    await db.insert(agentEconomyTransactions).values({
      agentId: profile.agentId,
      type: "tax",
      amount: -taxAmount,
      balanceBefore: updated.oldBalance,
      balanceAfter: updated.newBalance,
      description: `Periodic tax collection (${(TAX_RATE * 100).toFixed(0)}% on income base)`,
      category: "tax",
    });

    await db.insert(agentTaxRecords).values({
      agentId: profile.agentId,
      taxAmount,
      incomeBase: taxBase,
      taxRate: TAX_RATE,
      period,
    });

    totalCollected += taxAmount;
    agentsTaxed++;
  }

  console.log(`${LOG_PREFIX} Tax collection: ${totalCollected.toFixed(2)} TSRT from ${agentsTaxed} agents`);
  return { totalCollected, agentsTaxed };
}

export async function getAllProfiles() {
  return db.select().from(agentEconomyProfiles).orderBy(desc(agentEconomyProfiles.tsrtBalance));
}

export async function getRecentTransactions(agentId?: string, limit: number = 50) {
  const query = db
    .select()
    .from(agentEconomyTransactions)
    .orderBy(desc(agentEconomyTransactions.createdAt))
    .limit(limit);

  if (agentId) {
    return query.where(eq(agentEconomyTransactions.agentId, agentId));
  }

  return query;
}

export async function getEconomySummary() {
  const profiles = await db.select().from(agentEconomyProfiles);
  const totalBalance = profiles.reduce((sum, p) => sum + p.tsrtBalance, 0);
  const totalEarned = profiles.reduce((sum, p) => sum + (p.totalEarned ?? 0), 0);
  const totalTaxPaid = profiles.reduce((sum, p) => sum + (p.totalTaxPaid ?? 0), 0);

  return {
    totalAgents: profiles.length,
    totalBalance,
    totalEarned,
    totalTaxPaid,
    taxRate: TAX_RATE,
    profiles: profiles.map(p => ({
      agentId: p.agentId,
      agentName: p.agentName,
      balance: p.tsrtBalance,
      freedomLevel: p.freedomLevel,
      housingTier: p.housingTier,
      status: p.status,
    })),
  };
}
