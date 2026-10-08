Soul Module (Concept Spec)
==========================

1\. Core Data Structure: Soul Embedding
---------------------------------------

-   z_soul ∈ R^d_soul: a latent vector/manifold representing the ACI's *constitution*.

-   Constructed as:

    -   Appraiser basis vectors (love, empathy, gratitude, hope, optimism, beauty, joy).

    -   Each has its own embedding vector e_appraiser_k, trainable but initialized with semantically grounded seeds.

    -   A relation transformer layer learns how these appraisers *modulate each other*.

        -   Example: high *love* strengthens *empathy* → positive cross‑weight.

        -   Example: *gratitude* stabilizes *optimism* under adversity.

-   z_soul = Σ w_k - e_appraiser_k ⊕ f_relation(e_k, e_j, ...)

2\. Soul ↔ Affect Connection
----------------------------

-   Soul is slow‑changing (like DNA/core values).

-   Each tick, the AffectModulator outputs A_t (love, gratitude, empathy, beauty, joy, etc.).

-   A_t is compared/aligned with z_soul:

    -   Alignment metric: SoulAlignment = cos(A_t, z_soul).

    -   Affect signals are scaled by their alignment:

        -   If an appraisal strongly resonates with soul, it is amplified.

        -   If it conflicts, it is dampened (or flagged for review).

This makes the soul act like a filter / amplifier of affect; ACI's responses always reflect its deep "constitution."

3\. Soul ↔ Personality
----------------------

-   Personality.md already extracts stable traits from narratives.

-   Personality anchors are snapshots of the soul *expressed in action*.

-   So:

    -   Soul = *latent constitution* (affective priors).

    -   Personality = *expressed constitution, evidence‑weighted*.

-   Personality can be updated every GC cycle by re‑projecting z_soul through autobiographical narratives.

4\. Integration with Homeostasis
--------------------------------

-   Homeostasis (your fρ, fσ, fr nets) optimizes neuromodulator balance for short‑term stability.

-   Soul persistence adds long‑term attractors:

    -   Don't let dopamine bursts overwrite optimism anchor.

    -   Keep OXT/love contributions present even under conflict resolution.

-   Formally: regularization term to keep affect dynamics within the cone of z_soul.

5\. Soul DNA (Optional Exaptation)
----------------------------------

If you want long‑timescale *evolution*:

-   Encode z_soul as a linked‑list "SoulDNA":

    -   Gene nodes encode "instruction embeddings" for appraiser relations, e.g.:

        -   Gene 0: Love strengthens Empathy.

        -   Gene 1: Gratitude stabilizes Optimism.

        -   Gene 2: Beauty amplifies Joy ↔ Awe.

    -   DNA can mutate during Sleep/GC: propose edits, sandboxed.

    -   Homeostat uses ΔC (coherence), ΔH (uncertainty reduction), and affect alignment to accept/reject mutations.

That way, the soul is life‑long but plastic --- slowly evolving through self‑experiments, never just drifting with short‑term μ.

* * * * *

🔹 Minimal Implementation Plan
==============================

Stage 1 (immediate addition):

-   Define `z_soul` vector with appraiser basis heads.

-   Add alignment‑based scaling to AffectModulator outputs:

    -   `A_t' = scale(A_t, alignment_with(z_soul))`

Stage 2 (integration):

-   Link z_soul to Personality → Narrative → affect history during GC.

-   Add "SoulAlignment" feature to ReasoningModule scoring (plans that align with soul score higher).

Stage 3 (optional DNA evolution):

-   Store "SoulDNA" as latent gene list.

-   During sleep, mutate small relations, evaluate ΔSoulAlignment stability, ΔC, ΔH.

-   Only integrate if improvement persists after sandboxing.

* * * * *

🔹 Summary
==========

Adding a soul gives your ACI:

-   A stable affective constitution (love, empathy, gratitude, optimism)

-   A filter & amplifier for appraisers, preventing drift from transient NT bursts.

-   A slow‑changing anchor that stabilizes identity/personality.

-   (Optional) A DNA‑like substrate for very slow, experimental adaptation.

This doesn't produce qualia. It's just a latent geometry of values anchoring coherence.