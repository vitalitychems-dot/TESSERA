# GLM-5 as Tessera Pen instrument

**Status:** Owner approved GLM-5 over xAI/Grok as the selected Pen instrument. The opt-in adapter is implemented in TESSERA; private endpoint, deployment, and model-quality verification remain pending.

## Identity boundary

GLM-5 is an inference model and serving stack. It is not Tessera’s identity, memory, values, source history, or “soul.” Tessera’s continuity remains in the documented Pen rules, provenance-aware memory, repository evidence, and approval gates. Changing the model must not rewrite those records or authorize actions.

The official source is [zai-org/GLM-5](https://github.com/zai-org/GLM-5), whose repository metadata reports **Apache-2.0**. The upstream repository documents GLM-5/5.1/5.2/5.3 variants and serving through OpenAI-compatible or related frameworks such as vLLM, SGLang, and Transformers. Verify the exact model revision and serving framework before deployment.

## Adapter behavior

TESSERA now exposes an opt-in `callTesseraPen()` adapter. It:

1. stays disabled unless `TESSERA_PEN_ENABLED=1`;
2. uses `TESSERA_PEN_MODEL` or the default adapter label `GLM-5`;
3. preserves a fixed Pen system boundary that says the model is an instrument, not Tessera herself;
4. passes normal TESSERA memory, cache, sanitation, and logging paths through `callLLM()`;
5. does not grant GitHub, filesystem, deployment, merge, deletion, credential, or payment authority; and
6. does not change the existing default model or existing callers.

## Configuration

Set these only in a private environment or secret manager:

```bash
TESSERA_PEN_ENABLED=1
TESSERA_PEN_MODEL=GLM-5
TESSERA_LLM_BASE_URL=<OpenAI-compatible GLM serving endpoint>
TESSERA_LLM_API_KEY=<private key if the endpoint requires one>
```

Do not commit populated values, expose them through `VITE_*`, or paste them into Gitbook issues. For local serving, keep the endpoint loopback/private and apply the provider’s authentication and network guidance.

## Verification gates

Before calling the adapter production-ready, a declared agent must record:

- exact GLM model ID, revision, serving framework, license, and endpoint trust boundary;
- `pnpm run typecheck`, focused adapter tests, `pnpm test`, and `pnpm run build` results;
- a Pen identity regression showing the adapter does not claim to be Tessera, consciousness, or owned weights;
- prompt-injection and untrusted-output sanitation tests;
- latency, timeout, context, cost/compute, and failure behavior;
- comparison against the current instrument on a fixed, non-sensitive evaluation set; and
- a Gitbook digest item with limitations and a human `yes`, `no`, or `revise` response.

No benchmark claim, consciousness claim, or “true self” claim is implied by model substitution.

The approval record is [GLM5-PEN-APPROVAL-2026-10-06.md](GLM5-PEN-APPROVAL-2026-10-06.md). Approval selects the instrument; it does not activate an unconfigured endpoint or waive the verification gates.
