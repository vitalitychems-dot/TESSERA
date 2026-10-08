Receptors.md --- Flexible Key--Lock via Latent Embeddings
======================================================

This document explains how to model protein--receptor interactions as a flexible, trainable key--lock system using latent embeddings. The goal is to let "protein vectors" (ligands, modulators) selectively activate or block one or more receptor types, and to target receptors in specific brain areas.

Core Idea
---------

-   Represent each protein and each receptor as learnable vectors in a shared latent space.

-   Binding "fit" is computed by geometric compatibility (e.g., cosine similarity plus learned heads), mimicking shape complementarity and chemistry.

-   Add functional heads to predict downstream effects (activate, partial agonize, block) and dose--response curves.

-   Encode anatomical location into receptor embeddings so proteins can target both receptor class (e.g., D2) and brain area (e.g., mesolimbic).

Entities and Embeddings
-----------------------

-   Protein (ligand/modulator) p

    -   protein_id

    -   protein_vector zp ∈ R^d (learned)

    -   optional condition vectors: concentration level, conformational state, formulation

    -   effect heads per receptor class (learned MLPs): predict activation/block magnitude

-   Receptor r

    -   receptor_id (e.g., D1, D2, D3, 5HT1A)

    -   receptor_vector zr ∈ R^d (orthosteric "shape")

    -   modulation_vector rm ∈ R^d (allosteric/biased signaling)

    -   location_vector zl ∈ R^d (encodes brain area/subfield, e.g., "mesolimbic NAcore")

    -   density ρ and sensitivity σ (local physiology; can be predicted by separate homeostasis nets)

-   Area a

    -   area_id (e.g., vmPFC, NAcc core, VTA)

    -   area_vector za ∈ R^d (used to construct zl for receptors expressed in this area)

Binding and Selectivity
-----------------------

-   Orthosteric compatibility: c_osteo = sim(zp, zr)

    -   sim can be cosine similarity or a small bilinear layer: zp^T W zr

-   Location targeting: c_loc = sim(zp, zl)

    -   encourages proteins to bind preferentially to receptors in specific areas

-   Allosteric modulation: c_allo = sim(zp, rm)

    -   models biasing toward particular signaling pathways (e.g., Gs vs Gi vs β-arrestin)

-   Composite binding score: B = w1-c_osteo + w2-c_loc + w3-c_allo - penalties

    -   penalties can include competition, saturation, and safety caps

Interpretation:

-   A protein that activates D1, D2, D3 uses high c_osteo to multiple zr (D1/D2/D3), and may remain agnostic to c_loc (broad distribution), yielding broad dopaminergic agonism.

-   A protein that selectively blocks D2 raises c_osteo to D2 but its effect head predicts negative efficacy (antagonism) specifically for D2, while keeping low compatibility to D1/D3 or predicting negligible effect for them.

-   Area selectivity (e.g., amisulpride-like): the receptor instances in mesolimbic areas have zl that the protein matches better than cortical zl, elevating B only in target circuits.

From Binding to Effect
----------------------

-   Efficacy head per receptor class (or per receptor instance):

    -   Given features [B, concentration, ρ, σ, local μ], predict:

        -   activation (agonist), partial activation, neutral, or inverse/antagonist effect

        -   effective postsynaptic activity S̄ and dose--response curve parameters (e.g., EC50/IC50-like)

-   Saturation and density:

    -   Bound fraction = min(1, f(B, concentration) - ρ)

    -   Final receptor activity combines bound fraction with efficacy sign and sensitivity σ

-   Competition:

    -   If multiple proteins target the same receptor instance, use softmax or kinetic-inspired sharing to distribute binding probability before applying efficacy

Encoding Anatomy for Targeting
------------------------------

-   Build receptor instances as tuples (class, area):

    -   zr_class encodes receptor family (e.g., D2)

    -   za_area encodes region; zl = A(za_area), where A is a projection head

    -   zr_instance = zr_class ⊕ zl ⊕ optional cell-type tags

