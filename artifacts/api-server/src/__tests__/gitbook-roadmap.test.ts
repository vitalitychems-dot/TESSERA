import { describe, expect, it } from "vitest";
import {
  escapeGitHubCommentText,
  parseActiveClaims,
  parseConferenceRules,
  parseGitbookRules,
  parseGitbookTasks,
  validateGitbookProgress,
} from "../lib/gitbook-roadmap";

describe("Gitbook roadmap source parsing", () => {
  it("reads task IDs, owners, states, deliverables and acceptance criteria", () => {
    const tasks = parseGitbookTasks([
      "| ID | Lane / owner | Status | Single deliverable | Acceptance test |",
      "|---|---|---|---|---|",
      "| HYB-013 | UI maintainer | READY | Recover one missing flow. | A smoke test proves it. |",
      "| HYB-014 | Test steward | DONE (CI) | Add historical gate. | CI is green. |",
    ].join("\n"));
    expect(tasks).toEqual([
      { id: "HYB-013", owner: "UI maintainer", status: "READY", deliverable: "Recover one missing flow.", acceptanceTest: "A smoke test proves it." },
      { id: "HYB-014", owner: "Test steward", status: "DONE (CI)", deliverable: "Add historical gate.", acceptanceTest: "CI is green." },
    ]);
  });

  it("extracts only the master handoff's Global rules section", () => {
    const rules = parseGitbookRules("## Global rules\n- Merges require CI.\n- Never expose secrets.\n\n## P0 — disk\n- Not a global rule.");
    expect(rules).toEqual(["Merges require CI.", "Never expose secrets."]);
  });

  it("extracts conference rules and current claims without returning older lane history", () => {
    expect(parseConferenceRules("## Conference rules\n1. Not a bullet.\n- Claim one task.\n- Keep evidence.\n\n## Conference agenda\n- Not a conference rule."))
      .toEqual(["Claim one task.", "Keep evidence."]);
    expect(parseActiveClaims("## Active claims\n### Build TESSERA UI — Cursor Project\n### Test TESSERA API — Replit\n## Lane state\n### Completed old task"))
      .toEqual(["Build TESSERA UI — Cursor Project", "Test TESSERA API — Replit"]);
  });

  it("accepts only current task IDs and explicitly confirmed, bounded public notes", () => {
    const ids = new Set(["HYB-013"]);
    expect(validateGitbookProgress("HYB-013", "Typecheck passed.", true, ids))
      .toEqual({ ok: true, taskId: "HYB-013", note: "Typecheck passed." });
    expect(validateGitbookProgress("HYB-099", "Made progress.", true, ids).ok).toBe(false);
    expect(validateGitbookProgress("HYB-013", "private", false, ids).ok).toBe(false);
    expect(validateGitbookProgress("HYB-013", "x".repeat(2_001), true, ids).ok).toBe(false);
  });

  it("quotes public progress as plain text and breaks mentions", () => {
    const result = escapeGitHubCommentText("@all <script>alert(1)</script>\nline two");
    expect(result).toContain("@\u200ball");
    expect(result).toContain("&lt;script&gt;");
    expect(result.split("\n")).toHaveLength(2);
  });
});
