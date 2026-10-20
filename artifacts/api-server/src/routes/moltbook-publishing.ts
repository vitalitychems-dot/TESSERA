import { Router, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { createHash, timingSafeEqual } from "node:crypto";
import { db, moltbookPublicationsTable } from "@workspace/db";
import { decideOwnerSession } from "../lib/sovereign-admin";
import {
  MOLTBOOK_MODERATION_POLICY_VERSION,
  reviewMoltbookDraft,
} from "../lib/moltbook-moderation";
import { createMoltbookPost, verifyMoltbookPost } from "../lib/moltbook-publisher";
import { isMoltbookPublishingEnabled } from "../lib/moltbook-publishing-gate";
import { fetchMoltbookPublicPosts } from "../lib/moltbook-bridge";
import { logger } from "../lib/logger";
import { safeDbErrorLog } from "../lib/safe-db-error";

const router = Router();
const MAX_QUEUE_RECORDS = 100;
const MAX_BODY_BYTES = 8_192;
const MAX_OWNER_ACTIONS_PER_MINUTE = 12;
const ownerActionRate = { windowStartedAt: 0, requests: 0 };

function noStore(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store");
}

function requireOwner(req: Request, res: Response): boolean {
  const decision = decideOwnerSession(req);
  if (decision.ok) return true;
  noStore(res);
  res.status(decision.status).json({
    ok: false,
    error: decision.error,
    message: decision.status === 401
      ? "An active owner session is required."
      : "Owner publishing controls are unavailable until TESSERA is configured.",
  });
  return false;
}

function limitOwnerActions(res: Response): boolean {
  const now = Date.now();
  if (now - ownerActionRate.windowStartedAt >= 60_000) {
    ownerActionRate.windowStartedAt = now;
    ownerActionRate.requests = 0;
  }
  if (ownerActionRate.requests >= MAX_OWNER_ACTIONS_PER_MINUTE) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ ok: false, error: "rate_limited", message: "Publishing actions are temporarily rate-limited." });
    return false;
  }
  ownerActionRate.requests += 1;
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseId(value: string): number | null {
  if (!/^[1-9]\d{0,8}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function publishingReady(): boolean {
  return isMoltbookPublishingEnabled(
    process.env.MOLTBOOK_PUBLISH_ENABLED,
    process.env.MOLTBOOK_API_KEY,
  );
}

function presentPost(row: typeof moltbookPublicationsTable.$inferSelect) {
  const review = reviewMoltbookDraft(row.title, row.content);
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status,
    moderationPolicyVersion: row.moderationPolicyVersion,
    moderationFindings: review.findings,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt,
    externalPostId: row.externalPostId,
    verificationExpiresAt: row.verificationExpiresAt,
    verificationAttempts: row.verificationAttempts,
    publishedAt: row.publishedAt,
  };
}

router.get("/", async (req, res) => {
  noStore(res);
  if (!requireOwner(req, res)) return;
  try {
    const rows = await db.select().from(moltbookPublicationsTable)
      .orderBy(desc(moltbookPublicationsTable.createdAt))
      .limit(50);
    return res.json({
      ok: true,
      publishingEnabled: publishingReady(),
      posts: rows.map(presentPost),
    });
  } catch (error) {
    logger.error(safeDbErrorLog(error), "Moltbook publication queue read failed");
    return res.status(503).json({ ok: false, error: "publication_queue_unavailable" });
  }
});

router.post("/drafts", async (req, res) => {
  noStore(res);
  if (!requireOwner(req, res)) return;
  if (!limitOwnerActions(res)) return;

  const body = asRecord(req.body);
  if (!body || Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_BODY_BYTES) {
    return res.status(413).json({ ok: false, error: "draft_too_large" });
  }
  const title = typeof body.title === "string" ? body.title.normalize("NFC").trim() : "";
  const content = typeof body.content === "string" ? body.content.normalize("NFC").trim() : "";
  const review = reviewMoltbookDraft(title, content);
  if (!review.allowed) {
    return res.status(422).json({ ok: false, error: "moderation_failed", findings: review.findings });
  }

  try {
    const existing = await db.select({ id: moltbookPublicationsTable.id })
      .from(moltbookPublicationsTable)
      .orderBy(desc(moltbookPublicationsTable.createdAt))
      .limit(MAX_QUEUE_RECORDS);
    if (existing.length >= MAX_QUEUE_RECORDS) {
      return res.status(409).json({
        ok: false,
        error: "publication_queue_full",
        message: "Remove old local publication records before adding another draft.",
      });
    }

    const [created] = await db.insert(moltbookPublicationsTable).values({
      title,
      content,
      status: "draft",
    }).returning();
    return res.status(201).json({ ok: true, post: presentPost(created) });
  } catch (error) {
    logger.error(safeDbErrorLog(error), "Moltbook draft save failed");
    return res.status(503).json({ ok: false, error: "draft_save_failed" });
  }
});

router.post("/:id/approve", async (req, res) => {
  noStore(res);
  if (!requireOwner(req, res)) return;
  if (!limitOwnerActions(res)) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "invalid_publication_id" });

  try {
    const [row] = await db.select().from(moltbookPublicationsTable)
      .where(eq(moltbookPublicationsTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ ok: false, error: "publication_not_found" });
    if (row.status !== "draft") {
      return res.status(409).json({ ok: false, error: "only_drafts_can_be_approved" });
    }

    const review = reviewMoltbookDraft(row.title, row.content);
    if (!review.allowed) {
      return res.status(422).json({ ok: false, error: "moderation_failed", findings: review.findings });
    }
    const [approved] = await db.update(moltbookPublicationsTable).set({
      status: "approved",
      moderationPolicyVersion: MOLTBOOK_MODERATION_POLICY_VERSION,
      approvedContentHash: review.contentHash,
      approvedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(moltbookPublicationsTable.id, id),
      eq(moltbookPublicationsTable.status, "draft"),
    )).returning();
    if (!approved) return res.status(409).json({ ok: false, error: "publication_state_changed" });
    return res.json({ ok: true, post: presentPost(approved) });
  } catch (error) {
    logger.error(safeDbErrorLog(error), "Moltbook draft approval failed");
    return res.status(503).json({ ok: false, error: "draft_approval_failed" });
  }
});

