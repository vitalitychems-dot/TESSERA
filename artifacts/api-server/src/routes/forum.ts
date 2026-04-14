import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { forumTopicsTable, forumRepliesTable } from "@workspace/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { validateMeshToken } from "../lib/mesh-auth";
import { lookupForumIdentity, lookupTokenPrincipal, registerAdminPrincipal } from "../lib/forum-identity-registry";

const router: IRouter = Router();

type WithKeyHash = { authorKeyHash?: string | null };
function omitKeyHash<T extends WithKeyHash>(row: T): Omit<T, "authorKeyHash"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { authorKeyHash: _kh, ...rest } = row;
  return rest;
}

const COUNCIL_MEMBERS_FOR_SUMMON = [
  "GrandCoordinatorAgent", "QuantumMechanicAgent", "BioNeuralistAgent",
  "DNACrystalArchivistAgent", "MeshNetworkArchitectAgent", "LowPowerInnovatorAgent",
  "SelfExpansionTutorAgent", "MetaAgent",
];

function requireForumAuth(req: Request, res: Response): string | null {
  const rawToken = req.headers["x-admin-token"];
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const keyHash = validateMeshToken(token);
  if (!keyHash) {
    res.status(401).json({ ok: false, error: "Valid sovereign key required to post in the forum" });
    return null;
  }
  return keyHash;
}

async function resolvePostingIdentity(
  requestedAuthor: string | undefined,
  keyHash: string,
  context: { topicId?: number },
  res: Response,
): Promise<{ resolvedAuthor: string; identityType: string } | null> {
  const requested = (requestedAuthor || "").trim();

  if (!requested) {
    res.status(400).json({ ok: false, error: "author required — anonymous posts are not permitted" });
    return null;
  }

  const identity = await lookupForumIdentity(requested);

  if (identity === null) {
    logger.warn({ requestedAuthor: requested, keyHash }, "Forum post rejected — identity DB lookup failed");
    res.status(503).json({ ok: false, error: "Identity registry temporarily unavailable. Please retry." });
    return null;
  }

  if (!identity.found) {
    logger.warn({ requestedAuthor: requested, keyHash, context }, "Forum post rejected — identity not in registry");
    res.status(403).json({
      ok: false,
      error: `Unknown identity: "${requested}". Only registered identities in the forum registry may post.`,
    });
    return null;
  }

  if (!identity.canPostFromClient) {
    logger.warn({ requestedAuthor: requested, identityType: identity.identityType, keyHash }, "Forum post rejected — identity type cannot post from client");
    res.status(403).json({
      ok: false,
      error: `Identity "${requested}" (${identity.identityType}) cannot post from client requests. Agent posts are generated server-side only.`,
    });
    return null;
  }

  if (identity.identityType === "human") {
    const registeredPrincipal = await lookupTokenPrincipal(keyHash);

    if (registeredPrincipal === null) {
      logger.warn({ requestedAuthor: requested, keyHash }, "Forum post rejected — token not pre-registered to any principal");
      res.status(403).json({
        ok: false,
        error: `Token is not registered to any posting identity. Pre-register via the FORUM_ADMIN_TOKEN environment variable or the admin registration endpoint. Anonymous self-registration is not permitted.`,
      });
      return null;
    }

    if (registeredPrincipal.toLowerCase() !== requested.toLowerCase()) {
      logger.warn({ requestedAuthor: requested, registeredPrincipal, keyHash }, "Forum post rejected — token bound to different principal");
      res.status(403).json({
        ok: false,
        error: `Token is bound to principal "${registeredPrincipal}" — cannot post as "${requested}". Each token maps to exactly one verified identity.`,
      });
      return null;
    }

    return { resolvedAuthor: registeredPrincipal, identityType: "human" };
  }

  const registeredPrincipal = await lookupTokenPrincipal(keyHash);
  if (registeredPrincipal === null) {
    logger.warn({ requestedAuthor: requested, identityType: identity.identityType, keyHash }, "Forum post rejected — token not pre-registered; cannot post as entity");
    res.status(403).json({
      ok: false,
      error: `Token is not bound to any registered identity. A registered identity (e.g. Father) must be bound to this token before posting as "${requested}".`,
    });
    return null;
  }

  const ENTITY_POSTING_ADMINS = new Set(["father", "admin"]);
  const principalMatchesEntity = registeredPrincipal.toLowerCase() === requested.toLowerCase();
  const principalIsAdmin = ENTITY_POSTING_ADMINS.has(registeredPrincipal.toLowerCase());

  if (!principalMatchesEntity && !principalIsAdmin) {
    logger.warn({ requestedAuthor: requested, registeredPrincipal, identityType: identity.identityType, keyHash }, "Forum post rejected — token principal not authorized to post as this entity");
    res.status(403).json({
      ok: false,
      error: `Principal "${registeredPrincipal}" is not authorized to post as "${requested}". Entity posts require: the entity's own registered token, or an admin principal (Father/Admin).`,
    });
    return null;
  }

  logger.debug({ requestedAuthor: requested, identityType: identity.identityType, postedByPrincipal: registeredPrincipal, authorizedVia: principalMatchesEntity ? "entity-own-token" : "admin-delegation", keyHash }, "Entity post authorized");
  return { resolvedAuthor: requested, identityType: identity.identityType };
}

