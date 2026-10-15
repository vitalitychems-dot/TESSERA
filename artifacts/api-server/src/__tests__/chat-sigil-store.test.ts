import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { getPool, isDbConfigured } from "@workspace/db";
import { ChatSigilStore } from "../lib/chat-sigil-store";

describe.skipIf(!isDbConfigured())("durable private chat sigil", () => {
  const table = `father_chat_sigils_test_${randomBytes(6).toString("hex")}`;
  const pool = getPool();
  const store = new ChatSigilStore(pool, table);
  const prior = "test-only-prior-sigil-not-a-user-credential";
  afterAll(async () => { await pool.query(`DROP TABLE IF EXISTS ${table}`); });

  it("enrolls explicitly, stores no plaintext, confirms once and survives a new store", async () => {
    expect(await store.status("test-session-a")).toEqual({ enrolled: false, rotatedThisSession: false });
    await expect(store.prepare(prior, "test-session-a")).rejects.toMatchObject({ code: "sigil-enrollment-required" });
    const first = await store.prepare(prior, "test-session-a", true);
    const replacement = await store.prepare(prior, "test-session-a");
    await expect(store.confirm(first.confirmationToken, "test-session-a")).rejects.toMatchObject({ code: "confirmation-expired-or-replaced" });
    await expect(store.confirm(replacement.confirmationToken, "test-session-b")).rejects.toMatchObject({ code: "confirmation-expired-or-replaced" });
    await expect(store.prepare("wrong-sigil-value", "test-session-a")).rejects.toMatchObject({ code: "sigil-mismatch" });
    const raw = JSON.stringify((await pool.query(`SELECT * FROM ${table}`)).rows);
    for (const value of [prior, replacement.code, replacement.confirmationToken, "test-session-a"]) expect(raw).not.toContain(value);
    expect(await store.status("test-session-a")).toEqual({ enrolled: true, rotatedThisSession: false });
    await store.confirm(replacement.confirmationToken, "test-session-a");
    expect((await new ChatSigilStore(pool, table).status("test-session-a")).rotatedThisSession).toBe(true);
    await expect(store.prepare(prior, "test-session-b")).rejects.toMatchObject({ code: "sigil-mismatch" });
    await expect(store.prepare(replacement.code, "test-session-a")).rejects.toMatchObject({ code: "already-rotated-this-session" });
    const next = await new ChatSigilStore(pool, table).prepare(replacement.code, "test-session-b");
    await store.confirm(next.confirmationToken, "test-session-b");
    expect((await store.status("test-session-a")).rotatedThisSession).toBe(true);
    expect((await store.status("test-session-b")).rotatedThisSession).toBe(true);
    await expect(store.confirm(next.confirmationToken, "test-session-b")).rejects.toMatchObject({ code: "confirmation-expired-or-replaced" });
  });

  it("rejects expired confirmations and permits only one concurrent preparation", async () => {
    await pool.query(`DELETE FROM ${table}`);
    const first = await store.prepare(prior, "test-session-c", true);
    await pool.query(`UPDATE ${table} SET pending_expires_at = NOW() - INTERVAL '1 minute'`);
    await expect(store.confirm(first.confirmationToken, "test-session-c")).rejects.toMatchObject({ code: "confirmation-expired-or-replaced" });
    const results = await Promise.allSettled([store.prepare(prior, "test-session-c"), store.prepare(prior, "test-session-c")]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });
});
