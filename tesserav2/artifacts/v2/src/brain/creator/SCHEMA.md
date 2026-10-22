# Creator corpus schema (data lives outside git)

Private, local-only. Default directory `/workspace/secrets/creator/` (mode 600), override with
`TESSERA_CREATOR_DIR`. Nothing in this directory is ever committed.

- `father-msgs.jsonl`: `{ "id": string, "date": "YYYY-MM-DD", "text": string }`, the creator's own typed messages, verbatim.
- `other-text.jsonl`: `{ "src": string, "text": string }`, text known not to be his (agent PR prose) for authorship negatives.

Profile items carry `{ kind, key, ref, t, count, supersedes }`: a message id as source reference, never the text.
Only goals, rules, approvals and values he stated himself are extracted; no diagnosis, no inferred sensitive traits.
A later statement on the same key supersedes the earlier one (recency), and every change is a `temporal.mjs` event.
