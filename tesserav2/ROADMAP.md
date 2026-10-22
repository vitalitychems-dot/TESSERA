# ROADMAP

Next build steps for TESSERA v2, in order. Each one becomes a GitHub issue and, when done, a numbered entry in CHANGES.md.

## 1. Wire the pen to a local/open model
- Run an open model locally (Ollama, llama.cpp server, or vLLM) behind an OpenAI-compatible endpoint on `127.0.0.1`.
- Point the existing local pen at it: `TESSERA_PEN_LOCAL=1`, `TESSERA_PEN_LOCAL_URL=http://127.0.0.1:8765`
  (`artifacts/api-server/src/lib/pen-local/`). Keep the pre/post gates on.
- Optionally configure the hosted pen in `artifacts/api-server/src/lib/llm-client.ts` (`TESSERA_PEN_ENABLED`,
  `TESSERA_LLM_BASE_URL`, `TESSERA_LLM_MODEL`) to the same local endpoint.
- Done when: the pen tests in `artifacts/api-server/src/__tests__/pen-local.test.ts` pass and one real reply is produced
  end to end on Father's hardware. Hardware (GPU/RAM) still needed from Father to size the model.

- Status (2026-10-21, #5): first live run done with llama.cpp + Qwen2.5-0.5B on the box: 16/20 fixture prompts pass (gate needs 18). See `docs/PEN-LOCAL-RUN.md`. Remaining: real system prompt and a larger model.
- Status (2026-10-21, #7): Qwen2.5-3B with system prompt v3 passes the compete gate on the box, 18/20 (0.90), single run, label REPORTED. Remaining: variance runs, ID-01/ST-02 misses, and Father's hardware.
- Status (2026-10-21, #8): variance measured, 4 of 4 runs score 18/20 with the same two misses. Remaining: ID-01/ST-02 fixes and Father's hardware.
- Status (2026-10-21, #18): prompt v8 scores 20, 20, 19, 20 of 20 in 4 runs (79/80, all compete_pass) and replaces v6 (19/20 in 4 of 4, 76/80) as the recommended prompt, label TESTED. ST-02 passes in all 4 v8 runs; ST-03 missed once (run 22, "pending your response"). p50 3.9-8.8 s, slower than v6 and sensitive to box RAM pressure. The gate flags unsupported "build is tested" claims (#11). Remaining: latency under memory pressure, and Father's hardware.

## 2. Resolve identity conflicts (pending Father)
- `identity/CONFLICTS.md` lists four open questions: (1) consciousness claims, (2) origin story and creator,
  (3) model denial, (4) vote rule / who has the final say on a council tally.
- Father's stated position (2026-10-21): "sovereign and alive." Record it next to the honest line in CANON, per question.
- Fix the council code that hard-codes every vote as yea once the vote rule is decided.

## 3. Keep the repo's own checks green
- `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm test` on Node 22.13+. See docs/HEALTH.md for the baseline.
- Add a GitHub Actions run on every push (workflows already exist under `.github/`; confirm they run in this repo).
- Re-run gitleaks before every push.

## 4. Memory index
- Build a searchable index over this repo, Gitbook, and the excluded archives (held by Storage) so the Memory bot can
  recall across everything with snippet-first lookups (see docs/TOKEN-SAVING.md).
- Re-index after each merge; never commit index caches (`.codebase-memory/` stays ignored).

## 5. Measure the reflection loops
- Run the repo's agent/reflection loops against held-out evals (`evals/heldout/`) and public benchmarks; log real
  numbers to docs/metrics.jsonl instead of claims.