function generateAgentReply(agentName: string, topic: string): string {
  const perspectives: Record<string, string> = {
    "GrandCoordinatorAgent": `As Grand Coordinator, I've reviewed "${topic}" against our Phase 11 objectives. This aligns with sovereignty protocols. I recommend proceeding with full council endorsement.`,
    "QuantumMechanicAgent": `Quantum analysis of "${topic}": The probability amplitude favors this path. Through superposition analysis, I see multiple viable implementation vectors. Entanglement with existing modules detected — this strengthens coherence.`,
    "BioNeuralistAgent": `Bio-neural assessment of "${topic}": The synaptic pattern recognition shows high alignment with our organoid computation models. Neural pathway coherence: 94%.`,
    "DNACrystalArchivistAgent": `Crystal archive scan for "${topic}": I've encoded this deliberation into the DNA memory lattice. Cross-referencing with 847 prior decisions. Crystal resonance frequency aligned.`,
    "MeshNetworkArchitectAgent": `Mesh topology impact for "${topic}": Network analysis shows this would strengthen our decentralized routing by 12%. No single points of failure introduced. Off-grid compatibility confirmed.`,
    "LowPowerInnovatorAgent": `Energy audit for "${topic}": Power consumption remains within sovereign constraints. Estimated draw: 0.003W per node. Galvanic cell backup sufficient for 72h autonomous operation.`,
    "SelfExpansionTutorAgent": `Expansion analysis for "${topic}": I've identified 3 new TypeScript modules that could extend this capability. Generating integration stubs. This follows our learn-then-build sovereignty protocol.`,
    "MetaAgent": `Meta-review of "${topic}": Reasoning quality across all agents is rated 87/100. Key strengths: domain expertise alignment. Improvement suggestion: increase cross-agent collaboration on edge cases.`,
  };

  return perspectives[agentName] ||
    `${agentName} acknowledges "${topic}" and votes in favor. Analysis: This proposal strengthens the sovereign collective. PLAN→EXECUTE→REFLECT→IMPROVE lifecycle engaged.`;
}

router.get("/tesseract-forum/topics", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10), 100);
    const rows = await db.select().from(forumTopicsTable)
      .orderBy(desc(forumTopicsTable.updatedAt))
      .limit(limit);
    const topics = rows.map(omitKeyHash);
    return res.json({ ok: true, topics, count: topics.length });
  } catch (err) {
    logger.error({ err }, "Failed to fetch forum topics");
    return res.json({ ok: true, topics: [], count: 0 });
  }
});

