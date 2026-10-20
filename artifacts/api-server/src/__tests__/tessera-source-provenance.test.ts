import { describe, expect, it } from "vitest";
import {
  makeSourceProvenance,
  normalizeSourceUrl,
  sanitizeCitationText,
} from "../lib/tessera-source-provenance";

describe("Tessera source provenance", () => {
  it("accepts ordinary HTTP(S) source URLs and normalizes their date fields", () => {
    const provenance = makeSourceProvenance({
      sourceUrl: "https://example.org/knowledge?q=1",
      documentReference: "paper:2026/17",
      retrievedAt: new Date("2026-10-01T12:30:00.000Z"),
      publishedAt: "2026-09-29T00:00:00.000Z",
    });

    expect(provenance).toMatchObject({
      sourceUrl: "https://example.org/knowledge?q=1",
      documentReference: "paper:2026/17",
      retrievedAt: "2026-10-01T12:30:00.000Z",
      publishedAt: "2026-09-29T00:00:00.000Z",
      trustStatus: "unverified",
    });
    expect(provenance.trustNote).toContain("not an established fact");
  });

  it("rejects unsafe or credential-bearing URLs and records missing dates honestly", () => {
    expect(normalizeSourceUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeSourceUrl("https://user:password@example.org/private")).toBeNull();
    expect(normalizeSourceUrl("not a URL")).toBeNull();

    const provenance = makeSourceProvenance({
      sourceUrl: "javascript:alert(1)",
      documentReference: "archive:entry-4",
      retrievedAt: "not-a-date",
    });

    expect(provenance.sourceUrl).toBeNull();
    expect(provenance.documentReference).toBe("archive:entry-4");
    expect(provenance.retrievedAt).toBeNull();
  });

  it("preserves month-level publication dates without inventing a day", () => {
    const provenance = makeSourceProvenance({
      sourceUrl: "https://archive.org/details/bstj27-4-623",
      publishedAt: "1948-10",
    });

    expect(provenance.publishedAt).toBe("1948-10");
  });

  it("cleans untrusted display labels before including them in citations", () => {
    expect(sanitizeCitationText("  <script>\nInjected\u0000 name  ")).toBe("script Injected name");
  });
});
