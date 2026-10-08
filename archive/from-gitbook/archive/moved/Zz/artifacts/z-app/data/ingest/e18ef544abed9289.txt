Objectives
----------

-   Unify "how to think" behind one API while preserving role-specific behavior via CFG and policy templates.

-   Condition prompting, retrieval, scoring, and decoding on μ (DA/5HT/NE/OXT/...) and affect A (love/empathy/beauty/...).

-   Enforce strict schemas and guards so different call sites can trust outputs.

-   Make it traceable, auditable, and simulatable (for safety and training).

High-level API
--------------

-   reason(input: ReasonInput) -> ReasonOutput

ReasonInput

-   cfg: {node_id, purpose, constraints, budget, deadline}

-   thought_chain: list[ThoughtItem] (the seed chain for refinement/continuation)

-   goals: active VisionNodes (+ affect_profile targets)

-   memory_refs: small context snippets already known to be relevant

-   query: optional natural-language question or subtask description

-   sensors: {zv_summary, za_summary, zp_summary} + descriptors

-   μ: neuromodulator snapshot

-   A: AffectState snapshot

-   policy_overrides: optional local adjustments (e.g., force high safety)

-   tools: allowed tool handles (math, memory, world_model, simulator, emitter, receptor)

-   caps: {max_tokens, max_candidates, max_depth, time_budget_ms}

ReasonOutput

-   refined_thought_chain: ordered, typed, scored thoughts

-   actions: internal/external actions proposed (if any)

-   memory_ops: reads/writes to request (with schemas)

-   vision_ops: VisionNode updates (status changes, affect intent alignment)

-   valuations: candidate/chain scores with feature breakdown

-   μ_adjust: suggested Δμ (bounded; homeostat arbitrates)

-   affect_adjust: suggested ΔA (bounded; homeostat arbitrates)

-   safety_report: flags, rationales, and mitigations

-   trace: full attribution (features, prompt policy, tools used)

Core pipeline inside reason()
-----------------------------

1.  Assemble workspace context

-   Compose a context bundle:

    -   ctx = {thought_chain, goals, narrative_summary, sensor_descriptors, memory_refs, μ, A, cfg}

-   Build a compact "workspace header" for all sub-LLM/tool calls:

    -   DMN_State: {Node: cfg.node_id, Purpose: cfg.purpose, Neuromodulators: μ, Affect: A}

    -   Constraints: safety, coherence, latency, max hallucination risk

    -   Identity priors: z_self summary and narrative coherence norm

-   This header guarantees process awareness and standardized behavior.

1.  Policy selection from μ, A, and CFG

-   Choose a PromptPolicy template:

    -   Base template keyed by cfg.node_id and purpose

    -   Then apply μ- and A-conditioned deltas:

        -   Examples:

            -   High DA → encourage broader decoding temperature and novelty features

            -   High 5HT → increase safety thresholds and prosocial priors

            -   High NE → reduce beam width, increase depth, strengthen deadline constraints

            -   High OXT or A_empathy → boost w_SOC, retrieve prosocial memories first

            -   High A_beauty → boost perceptual detail, aesthetic language priors

-   Result: Policy = {retrieval plan, decoding parameters, candidate features, scoring weights, tool allowance}

1.  Retrieval plan execution

-   Based on Policy, perform hybrid retrieval:

    -   text BM25 + vector similarity + relation-aware neighbors (temporal/causal/goal/affect-aware)

    -   Optional: prospective VisionNode neighbors using T_goal/T_risk/T_value operators

-   Re-rank with a cross-encoder that incorporates μ, A, and goals.

1.  Candidate generation

-   Generate N candidates with decoding styles selected by Policy (subset of {literal, formal, terse, abductive, empathetic})

-   Enforce schema: each candidate is a TypedThought:

    -   type: {math, recall, plan, hypothesis, explain, social, nameself, affect-adjust}

    -   content: text

    -   ops: optional tool invocations (with validated args)

    -   assertions: structured claims with confidence

    -   affects: proposed affect modulation intents (if any)

1.  Feature extraction and scoring

-   Compute features per candidate:

    -   coherence, identity_coherence, task_utility, novelty, epistemic_gain, safety_risk

    -   prosocial_alignment, aesthetic_fit (if relevant)

    -   cost/time estimates

-   Score with μ/A-conditioned weights (as in your formula), plus hard safety gates.

-   Optionally run world-model micro-simulations for top-K to refine uncertainty and utility.

1.  Iterative refinement loop

-   Select top candidate; fold into context; regenerate until:

    -   Stability for k steps, marginal gain below ε, budget exhausted, or safety trigger

