---
name: Cursor Cloud Agent history
description: Safe, rate-limited retrieval of Cursor agent threads and run outcomes through the connected API.
---

For a Cursor history audit, list agents and paginate each agent's run list before assuming the latest run represents the entire history. `GET /v1/agents/{id}/runs/{runId}` returns a terminal run's final result, not the full conversation or tool-event transcript. The `/stream` endpoint is per-run SSE and may expire; use it only when message-level evidence is needed.

**Why:** A burst of parallel reads hit the connector's `11/10 RPS` limit. The run list, final result, and SSE stream expose different levels of history, so a result-only review must not be described as a full transcript review.

**How to apply:** Keep API reads comfortably below 10 requests/second (small batches with pauses), retry 429s only after the indicated delay, and report when results are absent or stream history was not retrieved.
