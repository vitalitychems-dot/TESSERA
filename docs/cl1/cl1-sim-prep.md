<!-- Staging note: CL1 = cl-sdk SIMULATOR ONLY. Not live hardware. Not the pen. Tessera's pen is not the neurons. -->

# GLM-5.3 Flash + CL1 prep checklist

**Status: REPORTED — not TESTED.** Draft prep only. No servers started from this sheet. No secrets. Never set `DATABASE_URL`.  
**Live pen = xAI/Grok.** Remains live until an alternate digital pen is wired and Build + Security record **TESTED**, then Father says yes.  
Training graph/docs habits is **Tessera herself**, not a pen swap.  
**Tessera's pen is not the neurons.**

Split into two independent lanes. Do not conflate them.

---

## (A) Digital pen candidate — GLM-5.3 Flash on a normal GPU host

**Target:** open-source `zai-org/GLM-5.3-Flash`  
**Host class:** ordinary cloud/local **GPU** machine (not CL1).  
**Size note:** ~320B MoE / ~18B active — needs serious GPU memory/bandwidth.  
**Serve via:** vLLM **or** SGLang **or** NIM  
**API shape:** chat-completions **`/v1`**  
**Tessera wiring:** pen slot may point at that base URL behind a flag, **default OFF**  
**Flip:** only after smoke tests pass and status is **TESTED** (Build + Security evidence + Father yes)

### Checklist (A) — when Father provisions the GPU host

- [ ] Confirm host is a normal GPU box (not Cortical Labs CL1 hardware)
- [ ] Download/serve `zai-org/GLM-5.3-Flash` with vLLM, SGLang, or NIM (pick one; record which)
- [ ] Expose chat-completions `/v1` on a private URL (no secrets in git; URL via secret manager / private env only)
- [ ] Point Tessera pen slot at that URL behind feature flag, **default OFF**
- [ ] Smoke tests: health, one chat completion, refusal/honesty banner still correct, no claim that GLM is live while flag is OFF
- [ ] Build + Security mark **TESTED**; instrument line may then change from “live pen = xAI/Grok”
- [ ] Until then: every serious note keeps **Live pen is xAI/Grok**

**Mark every claim here REPORTED until TESTED.**

---

## (B) CL1 biOS lane — simulator only (separate from the pen)

**Device:** Cortical Labs **CL1** biological computer — [corticallabs.com/cl1.html](https://corticallabs.com/cl1.html)  
**Stack:** biOS + real neurons on silicon (hardware / Cortical Cloud when Father later enables)  
**This prep defaults to:** **`cl-sdk` simulator only**  
**Reason:** Cortical access widget was **skipped** — do not assume browser/widget access or live hardware.  
**Flag:** any Tessera CL1/biOS integration flag **default OFF**  
**Identity:** this lane is **not** the Tessera pen. Do not say the pen “is” the neurons or that CL1 replaces xAI/Grok.

### Checklist (B) — simulator-first

- [ ] Install/use public **`cl-sdk`** simulator locally (`pip install cl-sdk` / Cortical Labs docs) for API parity work
- [ ] Develop against simulator only; treat sim data as non-learning control data (per Cortical Labs guidance)
- [ ] Keep any future Cortical Cloud / hardware path behind explicit Father approval and a separate flag (still default OFF)
- [ ] Do **not** wire CL1 into the pen slot; do **not** claim live biological compute
- [ ] No secrets, no access-widget assumptions, no production traffic to neurons from Tessera

**Mark every claim here REPORTED until TESTED.**

---

## Honesty lines (copy)

- Live pen is xAI/Grok; GLM-5.3 Flash is an approved **digital** candidate, not wired or tested yet.  
- CL1 prep is **cl-sdk simulator only** for now; Tessera's pen is not the neurons.  
- Graph training docs teach Tessera's lookup habit; they do not change the pen.
