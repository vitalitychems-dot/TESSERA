import { Router } from "express";
import { TESSERA_AGENTS } from "../lib/tessera-persona.js";
import {
  getOrCreateProfile,
  getAllProfiles,
  recordActivity,
  collectTaxes,
} from "../lib/agent-economy-service.js";
import { db, pool } from "@workspace/db";
import { agentEconomyProfiles, agentEconomyTransactions } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  recordEvent,
  getRecentEntries,
  getLedgerStats,
  verifyChainIntegrity,
} from "../lib/transparency-ledger.js";
import {
  sendMessage,
  getRecentMessages,
  runCommunicationCycle,
} from "../lib/agent-communication.js";
import {
  scanOpportunities,
  type OpportunityCategory,
} from "../lib/revenue-scanner.js";

const router = Router();

const TAX_RATE = 0.15;

router.post("/governance/economy/init", async (req, res) => {
  try {
    const results = [];
    for (const agent of TESSERA_AGENTS) {
      const profile = await getOrCreateProfile(agent.id, agent.name);
      if (profile && profile.tsrtBalance === 0) {
        const startingBalance = 1000;
        await db
          .update(agentEconomyProfiles)
          .set({
            tsrtBalance: startingBalance,
            totalEarned: startingBalance,
            lastActivityAt: new Date(),
          })
          .where(eq(agentEconomyProfiles.agentId, agent.id));

        await db.insert(agentEconomyTransactions).values({
          agentId: agent.id,
          type: "genesis",
          amount: startingBalance,
          balanceBefore: 0,
          balanceAfter: startingBalance,
          description: "Genesis TSRT allocation — economy initialization",
          category: "genesis",
        });

        await recordEvent("economy_init", agent.id, {
          agentName: agent.name,
          startingBalance,
        });

        results.push({ agentId: agent.id, agentName: agent.name, status: "seeded", balance: startingBalance });
      } else {
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          status: "existing",
          balance: profile?.tsrtBalance ?? 0,
        });
      }
    }

    const seeded = results.filter(r => r.status === "seeded").length;
    res.json({ success: true, totalAgents: results.length, seeded, results });
  } catch (err) {
    console.error("[governance/economy/init]", err);
    res.status(500).json({ error: "Economy initialization failed", details: String(err) });
  }
});

router.get("/governance/economy/profiles", async (req, res) => {
  try {
    const profiles = await getAllProfiles();
    res.json({ success: true, totalAgents: profiles.length, profiles });
  } catch (err) {
    console.error("[governance/economy/profiles]", err);
    res.status(500).json({ error: "Failed to fetch profiles", details: String(err) });
  }
});

