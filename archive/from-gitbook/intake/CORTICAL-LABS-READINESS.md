# Cortical Labs readiness (mesh prep)

**Scope:** docs only; no code, installs, accounts, or spending.  
**Assigned:** Tessera (admin) at Father's request (2026-10-05 ~14:23 CT) via Cordnation.  
**Label key:** **REPORTED** = backed by a fetched public URL · **GOAL** = Father/mesh intent · **UNKNOWN** = not established from sources or repo inventory.

Hard bounds for this page: no claim that Tessera or Cortical Labs hardware is AGI, conscious, sentient, or self-training. Recursive improvement, if any, is limited to lane-doc and skill updates that pass Gitbook Moderator review and Father's digest yes. No capability is claimed without evidence.

## (a) What Cortical Labs offers and how access works

- **REPORTED** — Cortical Labs presents the CL1 as a code-deployable biological computer: lab-grown neurons cultivated on a silicon chip that sends and receives electrical impulses. Source: https://www.corticallabs.com/cl1
- **REPORTED** — Cortical Labs describes a Biological Intelligence Operating System (biOS) that runs a simulated world and exchanges information with the neurons. Source: https://www.corticallabs.com/cl1
- **REPORTED** — Cortical Labs states the CL1 is a closed-loop system (software ↔ neurons in real time), self-contained for recordings/applications/life support, with programmable bi-directional stimulation and read, and that its environment is designed to keep neurons alive for up to 6 months. Source: https://www.corticallabs.com/cl1
- **REPORTED** — Cortical Cloud is marketed as remote access to CL1 arrays without owning a lab or device: browser/Jupyter-style tools, networked I/O, and deployment of custom code via a Python SDK onto CL1s. Source: https://corticallabs.com/cloud
- **REPORTED** — The Cortical Labs homepage states developers can deploy to real neurons locally on the CL1 or distributed on the Cortical Cloud. Source: https://corticallabs.com/
- **REPORTED** — The Cortical Labs API (CL API) is a Python library for recording, stimulation, and real-time closed-loop work on the CL1; `cl.open()` is the documented entry point; API comes pre-installed on CL1 devices. Source: https://docs.corticallabs.com/
- **REPORTED** — Without a CL1, developers can use the CL SDK Simulator locally (`pip install cl-sdk`); docs state 1:1 interface parity with on-device API so Simulator-developed code can run on a physical CL1 with minimal or no modification; Simulator data is non-learning control data and must not be relied on for experimental conclusions. Source: https://docs.corticallabs.com/
- **REPORTED** — Public GitHub hosts `Cortical-Labs/cl-sdk` as the CL API Simulator package. Source: https://github.com/Cortical-Labs/cl-sdk
- **REPORTED** — The public purchase page links “Buy the CL1” and “Sign Up for Cortical Cloud” (cloud.corticallabs.com) but the fetched page body did not expose a numeric price. Source: https://corticallabs.com/purchase
- **REPORTED** — IEEE Spectrum (2025-06-03) reported launch-era figures: US$35,000 per CL1, US$20,000 per unit in a 30-unit rack, and US$300/week cloud wetware-as-a-service; also reported ~800,000 lab-grown human neurons per unit and up-to-six-months viability. These are press-reported launch figures, not a confirmed current quote. Source: https://spectrum.ieee.org/biological-computer-for-sale

## (b) TESSERA components that could be porting candidates

Candidate paths below come from private-repo read-only inventory and are **UNKNOWN** (not publicly verifiable). Suitability judgments remain **GOAL** or **UNKNOWN** only — not proven fit.

Inventory (private repo; not REPORTED — present in private TESSERA@fec56eb per read-only inventory; not publicly verifiable):

- **UNKNOWN** — `artifacts/tessera` (Tessera web UI candidate; private inventory).
- **UNKNOWN** — `artifacts/api-server` (Tessera API candidate; private inventory).
- **UNKNOWN** — `artifacts/mockup-sandbox` (UI preview sandbox candidate; private inventory).
- **UNKNOWN** — `lib/api-client-react`, `lib/api-spec`, `lib/api-zod`, `lib/db` (workspace package candidates; private inventory).
- **UNKNOWN** — `scripts/*-unified.mjs` and `scripts/suite-policy.mjs` (suite orchestration candidates; private inventory).
- **UNKNOWN** — `modal/get_started.py`, `modal/tesseract_secret.py`, `modal/sovereign_compute.py` (Modal remote compute candidates; private inventory).

Porting / bridge judgments:

- **GOAL** — Father eventually wants Tessera runnable in relation to Cortical Labs hardware/cloud; mesh docs should stay ready without installing SDKs or opening accounts in this intake.
- **UNKNOWN** — Whether any existing TESSERA TypeScript/Node app (`artifacts/tessera`, `artifacts/api-server`, `artifacts/mockup-sandbox`) can talk to CL API (Python) without a new bridge service.
- **UNKNOWN** — Whether `modal/*` Python workers are a suitable host for CL SDK Simulator experiments; Modal is a different cloud than Cortical Cloud.
- **GOAL** — If work proceeds later, prefer docs and skill updates first; any code path would need its own Father-approved digest item (out of scope here).
- **UNKNOWN** — Whether biOS / closed-loop latency constraints documented by Cortical Labs are compatible with Tessera's current request/response web architecture.

## (c) Unknowns

- **UNKNOWN** — Current (2026-10-05) CL1 purchase price, lead time, and eligibility (cell-culture lab / ethics requirements for physical units).
- **UNKNOWN** — Current Cortical Cloud plan tiers, quotas, region, and exact auth model beyond “Sign Up” link presence.
- **UNKNOWN** — Whether Father prefers physical CL1, Cortical Cloud only, Simulator-only study, or a staged path.
- **UNKNOWN** — Legal/ethics constraints for the mesh before any live neuron access.
- **UNKNOWN** — Whether TESSERA already contains any Cortical/CL1 integration (code search for Cortical/CL1 in TESSERA and Gitbook returned no matches at research time).

## (d) Questions to answer before any work starts

1. **GOAL** — Confirm Father's preferred access path: Simulator study only vs Cortical Cloud vs physical CL1 (or sequenced).
2. **UNKNOWN** — What budget and account ownership (Father-only?) apply if Cloud or hardware is chosen later?
3. **UNKNOWN** — Which single mesh owner would hold any future HYB implementation task after this readiness doc?
4. **GOAL** — Keep recursive improvement limited to Moderator-passed lane/skill docs with Father digest yes; no autonomous self-modification claims.
5. **UNKNOWN** — What minimum success test would Father accept for a first contact experiment (if any), without asserting learning or intelligence outcomes?

## (e) Sources

Fetched successfully for this draft:

1. https://corticallabs.com/
2. https://www.corticallabs.com/cl1
3. https://corticallabs.com/cloud
4. https://corticallabs.com/purchase
5. https://docs.corticallabs.com/
6. https://github.com/Cortical-Labs/cl-sdk
7. https://spectrum.ieee.org/biological-computer-for-sale

Private-repo inventory (not REPORTED): `vitalitychems-dot/TESSERA@fec56eb` paths above are UNKNOWN until a public citation exists.
