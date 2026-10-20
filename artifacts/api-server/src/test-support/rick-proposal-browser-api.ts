import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import { eq } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { systemStateTable } from "@workspace/db/schema";

type StoredProposal = {
  id: string;
  title: string;
  state: string;
  approvedBy?: string;
  approvalTestRef?: string;
  implementedBy?: string;
  implementationTestRef?: string;
};

type ProposalStore = { proposals: StoredProposal[]; lastGeneratedAt: number };

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

export async function startRickProposalBrowserApi() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Rick proposal browser integration tests must never run against production.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the Rick proposal persistence integration test.");
  }

  const envNames = ["NODE_ENV", "RICK_PROPOSALS_STATE_KEY", "TESSERACT_ADMIN_KEY", "SOVEREIGN_SESSION_SECRET"] as const;
  const previousEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  const stateKey = `rick.proposals.integration.${randomUUID()}`;
  const proposalId = `rick-integration-${randomUUID()}`;
  const ownerKey = "synthetic-rick-browser-integration-owner";
  const sessionSecret = `synthetic-rick-browser-integration-${randomUUID()}-${randomUUID()}`;

  process.env.NODE_ENV = "test";
  process.env.RICK_PROPOSALS_STATE_KEY = stateKey;
  process.env.TESSERACT_ADMIN_KEY = ownerKey;
  process.env.SOVEREIGN_SESSION_SECRET = sessionSecret;

  let server: Server | undefined;
  let seeded = false;
  let cleaned = false;
  const proposal: StoredProposal & Record<string, unknown> = {
    id: proposalId,
    title: "Synthetic Rick approval and implementation persistence check",
    problem: "Disposable integration-test proposal.",
    evidence: [{ metric: "integration.fixture", value: "synthetic" }],
    proposedChange: "Record owner review evidence only.",
    testPlan: "Integration assertions verify persistence.",
    risk: "low",
    effortHours: 1,
    category: "integration-test",
    state: "pending-review",
    generatedAt: Date.now(),
    source: "deterministic",
  };

  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try {
      if (server) {
        await new Promise<void>((resolve, reject) =>
          server!.close((error) => error ? reject(error) : resolve()),
        );
      }
    } finally {
      try {
        if (seeded) {
          await db.delete(systemStateTable).where(eq(systemStateTable.key, stateKey));
          const [leftover] = await db
            .select({ key: systemStateTable.key })
            .from(systemStateTable)
            .where(eq(systemStateTable.key, stateKey))
            .limit(1);
          if (leftover) throw new Error("Synthetic Rick proposal state was not removed after the integration test.");
        }
      } finally {
        try {
          await pool.end();
        } finally {
          for (const name of envNames) restoreEnv(name, previousEnv[name]);
        }
      }
    }
  };

  try {
    const [existing] = await db
      .select({ key: systemStateTable.key })
      .from(systemStateTable)
      .where(eq(systemStateTable.key, stateKey))
      .limit(1);
    if (existing) throw new Error("Unexpected collision for the synthetic Rick proposal state key.");

    await db.insert(systemStateTable).values({
      key: stateKey,
      value: { proposals: [proposal], lastGeneratedAt: Date.now() },
      description: "Disposable Rick browser integration fixture.",
    });
    seeded = true;

    const [{ default: adminSessionRouter }, { default: rickRouter }] = await Promise.all([
      import("../routes/admin-session"),
      import("../routes/rick"),
    ]);
    const app = express();
    app.set("trust proxy", "loopback");
    app.use(express.json());
    app.use("/api", adminSessionRouter);
    app.use("/api", rickRouter);

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Rick proposal integration API did not start.");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    return {
      baseUrl,
      proposalId,
      ownerKey,
      async readPersistedProposal(): Promise<StoredProposal | undefined> {
        const [row] = await db
          .select({ value: systemStateTable.value })
          .from(systemStateTable)
          .where(eq(systemStateTable.key, stateKey))
          .limit(1);
        const value = row?.value as ProposalStore | undefined;
        return value?.proposals?.find((item) => item.id === proposalId);
      },
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
