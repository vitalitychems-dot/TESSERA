# Tessera learning memory

This folder is retrieval memory plus a proposal loop.

It stores interactions, distills them into short lessons, and ranks those lessons with BM25 when a later query is related. Repeated failures become IMP-shaped rows for the Gitbook queue. The rows are proposals. Nothing here edits a repository, opens a pull request, or changes model weights.

This is not model training. It is not consciousness. `SOVEREIGN_NO_EXTERNAL_LLM` is untouched, and this code does not call an external model.

Importing the module does not create files. The first `record` or `propose` call appends JSONL under the directory you pass, or `.local/tessera-memory` when you omit one. `.local/` is gitignored. Records are appended. This module does not delete them.

## What is tested

- A stored interaction produces a lesson whose evidence id is that record.
- A related query retrieves that lesson and `contextForQuery` returns it as context text.
- Secret-shaped values are rewritten to `[REDACTED]` before the append.
- Two repeats of the same failure emit one IMP row with ID, Lane, Repo, Path, Change, Why, and Evidence.
- A path that names the `1T` vault is not copied into the proposal Path.

## What is only designed

`contextForQuery` is the hook a request handler can call before answering. It is not mounted on the API server. Wiring it into a live route would be a separate change. Lessons are recomputed from the JSONL file. They are not fine-tuning data and they are not sent to a model by this module.

## IMP row

| Field | Meaning |
| --- | --- |
| ID | Stable `IMP-MEM-` id from the evidence record ids |
| Lane | `Tessera` |
| Repo | `vitalitychems-dot/TESSERA`, or Gitbook when the text is about Gitbook only |
| Path | A path mentioned in the evidence, otherwise this memory folder |
| Change | The repeated gap, as a review item |
| Why | Why the row exists, including that it is not auto-applied |
| Evidence | Comma-separated interaction ids |