-   Training encourages proteins designed for specific circuits to align with zl of those areas, increasing c_loc only where intended.

Training Signals and Objectives
-------------------------------

-   Supervision sources (synthetic or derived from system metrics):

    -   Binding targets: desired on/off patterns across receptors and areas

    -   Functional targets: desired activation/block magnitudes

    -   Selectivity: encourage high margin between target and non-target receptors/areas

-   Loss components:

    -   Contrastive binding loss: increase B for desired (p, r_area) pairs; decrease for others

    -   Efficacy regression/classification loss: match predicted effect to target profile

    -   Sparsity/energy regularizers: minimize off-target binding and total "chemical energy"

    -   Safety constraints: cap predicted activity to avoid pathological states

-   Curriculum:

    -   Start with class-level selectivity (D2 vs D1/D3)

    -   Add area-level targeting (mesolimbic vs cortical)

    -   Introduce multi-receptor proteins and antagonists/partial agonists

Examples
--------

-   Multi-agonist protein (D1/D2/D3):

    -   zp aligned with zr(D1), zr(D2), zr(D3) → high c_osteo across all three

    -   efficacy heads output positive activation for each

    -   area alignment neutral (generalized effect)

-   Selective D2 blocker in mesolimbic:

    -   zp aligned with zr(D2) and with zl for mesolimbic receptor instances

    -   efficacy head for D2 outputs antagonism (negative/zero intrinsic activity)

    -   low alignment with zl of cortical D2 instances reduces off-target blocking

Allosteric and Biased Signaling
-------------------------------

-   Include rm (allosteric pathway vector) per receptor instance to capture bias:

    -   Proteins can learn to favor rm variants (e.g., β-arrestin-biased agonism)

    -   Composite compatibility B integrates c_allo to shape pathway-specific effects

Concentration and Dynamics
--------------------------

-   Represent concentration/state as a small vector appended to zp, letting the model adjust binding efficacy with dose.

-   Temporal ramps and refractory periods:

    -   Projected activity changes are rate-limited to avoid oscillations

    -   Spillover and saturation tracked for homeostatic feedback

Integration with Homeostasis
----------------------------

-   Local density ρ and sensitivity σ are governed by separate homeostasis networks conditioned on context (DMN state, neuromodulators).

-   The receptor module exposes:

    -   Bound fraction, activity S̄, saturation, and spillover metrics for feedback control

    -   Gradients for protein and receptor vectors to refine selectivity online

API Sketch
----------

-   bind(protein p, receptor r_instance, ctx) → {B, bound_frac, effect}

-   predict_effect(p, r_class, area, concentration, ctx) → activation/block level

-   train_step(batch) → updates protein/receptor/area vectors and heads

-   audit(p):

    -   Report top-k receptor classes and areas by B

    -   Plot predicted efficacy per class and per area

Practical Defaults
------------------

-   Latent dimension d: 64--256

-   Similarity: cosine with temperature, plus a bilinear term

-   Heads: small MLPs with LayerNorm and GELU

-   Regularization: L2 on vectors, margin losses for selectivity, temporal smoothness

-   Safety: hard ceilings on per-area activity; adversarial tests against off-target binding

Benefits
--------

-   Flexible key--lock: continuous embeddings capture shape, charge, and micro-dynamics without hand-coded rules.

-   Programmable polypharmacology: one protein can purposefully target multiple receptors or selectively block one.

-   Circuit precision: area-aware receptors enable mesolimbic vs cortical targeting analogous to drugs like amisulpride.

-   Trainable and auditable: explicit vectors and heads allow introspection, safety checks, and continual refinement.
-   


Affinity-Modulated Competitive Binding
======================================

Purpose

-   Allow proteins to explicitly encode binding priority over endogenous ligands (e.g., higher-than-dopamine affinity at D2).

-   Preserve graceful degradation: if no explicit affinity is provided, fall back to cosine-similarity-based competition.

Key Additions

