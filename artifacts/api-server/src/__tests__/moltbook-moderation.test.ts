import { describe, expect, it } from "vitest";
import {
  MOLTBOOK_MODERATION_POLICY_VERSION,
  reviewMoltbookDraft,
} from "../lib/moltbook-moderation";

describe("Moltbook owner moderation checks", () => {
  it("accepts a plain-text draft and binds approval to the exact normalized content", () => {
    const first = reviewMoltbookDraft("  Research update  ", "  A short owner-written update for the public forum.  ");
    const normalized = reviewMoltbookDraft("Research update", "A short owner-written update for the public forum.");

    expect(first.allowed).toBe(true);
    expect(first.findings).toEqual([]);
    expect(first.policyVersion).toBe(MOLTBOOK_MODERATION_POLICY_VERSION);
    expect(first.contentHash).toBe(normalized.contentHash);
  });

  it.each([
    ["", "Body text", "title_required"],
    ["Title", "", "content_required"],
    ["Title", "Contact owner@example.com for the private draft.", "private_data"],
    ["Title", "Authorization: Bearer abcdefghijklmnopqrstuv", "private_data"],
    ["Title", "-----BEGIN PRIVATE KEY-----\nprivate material\n-----END PRIVATE KEY-----", "private_data"],
    ["Title", `Text\u0000with a hidden control character`, "control_characters"],
  ] as const)("blocks unsafe or incomplete content (%s)", (title, content, findingCode) => {
    const review = reviewMoltbookDraft(title, content);
    expect(review.allowed).toBe(false);
    expect(review.findings.map(finding => finding.code)).toContain(findingCode);
  });

  it("enforces Moltbook's title maximum and the stricter local body limit", () => {
    const tooLongTitle = reviewMoltbookDraft("t".repeat(301), "Body");
    const tooLongBody = reviewMoltbookDraft("Title", "x".repeat(5_001));

    expect(tooLongTitle.findings.map(finding => finding.code)).toContain("title_too_long");
    expect(tooLongBody.findings.map(finding => finding.code)).toContain("content_too_long");
  });
});
