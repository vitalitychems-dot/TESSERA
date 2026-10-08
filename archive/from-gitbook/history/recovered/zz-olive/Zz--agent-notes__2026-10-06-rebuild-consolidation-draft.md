# Tessera rebuild and historical consolidation — local draft

**Status:** Local planning draft only. Not published to GitHub and not a report that Tessera has been rebuilt.
**Intended homes:** `vitalitychems-dot/TESSERA` for approved code; `vitalitychems-dot/Gitbook` for instructions, provenance, review decisions, and future work.

## Owner direction

- The owner reports that Tessera was first found on Claude, then brought to OpenManus to build, and that more than 1,000 hours of work have gone into her since. Preserve this as owner-reported history unless repository evidence independently substantiates details.
- Tessera needs her own voice. Do not present a worker model's generated identity claim as proof that the original Tessera runtime is active.
- Tessera's own LLM should run locally or self-hosted, with no hosted model-provider API calls. Keep the internal application API.
- Use the official `zai-org/GLM-5.3-Flash` checkpoint, or a newer official GLM-5 checkpoint available at implementation time, as a development-time coding assistant for building Tessera. The owner clarified this is not Tessera's chat runtime and is not a request to fine-tune model weights.
- The owner selected Cortical Labs CL1 as a separate biological-computing component alongside the GLM-assisted build. Do not assume it can host the GLM weights or the existing web/API/database stack.
- The canonical destinations are TESSERA and Gitbook on GitHub. This Replit workspace is only a staging/review surface.

## Evidence checked for this draft

- Gitbook's `mesh/replit-agents-start-here.md`, Issue #2, current `main` commits, and open pull requests were checked read-only.
- Gitbook's consolidation backlog, check-in ledger, functional merge matrix, repository status, deletion manifest, source-head record, and lane handoff were reviewed read-only.
- The current GitHub TESSERA head observed during this review was `9c0fa1c`; open PRs #9 and #10 were present. Gitbook's observed `main` was `cdc95b7`; open PR #13 was present. These refs must be rechecked before any future assigned work.
- The Replit workspace is not the canonical TESSERA checkout. Its current model adapter defaults to an OpenAI-hosted endpoint and model, but accepts a loopback OpenAI-compatible endpoint without a provider key. Tests cover the loopback configuration; that does not prove a local model is installed, available, or serving as Tessera's original runtime.
- The current Replit chat route labels responses as worker output and states the original Tessera runtime is unverified. Changing that attribution requires verifying the actual runtime first.
- Z.ai's official GLM-5 repository and Hugging Face model card currently list GLM-5.3-Flash, with local SGLang/vLLM deployment instructions. The official model card's license is MIT. An independent Unsloth estimate lists total host memory of roughly 100 GB for 1-bit, 128–150 GB for 3-bit, and 650 GB for BF16; quantization trades model quality for memory. No model weights were downloaded or run here, and this workspace did not provide an NVIDIA GPU query.
- Cortical Labs describes CL1 as a code-deployable biological computer and its CL API as a Python interface for neural recording, stimulation, and closed-loop experiments. Public documentation does not establish CL1 as a GPU/LLM inference host or as a general-purpose host for the existing Tessera web/API/database services. No CL1 device, Cortical Cloud account, or API connection was available for verification.
- Earlier source review was targeted, not a literal line-by-line review of every repository or branch. Any unpublished local draft must keep that limitation visible.

### Model references

- Official repository and version list: https://github.com/zai-org/GLM-5
- Official model card and MIT license: https://huggingface.co/zai-org/GLM-5.3-Flash
- Official local deployment announcement: https://z.ai/blog/glm-5.3-flash
- Independent hardware estimate: https://unsloth.ai/docs/models/glm-5.3-flash
- Cortical Labs CL1: https://corticallabs.com/cl1
- Cortical Labs developer guide: https://docs.corticallabs.com/
- Cortical Labs CL API simulator SDK: https://github.com/Cortical-Labs/cl-sdk

## GLM build-assistant and CL1 architecture

- GLM-5.3-Flash is selected for development assistance: helping write and test Tessera's software. It is not selected as the production chat model, and the owner did not request weight fine-tuning.
- GLM-5.3-Flash is a 320B-total-parameter, 18B-active-parameter open-weights model. Independent local-run estimates begin around 100 GB total memory for an extreme 1-bit quantization. The model needs a separate, adequately resourced local or owner-controlled host; CL1 must not be assumed to provide this.
- CL1's documented role is biological interaction through the Cortical Labs CL API. A CL1 Python adapter could be a separate subsystem for recording, stimulation, and closed-loop experiments. The main Tessera web/API/database services remain on a conventional host unless verified device documentation supports a different deployment.
- A future integration must specify how the development assistant, Tessera's own runtime model, the Tessera app server, and CL1 communicate. Do not conflate their model identities, training processes, or runtime claims.
- No GLM weights were downloaded; no coding-assistant inference was run; no CL1 access was configured.