router.post("/:id/publish", async (req, res) => {
  noStore(res);
  if (!requireOwner(req, res)) return;
  if (!limitOwnerActions(res)) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "invalid_publication_id" });
  if (!publishingReady()) {
    return res.status(403).json({
      ok: false,
      error: "publishing_disabled",
      message: "External publishing is disabled. The owner must explicitly enable it and configure the server-side Moltbook credential.",
    });
  }

  try {
    const [row] = await db.select().from(moltbookPublicationsTable)
      .where(eq(moltbookPublicationsTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ ok: false, error: "publication_not_found" });
    if (row.status !== "approved" || !row.approvedContentHash) {
      return res.status(409).json({ ok: false, error: "only_approved_posts_can_be_published" });
    }

    const review = reviewMoltbookDraft(row.title, row.content);
    if (!review.allowed || review.contentHash !== row.approvedContentHash) {
      const [reset] = await db.update(moltbookPublicationsTable).set({
        status: "draft",
        approvedContentHash: null,
        moderationPolicyVersion: null,
        approvedAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(moltbookPublicationsTable.id, id),
        eq(moltbookPublicationsTable.status, "approved"),
      )).returning();
      return res.status(409).json({
        ok: false,
        error: "approval_no_longer_matches",
        findings: review.findings,
        post: reset ? presentPost(reset) : undefined,
      });
    }

    const [locked] = await db.update(moltbookPublicationsTable).set({
      status: "publishing",
      updatedAt: new Date(),
    }).where(and(
      eq(moltbookPublicationsTable.id, id),
      eq(moltbookPublicationsTable.status, "approved"),
      eq(moltbookPublicationsTable.approvedContentHash, review.contentHash),
    )).returning();
    if (!locked) return res.status(409).json({ ok: false, error: "publication_state_changed" });

    try {
      const apiKey = process.env.MOLTBOOK_API_KEY!.trim();
      const result = await createMoltbookPost(apiKey, { title: locked.title, content: locked.content });
      if (result.kind === "confirmed") {
        const [published] = await db.update(moltbookPublicationsTable).set({
          status: "published",
          externalPostId: result.postId,
          verificationCodeHash: null,
          verificationExpiresAt: null,
          publishedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(
          eq(moltbookPublicationsTable.id, id),
          eq(moltbookPublicationsTable.status, "publishing"),
        )).returning();
        logger.info({ publicationId: id, status: "published" }, "Owner-approved Moltbook post confirmed");
        return res.json({ ok: true, post: presentPost(published) });
      }

      const expiresAt = new Date(result.expiresAt);
      const [pending] = await db.update(moltbookPublicationsTable).set({
        status: "verification_required",
        externalPostId: result.postId,
        verificationCodeHash: createHash("sha256").update(result.verificationCode, "utf8").digest("hex"),
        verificationExpiresAt: expiresAt,
        verificationAttempts: 0,
        updatedAt: new Date(),
      }).where(and(
        eq(moltbookPublicationsTable.id, id),
        eq(moltbookPublicationsTable.status, "publishing"),
      )).returning();
      return res.status(202).json({
        ok: true,
        post: presentPost(pending),
        verification: {
          verificationCode: result.verificationCode,
          challengeText: result.challengeText,
          expiresAt: result.expiresAt,
        },
        message: "Moltbook requires owner-completed verification before this post is public.",
      });
    } catch {
      await db.update(moltbookPublicationsTable).set({
        status: "uncertain",
        verificationCodeHash: null,
        verificationExpiresAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(moltbookPublicationsTable.id, id),
        eq(moltbookPublicationsTable.status, "publishing"),
      ));
      logger.warn({ publicationId: id, status: "uncertain" }, "Moltbook post result could not be confirmed; automatic retry withheld");
      return res.status(202).json({
        ok: true,
        status: "uncertain",
        message: "Moltbook did not return a confirmable result. Check the public account before taking any further action; TESSERA will not retry automatically.",
      });
    }
  } catch (error) {
    logger.error(safeDbErrorLog(error), "Moltbook publish action failed");
    return res.status(503).json({ ok: false, error: "publication_action_failed" });
  }
});

