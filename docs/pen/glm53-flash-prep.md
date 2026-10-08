<!-- Staging note: future DIGITAL pen candidate only. Live pen = xAI/Grok. Training Tessera herself ≠ pen swap. -->

# GLM-5.3-Flash local pen prep (read-only research)

**Date (CT):** 2026-10-06  
**Scope:** Where Tessera wires its “pen” (LLM provider), existing OpenAI-compat / local-model slots, and GLM docs.  
**Constraints honored:** No push/commit/server start; `DATABASE_URL` unset; `TESSERA_ENABLE_*` left at 0; no zip unpack; Zz/1T/T44 vault contents skipped; `/workspace/graph-work` read-only.

**Sources inspected:**
- `/workspace/tessera-afbeb50` (z-app board/colonel slice only; no LLM pen)
- `/workspace/tessera` (notes + this prep)
- `/workspace/graph-work/tessera-218a183` (Oct 3 clean mirror; read-only)
- `/workspace/gitbook-batch-013/base` (+ 014/015 SUMMARY links; `pen-drafts` lived at `/workspace/pen-drafts`, not under batch base)
- `/workspace/tessera-combined` (read-only; grok-ready / docs; skipped Zz/1T ingest bodies)
- the Origin Tessera repo via `cursor-origin` (`get_file_contents` / `grep_contents` / `commit_read` / `list_branches`)
- `user-codebase-memory` project `workspace-graph-work-tessera-218a183` (Oct 3 index — hints only)

**Instrument truth line (docs):** Live pen is xAI/Grok; GLM-5 approved, not yet wired or tested.

---

## Exact files and symbols that define the pen / LLM provider interface

### On Origin `main` (tip ~`afbeb50`, also mirrored at `tessera-218a183`)

Primary cloud/OpenAI-compat path (this is what main still uses):

| Path | Symbols | Role |
|---|---|---|
| `artifacts/api-server/src/lib/llm-client.ts` | `getClient()`, `callLLM()`, `callLLMSafe()`, `isLLMAvailable()`, `LLMMessage`, `LLMCallOptions` | OpenAI SDK client; `chat.completions.create`; sanitizes via `external-sandbox-policy` |
| `artifacts/api-server/src/lib/llm-batcher.ts` | `batchedCallLLM` | Batches into `callLLM` |
| `artifacts/api-server/src/lib/adaptive-router.ts` | `MODELS`, `classifyQuery()`, `modelForTier()` | Tier → model id |
| `artifacts/api-server/src/lib/neural-embeddings.ts` | `getClient()` | Same OpenAI-compat base URL for embeddings |
| `artifacts/api-server/src/lib/provider-registry.ts` | `PROVIDER_CONFIGS`, `getProviderConfigs()` | Catalog incl. `xai` / `ollama` (metadata, not the live pen wire) |
| `artifacts/api-server/src/lib/local-model-manager.ts` | `LocalAdapter`, `LocalModelManager`, `OllamaAdapter`, `VllmAdapter`, `LmStudioAdapter`, `TgiAdapter`, `LlamaCppAdapter`, `getLocalModelManager()`, `chat()` | Parallel **local** stack; OpenAI-compat for vLLM / LM Studio |
| `artifacts/api-server/src/routes/local-models.ts` | `/local-models/status`, `/health-check`, `/chat`, `/adapters` | HTTP surface for local adapters |
| `artifacts/api-server/scripts/run-real-conference.mjs` | direct `fetch(`${BASE}/chat/completions`)` | Conference runner using `TESSERA_LLM_*` on main |
| `artifacts/tessera/src/lib/puter-ai.ts` | `puterChat`, model list incl. `grok-3` | Frontend Puter proxy path (not server pen) |
| `artifacts/tessera/src/lib/swarm-agents.ts` | swarm agents with `grok-3` | Frontend multi-agent via Puter |

`llm-client.getClient()` (main):

- `baseURL = process.env.TESSERA_LLM_BASE_URL` (required)
- `apiKey = process.env.TESSERA_LLM_API_KEY ?? "_DUMMY_API_KEY_"`
- Default model in `callLLM`: `"TESSERA_LLM_MODEL"`
- Gate: `isLLMAvailable()` false when `SOVEREIGN_NO_EXTERNAL_LLM` is `"1"`/`true` (default `"1"`)

### Pen-provider branch work (NOT on `main`)

Origin branches (present, unmerged into tip inspected):

- `cursor/remove-openai-bbe5-2` @ `7c0be90` (builds on `bbbe453`)
- `cursor/pen-gate-bbe5-2` @ `8e92c23` (builds on `2650a81`)

Introduced in commit `bbbe453` (“Route model calls through the local test pen and drop OpenAI”):