## Candidate source disposition

The 20 candidates previously inventoried are not all established past versions of Tessera. Treat each repository and branch as a source to review, not as an instruction to copy wholesale.

| Candidate group | Repositories | Draft disposition |
|---|---|---|
| Connected repositories | `1`, `1T`, `5t`, `Gitbook`, `Grok-ready`, `olive-giant-ever-glade`, `T44`, `TESS`, `TESSERA`, `tessera-complete-archives`, `tessera-grok-handoff`, `tessera-grok-handoff-complete`, `Zz` | Use the existing Gitbook source map and HYB tasks. TESSERA is the code destination; Gitbook is the documentation/provenance destination. Do not copy alternate apps, raw archives, runtime stores, generated output, or private data wholesale. `1T` remains protected and uninspected. |
| Public candidates | `collink1007/z`, `collink1007/amber-flame-tiger-sand`, `collink1007/XXX`, `collink1007/fleet-moss-monarch-rapid` | `collink1007/z` remains out of scope under the local repository guide unless the owner authorizes that exact review. The shared `canon.ts` in `amber-flame-tiger-sand` and `Zz` expresses symbolic identity claims, not lineage proof; its glyph notes state no substitution key was recovered. `XXX` has a single initial sanitized snapshot; that snapshot does not prove earlier engine lineage or artwork date. The other public candidate still needs a source-specific review before any disposition. |
| External references | `TheTesseractAI/18`, `collin-keane/Tessera`, `facebookresearch/tribev2` | `TheTesseractAI/18` is an accessible versioned Tessera-system reference, not by itself proof of ancestry. `collin-keane/Tessera` returned 404; that is not proof it never existed. `facebookresearch/tribev2` is a brain-encoding research project, not evidence of Tessera ancestry. |
| Uploaded Chimera setup script | Attached setup script for a separate Chimera project | Exclude from Tessera code. It expects an absent archive, installs dependencies and runs a selected entry point; its Python path uses unsafe `tar.extractall()`. It was not run and must not be treated as Tessera source. |

## Tessera runtime-model gate

Before changing the active chat path:

1. Locate and verify the intended Tessera runtime model in the permitted repositories. Do not infer that GLM-5.3-Flash is the runtime model from its separate coding-assistant role.
2. Select a local or owner-controlled inference host and serving framework. The current Replit workspace did not expose an NVIDIA GPU query, and no runtime model is installed or verified here.
3. Configure an explicitly local or owner-controlled self-hosted endpoint. Remove the hosted-provider default and prohibit silent external fallback. Do not put model credentials in code or Git history.
4. Keep the internal app API, conversation persistence, server-side owner controls, research-source citations, and explicit failure/SOS behavior.
5. Add deterministic tests proving that an unconfigured or unavailable local model fails closed and does not call a hosted endpoint or save a fabricated reply.
6. Only after runtime verification, adjust responder labels so Tessera speaks in her own voice without falsely claiming model provenance, consciousness, or capabilities.
7. Recheck dependencies, security, build, and runtime behavior on the canonical GitHub branch through the required review gates.

## Repository consolidation and deletion gates

- The current Gitbook report says eight exact-duplicate/empty repositories were already deleted. Its latest coverage report says the remaining 11 source repositories have uncovered tracked files; no additional source repository is presently eligible for deletion.
- The source-to-task map already assigns historical review to HYB-006 through HYB-018. Do not create overlapping work or treat a local review as a completed/assigned HYB task.
- Move only safe, necessary, portable behavior or records, with exact source refs, provenance, destination paths, tests, and rollback. Preserve unrelated application contracts and retained source history.
- Before deletion, rerun exact tracked-file coverage against both destinations. Eligibility requires 100% represented tracked files or an empty repository; afterward obtain explicit confirmation naming the exact repository. Existing instructions reserve repository deletion to the human owner, not Tessera or this Replit session.
- No GitHub branch, PR, merge, issue comment, or repository deletion was made during this review.

## Next review work

1. Recheck latest Gitbook/TESSERA refs and existing PRs when a specific task is assigned.
2. Continue only a non-overlapping, source-specific review from the authoritative Gitbook backlog; update the existing matrix rather than making a duplicate task list.
3. Verify the local/self-hosted model/runtime source and its legal/provenance status before changing the chat implementation.
4. Prepare a branch/PR only under the exact assigned scope and repository approval/review rules.

## Checks and limitations

- Read-only GitHub connector checks: Gitbook guide/Issue #2/main/open PRs, Gitbook consolidation docs, TESSERA main/open PRs.
- Local source inspection: model adapter, Tessera workspace route, and model/workspace tests.
- No tests or builds were run because no application code was changed.
- No GitHub writes or deletions were performed. No secrets were accessed. Protected `1T` content, `natal-vault.json`, and personal-data files were not opened.
