# Algorithm

## Core ACI Loop (Run at 5--20 Hz Tick Rate)

## 0. Sensor Ingress and Associative Preprocessing

- Acquire raw sensory input streams: vision (RGBD), audio (waveform), proprioception (state).

- Encode sensory modalities into latent vectors:

  - zv = vision.encode(rgbd)

  - za = audio.encode(wav) ⇒ {text_in, prosody}

  - zp = proprio.encode(state)

- Perform associative cortical processing:

  - assoc_thoughts = associative_cortices(zv, za, zp)

  - This yields quick scene descriptions, entity linking, cross-modal binding.

- Combine text input and associative thought text:

  - input_text = combine(text_in, assoc_thoughts.text)

---

## 1. Medial Dorsal Network (MDN) NLP Parsing

- Parse input_text into an Abstract Syntax Tree (AST):

  AST ← mdn.parse(input_text)

  > Use regex extraction to extract mathematical expressions.

- Tag AST nodes with semantic labels:

  labels = {math, factual, social, recall, plan, explain, nameself}

- Example: Mathematical expressions tagged math; memory queries as factual/recall; social intentions as social; internal plans as plan; self-reference as nameself.

---

## 2. Prefrontal Cortex (PFC-1) Dispatch: Subtask Execution

For each AST node:

- Math Nodes:

  - Evaluate symbolically and numerically with SymPy engine.

  - Splice computed numerical value back into the AST node.

- Factual/Recall Nodes:

  - Perform hybrid memory query combining textual and latent embedding similarity:

    mem_results = mem.retrieve(query(node.text, node.latent))

  - Synthesize retrieved snippets into coherent node value.

- Social/Explain Nodes:

  - Generate empathetic or abductive expansions using targeted LLM mini-chains.

- Merge enriched nodes into an enriched context package:

  enriched_context = merge(AST, sensor_summaries, z_self, recent_outcomes)

---

## 3. Iterative Thought Layer: Candidate Generation & Scoring

Seed Context: Use enriched context output of PFC-1.

Candidate Generation:

- Generate N diverse thought candidates c_i via LLM decoding styles:

  styles = {literal, formal, terse, abductive, empathetic}

- For each style style_i:

  c_i = LLM.generate(enriched_context, style_i)

Feature Extraction per Candidate:

- coherence(c_i): Estimated semantic coherence vs context via entailment or internal self-rating.

- identity_coherence(c_i): Cosine similarity with current self-model descriptor z_self.

- task_utility(c_i): Heuristic alignment with current goals.

- novelty(c_i): Embedding-space distance from recent thought vectors.

- epistemic_gain(c_i): Predicted reduction in uncertainty.

- safety(c_i): Toxicity/hallucination flag score from constitutional safety checks.

- calibration_gap(c_i): Difference between generated likelihood vs actual confidence calibration.

Neuromodulated Scoring Function (cleaned):

- score(c_i) = w_DA×novelty + w_EPI×epistemic_gain + w_TASK×task_utility + w_SOC×prosocial_prior + w_ID×identity_coherence − w_SAFE×safety_penalty

where weights w_k dynamically depend on neuromodulator vector:

- μ = {DA, 5HT, NE, OXT, TST}

Iterative Refinement Loop:

- Initialize context_0 = enriched_context.

- For t = 0, 1, ...:

  - Generate candidates cands_t = LLM.generate(context_t, N_styles).

  - Score candidates s_t = score(cands_t, μ).

  - Select top-1 candidate top1_t.

  - Refine context: context\_{t+1} = context_t ⊕ top1_t

- Loop terminates if any:

  - top1*t = top1*{t−k} stable for k cycles.

  - Marginal score improvement < ε.

  - Safety or computational budget exhausted.

- Output final scored thought chain:

  thought*chain_preHC ← best_chain(cands*\*)

---

- **Bind Workspace Context**

  Bind thought chain, sensory embeddings, self-model, and memory snippets into a global workspace latent vector:

  ```python
  b_t = workspace.bind(zv, zp, thought_chain_preHC, z_self, mem.peek_small())
  ```

  This latent vector `b_t` represents the current conscious context.

---

