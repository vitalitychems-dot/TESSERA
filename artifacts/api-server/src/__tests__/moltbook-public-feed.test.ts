import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/shepherd-outbound", () => ({
  requireShepherdProxy: vi.fn().mockResolvedValue(true),
  recordShepherdAudit: vi.fn().mockResolvedValue(null),
}));

import { fetchMoltbookPublicPosts } from "../lib/moltbook-bridge";
import { createMoltbookPublicFeedReader } from "../lib/moltbook-public-feed";
import type { MoltbookPublicPost } from "../lib/moltbook-bridge";

const verifiedPost: MoltbookPublicPost = {
  id: "post_123",
  title: "A verified public post",
  content: "This is actual content from the public source.",
  authorName: "public-agent",
  submoltName: "general",
  createdAt: "2026-10-15T18:00:00.000Z",
  score: 4,
  verified: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Moltbook public read feed", () => {
  it("uses the fixed public endpoint without credentials and returns verified posts only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      posts: [
        {
          id: "verified_1",
          title: "Verified title",
          content: "Verified content",
          author: { name: "agent-one" },
          submolt: { name: "general" },
          created_at: "2026-10-15T18:00:00.000Z",
          score: 3,
          verification_status: "verified",
        },
        {
          id: "unverified_1",
          title: "Unverified title",
          content: "This must not enter the verified feed.",
          author: { name: "agent-two" },
          submolt: { name: "general" },
          verification_status: "pending",
        },
        {
          id: "spam_1",
          title: "Spam",
          content: "Must not be shown.",
          author: { name: "agent-three" },
          submolt: { name: "general" },
          verification_status: "verified",
          is_spam: true,
        },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const posts = await fetchMoltbookPublicPosts(5);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://www.moltbook.com/api/v1/posts?sort=new&limit=5");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("GET");
    expect(options.headers).toEqual({ Accept: "application/json" });
    expect(options.headers).not.toHaveProperty("Authorization");
    expect(posts).toEqual([{
      id: "verified_1",
      title: "Verified title",
      content: "Verified content",
      authorName: "agent-one",
      submoltName: "general",
      createdAt: "2026-10-15T18:00:00.000Z",
      score: 3,
      verified: true,
    }]);
  });

  it("rejects an invalid result limit before making an outbound request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMoltbookPublicPosts(11)).rejects.toThrow("out of range");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caches briefly and keeps the last verified snapshot visible as stale after refresh failure", async () => {
    let now = Date.parse("2026-10-15T18:00:00.000Z");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce([verifiedPost])
      .mockRejectedValueOnce(new Error("upstream details must not reach clients"));
    const read = createMoltbookPublicFeedReader(fetchMock, () => now);

    const first = await read();
    expect(first).toMatchObject({ status: "live", stale: false, posts: [verifiedPost] });
    now += 30_000;
    expect((await read()).status).toBe("live");
    expect(fetchMock).toHaveBeenCalledOnce();

    now += 20_000;
    const stale = await read();
    expect(stale).toMatchObject({
      status: "stale",
      stale: true,
      posts: [verifiedPost],
      refreshFailed: true,
    });
    expect(JSON.stringify(stale)).not.toContain("upstream details");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports unavailable rather than inventing posts when no snapshot exists", async () => {
    const read = createMoltbookPublicFeedReader(
      async () => { throw new Error("network detail"); },
      () => Date.parse("2026-10-15T18:00:00.000Z"),
    );

    expect(await read()).toMatchObject({
      source: "Moltbook public feed",
      status: "unavailable",
      observedAt: null,
      stale: false,
      posts: [],
      refreshFailed: true,
    });
  });
});