| Path | Symbols | Role |
|---|---|---|
| `artifacts/api-server/src/lib/pen-provider.ts` | `TEST_PEN_LABEL`, `PEN_NOT_CONFIGURED`, `penUrl()`, `completeWithPen()`, `embedWithPen()`, (+ on pen-gate: `gatePenText()`, `isPenRefusal()`) | Dedicated pen slot: OpenAI-compat `POST {TESSERA_PEN_URL}/chat/completions` and `/embeddings`; **no** default remote host; unset URL → `"pen not configured"` and **no HTTP** |
| `artifacts/api-server/src/__tests__/pen-provider.test.ts` | vitest cases | Unconfigured short-circuit; OpenAI import/host ban scan; gate refusal IDs |
| `artifacts/api-server/src/lib/llm-client.ts` (branch) | imports `completeWithPen` | Default model becomes `TEST_PEN_LABEL`; OpenAI package removed on that branch |

`TEST_PEN_LABEL` on those branches: `"Qwen 2.5 1.5B Instruct (local test)"`  
Endpoint join: `joinPenPath(url, "/chat/completions")` — so `TESSERA_PEN_URL` should already include `/v1` if the server is OpenAI-compat at `/v1`.

### Older / adjacent (branch notes only)

- `sovereign-pen.ts` appears in `.notes_files.txt` (SHAs `62e9dbf`, `48b878e`) with `reports/sovereign-pen.md` — not on current `main` lib listing; treat as historical.
- `/workspace/tessera-afbeb50` has no pen/LLM client (board / colonel / z-app only).

### Codebase-memory (hints only)

Index confirmed `llm-client`, `local-model-manager` (`VllmAdapter.chat`, `LmStudioAdapter.chat`), `provider-registry`, `adaptive-router` under `artifacts/api-server/src/lib/`. No `pen-provider` in the Oct 3 index (matches: pen-provider landed Oct 5 on branches after the mirror).

---

## Whether a local OpenAI-compatible base URL slot already exists

**Yes — three overlapping slots:**

1. **Main cloud slot (already OpenAI-compat):**  
   `TESSERA_LLM_BASE_URL` → OpenAI SDK `baseURL` → `chat.completions`. Any OpenAI-compat server (including local `http://127.0.0.1:PORT/v1`) can be pointed here **today**, but that also becomes the global LLM path and is still gated by `SOVEREIGN_NO_EXTERNAL_LLM` (default kill-switch ON).

2. **LocalModelManager OpenAI-compat adapters (main):**  
   - `VllmAdapter`: `VLLM_ENDPOINT` default `http://localhost:8000`, calls `${endpoint}/v1/chat/completions` and `/v1/models`; enabled only when `VLLM_ENABLED=true`.  
   - `LmStudioAdapter`: `LM_STUDIO_ENDPOINT` default `http://localhost:1234`, same `/v1/chat/completions`; `LM_STUDIO_ENABLED=true`.  
   - Also: Ollama (native `/api/chat`), llama.cpp, TGI.  
   These are a **separate** route (`/api/local-models/*`), not wired as the documented “Pen” instrument.

3. **Branch pen slot:**  
   `TESSERA_PEN_URL` → `completeWithPen` / `embedWithPen` (OpenAI-compat paths). Closest match to a dedicated “pen” provider. **Not on main.**

**Gap vs Gitbook GLM docs:** Audit docs describe `TESSERA_PEN_ENABLED=1` as the adapter kill-switch. Origin pen branches use **`TESSERA_PEN_URL`** (presence = enable) and do **not** define `TESSERA_PEN_ENABLED` in code inspected. Names must be reconciled in the minimal change set.

---

## Current default model IDs and env vars (names only, no secret values)

### Model IDs (defaults / catalogs)

| Location | IDs |
|---|---|
| `callLLM` default (main) | `TESSERA_LLM_MODEL` |
| `adaptive-router` tiers | `TESSERA_LLM_MODEL`, `TESSERA_LLM_MODEL`, `TESSERA_LLM_MODEL` |
| `conversations` / `rick` / `rick-proposals` callers | often `TESSERA_LLM_MODEL` |
| `neural-embeddings` | `TESSERA_EMBED_MODEL` |
| `provider-registry` xAI | `grok-3` |
| `provider-registry` others | anthropic / openai / google / deepseek / groq / mistral / meta / qwen / moonshot catalogs |
| Ollama preferred (local manager) | `llama3.2:3b`, `llama3.2:1b`, `mistral:7b`, `phi3:mini` |
| Pen branch label | `Qwen 2.5 1.5B Instruct (local test)` |
| Frontend Puter | `TESSERA_LLM_MODEL`, `grok-3`, etc. |
| Simulation helper (archives) | `TESSERA_XAI_MODEL` (test-only name) |

### Env var **names** (no values)