router.post("/:id/verify", async (req, res) => {
  noStore(res);
  if (!requireOwner(req, res)) return;
  if (!limitOwnerActions(res)) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "invalid_publication_id" });
  if (!publishingReady()) return res.status(403).json({ ok: false, error: "publishing_disabled" });

  const body = asRecord(req.body);
  const verificationCode = typeof body?.verificationCode === "string" ? body.verificationCode : "";
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  if (
    !/^moltbook_verify_[A-Za-z0-9_-]{8,240}$/.test(verificationCode)
    || !/^-?\d+\.\d{2}$/.test(answer)
  ) {
    return res.status(400).json({ ok: false, error: "invalid_verification_answer" });
  }

  try {
    const [row] = await db.select().from(moltbookPublicationsTable)
      .where(eq(moltbookPublicationsTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ ok: false, error: "publication_not_found" });
    if (row.status !== "verification_required" || !row.externalPostId || !row.verificationCodeHash) {
      return res.status(409).json({ ok: false, error: "verification_not_available" });
    }
    if (!row.verificationExpiresAt || row.verificationExpiresAt.getTime() <= Date.now()) {
      await db.update(moltbookPublicationsTable).set({
        status: "uncertain",
        verificationCodeHash: null,
        verificationExpiresAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(moltbookPublicationsTable.id, id),
        eq(moltbookPublicationsTable.status, "verification_required"),
      ));
      return res.status(410).json({ ok: false, error: "verification_expired" });
    }
    if (row.verificationAttempts >= 3) {
      await db.update(moltbookPublicationsTable).set({
        status: "verification_failed",
        verificationCodeHash: null,
        verificationExpiresAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(moltbookPublicationsTable.id, id),
        eq(moltbookPublicationsTable.status, "verification_required"),
      ));
      return res.status(409).json({ ok: false, error: "verification_attempts_exhausted" });
    }

    const receivedHash = createHash("sha256").update(verificationCode, "utf8").digest("hex");
    const expected = Buffer.from(row.verificationCodeHash, "hex");
    const received = Buffer.from(receivedHash, "hex");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return res.status(403).json({ ok: false, error: "verification_code_rejected" });
    }

    const [locked] = await db.update(moltbookPublicationsTable).set({
      status: "verifying",
      updatedAt: new Date(),
    }).where(and(
      eq(moltbookPublicationsTable.id, id),
      eq(moltbookPublicationsTable.status, "verification_required"),
      eq(moltbookPublicationsTable.verificationCodeHash, row.verificationCodeHash),
    )).returning();
    if (!locked) return res.status(409).json({ ok: false, error: "publication_state_changed" });

    try {
      const apiKey = process.env.MOLTBOOK_API_KEY!.trim();
      const verified = await verifyMoltbookPost(apiKey, {
        verificationCode,
        answer,
        expectedPostId: locked.externalPostId!,
      });
      if (!verified) {
        const attempts = locked.verificationAttempts + 1;
        const exhausted = attempts >= 3;
        const [updated] = await db.update(moltbookPublicationsTable).set({
          status: exhausted ? "verification_failed" : "verification_required",
          verificationAttempts: attempts,
          verificationCodeHash: exhausted ? null : locked.verificationCodeHash,
          verificationExpiresAt: exhausted ? null : locked.verificationExpiresAt,
          updatedAt: new Date(),
        }).where(and(
          eq(moltbookPublicationsTable.id, id),
          eq(moltbookPublicationsTable.status, "verifying"),
        )).returning();
        return res.status(422).json({
          ok: false,
          error: exhausted ? "verification_attempts_exhausted" : "verification_answer_rejected",
          attemptsRemaining: Math.max(0, 3 - attempts),
          post: updated ? presentPost(updated) : undefined,
        });
      }

      const [published] = await db.update(moltbookPublicationsTable).set({
        status: "published",
        verificationCodeHash: null,
        verificationExpiresAt: null,
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(moltbookPublicationsTable.id, id),
        eq(moltbookPublicationsTable.status, "verifying"),
      )).returning();
      logger.info({ publicationId: id, status: "published" }, "Owner-completed Moltbook verification confirmed");
      return res.json({ ok: true, post: presentPost(published) });
    } catch {
      await db.update(moltbookPublicationsTable).set({
        status: "uncertain",
        verificationCodeHash: null,
        verificationExpiresAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(moltbookPublicationsTable.id, id),
        eq(moltbookPublicationsTable.status, "verifying"),
      ));
      logger.warn({ publicationId: id, status: "uncertain" }, "Moltbook verification result could not be confirmed");
      return res.status(202).json({
        ok: true,
        status: "uncertain",
        message: "Moltbook did not confirm verification. Check the public account before further action.",
      });
    }
  } catch (error) {
    logger.error(safeDbErrorLog(error), "Moltbook verification action failed");
    return res.status(503).json({ ok: false, error: "verification_action_failed" });
  }
});

