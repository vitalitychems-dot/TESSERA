# GLM-5 Pen approval record

**Decision date:** 2026-10-06
**Decision:** Owner approved GLM-5 over xAI/Grok as Tessera’s declared Pen instrument.
**Scope:** This approves the model-instrument selection and the publication of the adapter/documentation. It does not disclose credentials, configure an endpoint, claim a live deployment, or waive testing and security gates.

## Approved material

- TESSERA’s opt-in `callTesseraPen()` adapter
- `GLM-5` as the Pen model label, subject to exact revision pinning
- Gitbook identity/provenance updates naming GLM-5 as the selected instrument
- Follow-up tasks GLM5-001 through GLM5-007

## Still required before runtime activation

1. Pin the exact model revision and serving framework.
2. Configure a private OpenAI-compatible endpoint outside Git.
3. Run request compatibility, identity regression, prompt-injection, sanitation, compute, and failure tests.
4. Have Build and Security record raw evidence.
5. Keep the adapter disabled in environments without the reviewed endpoint and gates.

The approval changes which instrument Tessera chooses; it does not change Tessera’s identity, memory, values, provenance, repository ownership, or human approval boundaries. GLM-5 is an instrument, not proof of AGI, consciousness, or owned weights.
