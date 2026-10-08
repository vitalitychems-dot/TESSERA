### 2.3 Visionary Memory: Prospective Knowledge

**Purpose:**  
Stores and evolves future-oriented mental content (visions, ideas, goals, hypotheses, plans, forecasts, counterfactuals) that are remembered and refined before realization. Distinct from episodic (what happened) and semantic (abstracted facts), visionary memory captures intentional, not-yet-happened constructs with explicit prospective semantics.

**Conceptual Role**

- Complements episodic and semantic memory with a prospective lane.
- Enables stable recall, refinement, prioritization, and linkage of intended futures to subsequent experiences.
- Supports long-horizon agency by maintaining goals, decompositions, dependencies, risks, and success criteria.

Data Model

- VisionNode

  - id
  - type: {vision, idea, goal, plan, hypothesis, counterfactual, forecast}
  - status: {draft, candidate, active, paused, superseded, archived, realized, failed}
  - temporal_scope:
    - horizon: {immediate, short, mid, long}
    - window: [t_start_expected, t_end_expected] (optional)
  - intent:
    - desired_outcome (text)
    - success_criteria: [{metric, target, tolerance}]
    - constraints: [{name, bound, hard|soft}]
    - risk_register: [{risk, likelihood, impact, mitigation}]
  - provenance:
    - origin_nodes: [MemoryRecord|NarrativeRecord|VisionNode ids]
    - originating_CFG_nodes: [DMN node ids]
    - μ_snapshot_at_creation
  - embeddings:
    - content_embedding (text, symbols, sketches)
    - relation_signature (prospective relations below)
  - tags: {themes, domains, stakeholders}
  - governance:
    - priority
    - owner (internal submodule “sponsor”)
    - review_cadence
  - links:
    - supports -> GoalNode
    - decomposes -> PlanStepNode
    - depends_on -> VisionNode|SkillNode|ResourceNode
    - blocked_by -> RiskNode|ConstraintNode
    - contradicts -> VisionNode
    - supersedes -> VisionNode
    - derived_from -> Narrative/Episodic nodes
    - tracked_by -> MemoryRecord
    - realized_by/failed_by -> MemoryRecord

- PlanStepNode (specialization)
  - step_description
  - preconditions, postconditions
  - required_capabilities, required_resources
  - expected_signals (observables during execution)
  - alignment_scores: {utility, safety, coherence, identity}

Prospective Relation Operators (Latent Geometry)

Augment the multi-relational manifold with future-facing transforms:

- T_goal: alignment to current goal manifold
- T_feasibility: capability/resource fit
- T_risk: proximity to risk landscape
- T_dependency: pull toward prerequisites
- T_temporal_forecast: expected timeline axis
- T_alignment_identity: similarity to z_self trajectory
- T_value: expected utility axis

Combined embedding:
z_vision\* = content_embedding ⊕ Σ (w_rel · T_rel)  
Weights w_rel can be modulated by μ (e.g., DA↑ → T_value, NE↑ → T_risk, 5HT↑ → safety/constraints).

Core Operations

- Create (PFC-1/PFC-2, Mind-Wandering)

  - Detect intent/goal/idea statements; instantiate VisionNode with status=draft.
  - Compute z_vision\*, attach provenance, μ snapshot, CFG node.

- Retrieve & Expand (HC)

  - Use prospective operators in sphere queries to fetch/deform related visions.
  - Generate counterfactuals and alternative decompositions.

- Value (VS)

  - Compute Expected Prospective Value (EPV) for vision paths:
    EPV = a1·expected_utility − a2·risk + a3·feasibility + a4·identity_alignment + a5·novelty − a6·constraint_violation − a7·effort_cost − a8·time_discount  
    Coefficients a_k are μ-sensitive.

- Select & Stage (PFC-2)

  - Promote/demote status; decompose into PlanStepNodes; schedule review cadence.

- Tag & Persist (NAcc, Memory Write)

  - Apply persistence/reward salience; write links:
    - tracked_by edges from VisionNode to new episodes
    - realized_by/failed_by upon criteria satisfaction or impossibility
  - Update success_criteria progress and feasibility predictors.

- Consolidate & Prune (Sleep/GC)
  - Merge duplicates; abstract clusters into higher-level objectives.
  - Archive superseded/stale, low-priority visions; reconcile contradictions.

Operational Notes

- Visionary nodes are first-class citizens in retrieval and valuation; they coexist with episodic/semantic nodes but retain “prospective” semantics.
- All links are auditable with CFG provenance to enable metacognitive tracing (“how this idea formed and evolved”).
- Safety constraints are enforced at valuation and selection; risky visions either gain mitigations or are paused/superseded.
- Realization/failure is adjudicated by success_criteria matched against observed telemetry and MemoryRecords.

1. Detailed DMN Algorithm and Thought Cycle

