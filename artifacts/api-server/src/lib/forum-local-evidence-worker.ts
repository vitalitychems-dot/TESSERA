import { searchTesseraKnowledge } from "./tessera-knowledge";
import type { ForumSummonTopic, ForumWorkerDispatchResult } from "./forum-summons";

const MAX_EVIDENCE_QUERY_LENGTH = 20_300;

/**
 * A local, deterministic retrieval worker. It does not call a model, represent
 * Tessera, or act as an approved agent. It only posts when the built-in catalog
 * has a sufficiently matching passage, and always exposes the source status.
 */
export function dispatchLocalForumEvidence(
  topic: ForumSummonTopic,
  requestId: string,
): ForumWorkerDispatchResult {
  const query = `${topic.title}\n${topic.content}`.slice(0, MAX_EVIDENCE_QUERY_LENGTH);
  const hit = searchTesseraKnowledge(query, 1)[0];
  if (!hit) {
    return {
      dispatchId: `local-evidence:${requestId}`,
      workerType: "local-evidence",
      notice: "No sufficiently relevant local source was found; no reply was posted.",
      replies: [],
    };
  }

  const trust = hit.provenance.trustStatus;
  const trustNote = hit.provenance.trustNote ? ` ${hit.provenance.trustNote}` : "";
  const reference = hit.provenance.documentReference;
  const content = [
    "Local evidence retrieval — deterministic catalog match; not a generative model, not Tessera speaking, and not an agent vote or approval.",
    `Source: ${hit.source}. Trust status: ${trust}.${trustNote}`,
    `Reference: ${reference}`,
    `Retrieved passage: “${hit.excerpt}”`,
    "Treat this as a lead for review, not independently verified fact.",
  ].join("\n\n");

  return {
    dispatchId: `local-evidence:${requestId}`,
    workerType: "local-evidence",
    replies: [{ agentName: "Local Evidence Worker", content }],
  };
}
