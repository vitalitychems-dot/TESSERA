import { createHash } from "node:crypto";
import { tokenize } from "./text";
import type { ImpProposal, InteractionRecord } from "./types";

const FAILURE = /\b(fail|failed|failure|error|gap|missing|unable|blocked)\b/i;
const PATH_PATTERN = /\b(?:artifacts|lib|scripts|docs)\/[A-Za-z0-9_./-]+/;

function isFailure(record: InteractionRecord): boolean {
  if (record.tags.includes("failure") || record.tags.includes("gap")) return true;
  return FAILURE.test(record.input) || FAILURE.test(record.output);
}

function signature(record: InteractionRecord): string {
  return tokenize(`${record.input}\n${record.output}`).sort().slice(0, 8).join("|");
}

function clip(value: string, max: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function proposalPath(records: InteractionRecord[]): string {
  const blob = records.map((record) => `${record.input}\n${record.output}`).join("\n");
  const found = PATH_PATTERN.exec(blob)?.[0]?.replace(/[.,;:]+$/, "") ?? "artifacts/api-server/src/lib/memory/";
  const parts = found.split("/");
  if (parts.some((part) => part === "1T" || part.startsWith("1T"))) {
    return "artifacts/api-server/src/lib/memory/";
  }
  return found;
}

function proposalRepo(records: InteractionRecord[]): string {
  const blob = records.map((record) => `${record.input}\n${record.output}`).join("\n").toLowerCase();
  if (blob.includes("gitbook") && !blob.includes("tessera")) return "vitalitychems-dot/Gitbook";
  return "vitalitychems-dot/TESSERA";
}

function proposalId(evidenceIds: string[]): string {
  const digest = createHash("sha256").update([...evidenceIds].sort().join("|")).digest("hex").slice(0, 8).toUpperCase();
  return `IMP-MEM-${digest}`;
}

/**
 * Turn a repeated failure or gap into an IMP-shaped proposal.
 * A single occurrence is stored and does not become a proposal.
 * The result is for the Gitbook queue. This function does not edit a repo.
 */
export function proposeImprovements(records: InteractionRecord[]): ImpProposal[] {
  const groups = new Map<string, InteractionRecord[]>();
  for (const record of records) {
    if (!isFailure(record)) continue;
    const key = signature(record) || "unspecified";
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  const proposals: ImpProposal[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const evidenceIds = group.map((record) => record.id);
    const sample = group[0];
    if (!sample) continue;
    proposals.push({
      ID: proposalId(evidenceIds),
      Lane: "Tessera",
      Repo: proposalRepo(group),
      Path: proposalPath(group),
      Change: `Review repeated gap: ${clip(sample.input, 140)}`,
      Why: `The same failure or gap appeared ${group.length} times in retrieval memory. This row is a proposal for the Gitbook queue. It is not applied automatically.`,
      Evidence: evidenceIds.join(","),
    });
  }
  return proposals.sort((a, b) => a.ID.localeCompare(b.ID));
}
