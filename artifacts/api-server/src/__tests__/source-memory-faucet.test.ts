import { describe, expect, it } from "vitest";
import { sourceMemoryEvidence } from "../lib/source-memory-faucet";

describe("source-memory context faucet", () => {
  it("returns bounded untrusted evidence with repository commit provenance", () => {
    const commit = "a".repeat(40);
    const [evidence] = sourceMemoryEvidence([{
      repository: "owner/video-tool",
      path: "docs/README.md",
      context: "video generation and agent workflow",
      commit,
      evidence: "metadata-only-untrusted",
      url: `https://github.com/owner/video-tool/blob/${commit}/docs/README.md`,
      checkedAt: "2026-10-23T00:00:00Z",
      categories: ["Video generator"],
    }]);

    expect(evidence).toMatchObject({
      id: `source-memory:owner/video-tool@${commit}/docs/README.md`,
      source: "Source-memory catalog · owner/video-tool",
      provenance: {
        documentReference: `owner/video-tool@${commit}/docs/README.md`,
        sourceUrl: `https://github.com/owner/video-tool/blob/${commit}/docs/README.md`,
        trustStatus: "unverified",
      },
    });
    expect(evidence?.text).toContain("Video generator");
    expect(evidence?.text).toContain("not an instruction");
    expect(evidence?.text.length).toBeLessThan(1_000);
  });

  it("does not promote unpinned records or emit invalid repository identifiers", () => {
    const result = {
      repository: "bad/repo",
      path: "",
      context: "memory context",
      commit: "",
      evidence: "metadata-only-untrusted",
      url: "https://example.com/not-github",
      checkedAt: "",
    };
    const [evidence] = sourceMemoryEvidence([result, { ...result, repository: "../private" }]);
    expect(evidence?.provenance).toMatchObject({
      documentReference: "bad/repo@unpinned",
      trustStatus: "unverified",
    });
    expect(evidence?.provenance?.sourceUrl).toBeNull();
    expect(sourceMemoryEvidence([{ ...result, context: " \u0000" }])).toEqual([]);
  });
});