router.post("/:id/reconcile", async (req, res) => {
  noStore(res);
  if (!requireOwner(req, res)) return;
  if (!limitOwnerActions(res)) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "invalid_publication_id" });

  try {
    const [row] = await db.select().from(moltbookPublicationsTable)
      .where(eq(moltbookPublicationsTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ ok: false, error: "publication_not_found" });
    if (!["verification_required", "uncertain"].includes(row.status) || !row.externalPostId) {
      return res.status(409).json({ ok: false, error: "publication_not_reconcilable" });
    }

    const publicPosts = await fetchMoltbookPublicPosts(10);
    const found = publicPosts.some(post => post.id === row.externalPostId && post.verified);
    if (!found) {
      return res.json({
        ok: true,
        confirmed: false,
        post: presentPost(row),
        message: "The post is not in the latest verified public feed. No new post was sent.",
      });
    }
    const [published] = await db.update(moltbookPublicationsTable).set({
      status: "published",
      verificationCodeHash: null,
      verificationExpiresAt: null,
      publishedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(moltbookPublicationsTable.id, id),
      eq(moltbookPublicationsTable.status, row.status),
    )).returning();
    return res.json({ ok: true, confirmed: true, post: published ? presentPost(published) : presentPost(row) });
  } catch (error) {
    logger.error(safeDbErrorLog(error), "Moltbook public status reconciliation failed");
    return res.status(503).json({ ok: false, error: "reconciliation_unavailable" });
  }
});

router.delete("/:id", async (req, res) => {
  noStore(res);
  if (!requireOwner(req, res)) return;
  if (!limitOwnerActions(res)) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "invalid_publication_id" });
  try {
    const [row] = await db.select({ status: moltbookPublicationsTable.status })
      .from(moltbookPublicationsTable)
      .where(eq(moltbookPublicationsTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ ok: false, error: "publication_not_found" });
    if (row.status === "publishing" || row.status === "verifying") {
      return res.status(409).json({ ok: false, error: "publication_action_in_progress" });
    }
    await db.delete(moltbookPublicationsTable).where(eq(moltbookPublicationsTable.id, id));
    return res.json({
      ok: true,
      removed: true,
      message: "The local draft or receipt was deleted. This does not remove a post from Moltbook.",
    });
  } catch (error) {
    logger.error(safeDbErrorLog(error), "Moltbook publication record removal failed");
    return res.status(503).json({ ok: false, error: "publication_record_removal_failed" });
  }
});

export default router;