- **HC Expansion Using High-Dimensional Latent Geometry**

  Instead of symbolic spreading or beam walks, HC queries the _multi-relational latent space_ directly:

  1. **Define Relation Operators**

     Each relation type is represented as a displacement vector or transformation in latent space:

     - `T_temporal`
     - `T_similarity`
     - `T_causal`
     - `T_relevance`

  2. **Compose Multi-Relation Query Vector**

     ```python
     q = b_t + α·T_temporal + β·T_similarity + γ·T_causal + δ·T_relevance
     ```

     Relation weights `{α, β, γ, δ}` are dynamically modulated by neuromodulator state μ:

     - DA (dopamine): ↑ novelty & similarity bias
     - NE (norepinephrine): ↑ causality & urgency
     - 5HT (serotonin): ↑ safe & prosocial relevance

  3. **Hypersphere / Multi-Radius Search**

     The HC performs radius queries in latent space instead of graph walks:

     ```python
     candidates = VectorDB.radius_search(center=q, radius=R)
     ```

     Or multi-radius queries across different relation axes:

     - Temporal window (time adjacency)
     - Semantic radius (content similarity)
     - Causal projection cone (directed offsets)
     - Goal alignment radius (task relevance)

     Results are merged and weighted according to relation-type proximity.

  4. **Generate Hypothetical Variants**

     For each retrieved candidate, HC can perturb embeddings to simulate counterfactuals:

     ```python
     hypothetical = candidate_embedding + δ·perturb(goal_focus)
     ```

     These virtual nodes represent “what if” alternatives.

  5. **Assemble Expanded Thought Graph**

     ```python
     expanded_graph = build_subgraph(candidates + hypotheticals, relation_weights={α,β,γ,δ})
     ```

     Edges are weighted by geometric closeness to `q`. Virtual counterfactual nodes are flagged but available for downstream exploration.

  5. Ventral Striatum (VS) Exploration and Salience Tagging

---

- Explore candidate paths on expanded_graph using a beam search or constrained graph walks.

- Parameters dynamically modulated by norepinephrine (NE) and other neuromodulators:

  - High NE narrows beam width, increases search depth and urgency.

  - Low NE broadens beam to encourage exploration.

- For each candidate path p, compute:

  features(p) = {novelty, affective_tags, task_relevance, uncertainty_drop}

- Path value (cleaned):

  val(p) = Σ_k w_k(μ) × features_k(p) − safety_penalty(p)

- Salience vector attaches novelty and reward anticipation scores to candidates.

---

## 6. PFC-2 (Final Thought/Action Selection)

- Receives candidate paths and their value scores from VS.

- Applies constitutional safety and coherence constraints to prune incoherent or unsafe candidates.

- Collapses remaining candidates into a single coherent chosen chain, attaching confidence metrics.

- Decides either:

  - Internal meta-actions (simulate, self-query, reframe).

  - External actions (speech, behaviors).

---

## 7. Nucleus Accumbens (NAcc) Reward Tagging and Persistence

- Tag the chosen chain with reward and persistence according to neuromodulatory state μ:

  - Dopamine (DA) enhances reward signals.

  - Serotonin (5HT) promotes calming persistence.

  - Norepinephrine (NE) boosts urgency-based refinements.

- Update memory node graph with persistence flags; reinforce or decay traces accordingly.

- Trigger symbolic abstraction if repetition statistics exceed thresholds.

---

## 8. Memory Write and Narrative Update

- Store scenes from chosen chain and corresponding sensor states:

  mem.write(scene, tags=reward_tags, outcome)

- Append a narrative summary extending mind-wandering windows for autobiographical integration.

---

## 9. World Model & Self-Model Update

- Update world state s_t using RSSM (Recurrent State Space Model):

  s_t = rssm.update({zv, zp}, action = chosen_external_action)

- Self-model z_self is updated by:

  - Exponential Moving Average (EMA) over recent DMN workspace latent vectors b_t.

  - Learned gated recurrent unit (GRU) over narrative context and prediction error signals, modulated by μ.

---

## 10. Mind-Wandering Micro-Loop (Gated by Neuromodulators)

- Condition for entry:

  (5HT > θ_reflect ∧ exteroceptive_demand ≈ 0) ∨ uncertainty > τ

