import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/shepherd-outbound", () => ({
  requireShepherdProxy: vi.fn().mockResolvedValue(true),
  recordShepherdAudit: vi.fn().mockResolvedValue(null),
}));

vi.mock("../lib/sovereign-fetch-guard", () => ({
  runWithShepherdContext: async (_caller: string, work: () => Promise<Response>) => work(),
}));

import { createMoltbookPost, verifyMoltbookPost } from "../lib/moltbook-publisher";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("owner-approved Moltbook publisher", () => {
  it("sends one fixed-endpoint POST only when the explicit publisher is called", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      success: true,
      post: { id: "post_123", verification_status: "verified" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createMoltbookPost("test-secret", {
      title: "Owner-approved update",
      content: "This is the exact text the owner reviewed.",
    });

    expect(result).toEqual({ kind: "confirmed", postId: "post_123" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://www.moltbook.com/api/v1/posts");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({ Authorization: "Bearer test-secret" });
    expect(JSON.parse(String(options.body))).toEqual({
      submolt_name: "general",
      title: "Owner-approved update",
      content: "This is the exact text the owner reviewed.",
      type: "text",
    });
  });

  it("returns a verification challenge for the owner instead of solving or submitting it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      success: true,
      verification_required: true,
      post: {
        id: "post_pending",
        verification_status: "pending",
        verification: {
          verification_code: "moltbook_verify_12345678",
          challenge_text: "Add twenty to five.",
          expires_at: "2026-10-20T00:05:00.000Z",
        },
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createMoltbookPost("test-secret", { title: "Owner title", content: "Owner text." });

    expect(result).toEqual({
      kind: "verification_required",
      postId: "post_pending",
      verificationCode: "moltbook_verify_12345678",
      challengeText: "Add twenty to five.",
      expiresAt: "2026-10-20T00:05:00.000Z",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("only reports verification when Moltbook confirms the same post id", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        success: true,
        content_type: "post",
        content_id: "post_pending",
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyMoltbookPost("test-secret", {
      verificationCode: "moltbook_verify_12345678",
      answer: "25.00",
      expectedPostId: "post_pending",
    })).resolves.toBe(true);

    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://www.moltbook.com/api/v1/verify");
    expect(options.method).toBe("POST");
    expect(JSON.parse(String(options.body))).toEqual({
      verification_code: "moltbook_verify_12345678",
      answer: "25.00",
    });
  });

  it("does not retry a request when the upstream call fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMoltbookPost("test-secret", { title: "Owner title", content: "Owner text." }))
      .rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