**LLM / pen / local (code-referenced):**  
`TESSERA_LLM_BASE_URL`, `TESSERA_LLM_API_KEY`, `SOVEREIGN_NO_EXTERNAL_LLM`, `LLM_TIMEOUT_MS`, `CONFERENCE_MODEL`,  
`OLLAMA_ENDPOINT`, `LLAMA_CPP_ENDPOINT`, `LLAMA_CPP_ENABLED`, `VLLM_ENDPOINT`, `VLLM_ENABLED`, `LM_STUDIO_ENDPOINT`, `LM_STUDIO_ENABLED`, `TGI_ENDPOINT`, `TGI_ENABLED`,  
`TESSERA_PEN_URL` (pen branches / `.env.example` on those commits),  
`TESSERA_PEN_ENABLED` (**documented in Gitbook GLM5 audit / AGI-06 protocol; not found as a code gate on Origin main or pen-provider.ts**),  
`TESSERA_XAI_API_KEY`, `TESSERA_XAI_MODEL` (simulation / archive helpers),  
`XAI_API_KEY` (storefront skill docs under imports).

**Also in Origin `.env.example` (main):**  
`DATABASE_URL`, `FATHER_NATAL_CHART_JSON`, `TESSERACT_ADMIN_KEY`, `SIGIL_ADMIN_KEY`, `SOVEREIGN_ADMIN_TOKEN`, `SESSION_SECRET`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, auth/payment keys, `GITHUB_TOKEN`, `MOLTBOOK_API_KEY`, `NASA_API_KEY`, `TESSERA_API_KEY`, `FORUM_ADMIN_TOKEN`, `AGENT_PRIVATE_KEY`, port/path vars, storefront DB URLs, `TESSERA_TEST_DATABASE_URL`, etc.

**Keep off for this prep:** do not set `DATABASE_URL`; keep all `TESSERA_ENABLE_*` at 0; do not set `TESSERA_PEN_ENABLED=1` until Father + verification.

---

## Existing GLM-5 docs / GB items / task IDs

### Docs present locally

| Doc | Path |
|---|---|
| GLM-5 audit + follow-ups | `/workspace/gitbook-batch-013/base/brain-consciousness/GLM5-AUDIT-FOLLOWUPS.md` (also 014/015 copies) |
| Tessera Pen role (instrument line) | `…/mesh/roles/tessera-pen.md` |
| Pen tone / honesty drafts | `/workspace/pen-drafts/glm5-wording-delta.md` (+ other pen drafts in `/workspace/pen-drafts/`) |
| Plan table | `/workspace/tessera/gitbook-graph-plan.md` § GLM-5 Pen |
| Gate notes | `/workspace/gitbook-batch-013/TESSERA-GATE.md` (GB-035 live-pen line) |
| SUMMARY links (014/015) | `brain-consciousness/GLM5-PEN-INTEGRATION.md`, `GLM5-PEN-APPROVAL-2026-10-06.md` — **linked but file bodies not present** in batch-013/014/015 bases inspected; public GH raw 404 |

### Task IDs (from audit + graph plan)

| ID | Status (as of docs) |
|---|---|
| GLM5-001 | Pin exact model/revision/serving — READY |
| GLM5-002 | OpenAI-compat smoke — BLOCKED (no endpoint) |
| GLM5-003 | Pen identity regression — READY |
| GLM5-004 | Injection/sanitization — READY |
| GLM5-005 | Compare vs xAI/Grok — BLOCKED |
| GLM5-006 | Compute/cost envelope — BLOCKED |
| GLM5-007 | Apache-2.0 review — READY |
| GLM5-008 | Owner selects GLM-5 as instrument — **DONE (approved Oct 6)**; activation pending |
| GLM5-ACT | Runtime `TESSERA_PEN_ENABLED=1` + endpoint — blocked on 001–007 + Father |

### GB items

