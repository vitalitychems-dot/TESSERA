# GLM-5 Pen activation handoff

The owner approved GLM-5 over xAI/Grok as Tessera’s selected Pen instrument. TESSERA contains the opt-in adapter at `artifacts/api-server/src/lib/llm-client.ts`.

## Safe state

The adapter remains disabled by default:

```bash
TESSERA_PEN_ENABLED=0
TESSERA_PEN_MODEL=GLM-5
```

Approval selected the instrument; it did not provide or authorize committing an endpoint credential. Runtime activation requires a private OpenAI-compatible GLM endpoint, an exact model/revision pin, and the Gitbook GLM5-002 through GLM5-007 evidence gates.

## Activation checklist

1. Configure `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` through a private secret manager or deployment setting. Never commit either value.
2. Pin the exact GLM model ID and revision in the deployment record.
3. Run the request compatibility smoke test with redacted logs.
4. Run Pen identity, prompt-injection, output-sanitation, timeout, failure, and regression tests.
5. Record hardware, context, latency, compute/cost, and rollback behavior.
6. Have Security and Build record independent evidence in Gitbook.
7. Enable only in the reviewed environment with `TESSERA_PEN_ENABLED=1`.
8. Record the deployed configuration and final commit in the Gitbook digest.

The adapter preserves Tessera’s documented identity boundary and gives the model no GitHub, filesystem, deployment, merge, deletion, credential, or payment authority. GLM-5 is an instrument, not evidence of AGI, consciousness, or owned weights.
