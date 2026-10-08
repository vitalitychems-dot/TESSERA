### Homeostasis

- Three learned maps per receptor type r in area a:

  - Density network: ρ̂r,a = fρ(ctx)

  - Sensitivity network: ŝr,a = fσ(ctx)

  - Release network at emitter e for NT n: r̂e,n = fr(ctx)

  - ctx can include: local NT levels, binding events, recent DMN node, neuromodulators μ, error signals, time-of-day, etc.

- Multi-scale efficiency:

  - Local biophysical efficiency: produce strong, well-modulated postsynaptic activity with minimal waste (low spillover, low unused capacity).

  - Mesoscale circuit efficiency: achieve stable, non-saturated dynamic range over time (no chronic ceiling/floor).

  - Cognitive (DMN) efficiency: improve downstream utility metrics (coherence, accuracy, safety, task reward, reduced uncertainty).

Define signaling efficiency (per tick t, per area a, receptor type r)
Let:

- B̄r,a: fraction of orthosteric sites effectively bound (0..1)

- S̄r,a: normalized postsynaptic activity from receptor NN after allosteric scaling (0..1)

- SatNTn,a: NT saturation at targets (fraction of NT beyond binding capacity)

- RangeUtilr,a: proportion of time recent S̄r,a stayed in a target operating window [θlow, θhigh]

- NoiseLeakr,a: activity explained by noise or unrelated inputs (proxy: variance unexplained by modeled inputs)

- EnergyCost: optional regularizer on release and density (L1/L2 on r̂ and ρ̂)

Local efficiency (per receptor type r, area a)
Efflocal = w1-S̄r,a + w2-RangeUtilr,a - w3-SatNTn,a - w4-NoiseLeakr,a - w5-EnergyCost

Aggregate locally across receptors and areas:
Efflocal_total = Σa Σr Efflocal(r,a)

DMN-informed cognitive efficiency (global)
Use live DMN metrics already computed in the loop:

- Coherence gain ΔC: improvement in coherence between successive thought states

- Task utility gain ΔU: change in task-aligned utility

- Uncertainty drop ΔH: reduction in epistemic uncertainty

- Safety compliance S: 1 - safety_penalty

- Calibration improvement ΔCal: reduced calibration gap
  Effcog = v1-ΔC + v2-ΔU + v3-ΔH + v4-S + v5-ΔCal

Overall signaling efficiency (to maximize)
Efftotal = α-Efflocal_total + β-Effcog

Optimization objective
You can minimize a loss L = -Efftotal with optional stabilizers:
L = -(α-Efflocal_total + β-Effcog) + λ1-Smooth(ρ̂, ŝ, r̂) + λ2-DriftPenalty + λ3-HomeostasisDeviation

- Smooth: penalize rapid changes (temporal derivative) to avoid instability.

- DriftPenalty: penalize long-term drift from physiological priors.

- HomeostasisDeviation: keep population averages in realistic ranges.

What to backprop through

- fρ, fσ, fr (the density, sensitivity, release NNs): use gradients from L.

- Optionally, allow the protein's modulate function hyperparameters to learn (e.g., phase in sin/cos, slope in tanh) if you parametrize them.

Which signals do you need?

- Not only NT saturation vs density. Include:

  - Bound/unbound ratios (B̄)

  - Postsynaptic activity S̄ and its variance

  - Operating-range utilization RangeUtil

  - Spillover/saturation SatNT

  - Allosteric context contribution

  - Energy cost proxies (release amount, receptor synthesis cost)

  - DMN global metrics (ΔC, ΔU, ΔH, S, ΔCal) pulled from your CFG-tagged nodes to attribute credit to neuromodulatory states that preceded those outcomes

Attribution across time (credit assignment)

- Use short eligibility traces linking recent homeostatic states (ρ̂, ŝ, r̂ at t-k..t) to DMN outcomes at t..t+K.

- Alternatively, use a learned critic that predicts Effcog from μ, receptor states, and CFG node, and backprop prediction error.

Minimal implementable formulae

Local metrics

- Binding fraction: B̄r,a = bound_sites / total_sites

- Saturation: SatNTn,a = max(0, NT_available - NT_bound_capacity) / NT_available

- Range utilization: RangeUtilr,a = time_in[θlow, θhigh] / window

- Noise leak (proxy): NoiseLeakr,a = Var(S̄r,a | inputs)residual / Var(S̄r,a)

DMN metrics (you already compute analogs)

- ΔC = C(t) - C(t-1)

- ΔU = U(t) - U(t-1)

- ΔH = H(t-1) - H(t)

- S = 1 - safety_penalty(t)

- ΔCal = CalGap(t-1) - CalGap(t)

Training loop sketch (pseudo)

- At each tick:

  1.  Forward: compute r̂, ρ̂, ŝ from homeostatic nets given ctx; simulate binding → S̄, B̄, SatNT.

  2.  Run DMN step; log DMN metrics (ΔC, ΔU, ΔH, S, ΔCal) with CFG node ID.

  3.  Compute Efflocal_total and Effcog; build L.

  4.  Backprop L into fρ, fσ, fr; apply temporal smoothing regularizers.

  5.  Update eligibility traces or critic to improve temporal credit assignment.

Do you need DMN introspection?

- Strongly recommended.

- Local-only objectives (saturation vs density) can stabilize biophysics but are blind to cognitive value.

- DMN introspection via CFG node meta-context lets the system learn which neuromodulatory profiles help different cognitive phases (e.g., more NE during 3.6 Salience; more 5HT during 3.11 Mind-wandering; DA bursts tied to exploitation or learning).

- Use the CFG node and μ snapshot as conditioning inputs to fρ, fσ, fr so the nets can learn phase-specific setpoints.

Practical tips

- Normalize all local terms to 0..1 before weighting; learn α, β via meta-optimization or keep priors.

- Start with β small (favor stability), then anneal upward to incorporate cognitive optimization.

- Constrain ρ̂, ŝ, r̂ with softplus or sigmoid ranges to avoid unbounded growth.

- Add a "safety clamp" on μ to prevent pathological neuromodulator states during training.

Compact loss example
L = -[α Σa,r (w1 S̄r,a + w2 RangeUtilr,a - w3 SatNTn,a - w4 NoiseLeakr,a - w5 EnergyCost)] - β (v1 ΔC + v2 ΔU + v3 ΔH + v4 S + v5 ΔCal) + λ1 ||Δθ||^2 + λ2 ||Δt θ||^2

Where θ are parameters of fρ, fσ, fr; Δt is temporal difference to enforce smoothness.

Bottom line

- Compute signaling efficiency as a weighted sum of local receptor-level efficiency and global DMN outcome efficiency.

- Backprop through density, sensitivity, and release networks using that composite objective.

- Include DMN introspection via CFG node and neuromodulator snapshots for phase-aware adaptation;
