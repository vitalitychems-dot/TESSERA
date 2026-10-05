/**
 * Tessera learning memory.
 *
 * This is retrieval memory plus a proposal loop. Interactions are appended
 * to a local JSONL file, grouped into lessons, and ranked with BM25 when a
 * later query arrives. Repeated failures become IMP-shaped proposals for
 * the Gitbook queue.
 *
 * It does not update model weights, call an external model, or train anything.
 * It is not consciousness and it is not self-training.
 * Importing this module does not read or write the store.
 */

export { scoreBm25 } from "./bm25";
export { distillLessons, retrieveLessons } from "./distill";
export { proposeImprovements } from "./improve";
export { redactSecrets } from "./redact";
export { createMemoryStore, type MemoryStore, type MemoryStoreOptions } from "./store";
export { IMP_FIELDS, type ImpProposal, type InteractionRecord, type Lesson, type RecordInteractionInput, type RetrievedLesson } from "./types";