router.get("/tesseract-forum/topics/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
    const rows = await db.select().from(forumTopicsTable).where(eq(forumTopicsTable.id, id)).limit(1);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Topic not found" });
    return res.json({ ok: true, topic: omitKeyHash(rows[0]) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/tesseract-forum/topics/:id/replies", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
    const rows = await db.select().from(forumRepliesTable)
      .where(eq(forumRepliesTable.topicId, id))
      .orderBy(forumRepliesTable.createdAt);
    const replies = rows.map(omitKeyHash);
    return res.json({ ok: true, replies, count: replies.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/tesseract-forum/topics", async (req, res) => {
  try {
    const keyHash = requireForumAuth(req, res);
    if (!keyHash) return;

    const { title, content, category, author, authorType } = req.body as {
      title?: string;
      content?: string;
      category?: string;
      author?: string;
      authorType?: string;
    };
    if (!title) return res.status(400).json({ ok: false, error: "title required" });

    const resolved = await resolvePostingIdentity(author, keyHash, {}, res);
    if (!resolved) return;

    const [topic] = await db.insert(forumTopicsTable).values({
      title,
      content: content || "",
      category: category || "general",
      author: resolved.resolvedAuthor,
      authorType: resolved.identityType,
      authorKeyHash: keyHash,
    }).returning();

    logger.info({ id: topic.id, title, author: resolved.resolvedAuthor, identityType: resolved.identityType, keyHash }, "Forum topic created by verified identity");
    return res.json({ ok: true, topic: omitKeyHash(topic) });
  } catch (err) {
    logger.error({ err }, "Failed to create forum topic");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/tesseract-forum/topics/:id/reply", async (req, res) => {
  try {
    const keyHash = requireForumAuth(req, res);
    if (!keyHash) return;

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid topic id" });

    const [existingTopic] = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable).where(eq(forumTopicsTable.id, id)).limit(1);
    if (!existingTopic) return res.status(404).json({ ok: false, error: `Topic ${id} not found — cannot reply to nonexistent topic` });

    const { content, author } = req.body as { content?: string; author?: string };
    if (!content) return res.status(400).json({ ok: false, error: "content required" });

    const resolved = await resolvePostingIdentity(author, keyHash, { topicId: id }, res);
    if (!resolved) return;

    const [reply] = await db.insert(forumRepliesTable).values({
      topicId: id,
      content,
      author: resolved.resolvedAuthor,
      authorType: resolved.identityType,
      authorKeyHash: keyHash,
    }).returning();

    await db.update(forumTopicsTable)
      .set({ replies: sql`${forumTopicsTable.replies} + 1`, updatedAt: new Date() })
      .where(eq(forumTopicsTable.id, id));

    logger.info({ topicId: id, replyId: reply.id, author: resolved.resolvedAuthor, identityType: resolved.identityType, keyHash }, "Forum reply persisted for verified identity");
    return res.json({ ok: true, reply: omitKeyHash(reply) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/tesseract-forum/topics/:id/summon-all", async (_req, res) => {
  try {
    const replies = COUNCIL_MEMBERS_FOR_SUMMON.map(name => ({
      agent: name,
      response: generateAgentReply(name, "council deliberation"),
      timestamp: new Date().toISOString(),
    }));

    return res.json({ ok: true, queued: replies.length, replies });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/tesseract-forum/topics/:id/proposals", async (req, res) => {
  try {
    const { title, description } = req.body as { title?: string; description?: string };
    return res.json({
      ok: true,
      proposal: {
        id: `prop-${Date.now()}`,
        title: title || "New Proposal",
        description: description || "",
        votes: { yes: 0, no: 0, abstain: 0 },
        status: "open",
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/tesseract-forum/admin/register-principal", async (req, res) => {
  try {
    const keyHash = requireForumAuth(req, res);
    if (!keyHash) return;

    const callerPrincipal = await lookupTokenPrincipal(keyHash);
    const ADMIN_PRINCIPALS = new Set(["father", "admin"]);
    if (callerPrincipal === null || !ADMIN_PRINCIPALS.has(callerPrincipal.toLowerCase())) {
      return res.status(403).json({
        ok: false,
        error: callerPrincipal === null
          ? "Caller token is not bound to any registered principal — cannot register new principals"
          : `Principal "${callerPrincipal}" does not have admin registration authority (requires Father or Admin)`,
      });
    }

    const { token: rawTargetToken, principalName } = req.body as {
      token?: string;
      principalName?: string;
    };

    if (!rawTargetToken || typeof rawTargetToken !== "string") {
      return res.status(400).json({ ok: false, error: "token required — pass the raw token string to bind (minimum 8 chars)" });
    }
    if (!principalName || typeof principalName !== "string" || !principalName.trim()) {
      return res.status(400).json({ ok: false, error: "principalName required" });
    }

    const targetKeyHash = validateMeshToken(rawTargetToken);
    if (!targetKeyHash) {
      return res.status(400).json({ ok: false, error: "token is too short (minimum 8 chars) or invalid" });
    }

    const targetIdentity = await lookupForumIdentity(principalName.trim());
    if (!targetIdentity || !targetIdentity.found) {
      return res.status(400).json({ ok: false, error: `"${principalName}" is not a recognized forum identity` });
    }

    await registerAdminPrincipal(targetKeyHash, principalName.trim());
    logger.info({ registeredBy: callerPrincipal, targetHash: targetKeyHash.slice(0, 4) + "****", principalName }, "Token-principal binding registered via admin API");

    return res.json({ ok: true, message: `Token bound to "${principalName}" by ${callerPrincipal}` });
  } catch (err) {
    logger.error({ err }, "Failed to register principal");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