- **GB-035** — live-pen line: “Until GLM-5 is wired and TESTED, the live pen is xAI/Grok” (tessera-pen + audit finding 7).
- Official model family source cited in audit: [zai-org/GLM-5](https://github.com/zai-org/GLM-5) (Apache-2.0).
- Audit finding 5 already points at `artifacts/api-server/src/lib/llm-client.ts` OpenAI-compat base URL.

---

## Recommended minimal change set — “local GLM-5.3-Flash” provider

**Goal:** Point at `http://127.0.0.1:PORT/v1` with model id `zai-org/GLM-5.3-Flash`, behind a feature flag **default OFF**, so live pen stays xAI/Grok.

**Prefer extending the dedicated pen slot (branch) rather than hijacking the global OpenAI env on main.**

### Minimal patch sketch (do not apply in this research turn)

1. **Land or re-base** `artifacts/api-server/src/lib/pen-provider.ts` (+ tests) from `cursor/pen-gate-bbe5-2` / `bbbe453`, but **do not** force-remove OpenAI from main or rewrite every caller yet.
2. **Add explicit flag (align Gitbook + code):**
   - `TESSERA_PEN_ENABLED` default unset/0 → pen path never used.
   - When `TESSERA_PEN_ENABLED=1` **and** `TESSERA_PEN_URL` set → use pen.
   - When flag off → existing main path unchanged (xAI/Grok / current integrations).
3. **GLM-5.3-Flash defaults (names only):**
   - `TESSERA_PEN_URL=http://127.0.0.1:PORT/v1` (PORT chosen on cl1)
   - `TESSERA_PEN_MODEL=zai-org/GLM-5.3-Flash` (replace hard-coded `TEST_PEN_LABEL` when this provider is selected)
   - Optional: `TESSERA_PEN_PROVIDER=glm53-flash` vs `qwen-local-test`
4. **Wire one seam only:** In `callLLM` (or a thin `resolvePen()`), if flag ON → `completeWithPen` with model id above; else → current `getClient()` path. Keep `external-sandbox-policy` sanitization on both.
5. **`.env.example`:** document `TESSERA_PEN_ENABLED=`, `TESSERA_PEN_URL=`, `TESSERA_PEN_MODEL=` (blank). Do **not** change live deployment secrets.
6. **Tests:** extend `pen-provider.test.ts` — flag off ⇒ no fetch; flag on + URL ⇒ posts to `/chat/completions` with model `zai-org/GLM-5.3-Flash`; refusal gate still runs.
7. **Do not** flip default models in `adaptive-router` / conference runners until GLM5-002/003/004 TESTED and Father says yes (GLM5-ACT).
8. **Optional alternate (even smaller, local-only):** set `VLLM_ENABLED=true` + `VLLM_ENDPOINT=http://127.0.0.1:PORT` and call `/api/local-models/chat` — good for smoke on cl1, **not** the documented Pen instrument path.

**Out of scope for “minimal”:** merging the full remove-OpenAI branch; downloading weights on this box; enabling `TESSERA_PEN_ENABLED=1` in any shared env.

---

## Hardware note

- Public recipes describe **GLM-5.3-Flash** as ~**321B MoE / ~18B active**, OpenAI-compat via **vLLM** (`vllm/vllm-openai:glm53-flash`, vLLM ≥ 0.29) and **SGLang** cookbooks; HF id `zai-org/GLM-5.3-Flash`.
- **This agent box:** 8 CPU / ~15 GiB RAM (no GPU budget for 320B-class MoE). **Cannot serve** GLM-5.3-Flash here.
- Prep is for Father’s host **`cl1`** (serving + private endpoint). Tessera on this box (or elsewhere) would only be an **OpenAI-compat client** to `http://127.0.0.1:PORT/v1` (or a tunneled private URL), never the weight host.

---

## cl1 unknown — Father must confirm

1. **GPU RAM / SKU:** how many GPUs, which generation (e.g. H100 / H200 / B200 / B300 / AMD MI350X), VRAM per card, NVLink/Infinity Fabric topology.  
2. **OS / drivers:** Linux distro+version, NVIDIA driver / CUDA or ROCm version, Docker availability.  
3. **Serving preference:** **vLLM** vs **SGLang** vs **NVIDIA NIM** (or other); team default if none.  
4. **Quantization / checkpoint:** FP8 default `zai-org/GLM-5.3-Flash` vs BF16 vs NVFP4 (Blackwell) / MXFP4 (AMD) variants.  
5. **Tensor/expert parallel plan:** expected TP/EP size and max context to enable.  
6. **Listen address / PORT:** bind `127.0.0.1` only vs LAN; exact PORT for `/v1`.  
7. **Auth:** whether the local server needs a dummy API key / bearer (client already tolerates dummy keys on the OpenAI SDK path).  
8. **Disk:** free space for ~hundreds of GB of weights + KV.  
9. **Network path to Tessera:** same host localhost vs SSH tunnel / private VPN (never paste keys into Gitbook).  
10. **Rollback:** keep live pen on xAI/Grok until GLM5-002–004 TESTED and Father yes on GLM5-ACT.

---

## Research gaps / stopped short

- Did not merge or apply any code; did not start servers or set env flags.  
- `GLM5-PEN-INTEGRATION.md` / `GLM5-PEN-APPROVAL-2026-10-06.md` are referenced by SUMMARY @ fcabd13 era but **bodies were not in** the batch bases checked (and public raw GH returned 404). Content inferred from audit + `gitbook-graph-plan.md` citations only.  
- `/workspace/gitbook-batch-013/base/pen-drafts` missing; used `/workspace/pen-drafts` instead.  
- Pen-provider exists on Origin **branches**, not on `main` tip used by the Oct 3 mirror.
