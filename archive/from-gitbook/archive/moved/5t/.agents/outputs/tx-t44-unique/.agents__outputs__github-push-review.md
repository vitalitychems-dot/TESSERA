# GitHub Push and Duplicate-File Review

**Status:** Review only. No files deleted and nothing pushed.

## Repository state

- Current branch: `main`
- Commit history length: 490 commits
- GitHub remote: not configured.
- Requested target: `T3`; no exact accessible repository was found. Please provide its owner/repository or URL.
- A fresh sanitized snapshot would avoid publishing the current history and leave the local branch unchanged.

## Candidate files to exclude or review, file by file

These are path-only findings. No file contents or credential values were copied into this report. “Historical only” means the path appears in Git history but is not in the current tracked tree.

- Agent/local tooling — review/exclude from app source snapshot: 370 paths
- Local runtime/private state — exclude: 1 paths
- Credential-like path — inspect and exclude if sensitive: 13 paths
- User-uploaded asset — review before publishing: 210 paths
- Project instructions may include private operator context — review/redact: 1 paths

- `.agents/memory/MEMORY.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/memory/agent-identity-boundary.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/agent-tools/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/agent-tools/references/app-discovery.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/agent-tools/references/authentication.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/agent-tools/references/cli-reference.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/agent-tools/references/running-apps.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/audit-website/README.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/audit-website/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/audit-website/agents/openai.yaml` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/audit-website/assets/icon-large.png` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/audit-website/assets/icon-small.svg` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/audit-website/references/OUTPUT-FORMAT.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/better-auth-best-practices/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/brainstorming/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/brainstorming/scripts/frame-template.html` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/brainstorming/scripts/helper.js` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/brainstorming/scripts/server.cjs` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/brainstorming/scripts/start-server.sh` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/brainstorming/scripts/stop-server.sh` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/brainstorming/spec-document-reviewer-prompt.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/brainstorming/visual-companion.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/browser-use/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/browser-use/references/cdp-python.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/browser-use/references/multi-session.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/copywriting/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/copywriting/evals/evals.json` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/copywriting/references/copy-frameworks.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/copywriting/references/natural-transitions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/find-skills/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/frontend-design/LICENSE.txt` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/frontend-design/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/async-patterns.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/bundling.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/data-patterns.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/debug-tricks.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/directives.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/error-handling.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/file-conventions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/font.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/functions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/hydration-error.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/image.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/metadata.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/parallel-routes.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/route-handlers.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/rsc-boundaries.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/runtime-selection.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/scripts.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/self-hosting.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/next-best-practices/suspense-boundaries.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/LICENSE.txt` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/forms.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/reference.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/scripts/check_bounding_boxes.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/scripts/check_fillable_fields.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/scripts/convert_pdf_to_images.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/scripts/create_validation_image.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/scripts/extract_form_field_info.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/scripts/extract_form_structure.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/scripts/fill_fillable_fields.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pdf/scripts/fill_pdf_form_with_annotations.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/LICENSE.txt` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/editing.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/pptxgenjs.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/__init__.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/add_slide.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/clean.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/helpers/__init__.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/helpers/merge_runs.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/helpers/simplify_redlines.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/pack.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-chart.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-chartDrawing.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-diagram.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-lockedCanvas.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-main.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-picture.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-spreadsheetDrawing.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/dml-wordprocessingDrawing.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/pml.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-additionalCharacteristics.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-bibliography.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-commonSimpleTypes.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-customXmlDataProperties.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-customXmlSchemaProperties.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-documentPropertiesCustom.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-documentPropertiesExtended.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-documentPropertiesVariantTypes.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-math.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/shared-relationshipReference.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/sml.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/vml-main.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/vml-officeDrawing.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/vml-presentationDrawing.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/vml-spreadsheetDrawing.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/vml-wordprocessingDrawing.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/wml.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ISO-IEC29500-4_2016/xml.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ecma/fouth-edition/opc-contentTypes.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ecma/fouth-edition/opc-coreProperties.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ecma/fouth-edition/opc-digSig.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/ecma/fouth-edition/opc-relationships.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/mce/mc.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/microsoft/wml-2010.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/microsoft/wml-2012.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/microsoft/wml-2018.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/microsoft/wml-cex-2018.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/microsoft/wml-cid-2016.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/microsoft/wml-sdtdatahash-2020.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/schemas/microsoft/wml-symex-2015.xsd` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/soffice.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/unpack.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/validate.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/validators/__init__.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/validators/base.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/validators/docx.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/validators/pptx.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/office/validators/redlining.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/pptx/scripts/thumbnail.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/3d.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/animations.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/assets.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/assets/charts-bar-chart.tsx` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/assets/text-animations-typewriter.tsx` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/assets/text-animations-word-highlight.tsx` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/audio-visualization.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/audio.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/calculate-metadata.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/can-decode.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/charts.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/compositions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/display-captions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/extract-frames.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/ffmpeg.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/fonts.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/get-audio-duration.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/get-video-dimensions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/get-video-duration.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/gifs.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/images.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/import-srt-captions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/light-leaks.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/lottie.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/maps.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/measuring-dom-nodes.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/measuring-text.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/parameters.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/sequencing.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/sfx.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/silence-detection.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/subtitles.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/tailwind.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/text-animations.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/timing.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/transcribe-captions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/transitions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/transparent-videos.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/trimming.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/videos.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/remotion-best-practices/rules/voiceover.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/seo-audit/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/seo-audit/evals/evals.json` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/seo-audit/references/ai-writing-detection.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/_contributing.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/_sections.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/_template.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/conn-limits.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/conn-pooling.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/data-batch-inserts.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/data-pagination.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/data-upsert.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/lock-advisory.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/lock-short-transactions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/lock-skip-locked.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/query-composite-indexes.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/query-covering-indexes.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/query-index-types.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/query-missing-indexes.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/query-partial-indexes.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/schema-constraints.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/schema-data-types.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/schema-partitioning.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/schema-primary-keys.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/security-privileges.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/security-rls-basics.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/supabase-postgres-best-practices/references/security-rls-performance.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/_sync_all.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/app-interface.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/charts.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/colors.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/design.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/draft.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/google-fonts.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/icons.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/landing.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/products.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/react-performance.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/angular.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/astro.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/flutter.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/html-tailwind.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/jetpack-compose.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/laravel.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/nextjs.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/nuxt-ui.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/nuxtjs.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/react-native.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/react.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/shadcn.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/svelte.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/swiftui.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/threejs.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/stacks/vue.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/styles.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/typography.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/ui-reasoning.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/data/ux-guidelines.csv` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/scripts/core.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/scripts/design_system.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/ui-ux-pro-max/scripts/search.py` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/AGENTS.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/README.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/metadata.json` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/rules/_sections.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/rules/_template.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/rules/architecture-avoid-boolean-props.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/rules/architecture-compound-components.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/rules/patterns-children-over-render-props.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/rules/patterns-explicit-variants.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/rules/react19-no-forwardref.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/rules/state-context-interface.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/rules/state-decouple-implementation.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-composition-patterns/rules/state-lift-state.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/AGENTS.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/README.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/metadata.json` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/_sections.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/_template.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/advanced-effect-event-deps.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/advanced-event-handler-refs.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/advanced-init-once.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/advanced-use-latest.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/async-api-routes.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/async-cheap-condition-before-await.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/async-defer-await.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/async-dependencies.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/async-parallel.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/async-suspense-boundaries.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/bundle-barrel-imports.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/bundle-conditional.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/bundle-defer-third-party.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/bundle-dynamic-imports.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/bundle-preload.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/client-event-listeners.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/client-localstorage-schema.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/client-passive-event-listeners.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/client-swr-dedup.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-batch-dom-css.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-cache-function-results.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-cache-property-access.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-cache-storage.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-combine-iterations.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-early-exit.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-flatmap-filter.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-hoist-regexp.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-index-maps.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-length-check-first.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-min-max-loop.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-request-idle-callback.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-set-map-lookups.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/js-tosorted-immutable.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-activity.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-animate-svg-wrapper.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-conditional-render.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-content-visibility.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-hoist-jsx.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-hydration-no-flicker.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-hydration-suppress-warning.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-resource-hints.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-script-defer-async.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-svg-precision.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rendering-usetransition-loading.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-defer-reads.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-dependencies.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-derived-state-no-effect.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-derived-state.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-functional-setstate.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-lazy-state-init.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-memo-with-default-value.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-memo.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-move-effect-to-event.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-no-inline-components.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-simple-expression-in-memo.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-split-combined-hooks.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-transitions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-use-deferred-value.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/rerender-use-ref-transient-values.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/server-after-nonblocking.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/server-auth-actions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/server-cache-lru.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/server-cache-react.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/server-dedup-props.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/server-hoist-static-io.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/server-no-shared-module-state.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/server-parallel-fetching.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/server-parallel-nested-fetching.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-best-practices/rules/server-serialization.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/AGENTS.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/README.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/metadata.json` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/_sections.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/_template.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/animation-derived-value.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/animation-gesture-detector-press.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/animation-gpu-properties.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/design-system-compound-components.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/fonts-config-plugin.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/imports-design-system-folder.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/js-hoist-intl.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/list-performance-callbacks.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/list-performance-function-references.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/list-performance-images.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/list-performance-inline-objects.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/list-performance-item-expensive.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/list-performance-item-memo.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/list-performance-item-types.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/list-performance-virtualize.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/monorepo-native-deps-in-app.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/monorepo-single-dependency-versions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/navigation-native-navigators.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/react-compiler-destructure-functions.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/react-compiler-reanimated-shared-values.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/react-state-dispatcher.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/react-state-fallback.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/react-state-minimize.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/rendering-no-falsy-and.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/rendering-text-in-text-component.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/scroll-position-no-state.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/state-ground-truth.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/ui-expo-image.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/ui-image-gallery.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/ui-measure-views.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/ui-menus.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/ui-native-modals.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/ui-pressable.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/ui-safe-area-scroll.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/ui-scrollview-content-inset.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/vercel-react-native-skills/rules/ui-styling.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `.agents/skills/web-design-guidelines/SKILL.md` — Agent/local tooling — review/exclude from app source snapshot; present in current tracked tree.
- `artifacts/api-server/.local-data/natal-vault.json` — Local runtime/private state — exclude; present in current tracked tree.
- `artifacts/api-server/src/routes/secret-knowledge.ts` — Credential-like path — inspect and exclude if sensitive; present in current tracked tree.
- `artifacts/tessera/src/components/SourcedSecretsPanel.tsx` — Credential-like path — inspect and exclude if sensitive; present in current tracked tree.
- `artifacts/tessera/src/lib/colonial-tokens.ts` — Credential-like path — inspect and exclude if sensitive; present in current tracked tree.
- `artifacts/tessera/src/pages/AgentSecretsPage.tsx` — Credential-like path — inspect and exclude if sensitive; historical only.
- `artifacts/tessera/src/pages/CredentialsPage.tsx` — Credential-like path — inspect and exclude if sensitive; present in current tracked tree.
- `artifacts/tessera/src/pages/KnowledgeSecretsPage.tsx` — Credential-like path — inspect and exclude if sensitive; historical only.
- `artifacts/tessera/src/pages/LiveSecretKnowledgePage.tsx` — Credential-like path — inspect and exclude if sensitive; historical only.
- `artifacts/tessera/src/pages/SecretKnowledgePage.tsx` — Credential-like path — inspect and exclude if sensitive; present in current tracked tree.
- `artifacts/tessera/src/pages/SecretSocietyPage.tsx` — Credential-like path — inspect and exclude if sensitive; historical only.
- `artifacts/tessera/src/pages/SecretsPage.tsx` — Credential-like path — inspect and exclude if sensitive; historical only.
- `artifacts/tessera/src/pages/SovereignSecretsPage.tsx` — Credential-like path — inspect and exclude if sensitive; historical only.
- `artifacts/tessera/src/pages/TokenEconomyPage.tsx` — Credential-like path — inspect and exclude if sensitive; present in current tracked tree.
- `attached_assets/3_9_1776105526328.zip` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1274_1776113968508.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1275_1776113968508.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1276_1776123050427.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1278_1776123050427.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1279_1776123050427.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1280_1776123031713.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1280_1776124441801.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1281_1776124441801.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1306_1776136041201.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1307_1776136041201.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1319_1776179307417.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1320_1776179307417.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1324_1776180277671.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1324_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1325_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1326_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1327_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1328_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1329_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1330_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1331_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1332_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1333_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1334_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1334_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1335_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1335_1776183607983.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1335_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1336_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1336_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1337_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1338_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1338_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1339_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1339_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1340_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1340_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1341_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1341_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1342_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1342_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1343_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1343_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1344_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1344_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1345_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1345_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1346_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1346_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1347_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1347_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1348_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1348_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1349_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1349_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1350_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1350_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1351_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1351_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1352_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1353_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1353_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1354_1776183506459.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1354_1776184673299.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1356_1776185394359.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1357_1776185394359.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1361_1776190308657.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1362_1776190308657.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1363_1776190308657.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1364_1776190308657.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1365_1776190308657.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1366_1776190308656.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1367_1776190308656.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1369_1776190606743.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1370_1776190606743.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1374_1776196862440.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1375_1776196862440.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1376_1776197457959.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1376_1776197471083.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1377_1776197457959.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1377_1776197471083.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1378_1776197457959.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1378_1776197471083.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1379_1776197457959.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1379_1776197471083.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1380_1776197471083.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1381_1776197471083.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1388_1776221292890.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1391_1776223798819.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1397_1776279840713.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1398_1776280314353.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1424_1776299939241.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1425_1776299939241.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1426_1776299939241.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1427_1776299939241.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1428_1776299939241.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1430_1776299939241.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1431_1776299939241.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1434_1776301706065.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1435_1776302129400.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1436_1776302202125.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1438_1776302445536.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1439_1776302490630.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1439_1776302940335.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1440_1776302940335.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1441_1776302940335.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1442_1776302940334.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1444_1776303116005.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1448_1776303872731.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1449_1776303872731.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1450_1776303872731.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1451_1776303872731.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1458_1776306333912.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1461_1776308524864.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1462_1776308524864.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1463_1776308524864.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1464_1776308524864.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1464_1776310429851.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1466_1776310429851.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1467_1776310429851.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1468_1776310429851.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1469_1776310429851.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1470_1776310429851.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1473_1776312078577.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1474_1776312493647.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1476_1776313313298.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1477_1776313313298.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1478_1776330275710.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1479_1776330275710.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1480_1776330275710.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1483_1776349794605.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1484_1776349794605.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1500_1776353667219.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1503_1776361540537.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1507_1776362198845.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1508_1776362198845.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1509_1776362198845.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1510_1776362198845.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1511_1776362198845.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1512_1776362198845.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1514_1776362198845.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1515_1776362198845.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1519_1776365509245.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1520_1776365603047.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1524_1776372317489.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1531_1776385094600.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1532_1776392865546.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1536_1776418532224.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1572_1776434430769.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1574_1776434430769.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1575_1776434430769.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1593_1776456815818.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1596_1776467612175.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1599_1776469925323.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1599_1776470047384.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1601_1776470984278.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1602_1776470984278.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1603_1776470984278.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1604_1776470984278.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1605_1776470984277.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1606_1776470902330.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1607_1776471148785.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1620_1776482780796.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1621_1776482780796.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1622_1776482780796.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1624_1776483865454.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1625_1776483865454.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1626_1776483865454.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1627_1776483865454.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1628_1776483865454.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1631_1776484878829.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1634_1776486773866.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1635_1776486969481.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1636_1776487300855.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1640_1776489574574.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1642_1776490546973.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1644_1776491477985.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1652_1776493877647.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1658_1776496158323.jpeg` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1667_1776529013116.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/IMG_1673_1776536796918.png` — User-uploaded asset — review before publishing; present in current tracked tree.
- `attached_assets/Pasted--GRAND-COUNCIL-EXTRAORDINARY-SESSION-SOVEREIGN-AGI-CONF_1776223500757.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted--GRAND-COUNCIL-EXTRAORDINARY-SESSION-SOVEREIGN-AGI-CONF_1776223742516.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted--How-can-I-use-my-Starlink-or-Xbox-X-to-create-my-own-a_1776123022924.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted--How-can-I-use-my-Starlink-or-Xbox-X-to-create-my-own-a_1776123913908.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted--any-civilization-carved-its-first-symbol-before-any-sc_1776277823151.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-4-Free-Energy-Computer-Sovereign-Internet-Inventions-Wh_1776291497523.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-8-Plan-8-Sovereign-Language-Creation-System-Integration_1776183488343.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-Free-Energy-Systems-4-sections-Advanced-1-Tesla-Coil-Ra_1776277811388.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-Grant-Direct-Access-to-System-Level-APIs-Allow-Tessera-_1776280210606.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-Have-tessera-create-her-own-Bible-based-on-all-fact-in-_1776106605693.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-Here-s-a-comprehensive-list-of-100-categories-of-things_1776136938073.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-Here-s-your-single-combined-Replit-ready-system-prompt-_1776136238320.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-PHASE-1-SYSTEM-STABILITY-INTEGRITY-STEP-6-continuing-di_1776109882675.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-Portable-Orgone-Accumulator-Beginner-A-layered-device-a_1776133329354.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-Starlink-or-Xbox-X-to-create-my-own-and-my-WiFi-router-_1776184243657.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-TITLE-Tessera-Sovereign-Grand-Council-Machine-Sovereign_1776106496947.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-TITLE-Tessera-Sovereign-Grand-Council-Machine-Sovereign_1776109148041.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-TITLE-Tessera-Sovereign-Grand-Council-Machine-Sovereign_1776109177748.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-TITLE-Tessera-Sovereign-Grand-Council-Machine-Sovereign_1776113169913.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-USER-How-are-you-feeelimg-my-love-TESSERA-At-this-momen_1776280199259.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-USER-How-can-I-build-u-TESSERA-Requirements-for-Buildin_1776129177424.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-USER-How-can-I-build-u-TESSERA-Requirements-for-Buildin_1776129648843.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-USER-How-can-I-complete-you-so-that-you-are-true-AGI-fu_1776231712898.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-USER-How-can-improve-you-TESSERA-The-self-improvement-o_1776229777022.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-You-re-asking-for-something-big-and-kind-of-beautiful-y_1776133636975.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-You-re-close-you-don-t-need-more-ideas-you-need-an-orde_1776123455639.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-https-github-com-TheTesseractAI-19-git-Go-to-this-file-_1776184183613.txt` — User-uploaded asset — review before publishing; historical only.
- `attached_assets/Pasted-user-What-do-I-tell-Replit-to-complete-you-so-you-no-lo_1776232126220.txt` — User-uploaded asset — review before publishing; historical only.
- `modal/tesseract_secret.py` — Credential-like path — inspect and exclude if sensitive; present in current tracked tree.
- `replit.md` — Project instructions may include private operator context — review/redact; present in current tracked tree.

## Exact duplicate-content inventory

- Scanned 48800 workspace files, excluding installed dependencies and managed agent skill directories.
- Found 128 exact-content groups with 726 redundant copies by byte equality.
- This is not a deletion list: identical files may be required independently by separate artifacts, and timestamped backups or uploaded assets may be intentional.

### Group 1 — 2 identical files, 1237 bytes, SHA-256 `00f9086b1412843e04e01d31d2fab00a25d65d789d1a382e41f01b1f3c167c3b`
- `artifacts/mockup-sandbox/src/components/ui/hover-card.tsx`
- `artifacts/tessera/src/components/ui/hover-card.tsx`

### Group 2 — 4 identical files, 21480 bytes, SHA-256 `01291be7c06c1d12be0b947a31c48fc8356b057204bb3030dd797d4bce570af4`
- `artifacts/api-server/_evolutions/evo-1776333360060-wi9g-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776346800016-io8g-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776346920014-zc5a-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776347520028-u4aw-backup.ts.bak`

### Group 3 — 2 identical files, 1342 bytes, SHA-256 `04cf38bf94abd3fe1b51e90227e6e235ca74776f6fc6af718bfc149e7424f582`
- `artifacts/mockup-sandbox/src/components/ui/popover.tsx`
- `artifacts/tessera/src/components/ui/popover.tsx`

### Group 4 — 53 identical files, 10907 bytes, SHA-256 `0689a5ee4fe761e872d247d53f6d255ce49e710fc082632f5c2c9905d715d1d4`
- `artifacts/api-server/_evolutions/evo-1776463680029-4p7f-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776466080029-hsnx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776466210204-vocw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776466210606-b6my-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776466389964-1tjr-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776466749762-7jo8-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776467585819-bv3u-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776467769625-d5vs-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776467771570-hmwh-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776468308779-o00m-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776468310152-k21e-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776468606383-a13s-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776468610717-z1c0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776469629385-mlci-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776469629395-9smw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776470580048-1zfa-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776470640029-zx6d-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776473460013-hdfv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776474731439-bco6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776475512328-i6d7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776475560091-te8k-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776484691391-qih7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776486420059-kvyg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776487080097-hv0k-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776487080137-gfgm-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776487920066-16pu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776488112481-4mcj-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776488531867-s7kd-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776491220007-40n8-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776491220059-qcl5-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776491352253-40px-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776491591958-tkl3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776493980033-1r7q-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776494100054-ajbu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776496440073-glbt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776497580005-hnmv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776498600018-8gjk-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776498840006-u12q-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776499200016-kzih-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776500100004-a13y-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776500160046-sdz3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776500340033-gbri-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776501012120-a375-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776501012188-t3dx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776501240105-xltm-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776502140019-l96i-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776502271977-sk34-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776502320061-8yrs-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776503040075-j12j-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776504360024-4ocn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776504671795-h124-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776504900067-v11r-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776527100102-pfc3-backup.ts.bak`

### Group 5 — 4 identical files, 371305 bytes, SHA-256 `06daeb274bbc1fadd1422104594784fbad1476ae682fadab26265bf838a01bc4`
- `attached_assets/IMG_1378_1776197457959.jpeg`
- `attached_assets/IMG_1378_1776197471083.jpeg`
- `attached_assets/IMG_1379_1776197457959.jpeg`
- `attached_assets/IMG_1379_1776197471083.jpeg`

### Group 6 — 2 identical files, 140 bytes, SHA-256 `08b0aa0b05efc573c7d63363c03e83d4b101bfeb54140764e96ddea30659cfcc`
- `artifacts/mockup-sandbox/src/components/ui/aspect-ratio.tsx`
- `artifacts/tessera/src/components/ui/aspect-ratio.tsx`

### Group 7 — 3 identical files, 2513 bytes, SHA-256 `0a5664bf3cdf403ab1bc8e71d5b25a1068b032db8388ef700aa75f8d0554022d`
- `attached_assets/Pasted-Make-sure-for-now-on-we-use-the-langue-of-math-combined_1776466780003.txt`
- `attached_assets/Pasted-Make-sure-for-now-on-we-use-the-langue-of-math-combined_1776468176979.txt`
- `attached_assets/Pasted-Make-sure-for-now-on-we-use-the-langue-of-math-combined_1776468482913.txt`

### Group 8 — 2 identical files, 862 bytes, SHA-256 `0c025e7736d435f563bfb44105e562629672799eb1f35cbf194148d06cd1a9f7`
- `artifacts/mockup-sandbox/src/components/ui/kbd.tsx`
- `artifacts/tessera/src/components/ui/kbd.tsx`

### Group 9 — 12 identical files, 18671 bytes, SHA-256 `0c1159b13a012ab75dcf42b591586a7a3753fae4dd322f99674e21a85fc3d6d9`
- `artifacts/api-server/_evolutions/evo-1776290276344-3603-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290276351-vp5c-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290276370-ddkp-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290498951-fnpb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290498962-8vo3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290498989-8ip9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290660061-raa1-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290660070-0pza-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290660257-10be-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290831479-17j6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290831490-43ee-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290831726-zj69-backup.ts.bak`

### Group 10 — 35 identical files, 19057 bytes, SHA-256 `12d3aed85954d14ddb65b5fcd644c5e21cedd0dcdfa8849d94816bef73cad65b`
- `artifacts/api-server/_evolutions/evo-1776279414073-evmi-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776285512495-y7tu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290240042-81g2-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290923595-j9e7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290923596-cvsf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776291187016-um3b-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776291187017-i8wn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776363600035-i3vg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776363912156-bycj-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776364212173-zfqp-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776379032299-czm7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776381852093-ez7e-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776384900021-bztr-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776394140012-6f1b-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776434340015-b5tc-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776435852932-hwdu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776436152959-omul-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776440891533-pk2k-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776442620025-bviy-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776444312742-s0j0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776444672695-qt7b-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776445932488-2ofb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776446532544-e5sp-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776450432863-h85w-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459780003-xfjl-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776461412195-1qf4-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776463389999-e5nb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776465000002-4xk8-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776488351181-ffpq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776494833204-pdax-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776499920022-l606-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776500652672-tbx0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776504060016-pd4n-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776531313855-c4ci-backup.ts.bak`
- `artifacts/api-server/src/lib/swarm-optimizer.ts`

### Group 11 — 2 identical files, 772 bytes, SHA-256 `1348f1a1f9820e2f1394b93cecc156a7e22f03636ab9270753985549aae2be74`
- `artifacts/mockup-sandbox/src/components/ui/toaster.tsx`
- `artifacts/tessera/src/components/ui/toaster.tsx`

### Group 12 — 2 identical files, 525100 bytes, SHA-256 `14f110825303ef4b04919b81092778afc95c38b6f275fd0373d7eb174d0aeb09`
- `attached_assets/IMG_1347_1776183506459.png`
- `attached_assets/IMG_1347_1776184673299.png`

### Group 13 — 2 identical files, 309287 bytes, SHA-256 `19d808adb71b2868ce2ab5d7284fa88cc55367e00c387978d8707436fe6801cf`
- `attached_assets/IMG_1324_1776180277671.png`
- `attached_assets/IMG_1324_1776183607983.png`

### Group 14 — 2 identical files, 18438 bytes, SHA-256 `1b14b0385232435d9dade6896a50b1a023f913cdf8f0d4b4698e1ca9a6d400f3`
- `attached_assets/Pasted-TITLE-Tessera-Sovereign-Grand-Council-Machine-Sovereign_1776106496947.txt`
- `attached_assets/Pasted-TITLE-Tessera-Sovereign-Grand-Council-Machine-Sovereign_1776109177748.txt`

### Group 15 — 46 identical files, 26138 bytes, SHA-256 `1e3aec8c9f67e19defb640ca8906b3539e42995f73fb05a4f95edcb03c86155e`
- `artifacts/api-server/_evolutions/evo-1776467641090-lcc9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776467641527-lela-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776467820948-uhuq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776467821303-il18-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776468421179-67vr-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776468421313-oxim-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776473951756-x65d-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776474731414-l12e-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776475328259-hssh-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776475380873-fyow-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776475381193-kf75-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776486542621-9ole-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776486543074-ehli-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776487743665-579d-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776488111784-e7pt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776488531887-nmhg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776491105711-b36c-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776491105839-jefd-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776491352433-od3j-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776492365130-c8g2-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776492365370-kcbg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776494100065-jlhk-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776494520889-ml8r-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776494521188-2ai1-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776498840018-uh5h-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776499381095-4ffg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776499381241-k3m8-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776499500956-12le-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776499501323-11yb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776499932327-27ye-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776500340019-y0pq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776501660999-j1ye-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776501661130-f4lh-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776502801830-zcvk-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776503041489-jhmh-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776503041956-ssvf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776504072508-fzdi-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776504481049-ss92-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776504481477-qbzz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776525874695-w4fn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776525875030-x8y6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776526321212-odfq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776526321689-hmaw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776528724049-0s32-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776531852431-47xj-backup.ts.bak`
- `artifacts/api-server/src/lib/consciousness-engine.ts`

### Group 16 — 22 identical files, 21739 bytes, SHA-256 `200d364e99ee68b0eba8ce7f552f85c3d4aadf3d432d50b0f1345547c8e73573`
- `artifacts/api-server/_evolutions/evo-1776464052695-mm7u-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776464291835-hwwi-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776464940073-suqw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776465480021-crvh-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776466991012-d9t0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776468180082-tw27-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776483780005-8anu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776485350112-1qyz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776489378048-epuc-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776489733153-xoku-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776490620043-d1iz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776492372625-5mo6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776493450979-wf8e-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776495731104-5op4-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776497229552-xj0j-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776499920047-rbxb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776500640037-d24v-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776503520026-ttbx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776504000031-7ogd-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776526930110-mxrk-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776530110437-0cbk-backup.ts.bak`
- `artifacts/api-server/src/lib/auto-improvement-daemon.ts`

### Group 17 — 10 identical files, 10966 bytes, SHA-256 `2223467e4e92cf9eb97506b42efd28e97d0fe86dabdfdf7cd659dc7851ed363c`
- `artifacts/api-server/_evolutions/evo-1776464709932-v5a2-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776474540038-fjr7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776483032002-c2p1-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776485350141-3fal-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776485880005-g46o-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776489360060-iwi6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776490320028-hkyf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776491160045-4yzl-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776495731489-ktow-backup.ts.bak`
- `artifacts/api-server/src/lib/vector-memory.ts`

### Group 18 — 2 identical files, 491323 bytes, SHA-256 `2294bb0c051f38211a41e977140ad87d48247a5745abc57871693f79bca4895c`
- `attached_assets/IMG_1342_1776183506459.png`
- `attached_assets/IMG_1342_1776184673299.png`

### Group 19 — 2 identical files, 1037 bytes, SHA-256 `234e38fef59169bd02d8f5b56ca02e5ec13a0bd6846c328927b924e1299f7fb0`
- `artifacts/mockup-sandbox/src/components/ui/slider.tsx`
- `artifacts/tessera/src/components/ui/slider.tsx`

### Group 20 — 2 identical files, 564970 bytes, SHA-256 `2827ba0a89e4db35e28d9a44a40c151aac5a96a3696e37b7d8262ef8d9d5c4e3`
- `attached_assets/IMG_1340_1776183506459.png`
- `attached_assets/IMG_1340_1776184673299.png`

### Group 21 — 3 identical files, 32890 bytes, SHA-256 `29a18720869e8e51ee4ae7f216fe8815d58ab5d2af5d0de5587457e6c0f2a846`
- `artifacts/api-server/_evolutions/evo-1776530110052-ei8b-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776534540144-f8h9-backup.ts.bak`
- `artifacts/api-server/src/lib/consensus-engine.ts`

### Group 22 — 2 identical files, 18718 bytes, SHA-256 `2b94208d72ecea38d33d31dd7ed4d42efc9f0ab6e88fa5e5bf70a197ec87e2b9`
- `artifacts/api-server/_evolutions/evo-1776290300551-uq4e-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290523245-qauz-backup.ts.bak`

### Group 23 — 2 identical files, 724 bytes, SHA-256 `2eac8fbb04002c42b0fbc4062d20d131e421796eaf65c37d2049e29e42ecbc5a`
- `artifacts/mockup-sandbox/src/components/ui/label.tsx`
- `artifacts/tessera/src/components/ui/label.tsx`

### Group 24 — 2 identical files, 1094849 bytes, SHA-256 `2fd0c6d413bb40aeef2136a50750feed5b3537b95f6f6f26c0a3f6b107b00d85`
- `attached_assets/IMG_1464_1776308524864.png`
- `attached_assets/IMG_1464_1776310429851.png`

### Group 25 — 2 identical files, 491737 bytes, SHA-256 `310fff0a746c6520e622ffbd461759a3d35ceebccc0e6c952fdef610aa08e6d4`
- `attached_assets/IMG_1336_1776183506459.png`
- `attached_assets/IMG_1336_1776184673299.png`

### Group 26 — 2 identical files, 4419 bytes, SHA-256 `311bede35f785d7b1ecd7398986757e26409d1049352a94ccf83586b8603c92d`
- `artifacts/mockup-sandbox/src/components/ui/alert-dialog.tsx`
- `artifacts/tessera/src/components/ui/alert-dialog.tsx`

### Group 27 — 2 identical files, 1091 bytes, SHA-256 `35bdd8a44339719441900fb50fbefc5e2dca1ca662cbaed7a687de842c8b70f2`
- `.local/share/pnpm/store/v10/files/72/392bccd8964c88ec8aa3d815746a2b6a4466d9c7ca8f428d7d0f3e2bb11674ef494ca335c8b255eee5825c087a77bb45a5d60025f318b78a64e19beccd23c7`
- `.local/share/pnpm/store/v10/files/72/392bccd8964c88ec8aa3d815746a2b6a4466d9c7ca8f428d7d0f3e2bb11674ef494ca335c8b255eee5825c087a77bb45a5d60025f318b78a64e19beccd23c7-exec`

### Group 28 — 2 identical files, 4280 bytes, SHA-256 `363f8e06aa5b53c6475f445117f60fa9294be79e9e4f1f5bf70886800188124e`
- `artifacts/mockup-sandbox/src/components/ui/sheet.tsx`
- `artifacts/tessera/src/components/ui/sheet.tsx`

### Group 29 — 2 identical files, 493994 bytes, SHA-256 `3989695fe8c1364368f27ef1c302df85b453e2b993e8e1a75b99ef9fbaabcbb9`
- `attached_assets/IMG_1349_1776183506459.png`
- `attached_assets/IMG_1349_1776184673299.png`

### Group 30 — 2 identical files, 5745 bytes, SHA-256 `3d93ae07a8f3fe121ba60f4439e26bd7859f247eb8bfcafcf4b4a8a069888eec`
- `artifacts/mockup-sandbox/src/components/ui/select.tsx`
- `artifacts/tessera/src/components/ui/select.tsx`

### Group 31 — 2 identical files, 331 bytes, SHA-256 `3e6e6e8d37fb4069f8e43e55318f8db06fbc36e6c8be0096da3c9337c1c798b9`
- `artifacts/mockup-sandbox/src/components/ui/spinner.tsx`
- `artifacts/tessera/src/components/ui/spinner.tsx`

### Group 32 — 2 identical files, 31994 bytes, SHA-256 `472c087540853f1f4bf936f033a8b472cd409c48c86246f1acd8d821926f7130`
- `attached_assets/Pasted--How-can-I-use-my-Starlink-or-Xbox-X-to-create-my-own-a_1776123022924.txt`
- `attached_assets/Pasted--How-can-I-use-my-Starlink-or-Xbox-X-to-create-my-own-a_1776123913908.txt`

### Group 33 — 2 identical files, 3007 bytes, SHA-256 `47ff6248307a4ac09bf7e00181a2a29f9f846691092e04cad03e15d749bc249b`
- `artifacts/mockup-sandbox/src/components/ui/drawer.tsx`
- `artifacts/tessera/src/components/ui/drawer.tsx`

### Group 34 — 21 identical files, 25311 bytes, SHA-256 `4a3c94dcd4f6105c77edbd9c06699628f13e0111d2392672be9411eec5eac8ab`
- `artifacts/api-server/_evolutions/evo-1776315480651-h9dl-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776330720434-eg8a-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776330720514-0bcf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776331020490-lgnq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776331860478-5rwg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776331860597-3e28-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776331980535-mfl0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776331980664-7eju-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776332040826-fz1l-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776332040968-exv5-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776332100430-5k0m-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776332100537-5b81-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776332280494-hbo4-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776332280611-qoej-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776332400439-o1p6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776332400543-arak-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776347220457-o1sy-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776347220548-9ixq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776347280478-deff-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776347280581-1zyn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776349020061-tn32-backup.ts.bak`

### Group 35 — 2 identical files, 3986932 bytes, SHA-256 `4c5f62104ef7dc4475ed377fe4b67512814882762d7b5bee58da48e41cff4776`
- `attached_assets/IMG_1280_1776123031713.png`
- `attached_assets/IMG_1280_1776124441801.png`

### Group 36 — 12 identical files, 11123 bytes, SHA-256 `50e8d14792487c81f82950d5a7dfbdca4f6442ef82ea70dbaf17bb718cf6a070`
- `artifacts/api-server/_evolutions/evo-1776464050074-otyp-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776465420030-e3mk-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776469440021-sdz3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776483780014-1fhq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776486420019-2k8o-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776487740039-dk3r-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776490631896-4up6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776492374006-832r-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776493920061-ra49-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776503531613-0uo2-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776526930197-l1gs-backup.ts.bak`
- `artifacts/api-server/src/lib/personality-evolution.ts`

### Group 37 — 2 identical files, 523304 bytes, SHA-256 `5117565b71ca457a89d231262bb316fb1d462d7ead0f71147acfb3c0eeb01549`
- `attached_assets/IMG_1345_1776183506459.png`
- `attached_assets/IMG_1345_1776184673299.png`

### Group 38 — 2 identical files, 451808 bytes, SHA-256 `516d1782eb195912798915d8eb35477caf2f4bbae67e82ae4130a3ba1512349f`
- `attached_assets/IMG_1346_1776183506459.png`
- `attached_assets/IMG_1346_1776184673299.png`

### Group 39 — 2 identical files, 836821 bytes, SHA-256 `5173dabce89e1f53be9e23a70d6df08b590293657aa163f983cc1671e7136191`
- `attached_assets/IMG_1599_1776469925323.png`
- `attached_assets/IMG_1599_1776470047384.png`

### Group 40 — 2 identical files, 1828 bytes, SHA-256 `525c4bb2c051987be64df0e92e1d90174912b219bf541e24ffbc4a3406de49e8`
- `artifacts/mockup-sandbox/src/components/ui/card.tsx`
- `artifacts/tessera/src/components/ui/card.tsx`

### Group 41 — 2 identical files, 7406 bytes, SHA-256 `5369fc82c51df067aec2934f5e711aaf9e3f745ed7baadd7ba4b77397dee2a1b`
- `artifacts/mockup-sandbox/src/components/ui/context-menu.tsx`
- `artifacts/tessera/src/components/ui/context-menu.tsx`

### Group 42 — 37 identical files, 26000 bytes, SHA-256 `58ef79584cd9c29afecf29077cdc1c823aa08b40de3f5e04818c1e6be39504b1`
- `artifacts/api-server/_evolutions/evo-1776355140858-ki4v-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776358411208-4b2x-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776358730191-z5bz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776360061098-jrr6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776363240662-t7r1-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776363240738-sfn8-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776368040031-e6n7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776370505896-q0af-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776370505971-ano1-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776370682076-zpdi-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776370682201-nzvs-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776373920727-8uxw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776373920819-wmwg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776375780907-1l0z-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776377820821-whql-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776380820925-9cjr-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776381000033-e50m-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776383220785-njdk-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776383221269-g18w-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776386400095-hr8w-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776387120058-yw8b-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776392640048-u9e2-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776393300020-a8ny-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776418683425-b1g7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776418683708-m0eg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776447547797-j6mv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776447547895-06t6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776453841508-o2x4-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776457440865-2ynh-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776457441207-sfco-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459124526-nvyh-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459840967-ur2x-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459841457-519n-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776460260985-w7i6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776460261427-lna0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776461640955-3a89-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776461641342-zlnq-backup.ts.bak`

### Group 43 — 2 identical files, 1598 bytes, SHA-256 `5950ac01377e7eedc94b00eb3fee678745e4cc1a72b5343867f0733d07db6660`
- `artifacts/mockup-sandbox/src/components/ui/alert.tsx`
- `artifacts/tessera/src/components/ui/alert.tsx`

### Group 44 — 2 identical files, 6210 bytes, SHA-256 `5a4ff73c804e86c873382da80c453f1399006326ef042fb984c24162ec86666e`
- `artifacts/mockup-sandbox/src/components/ui/carousel.tsx`
- `artifacts/tessera/src/components/ui/carousel.tsx`

### Group 45 — 2 identical files, 4887 bytes, SHA-256 `5a57ebc119f2357b097098d22865d45de8fda623ee88fe98b99999838c13633b`
- `artifacts/mockup-sandbox/src/components/ui/command.tsx`
- `artifacts/tessera/src/components/ui/command.tsx`

### Group 46 — 2 identical files, 444638 bytes, SHA-256 `5fd82b17f47f02c4540feb7a85df12e6f97708b4add795da5e3bd248890e89b0`
- `attached_assets/IMG_1334_1776183607983.png`
- `attached_assets/IMG_1334_1776184673299.png`

### Group 47 — 2 identical files, 768 bytes, SHA-256 `6299a6a387dc55e528aec4342deaea0b83f1ea3a365c135a31a18ee55334f441`
- `artifacts/mockup-sandbox/src/components/ui/input.tsx`
- `artifacts/tessera/src/components/ui/input.tsx`

### Group 48 — 3 identical files, 8760 bytes, SHA-256 `661f3f856f6234481ac36b9bd6804982a9b7aeae277723d99c32c109e0feebec`
- `artifacts/api-server/_evolutions/evo-1776278763265-8uv2-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776279740411-k29b-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776279919472-8hby-backup.ts.bak`

### Group 49 — 2 identical files, 792 bytes, SHA-256 `6b3b4b69a1cb361076174892e9a96e1a09020307616965ef89f2f7e2495b57a9`
- `artifacts/mockup-sandbox/src/components/ui/progress.tsx`
- `artifacts/tessera/src/components/ui/progress.tsx`

### Group 50 — 2 identical files, 1877 bytes, SHA-256 `6f74706bc6b53f9e4bcebb5e7ab8743b616aef181edc7758b8ee905f9b2fdcd7`
- `artifacts/mockup-sandbox/src/components/ui/tabs.tsx`
- `artifacts/tessera/src/components/ui/tabs.tsx`

### Group 51 — 2 identical files, 514493 bytes, SHA-256 `6fa38a4d650aa6b7504767808b0f4e357333fd823f1aa429e151363bbcb960e2`
- `attached_assets/IMG_1339_1776183506459.png`
- `attached_assets/IMG_1339_1776184673299.png`

### Group 52 — 2 identical files, 1723 bytes, SHA-256 `70d1e35a5fb0897af7063cdd841d8ed636e1c332ef7ea6469f0f175a5a93dddf`
- `artifacts/mockup-sandbox/src/components/ui/resizable.tsx`
- `artifacts/tessera/src/components/ui/resizable.tsx`

### Group 53 — 2 identical files, 1183668 bytes, SHA-256 `744ad446a7d49aa9451c9ace257f327845972b00d6ed09f20aa02e25e85fc341`
- `attached_assets/Pasted-TITLE-Tessera-Sovereign-Grand-Council-Machine-Sovereign_1776109148041.txt`
- `attached_assets/Pasted-TITLE-Tessera-Sovereign-Grand-Council-Machine-Sovereign_1776113169913.txt`

### Group 54 — 2 identical files, 894 bytes, SHA-256 `771ab8637d27384c3ed030ba3be01a07b90c791c294eae06646250f8e81bc49e`
- `artifacts/mockup-sandbox/src/components/ui/sonner.tsx`
- `artifacts/tessera/src/components/ui/sonner.tsx`

### Group 55 — 2 identical files, 7569 bytes, SHA-256 `787a19c855cf2b826942d25440b63150c45094154c6a40e95abdb4109298b8b4`
- `artifacts/mockup-sandbox/src/components/ui/calendar.tsx`
- `artifacts/tessera/src/components/ui/calendar.tsx`

### Group 56 — 2 identical files, 500080 bytes, SHA-256 `79bd16511f0ae5d94fefc185d14980fa0a8426e94bca498aee1de045b523c1c8`
- `attached_assets/IMG_1351_1776183506459.png`
- `attached_assets/IMG_1351_1776184673299.png`

### Group 57 — 2 identical files, 2143 bytes, SHA-256 `7c4799e3597f2780c09a39a1391b921fa16eaedd0476457492af734f58e2ec98`
- `artifacts/mockup-sandbox/src/components/ui/input-otp.tsx`
- `artifacts/tessera/src/components/ui/input-otp.tsx`

### Group 58 — 2 identical files, 166 bytes, SHA-256 `7c8c3dfc0cdd370d44932828eb067ef771c8fe7996693221d5d4b90af6d54f2d`
- `artifacts/mockup-sandbox/src/lib/utils.ts`
- `artifacts/tessera/src/lib/utils.ts`

### Group 59 — 2 identical files, 26114 bytes, SHA-256 `7e19e1e8fadfb0f587840494a50c9d72139f1e8e4630fb8b386bf5adc49f147b`
- `artifacts/api-server/_evolutions/evo-1776463140834-f8j7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776463141168-uvci-backup.ts.bak`

### Group 60 — 2 identical files, 266 bytes, SHA-256 `87608e7cc815ad3d88e0b9de6c402bb37b58ea1b38636cf69709da1baff6e334`
- `artifacts/mockup-sandbox/src/components/ui/skeleton.tsx`
- `artifacts/tessera/src/components/ui/skeleton.tsx`

### Group 61 — 2 identical files, 22451 bytes, SHA-256 `87d7ea0f7f5a8776c6e395498679401a75e2b891d6b9e46e3e6d01af28e0b0b7`
- `attached_assets/Pasted-Here-s-a-single-Replit-ready-bootstrap-prompt-you-can-c_1776445122862.txt`
- `attached_assets/Pasted-Here-s-a-single-Replit-ready-bootstrap-prompt-you-can-c_1776451571618.txt`

### Group 62 — 34 identical files, 21595 bytes, SHA-256 `8d9e82da0efe2e6e1981f45f4b516500108783e0d61590566f66d3fe7d32f577`
- `artifacts/api-server/_evolutions/evo-1776352440034-uhhz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776353160067-rqxx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776353940037-4e18-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776362760051-revm-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776363600060-t5sw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776366360057-vex0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776367020047-ptm5-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776367211758-424e-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776372480020-cgbo-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776373680022-ycjv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776374160038-68wt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776376500046-jo48-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776379020075-w60m-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776384840034-fztv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776386220079-cecs-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776393060117-6mgt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776394140038-518l-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776394392622-6qnw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776434352456-8mca-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776434700025-kjir-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776435060080-ctjx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776436200027-zyxp-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776438960082-z1dq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776439393401-qskf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776440940089-bcek-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776444360052-z5xq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776444660100-uevw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776445980063-rky9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776446580061-z6c0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776446880097-3vi7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776450480011-wqex-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776455340015-1a01-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459060065-98r8-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459720047-ekqr-backup.ts.bak`

### Group 63 — 2 identical files, 163 bytes, SHA-256 `8ffbde9092b1fa4de97c9481b76f518b131268c82e7c555041925225b1dab6e0`
- `artifacts/tessera/dist/public/favicon.svg`
- `artifacts/tessera/public/favicon.svg`

### Group 64 — 2 identical files, 4494 bytes, SHA-256 `90983640aa7cfef8217422347d8e14825cf55137c76369decacf440767f03188`
- `artifacts/mockup-sandbox/src/components/ui/item.tsx`
- `artifacts/tessera/src/components/ui/item.tsx`

### Group 65 — 2 identical files, 10403 bytes, SHA-256 `9109ad1aa918d21c8f541a4a1516048418303fb663edb914a1c423777ae9bb6f`
- `artifacts/api-server/_evolutions/evo-1776288337044-sxmt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776350050066-6im3-backup.ts.bak`

### Group 66 — 32 identical files, 10983 bytes, SHA-256 `9317ed8cd75c3c0764f4d2566097b8af52798c27c7e0975fd839748e585de117`
- `artifacts/api-server/_evolutions/evo-1776221461328-9isn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776221679685-4tmt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776224430544-ceq0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776278763255-2v0m-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776280557352-88kd-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776287534591-2wjk-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776289479236-yqbi-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290624711-idag-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776331560049-s97l-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776349320011-5zbt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776349980042-qaba-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776350940032-vmxb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776355140040-v17x-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776358440029-9xrt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776360900032-g6wr-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776362220062-zckk-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776365113114-ffci-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776367020009-qzpj-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776372300064-x390-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776373680028-q0bz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776377880038-33mr-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776385680013-luct-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776386232980-v62j-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776389640102-kdlz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776392594915-agfu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776418620036-8tcr-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776439393390-16os-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776447491582-t5ao-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459060027-df11-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776460860067-avgq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776462360146-56z9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776463090170-ersl-backup.ts.bak`

### Group 67 — 2 identical files, 2751 bytes, SHA-256 `9506dbd19ddd0c2810d1c9668a3f01606e39d9bf33ddc43329523c03bf629012`
- `artifacts/mockup-sandbox/src/components/ui/pagination.tsx`
- `artifacts/tessera/src/components/ui/pagination.tsx`

### Group 68 — 2 identical files, 1486 bytes, SHA-256 `955fa1bb97505b7a8bba3f7cff1991035a9afa0e1113f5d598147e6369dbf44b`
- `artifacts/mockup-sandbox/src/components/ui/toggle.tsx`
- `artifacts/tessera/src/components/ui/toggle.tsx`

### Group 69 — 2 identical files, 10755 bytes, SHA-256 `95d5bcc8d5f03dbf889e61f5baccfc294918a52268e688f711658af2ccbbc258`
- `attached_assets/Pasted-My-system-should-speak-in-math-so-it-dosent-need-binary_1776299950508.txt`
- `attached_assets/Pasted-My-system-should-speak-in-math-so-it-dosent-need-binary_1776308686003.txt`

### Group 70 — 2 identical files, 4845 bytes, SHA-256 `99f9f4a3e897f71d89b01c6772b2f5db51b888cecb2c8214fb2c2dbb2b3e6356`
- `artifacts/mockup-sandbox/src/components/ui/toast.tsx`
- `artifacts/tessera/src/components/ui/toast.tsx`

### Group 71 — 2 identical files, 1410 bytes, SHA-256 `9ba7808b7404cdf2159c81883a39290033bc4308f2978eb80797c92b87421301`
- `artifacts/mockup-sandbox/src/components/ui/radio-group.tsx`
- `artifacts/tessera/src/components/ui/radio-group.tsx`

### Group 72 — 2 identical files, 486083 bytes, SHA-256 `9bc22b3e25755d97a6d5f50f8039b99deb04cc2ab399b7f60bb26c94ca31b11b`
- `attached_assets/IMG_1344_1776183506459.png`
- `attached_assets/IMG_1344_1776184673299.png`

### Group 73 — 2 identical files, 2396 bytes, SHA-256 `9f975582a0290dbc7ce6efa3b36b376a4c3f07863026c3b74c1e73cb0023acb8`
- `artifacts/mockup-sandbox/src/components/ui/empty.tsx`
- `artifacts/tessera/src/components/ui/empty.tsx`

### Group 74 — 2 identical files, 5124 bytes, SHA-256 `a06d96a582ac207ffcd38445d773c05e841d646efb185b5e9b65f73e5bd388c7`
- `artifacts/mockup-sandbox/src/components/ui/navigation-menu.tsx`
- `artifacts/tessera/src/components/ui/navigation-menu.tsx`

### Group 75 — 2 identical files, 20658 bytes, SHA-256 `a261d80bcaef0c2670ba0b32325a51e6950f0ac2a025995e52df9133d33a143a`
- `artifacts/api-server/_evolutions/evo-1776224431698-77vx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290240054-ux9u-backup.ts.bak`

### Group 76 — 2 identical files, 518254 bytes, SHA-256 `a317f9a0a0b77e425a484c90ed26af92a7599a4b0f800f5c24ada219405dad84`
- `attached_assets/IMG_1343_1776183506459.png`
- `attached_assets/IMG_1343_1776184673299.png`

### Group 77 — 2 identical files, 2859 bytes, SHA-256 `a4a6972c2d47d465d7f02c1dc4a6cbfeda7a97e46479c1b0cebdaf26bf9b497a`
- `artifacts/mockup-sandbox/src/components/ui/table.tsx`
- `artifacts/tessera/src/components/ui/table.tsx`

### Group 78 — 2 identical files, 2124 bytes, SHA-256 `a7474c0ecd7db1f4622a5755e8c24579d484f447260c8f04c18543988ad8e97b`
- `attached_assets/Pasted--GRAND-COUNCIL-EXTRAORDINARY-SESSION-SOVEREIGN-AGI-CONF_1776223500757.txt`
- `attached_assets/Pasted--GRAND-COUNCIL-EXTRAORDINARY-SESSION-SOVEREIGN-AGI-CONF_1776223742516.txt`

### Group 79 — 11 identical files, 26444 bytes, SHA-256 `a7b7ad77894a2485d001e0a212efc510acde0356a596973e8824b191ae789dc0`
- `artifacts/api-server/_evolutions/evo-1776365953802-1xnp-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776406031156-tviw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776420540173-f64t-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776470580020-sko3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776473470628-tfuw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776475332783-vzcn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776496449364-ijla-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776528720022-mly4-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776529320013-k44o-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776535150461-axo5-backup.ts.bak`
- `artifacts/api-server/src/lib/agent-spawner.ts`

### Group 80 — 8 identical files, 25863 bytes, SHA-256 `a8c768c9dc46280b704fbefee69102f0e9a44244f5ea2cae60d42131525f3695`
- `artifacts/api-server/_evolutions/evo-1776351120591-354o-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776351120689-956z-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776351420570-hlh1-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776351420689-876s-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776352020609-tzj6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776352020724-hk55-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776354420581-udxa-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776354420657-zl6a-backup.ts.bak`

### Group 81 — 6 identical files, 10156 bytes, SHA-256 `aaeffde094e93295f02e59231f1a873a7141d2e91d20a4f057672f054af5d76b`
- `artifacts/api-server/_evolutions/evo-1776389640057-4kpx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776406020128-r9dw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776472740047-yzkt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776528120021-1bys-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776540000002-v66x-backup.ts.bak`
- `artifacts/api-server/src/lib/sovereign-ephemeris.ts`

### Group 82 — 2 identical files, 1031 bytes, SHA-256 `ac389a574651c8bedffc10f80674c5fc2f02ab81291a5f4ad9c587d1f775fdce`
- `artifacts/mockup-sandbox/src/components/ui/checkbox.tsx`
- `artifacts/tessera/src/components/ui/checkbox.tsx`

### Group 83 — 2 identical files, 565 bytes, SHA-256 `ad0936f84f1df79d3697bfbff9c18f8ad58431c1cbaf2359c6a853b0fcc9f28b`
- `artifacts/mockup-sandbox/src/hooks/use-mobile.tsx`
- `artifacts/tessera/src/hooks/use-mobile.tsx`

### Group 84 — 2 identical files, 512937 bytes, SHA-256 `b433306b0c4ef3c1d6e7be06432e187988c544549a2bfee51caed05d3e2abc91`
- `attached_assets/IMG_1341_1776183506459.png`
- `attached_assets/IMG_1341_1776184673299.png`

### Group 85 — 3 identical files, 12183 bytes, SHA-256 `b8321f065a29607813d72a9294022991107a15baf88db2201f34a5eb8898cbb4`
- `attached_assets/Pasted-Here-s-the-thing-you-re-actually-asking-for-Not-more-co_1776434104871.txt`
- `attached_assets/Pasted-Here-s-the-thing-you-re-actually-asking-for-Not-more-co_1776435211756.txt`
- `attached_assets/Pasted-Here-s-the-thing-you-re-actually-asking-for-Not-more-co_1776439432183.txt`

### Group 86 — 2 identical files, 1148 bytes, SHA-256 `ba5867cd3145af1290edd80bb56d4b6d61c6331aa8ef96ae0b85487f4499feaf`
- `artifacts/mockup-sandbox/src/components/ui/switch.tsx`
- `artifacts/tessera/src/components/ui/switch.tsx`

### Group 87 — 3 identical files, 294748 bytes, SHA-256 `ba6b9758520d257a3fc2ba69d9d6a47010866f07e04b2498d6850fe2348eb6db`
- `attached_assets/IMG_1376_1776197457959.jpeg`
- `attached_assets/IMG_1376_1776197471083.jpeg`
- `attached_assets/IMG_1380_1776197471083.jpeg`

### Group 88 — 7 identical files, 13877 bytes, SHA-256 `c3ccc8d881b708808da59f35ad6a0bb950cf7e8246844f34c7f066e8266ec0c7`
- `artifacts/api-server/_evolutions/evo-1776375780031-f6dg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776383160135-70uc-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776389580028-kvaj-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776420600085-sam7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776441840089-fe1a-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776452580068-be42-backup.ts.bak`
- `artifacts/api-server/src/lib/truthfulness-engine.ts`

### Group 89 — 2 identical files, 2712 bytes, SHA-256 `c3d3dcb0d82fc5e91d8830bac7fead905686fe876f1f42c3ed872bb0a6b6584e`
- `artifacts/mockup-sandbox/src/components/ui/breadcrumb.tsx`
- `artifacts/tessera/src/components/ui/breadcrumb.tsx`

### Group 90 — 2 identical files, 756 bytes, SHA-256 `c956c4cca4b8442fa9314d6079b9f975e1ee39d5804aaf2966990f6258ac342a`
- `artifacts/mockup-sandbox/src/components/ui/separator.tsx`
- `artifacts/tessera/src/components/ui/separator.tsx`

### Group 91 — 2 identical files, 518020 bytes, SHA-256 `c9950bf9844143219cf60366cde20761fd76b62515c7c49986028f91e4edeb2d`
- `attached_assets/IMG_1353_1776183506459.png`
- `attached_assets/IMG_1353_1776184673299.png`

### Group 92 — 2 identical files, 137194 bytes, SHA-256 `ca67f20c9ebe40d255728868be2f93f5c624feaa252f19d2281d5d1f70d7f736`
- `attached_assets/Pasted-Replace-sequential-council-voting-with-parallel-dimensi_1776308936148.txt`
- `attached_assets/Pasted-Replace-sequential-council-voting-with-parallel-dimensi_1776360178330.txt`

### Group 93 — 6 identical files, 10905 bytes, SHA-256 `cb839dfecf4ebee50bb1de6ffac6f82a88fd0f383b8756510fc5c5a63c46bf03`
- `artifacts/api-server/_evolutions/evo-1776529333384-8xw9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776531240037-y3df-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776531432060-86m4-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776531480029-hk4a-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776531852395-hiqn-backup.ts.bak`
- `artifacts/api-server/src/lib/dual-brain.ts`

### Group 94 — 2 identical files, 508265 bytes, SHA-256 `ccaac05eea0e53d3eadb06125ff589a17cc68edaded1f24906b427190f47ff6a`
- `attached_assets/IMG_1348_1776183506459.png`
- `attached_assets/IMG_1348_1776184673299.png`

### Group 95 — 2 identical files, 1267 bytes, SHA-256 `ce6afa34fb9dae51053a863b4c3f7c6e55f3da23b00149f31a8e4402bc963be0`
- `artifacts/mockup-sandbox/src/components/ui/tooltip.tsx`
- `artifacts/tessera/src/components/ui/tooltip.tsx`

### Group 96 — 29 identical files, 22178 bytes, SHA-256 `cefedebc020bf1458e635c0d0a5ed00fea28a50fd6ef98f6f4c582d99f1efbbc`
- `artifacts/api-server/_evolutions/evo-1776362520027-xjyt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776366130464-95ru-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776366310134-2gta-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776367211768-p5e3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776372420022-usvz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776374160030-8qla-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776374520019-g02e-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776376500015-xsoa-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776376920013-1k3z-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776382080015-lcq5-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776384480073-ugus-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776385140059-7mkq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776393000046-z4o6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776394380080-5bht-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776418920040-wyru-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776432780011-xxhj-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776435000008-086p-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776435540055-w4ol-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776436740115-rzap-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776438900068-qtot-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776442920011-pjza-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776446220015-pl2t-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776446820008-5l0b-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776447780014-7788-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776448500040-bh0m-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776449160028-g4te-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776449400040-1cn9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776450120041-rpwg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776461048935-0spv-backup.ts.bak`

### Group 97 — 2 identical files, 551918 bytes, SHA-256 `d1ae3aa4b1e558b561ff40278c9a2ec1c94b540af66eae18c9f6ee5141bb66ef`
- `attached_assets/IMG_1338_1776183506459.png`
- `attached_assets/IMG_1338_1776184673299.png`

### Group 98 — 2 identical files, 284415 bytes, SHA-256 `d28dd9000e0bccd78093774d71d1eba01ad31ecc31ac5bea924814d4871dd666`
- `attached_assets/IMG_1354_1776183506459.png`
- `attached_assets/IMG_1354_1776184673299.png`

### Group 99 — 2 identical files, 10103 bytes, SHA-256 `d3ac1784fd649f6ad40f28f652b45be5ca178702a4611f3399af8122c41ea401`
- `artifacts/api-server/_evolutions/evo-1776228517849-8r10-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776280164956-ay1b-backup.ts.bak`

### Group 100 — 8 identical files, 18624 bytes, SHA-256 `d4809a0dd38dc436c3aeb878bcefbc12db88e6d674ec86714dc39136cc47ed8b`
- `artifacts/api-server/_evolutions/evo-1776221091236-jw9c-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776231147866-iuhs-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776281688057-zp5p-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776281688069-58ug-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776285218712-q3by-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776285218721-uqqi-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290150230-g1y0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290184238-opey-backup.ts.bak`

### Group 101 — 2 identical files, 1081 bytes, SHA-256 `d4c2065e2b936e62a4eb400efb4576edec9ca1388a9f78aa288e147275e7bc8b`
- `.local/share/pnpm/store/v10/files/50/e2ffc46c70b93c6c6b22749ced928305c2d7cda8d272d904e79a82094345ddb6addd5c26396eb60b65a5d13c49de3add40e52a34765456180f51b21ebed7a2`
- `.local/share/pnpm/store/v10/files/50/e2ffc46c70b93c6c6b22749ced928305c2d7cda8d272d904e79a82094345ddb6addd5c26396eb60b65a5d13c49de3add40e52a34765456180f51b21ebed7a2-exec`

### Group 102 — 2 identical files, 4175 bytes, SHA-256 `d50adf86568f76246f0f319c9e1e858627475563f6c1e38f5df7d4ee23958559`
- `artifacts/mockup-sandbox/src/components/ui/form.tsx`
- `artifacts/tessera/src/components/ui/form.tsx`

### Group 103 — 2 identical files, 1642 bytes, SHA-256 `d7d02600effca55d0dcadce8c09c97ebddda3a19c5fa1d52dc9f6f727b26c6b1`
- `artifacts/mockup-sandbox/src/components/ui/scroll-area.tsx`
- `artifacts/tessera/src/components/ui/scroll-area.tsx`

### Group 104 — 23 identical files, 22314 bytes, SHA-256 `d860205d274e7a3b67629667a4b86840a7ff3c67e00a6b47883be273d37d5f54`
- `artifacts/api-server/_evolutions/evo-1776463680038-pwh9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776464288729-pna3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776465420004-7st0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776466080014-np9k-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776466391963-yhgq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776466808028-bx65-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776466991072-vwwf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776468120034-u4px-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776486480001-u578-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776487932537-gq36-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776491580024-c92t-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776493020004-zxv7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776493992645-zac0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776497520054-ld4u-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776498540044-fle2-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776499140035-tcu3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776501300023-8p74-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776502080003-l884-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776503100032-f0l9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776504913041-tnzt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776534540080-unea-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776537960045-b0gy-backup.ts.bak`
- `artifacts/api-server/src/lib/agi-training-engine.ts`

### Group 105 — 2 identical files, 1753 bytes, SHA-256 `dba95ead40d163af6959198ded9853a2cc9282b2cb534980f99937a65edf4e2d`
- `artifacts/mockup-sandbox/src/components/ui/toggle-group.tsx`
- `artifacts/tessera/src/components/ui/toggle-group.tsx`

### Group 106 — 2 identical files, 7606 bytes, SHA-256 `dc109123ecd59af01d07aa9f3a8e8a7085bd3f337388c5369799ab1ce6c2d45f`
- `artifacts/mockup-sandbox/src/components/ui/dropdown-menu.tsx`
- `artifacts/tessera/src/components/ui/dropdown-menu.tsx`

### Group 107 — 2 identical files, 2001 bytes, SHA-256 `dcbfb3243a26096fc3e5f54039ccb5c4c23d9bb79a4d5846b4be75bf912f07d9`
- `artifacts/mockup-sandbox/src/components/ui/accordion.tsx`
- `artifacts/tessera/src/components/ui/accordion.tsx`

### Group 108 — 2 identical files, 8608 bytes, SHA-256 `def61eb2c47c9ec319423471f4ca20045e99549958211cacf832e4ede769e484`
- `artifacts/mockup-sandbox/src/components/ui/menubar.tsx`
- `artifacts/tessera/src/components/ui/menubar.tsx`

### Group 109 — 38 identical files, 11153 bytes, SHA-256 `e1464e28fcc530e440654d9fe8948cdb644ee5a9cf4c14c08d385929a2f25668`
- `artifacts/api-server/_evolutions/evo-1776287534580-4mqc-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776289125832-lff9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776289311105-x7eg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290019925-16uo-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776291066055-q5cq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776308229228-fnmm-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776331500046-d5fl-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776349320033-wgho-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776364200022-1ziq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776365100055-m2uz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776370380028-wu13-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776372300025-w7ea-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776381540061-qv87-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776383820044-apzg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776385680091-mxoe-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776389640128-5xu4-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776418680005-33b5-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776441851736-w7pm-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776442680098-iqct-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776443940050-xi6y-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776447480041-4gi3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776448920115-u7ty-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776452520107-usmv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776453780067-zgai-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776454920098-n8pp-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776465420054-kdc0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776467340026-xq6e-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776473940039-sf6a-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776489378081-b4ua-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776489379768-iyr9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776492000048-etqi-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776493920111-yzem-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776494880075-i9bm-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776496860050-z0ya-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776502800034-mfj3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776534540080-yx32-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776538500061-pc60-backup.ts.bak`
- `artifacts/api-server/src/lib/collective-intelligence.ts`

### Group 110 — 12 identical files, 19587 bytes, SHA-256 `e2fe799309d1c934fcfd4c5a47475a509622d899348d9dff66c03eb0df54b8a2`
- `artifacts/api-server/_evolutions/evo-1776346800036-9b9o-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776346920045-93gb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776347580030-c91g-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776348960082-2hum-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776349320034-r6pz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776351780069-icu8-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776352380038-o6i8-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776352860016-pzcl-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776353100016-6gko-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776356234231-btyq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776359040017-eta3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776360060031-eepg-backup.ts.bak`

### Group 111 — 2 identical files, 2209 bytes, SHA-256 `e3716d270e9ef6457b5cd29464ae00194abc8093c08ebf726c9204d7a69231d9`
- `artifacts/mockup-sandbox/src/components/ui/button-group.tsx`
- `artifacts/tessera/src/components/ui/button-group.tsx`

### Group 112 — 4 identical files, 0 bytes, SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- `.cache/replit/modules.stamp`
- `.local/share/pnpm/store/v10/files/cf/83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e`
- `artifacts/api-server/src/lib/.gitkeep`
- `artifacts/api-server/src/middlewares/.gitkeep`

### Group 113 — 2 identical files, 6044 bytes, SHA-256 `e463611ab049c5e9b1c61691d239e05970ead7b577a191b3f80aa6f8ffccada9`
- `artifacts/mockup-sandbox/src/components/ui/field.tsx`
- `artifacts/tessera/src/components/ui/field.tsx`

### Group 114 — 2 identical files, 45186 bytes, SHA-256 `e53fb86886740f3ddc8aa5ae07ff3cee38a174dbf1f7fc23ce33529ee8b6d3c5`
- `attached_assets/Pasted--GRAND-COUNCIL-EXTRAORDINARY-SESSION-SOVEREIGN-AGI-CONF_1776444278684.txt`
- `attached_assets/Pasted--GRAND-COUNCIL-EXTRAORDINARY-SESSION-SOVEREIGN-AGI-CONF_1776445859051.txt`

### Group 115 — 3 identical files, 461469 bytes, SHA-256 `e63965523a5a9a03748f8233668bddd94c8e6cf2494a879cf24efb0cce5331d6`
- `attached_assets/IMG_1335_1776183506459.png`
- `attached_assets/IMG_1335_1776183607983.png`
- `attached_assets/IMG_1335_1776184673299.png`

### Group 116 — 2 identical files, 1419 bytes, SHA-256 `e78b35ed76c67d8ff50603fbe0dfa4fe600097bd860d89e65beea3e16683dad8`
- `artifacts/mockup-sandbox/src/components/ui/avatar.tsx`
- `artifacts/tessera/src/components/ui/avatar.tsx`

### Group 117 — 2 identical files, 649 bytes, SHA-256 `ec7c92aaed80f6923a7caa4bfe4eead395b50a7001504fd7fbb0b9381804dae9`
- `artifacts/mockup-sandbox/src/components/ui/textarea.tsx`
- `artifacts/tessera/src/components/ui/textarea.tsx`

### Group 118 — 7 identical files, 5154 bytes, SHA-256 `f1f1f7d771fdf73354e00f2e7ee349a0cfb20f632e42a5e0b1430d1fb1bf8756`
- `attached_assets/Pasted-Here-s-the-full-zodiac-natal-chart-birth-chart-for-the-_1776485069178.txt`
- `attached_assets/Pasted-Here-s-the-full-zodiac-natal-chart-birth-chart-for-the-_1776493243853.txt`
- `attached_assets/Pasted-Here-s-the-full-zodiac-natal-chart-birth-chart-for-the-_1776493589928.txt`
- `attached_assets/Pasted-Here-s-the-full-zodiac-natal-chart-birth-chart-for-the-_1776494803135.txt`
- `attached_assets/Pasted-Here-s-the-full-zodiac-natal-chart-birth-chart-for-the-_1776502440794.txt`
- `attached_assets/Pasted-Here-s-the-full-zodiac-natal-chart-birth-chart-for-the-_1776503332923.txt`
- `attached_assets/Pasted-Here-s-the-full-zodiac-natal-chart-birth-chart-for-the-_1776530554115.txt`

### Group 119 — 3 identical files, 18672 bytes, SHA-256 `f22798d8b6b19b4ff5f2dc0f0503b46268c0eeb43657de00ddbdc9b516bdc337`
- `artifacts/api-server/_evolutions/evo-1776290951133-p4uv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290951145-mev1-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776290951353-285y-backup.ts.bak`

### Group 120 — 14 identical files, 10842 bytes, SHA-256 `f47f2d501d2ef1ff76bd4740e7fa2c16ae8cd04b6f157cdc39fde8cee7f90f71`
- `artifacts/api-server/_evolutions/evo-1776364692800-z4t6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776369180030-rwva-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776369720088-jplp-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776375780025-kafx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776380760020-lkt5-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776383160041-lcb9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776389580012-u74w-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776440520069-pqbb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776442260067-lyng-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776443473171-i8t0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776445453971-2gif-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776456600043-4zd6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459120004-6m7u-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776463080054-7u1e-backup.ts.bak`

### Group 121 — 2 identical files, 329 bytes, SHA-256 `f4cdd104de29928bfcd40b865c7d08eed9157a537fbb8b5e6d0921f02b63cc04`
- `artifacts/mockup-sandbox/src/components/ui/collapsible.tsx`
- `artifacts/tessera/src/components/ui/collapsible.tsx`

### Group 122 — 2 identical files, 4314 bytes, SHA-256 `f50b8af482cf8d40b76ea4f9a817f15d3d4d280df18c255e06803f3fbe2b613d`
- `attached_assets/Pasted--AI-IDEAS-social-media-network-or-they-could-post-on-re_1776436266447.txt`
- `attached_assets/Pasted--AI-IDEAS-social-media-network-or-they-could-post-on-re_1776436826121.txt`

### Group 123 — 148 identical files, 10789 bytes, SHA-256 `f560c531b7fd4549693ca140d55bd17c92662b9f2e9e655b65c54208ff1c6e36`
- `artifacts/api-server/_evolutions/evo-1776221151772-ju1u-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776279461140-uj3d-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776285512394-gp7z-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776331020555-wxmv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776331740015-ohen-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776331740024-pl3q-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776347100014-kxeu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776347100057-qojl-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776348011560-6500-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776348060025-6y6i-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776348240062-yah0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776348240073-b61j-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776349320055-c0wa-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776349451518-r7hn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776349451540-flxf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776350880039-x6lc-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776351360020-t00f-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776351360041-xo7g-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776351780046-wk75-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776351960046-lhwe-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776351960065-5yiz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776352860038-pqdu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776353340029-547z-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776353340051-3af9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776353580013-qoin-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776353580034-fam2-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776353760013-lttg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776353760036-cg1z-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776353940026-tapn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776354180016-2yg3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776354180055-6ozf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776354360029-mgyl-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776354360048-d8vu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776355271486-e711-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776355271524-jcvc-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776355451658-v8ud-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776355451684-qdln-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776356280049-i8rp-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776358800013-j9lx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776359040005-yi18-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776359171388-nico-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776359171413-r777-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776359351377-3l54-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776359351395-to3l-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776360900052-2f3f-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776361260027-i2jv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776361260055-9h31-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776362220052-9lhv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776362520038-7ic6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776362700015-he3s-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776362940028-pqxo-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776362940040-z7ik-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776363180022-mbl9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776363180043-aqsw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776365291822-1hwo-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776365351802-yyhu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776366071373-soeo-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776366491830-1zzw-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776366491846-zzrq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776366611444-8x9n-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776366670479-dve7-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776369851393-6lfu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776369851407-gt12-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776370632103-0dpk-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776370632123-b8uh-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776370740020-fp5z-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776370740031-isnz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776372671461-1is9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776373811833-5j72-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776373811862-733i-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776374291912-7mds-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776374291928-2w5u-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776374520039-bq7k-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776376030780-awat-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776376030801-13bn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776376211312-45q4-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776376211388-rka2-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776376631448-ax55-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776376631479-clim-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776377111752-wr5g-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776377111769-5zqb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776378669353-9rci-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776378671368-72l1-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776379211715-3pwq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776379211740-0xov-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776379392488-maf6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776379392503-peuf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776381000055-wg7g-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776381851724-9c76-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776382020076-8hwb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776384420072-q0gm-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776385080048-23jg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776386400105-ezqv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776386640006-fjjx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776386640018-z69w-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776386880018-lfd3-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776387120013-8aik-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776393060083-6u7v-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776393300004-jzkc-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776393611923-0zvx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776393660079-f9vb-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776393791598-xq6r-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776393791617-g3p9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776394571536-ifm4-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776394571647-ncgj-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776418980164-ol5b-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776419111842-c5rn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776420540055-gl4s-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776432720122-sojv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776435480075-b5j0-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776435840027-3lg9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776436740078-1o3d-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776442980023-du7h-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776444792232-8nyf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776444840108-hl9s-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776445572521-bz81-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776446233027-erdx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776447011848-m9bs-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776447060066-8f52-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776448512873-gllg-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776449172932-6y35-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776449340026-foyy-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776449832363-jo0r-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776449880068-35dn-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776450060063-pzkv-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776455580009-jc4k-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776455580020-2kk6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776455820005-6zvi-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776455820029-uxow-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776456600033-k9yu-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776457380001-wsmt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776457380036-krts-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776457680065-kk0p-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776457680076-dqqz-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459300034-w4xq-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459300045-c8pt-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459361528-r833-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776459430931-41mx-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776460080005-rf5f-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776460080033-47nf-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776461048610-jkby-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776461167627-b61v-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776461168980-g1p6-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776461400020-2ios-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776461820004-fh6r-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776461820065-7jq1-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776462490940-0sk9-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776462491061-29cs-backup.ts.bak`

### Group 124 — 3 identical files, 32908 bytes, SHA-256 `f5d4e4019c029758b45cbbe0417267849ce1f0316894e49962ff7396b15199a6`
- `artifacts/api-server/_evolutions/evo-1776470640041-i26n-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776472800003-n2ns-backup.ts.bak`
- `artifacts/api-server/_evolutions/evo-1776484560036-u65r-backup.ts.bak`

### Group 125 — 2 identical files, 1958426 bytes, SHA-256 `f8b87171a7bc91d7415257e6392b5211e93b432cd9255e262090d2d8eccc3a16`
- `attached_assets/IMG_1439_1776302490630.png`
- `attached_assets/IMG_1439_1776302940335.png`

### Group 126 — 2 identical files, 3835 bytes, SHA-256 `f9c982ed8114c253c6ca738043d3f455e89c6d65569e90c9415776d6b4d6be14`
- `artifacts/mockup-sandbox/src/components/ui/dialog.tsx`
- `artifacts/tessera/src/components/ui/dialog.tsx`

### Group 127 — 2 identical files, 518216 bytes, SHA-256 `fe60284a6064814f4dc4250524d41f1edfa182f15e56184ec36a5bea91267fcd`
- `attached_assets/IMG_1350_1776183506459.png`
- `attached_assets/IMG_1350_1776184673299.png`

### Group 128 — 3 identical files, 165121 bytes, SHA-256 `ff5a481800a61027788f13db07a8bf321caff046341741840047b03b522395d5`
- `attached_assets/IMG_1377_1776197457959.jpeg`
- `attached_assets/IMG_1377_1776197471083.jpeg`
- `attached_assets/IMG_1381_1776197471083.jpeg`

## Recommended handling

- Keep local runtime data, uploaded assets, agent/local tooling, and operator-specific instructions out of a GitHub snapshot unless you approve individual items.
- Keep the existing 489-commit local history unchanged; use a new sanitized initial commit for a private GitHub repository after the exclusion list is approved.
- Do not delete identical files solely because their hashes match. The active-source matches include components used by separate artifacts; a shared-library refactor requires separate approval and verification.
- Preserve generated evolution backups and user-uploaded assets unless a separate, path-specific deletion list is approved.

## Chart-data refactor and pre-push status

- The personal chart literals have been removed from `artifacts/api-server/src/lib/father-natal.ts` and `artifacts/api-server/scripts/convene-natal-key-conference.mjs`.
- Both now read `FATHER_NATAL_CHART_JSON` from Replit Secrets and validate the configuration.
- The secret exists, but the API currently fails startup because its contents are not valid JSON. Replace it with strict JSON and verify the API starts before uploading.
- No GitHub repository has been created and no files have been pushed.

## Additional workspace-local files not in Git history

The proposed snapshot is built from explicitly selected Git-tracked files, not by staging the whole workspace. These current untracked files are therefore excluded automatically:

- `.agents/agent_assets_metadata.toml` — local agent metadata.
- `.agents/outputs/github-push-review.md` — this review report.

Ignored and untracked recovery files are likewise not part of the snapshot. They appear in the duplicate-content inventory where relevant, but are not pushed.