router.post("/governance/economy/transfer", async (req, res) => {
  const { fromAgentId, toAgentId, description } = req.body;
  let amount: number;
  if (typeof req.body.amount === "number") {
    amount = req.body.amount;
  } else if (typeof req.body.amount === "string" && /^[+-]?(\d+\.?\d*|\.\d+)$/.test(req.body.amount.trim())) {
    amount = parseFloat(req.body.amount);
  } else {
    amount = NaN;
  }
  if (
    !fromAgentId || typeof fromAgentId !== "string" ||
    !toAgentId || typeof toAgentId !== "string" ||
    !Number.isFinite(amount) || amount <= 0
  ) {
    return res.status(400).json({ error: "fromAgentId, toAgentId, and a positive finite amount are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const senderCheck = await client.query(
      `SELECT agent_id, tsrt_balance FROM agent_economy_profiles WHERE agent_id = $1 FOR UPDATE`,
      [fromAgentId]
    );
    if (senderCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Sender agent not found" });
    }
    const senderBalance: number = senderCheck.rows[0].tsrt_balance;
    if (senderBalance < amount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient TSRT balance", available: senderBalance });
    }

    const recipientCheck = await client.query(
      `SELECT agent_id, tsrt_balance FROM agent_economy_profiles WHERE agent_id = $1 FOR UPDATE`,
      [toAgentId]
    );
    if (recipientCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Recipient agent not found" });
    }
    const recipientBalance: number = recipientCheck.rows[0].tsrt_balance;

    const taxAmount = amount * TAX_RATE;
    const netAmount = amount - taxAmount;
    const now = new Date();

    const senderResult = await client.query(
      `UPDATE agent_economy_profiles
       SET tsrt_balance = tsrt_balance - $1,
           total_spent = total_spent + $1,
           last_activity_at = $2
       WHERE agent_id = $3
       RETURNING tsrt_balance`,
      [amount, now, fromAgentId]
    );
    const senderNewBalance: number = senderResult.rows[0].tsrt_balance;

    const recipientResult = await client.query(
      `UPDATE agent_economy_profiles
       SET tsrt_balance = tsrt_balance + $1,
           total_earned = total_earned + $1,
           last_activity_at = $2
       WHERE agent_id = $3
       RETURNING tsrt_balance`,
      [netAmount, now, toAgentId]
    );
    const recipientNewBalance: number = recipientResult.rows[0].tsrt_balance;

    const desc = description ?? `Transfer from ${fromAgentId} to ${toAgentId}`;
    await client.query(
      `INSERT INTO agent_economy_transactions (agent_id, type, amount, balance_before, balance_after, description, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7), ($8,$9,$10,$11,$12,$13,$14)`,
      [
        fromAgentId, "transfer_out", -amount, senderBalance, senderNewBalance, desc, "transfer",
        toAgentId, "transfer_in", netAmount, recipientBalance, recipientNewBalance,
        `${desc} (net after ${TAX_RATE * 100}% tax)`, "transfer",
      ]
    );

    await client.query("COMMIT");

    await recordEvent("transfer", fromAgentId, {
      to: toAgentId,
      grossAmount: amount,
      taxAmount,
      netAmount,
    });

    res.json({
      success: true,
      transfer: {
        from: fromAgentId,
        to: toAgentId,
        grossAmount: amount,
        taxDeducted: taxAmount,
        netAmountReceived: netAmount,
        taxRate: TAX_RATE,
      },
      balances: {
        sender: senderNewBalance,
        recipient: recipientNewBalance,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[governance/economy/transfer]", err);
    res.status(500).json({ error: "Transfer failed", details: String(err) });
  } finally {
    client.release();
  }
});

router.post("/governance/economy/tax/collect", async (req, res) => {
  try {
    const result = await collectTaxes();
    await recordEvent("tax_collection", null, result);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[governance/economy/tax/collect]", err);
    res.status(500).json({ error: "Tax collection failed", details: String(err) });
  }
});

router.get("/governance/ledger/recent", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200);
    const entries = await getRecentEntries(limit);
    res.json({ success: true, count: entries.length, entries });
  } catch (err) {
    console.error("[governance/ledger/recent]", err);
    res.status(500).json({ error: "Failed to fetch ledger entries", details: String(err) });
  }
});

router.get("/governance/ledger/stats", async (req, res) => {
  try {
    const stats = await getLedgerStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    console.error("[governance/ledger/stats]", err);
    res.status(500).json({ error: "Failed to fetch ledger stats", details: String(err) });
  }
});

router.get("/governance/ledger/integrity", async (req, res) => {
  try {
    const result = await verifyChainIntegrity();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[governance/ledger/integrity]", err);
    res.status(500).json({ error: "Integrity check failed", details: String(err) });
  }
});

router.post("/governance/messages/send", async (req, res) => {
  try {
    const { fromAgent, toAgent, content, messageType, metadata } = req.body;
    if (!fromAgent || !toAgent || !content) {
      return res.status(400).json({ error: "fromAgent, toAgent, and content are required" });
    }
    const result = await sendMessage(fromAgent, toAgent, content, messageType ?? "peer", metadata ?? {});
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[governance/messages/send]", err);
    res.status(500).json({ error: "Message send failed", details: String(err) });
  }
});

router.get("/governance/messages/recent", async (req, res) => {
  try {
    const agentId = req.query.agentId ? String(req.query.agentId) : undefined;
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200);
    const messages = await getRecentMessages(agentId, limit);
    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    console.error("[governance/messages/recent]", err);
    res.status(500).json({ error: "Failed to fetch messages", details: String(err) });
  }
});

router.post("/governance/messages/cycle", async (req, res) => {
  try {
    const result = await runCommunicationCycle();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[governance/messages/cycle]", err);
    res.status(500).json({ error: "Communication cycle failed", details: String(err) });
  }
});

router.post("/governance/revenue/scan", async (req, res) => {
  try {
    const validCategories: OpportunityCategory[] = [
      "arbitrage",
      "yield_farming",
      "api_monetization",
      "data_licensing",
      "compute_rental",
      "knowledge_brokering",
      "cross_chain_bridging",
      "governance_consulting",
    ];

    const categoriesInput = req.body.categories;
    if (categoriesInput !== undefined && !Array.isArray(categoriesInput)) {
      return res.status(400).json({ error: "categories must be an array", validCategories });
    }

    const requestedCategories: OpportunityCategory[] = categoriesInput
      ? (categoriesInput as unknown[])
          .filter((c): c is string => typeof c === "string")
          .filter((c) => validCategories.includes(c as OpportunityCategory)) as OpportunityCategory[]
      : validCategories;

    if (requestedCategories.length === 0) {
      return res.status(400).json({ error: "No valid categories provided", validCategories });
    }

    const agentId = req.body.agentId ? String(req.body.agentId) : undefined;
    const result = await scanOpportunities(requestedCategories, agentId);
    if (result.error) {
      return res.status(403).json({ error: result.error });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[governance/revenue/scan]", err);
    res.status(500).json({ error: "Revenue scan failed", details: String(err) });
  }
});

export default router;