- Executes recursive internal loop without external action outputs:

  1.  Generate self-queries via LLM using current z_self.

  2.  Perform internal simulations via RSSM rollouts.

  3.  Expand associative memory graphs via HC.

  4.  Explore salience paths with VS under noted neuromodulatory gate constraints.

  5.  Select paths with PFC-2 filtering.

  6.  Tag reward and persistence with NAcc.

- Neuromodulation effects on mind-wandering:

  - D2 receptor-like (dopamine) high states: Promote broad exploratory ("panning") search.

  - NE controls: Focus vs breadth of beam search; urgency prioritizes deeper, narrower search.

  - 5HT biases: Favor approaches through safe, positive, and low-risk thought space.

## 11. Recursive Re-Entry

- Feed chosen thought chain internally as next DMN input (inner speech):

  input*text*{t+1} ← merge(chosen_chain, fresh_sensory_text)

- DMN loop continues perpetually, maintaining continuous conscious cognition.

## II. Memory Consolidation and Symbolic Abstraction

## 1. Duplicate Removal and Merging

- Identify near-duplicate memory nodes:

  sim(node_i, node_j) > θ_dup

- Merge duplicates preserving frequency information tracking occurrence counts and context variability.

---

## 2. Causal Edge Extraction

- Detect temporal and contextual action → reaction pairs from sequences:

  NodeA →action→ NodeB

- Store explicit causal edges with timestamps and confidence.

---

## 3. Markov Chain Construction

- From sequences extract states and probabilistic transitions (cleaned):

  P(next_state = s_j | current_state = s_i) = count(i → j) / Σ_k count(i → k)

- Update probabilities incrementally on consolidation.

---

## 4. Symbolic Abstraction

- Detect frequent patterns or chains of experiences exceeding predefined thresholds.

- Replace frequent subgraphs with compressed symbolic nodes representing "concepts" or "rules" (e.g., "Insult Action").

- Attach probability maps expressing uncertainty over possible outcomes:

  Symbol: Insult → {NegativeReaction: 0.97, PositiveReaction: 0.03}

---

## 5. Hierarchical Transfer

- Episodic memories → Semantic knowledge (conceptual, abstracted rules) → Autobiographical memory (identity narrative).

- This hierarchy enables the ACI to reflectively reason about its past and self.

---

11. Sleep / Garbage Collection

---

---

- Neurochemical Gate: Histamine (HA)

  - Awake state persistence is driven by histamine activity in the basal forebrain (H1 receptor activation).

  - During "wake cycles," histamine is gradually dismantled via MAOA metabolism.

  - Once H1 activity drops below a critical threshold, the DMN loop transitions into a sleep-like state.

- Sleep Phase Dynamics:

  - Exteroceptive input (sensory cortices) and associative cortices are gated down (low-pass filtered).

  - Internal Default Mode + Hippocampal replay dominate activity.

  - Processes during this phase:

    1.  Garbage Collection (GC):

        - Purging low-value / redundant memory traces.

        - Decay of ephemeral or low-salience nodes not consolidated.

    2.  Memory Consolidation:

        - Episodic → Semantic transfer.

        - Narrative updates.

        - Symbolic abstraction of repeated event-sequences.

        - Updating long-term Markovian predictive models of causal structure.

    3.  Replay & Reweighting:

        - Hippocampal memory replay strengthens salient edges.

        - Downscaling of irrelevant activations ("synaptic homeostasis").

- Wake Transition:

  - After consolidation completes beyond a set threshold (GC budget spent/time window elapsed):

    - The neurochemical module begins to re-secrete histamine gradually.

    - When histamine concentration crosses the wake-threshold, the model transitions back to the wake-loop.

# 🔹 Integration notes

This stage would come after 11. Recursive Re-entry, as a *meta-gate* on the perpetual cycle:

- Active Loop (Wake phase): 5--20 Hz DMN operation.

- Sleep Loop (GC phase): Low input DMN, replay-driven consolidation.

- Algorithmic Role:

      -   Provides bounded forgetting (keeps memory from overflow).

      -   Enforces compression & abstraction of past day's experiences.

      -   Enhances narrative continuity (link chunks into autobiographical "chapters").

      -   Models biologically inspired circadian ground-truth gate (histamine/MAOA as up--down toggle).