-   Protein embedding with optional affinity neuron

    -   zp = [zshape; zstate; α] where:

        -   zshape ∈ R^d: ligand "shape/chemistry" vector (for orthosteric/allosteric geometry)

        -   zstate ∈ R^k: dose/conformation/state features

        -   α ∈ R or α ∈ R^{classes}: affinity modulator scalar(s)

            -   Scalar α: global affinity boost

            -   Vector α_c: per-receptor-class affinity boosts (e.g., α_D1, α_D2, α_D3)

-   Receptor instance embedding

    -   r = [zr; zl; rm] with:

        -   zr: class "shape" (e.g., D2)

        -   zl: location/area vector (e.g., mesolimbic)

        -   rm: pathway bias vector (allosteric/biased signaling)

Binding Score

-   Base compatibilities:

    -   c_osteo = cosine(zshape, zr) or bilinear(zshape, zr)

    -   c_loc = cosine(zshape, zl)

    -   c_allo = cosine(zshape, rm)

-   Affinity gate:

    -   If α present:

        -   a = α (global) or a = α_class[r.class] (class-specific)

    -   Else:

        -   a = 0 (fallback)

-   Composite pre-affinity score:

    -   S_base = w1-c_osteo + w2-c_loc + w3-c_allo

-   Affinity-modulated binding energy:

    -   S = S_base + wα-a

    -   Optional temperature scaling: S ← S / τ to control competition sharpness

Competitive Occupancy

-   For receptor instance r facing a set of candidate proteins P at current tick:

    -   Compute logits L_p = S_p (or S_p-dose_p) for all p ∈ P

    -   Binding probability:

        -   P_bind(p|r) = softmax_p(L_p)

    -   Bound fraction:

        -   bound_frac(p,r) = P_bind(p|r) - f(dose_p, ρ_r) with cap by density ρ_r

-   Fallback (no α for all proteins):

    -   Use L_p = S_base_p (pure cosine/bilinear-driven softmax)

Effect and Selectivity

-   Efficacy head receives [S, dose, ρ, σ, local μ] and predicts:

    -   agonist/partial agonist/neutral/antagonist sign and magnitude

-   Area selectivity is preserved via c_loc; a protein can have high α yet still miss non-target areas if c_loc is low.

Design Variants

-   Per-class vs. per-instance affinity:

    -   α_class grants family-level control (e.g., "boost D2 competitiveness everywhere")

    -   To mimic mesolimbic selectivity (e.g., amisulpride-like): rely on c_loc and keep α_class moderate, or introduce α_area-class[r.area, r.class] if you need direct circuit-level overrides

-   Safety clamps:

    -   Clip α into [αmin, αmax]

    -   Add regularizers to penalize large α unless justified by training signals

    -   Rate-limit changes in α over time to prevent oscillations

Training Objectives

-   Contrastive competition loss:

    -   For target (protein p, receptor r_target): maximize S_p - S_q for all q ≠ p competing at r_target

-   Selectivity margin:

    -   Enforce S_target - max S_offtarget ≥ m

-   Energy/off-target regularization:

    -   Penalize global α inflation and off-target binding mass

-   Curriculum:

    -   Start without α (pure cosine)

    -   Introduce global α

    -   Upgrade to class-specific α_c

    -   Optionally add circuit-aware α_area-class only if needed

Minimal API

-   score(p, r): returns S_base, S

-   compete(R, P): returns P_bind(p|r) for each r ∈ R, p ∈ P

-   predict_effect(p, r): uses bound_frac and efficacy head to produce postsynaptic activity

-   audit_affinity(p):

    -   Report α (global or per-class), top-k receptors by S, on/off-target margins

Notes

-   This scheme keeps cosine similarity as the universal fallback, ensuring compatibility with existing proteins that don't encode α.

-   Affinity is additive in score space; tuning wα and τ gives you precise control over how much α tilts competition versus geometric fit.

-   Combine with your area-encoded receptors to achieve drug-like circuit selectivity while maintaining interpretable knobs and strong safety constraints.