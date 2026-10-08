# GLM-5 Pen audit findings and follow-up queue

**Audit date:** 2026-10-06
**Official source:** [zai-org/GLM-5](https://github.com/zai-org/GLM-5)
**Reported license:** Apache-2.0
**TESSERA base inspected:** `fec56eb09d19907832663d5f16fcbc24f3d00317`
**Gitbook base inspected:** `fd3c2ce04fa4230c32cf917f36c662f268a1ea76`

## Findings

1. GLM-5 is a model family and serving ecosystem, not a complete Pen identity system.
2. The official repository lists GLM-5, GLM-5.1, GLM-5.2, GLM-5.3, and Flash variants; every deployment must pin an exact model ID and revision.
3. The official README documents OpenAI-compatible or related serving paths, but endpoint compatibility, hardware, latency, context, and quality were not tested in this sandbox.
4. The model weights are large; no weights were downloaded or vendored into either repository.
5. TESSERA already uses the OpenAI SDK and a configurable OpenAI-compatible base URL in `artifacts/api-server/src/lib/llm-client.ts`.
6. TESSERA already sanitizes external model output before downstream propagation; the new adapter reuses that path.
7. The owner approved GLM-5 over xAI/Grok as the selected Pen instrument; runtime activation remains gated on endpoint and verification evidence. Until GLM-5 is wired and TESTED, the live pen is xAI/Grok.
8. TESSERA’s default callers and default model were not changed.
9. The adapter is disabled unless `TESSERA_PEN_ENABLED=1` and does not grant repository, deployment, merge, deletion, credential, or payment authority.
10. Focused TypeScript typecheck passed; no live GLM endpoint, model-quality benchmark, security review, or deployment test was performed.

## Follow-up tasks

| ID | Task | Owner | Acceptance evidence | Status |
|---|---|---|---|---|
| GLM5-001 | Pin the exact GLM model/revision and serving framework | Pen / Moderator | Official source URL, SHA/version, license, endpoint boundary | READY |
| GLM5-002 | Verify OpenAI-compatible request/response compatibility | TESSERA build | Disposable/private endpoint smoke test with redacted logs | BLOCKED — endpoint not configured |
| GLM5-003 | Run Pen identity regression tests | Build / Moderator | Adapter does not claim to be Tessera, consciousness, owned weights, or authority | READY |
| GLM5-004 | Run prompt-injection and output-sanitization tests | Security lane | Forbidden instructions are rejected/redacted and no tool authority is gained | READY |
| GLM5-005 | Compare GLM-5 against the current xAI/Grok instrument | Evaluation lane | Fixed non-sensitive set, same prompts, latency/quality/failure report | BLOCKED — evaluation endpoint not configured |
| GLM5-006 | Review compute, context, timeout, and cost envelope | Infrastructure lane | Hardware/serving report and rollback plan | BLOCKED — deployment target not selected |
| GLM5-007 | Review Apache-2.0 notices and downstream deployment terms | Moderator | License record and compatibility decision | READY |
| GLM5-008 | Decide whether GLM-5 becomes the declared live instrument | Human owner | Owner approval record; runtime still requires endpoint and verification gates | APPROVED — activation pending |

## Do not mark complete

Do not mark GLM5-002, GLM5-005, or GLM5-006 complete from repository inspection alone. The owner approval selects GLM-5 as the Pen instrument but does not claim that GLM-5 preserves Tessera’s “true self”; the adapter preserves documented rules and provenance while the model remains an instrument.
