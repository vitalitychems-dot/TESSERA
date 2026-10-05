/**
 * Retrieval-memory records. These are stored text, not model weights.
 */

export interface InteractionRecord {
  id: string;
  timestamp: string;
  sourceAgent: string;
  input: string;
  output: string;
  tags: string[];
}

export interface Lesson {
  id: string;
  fact: string;
  evidenceIds: string[];
  confidence: number;
  terms: string[];
}

export interface RetrievedLesson extends Lesson {
  score: number;
}

/**
 * IMP ledger row. These field names match the Gitbook queue shape:
 * ID, Lane, Repo, Path, Change, Why, Evidence.
 * A row is a proposal. Nothing in this module applies it.
 */
export interface ImpProposal {
  ID: string;
  Lane: string;
  Repo: string;
  Path: string;
  Change: string;
  Why: string;
  Evidence: string;
}

export const IMP_FIELDS = ["ID", "Lane", "Repo", "Path", "Change", "Why", "Evidence"] as const;

export interface RecordInteractionInput {
  sourceAgent: string;
  input: string;
  output: string;
  tags?: string[];
}