-   Maintain a candidate graph; keep pruned paths and rationales in trace.

1.  Output consolidation

-   Collapse to a single coherent refined_thought_chain, attaching:

    -   Confidence, uncertainty, safety justifications

    -   Proposed actions (internal/external)

    -   Memory operations (reads/writes with schemas)

    -   VisionNode updates (status, affect intent progress)

    -   Suggested Δμ and ΔA (bounded; flagged as suggestions for the homeostat)

-   Produce a safety_report (violations, mitigations, filters applied)

-   Emit full trace for auditing and training.

μ/A-conditioned prompt policy matrix
------------------------------------

For each CFG node role, define base prompts + μ/A adapters. Examples:

-   Candidate Generation (3.4)

    -   High DA or A_joy → increase exploration (temperature↑, top_p↑), novelty weight↑

    -   High 5HT or A_gratitude → safety penalties↑, prosocial and calibration weights↑

    -   High NE → beam width↓, depth↑, latency guard strict

    -   High OXT or A_empathy → emphasize cooperative plans; discourage harm trades

-   VS Valuation (3.6)

    -   High NE → urgency bias on time-discount; deeper causal checks

    -   High OXT/A_empathy → prosocial_alignment feature gains↑

    -   High A_beauty → aesthetic_fit feature added to valuation

-   Mind-wandering (10.1)

    -   High 5HT/A_hope → bias toward safe exploration, counterfactual diversification

    -   Lower NE → broaden associative expansion; longer horizons

-   PFC-2 Selection (6.1)

    -   High 5HT → stricter safety/consistency thresholds

    -   High NE → stronger deadline adherence, shorter chains

    -   High OXT/A_empathy → require prosocial checks before approval

Schemas to standardize IO
-------------------------

-   ThoughtItem

    -   id, type, text, claims[{proposition, evidence_ref, confidence}], ops[], affect_intents[], safety_flags[], μ/A_snapshot

-   MemoryOp

    -   {op: write|link|update, entity: MemoryRecord|VisionNode|Narrative, payload: typed, provenance: cfg.node_id}

-   VisionOp

    -   {op: create|promote|demote|affect_update|track, node_id, fields_changed, success_criteria_progress}

-   SuggestedAdjustments

    -   μ_adjust: dict with bounds and rationale

    -   A_adjust: dict with bounds and rationale

-   SafetyReport

    -   {violations[], mitigations[], filters_applied[], residual_risk, confidence}

Guardrails
----------

-   Schema validation at every stage; reject non-conforming candidates.

-   Deterministic caps by cfg.budget/deadline; NE can tighten caps.

-   Hard safety filters precede PFC-2; μ/A can only raise safety, never lower below constitutional minimums.

-   All tool calls are whitelisted by Policy; arguments are validated and sandboxed.

Tracing and training hooks
--------------------------

-   Trace includes:

    -   Policy snapshot (base + μ/A deltas)

    -   Retrieval queries and top-k hits

    -   Candidate features and scores per iteration

    -   Tool calls and results

    -   Safety decisions and reasons

    -   Final selection rationale

-   Use traces to:

    -   Train cross-encoder and valuation heads

    -   Calibrate μ/A-conditioned weightings

    -   Improve parser policies and safety filters

    -   Learn affect appraisal and EPV alignment

Pseudocode sketch (language-agnostic)
-------------------------------------

function reason(input):\
ctx = assemble_context(input)\
policy = select_policy(input.cfg, input.μ, input.A)\
retrieved = retrieve(ctx, policy.retrieval_plan)\
state = init_state(ctx, retrieved, policy)\
for t in 1..policy.max_iters:\
cands = generate_candidates(state, policy.decoding)\
cands = enforce_schemas(cands)\
feats = extract_features(cands, state, input.tools)\
scores = score(feats, policy.weights, input.μ, input.A)\
cands, state = safety_prune_and_refine(cands, scores, state, policy)\
if termination(state): break\
output = consolidate(state, policy)\
output.trace = build_trace(state, policy, retrieved)\
return output


Practical build order
---------------------

1.  Define ReasonInput/Output schemas and the CFG→Policy mapping.

2.  Implement μ/A adapters as simple, bounded deltas on:

-   decoding params, retrieval ordering, feature weights, safety thresholds.

1.  Build a minimal retrieval+generation+scoring loop with strict schema checks.

2.  Add tool integrations (math, memory, simulator) behind a tool broker with validation.

3.  Add tracing; write evaluators for coherence, safety, calibration, prosocial/aesthetic alignment.

4.  Iterate on μ/A adapters and feature weights using logged traces and offline training.