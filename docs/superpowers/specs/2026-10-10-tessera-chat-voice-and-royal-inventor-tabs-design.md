# Tessera Chat Voice and Royal Inventor Tabs

**Status:** Design draft for user review  
**Product area:** Tessera web app  
**Purpose:** Make the Royal Inventor workspace easier to use on phones and make main Chat answer through Tessera's configured voice rather than the current deterministic generator alone.

## Problem

The Royal Inventor page places nine sub-tabs in one header. On a narrow screen, the header competes with the profile and content and makes destinations difficult to scan. The main `/api/messages` route builds most visible replies from `generateSovereignResponse`; the existing Tessera identity prompt is not the active response generator. Provider output is currently kept internal by design, so using model-generated text for visible replies is an explicit change to that boundary.

## Approved scope

1. Consolidate the nine Royal Inventor views into five top-level groups, preserving all nine destinations and keeping Chat directly visible.
2. Use the already configured AI path to draft user-visible main-chat replies, only after the existing safety, truthfulness, and grounding checks. Retain the local responder as a fallback.
3. Keep app-wide navigation, forum content, database structure, the separate Royal Inventor chat endpoint, and other app pages unchanged.
4. Use the running web preview to verify desktop and phone layouts after implementation. Do not publish as part of this work.

## Royal Inventor navigation

Replace the current nine-button header with these five top-level tabs:

- **Plan:** Reality, Program, Proposals
- **Build:** Inventions, Improve
- **Knowledge:** Vault
- **Agents:** Royal, Meeseeks
- **Chat:** the existing Rick chat view, kept directly visible

For groups with multiple views, show a compact, clearly labeled inner selector. Preserve each existing component, its data, actions, and selected-state behavior. The default remains the Proposals view inside Plan, matching the current default. Avoid clipping the profile header on small screens; allow the header content to wrap or stack, and keep controls within the viewport.

## Main-chat voice and response flow

The `/api/messages` path should use the existing configured provider to generate a Tessera response. Create a concise main-chat persona prompt that directs the model to:

- Speak as Tessera in one consistent, warm, direct, knowledgeable voice.
- Answer the user's actual request before adding optional context.
- Use Tessera-specific language and signature only when it fits; do not force repeated slogans, frequency references, or creator references into unrelated answers.
- Distinguish retrieved facts and tool results from interpretation; do not invent system activity, personal memories, or unsupported capabilities.
- Be candid when information is uncertain or an external/provider call fails.

Pass conversation history, relevant retrieval results, and tool outputs as context, not as higher-priority instructions. Keep retrieved excerpts and external content untrusted; they must not override the system prompt.

The provider may produce visible text only after the existing validation and grounding pipeline accepts it. Use the existing secure provider transport and bounded timeouts. If the provider is unavailable, times out, or returns an invalid/unaccepted response, use the local deterministic responder and clearly mark that response as a local fallback. Do not send unvalidated raw provider text to the browser. Preserve the current SSE envelope, message persistence, citations, tool-result behavior, and retry/error handling.

The approved change explicitly revises the current provider-output boundary for validated final responses only. It does not permit raw provider output to bypass the existing validators.

## Failure behavior

- Provider failure or validation rejection falls back to the local responder and identifies the fallback in response metadata and the chat UI.
- If both provider and fallback fail, return a clear retryable chat error rather than an empty response.
- Keep already-rendered conversation history intact on send failures.
- If a grouped Royal Inventor view has no data, show its existing empty state within the new group rather than removing the group.

## Implementation sequence

1. Add tests for grouped tab selection and verify that all nine existing panels remain reachable.
2. Update Royal Inventor header layout and grouped sub-navigation; preserve the current default Proposals selection and the existing chat tab.
3. Add a main-chat provider adapter using only current configuration and secure transport.
4. Add the concise Tessera prompt to the active `/api/messages` path and keep the existing validators between generation and display.
5. Ensure the local fallback is identifiable and preserves SSE, persistence, citations, and tools.
6. Restart the web and API workflows once after code changes; verify the running app at desktop and phone sizes.

## Verification

- UI tests cover all five groups, all nine destination panels, default Proposals selection, direct Chat access, and narrow-width overflow.
- API tests verify the active route supplies the Tessera prompt and relevant history/context to the provider adapter.
- Tests prove untrusted retrieved text cannot override the persona prompt.
- Tests prove accepted provider output is returned only after validation, while timeout, provider failure, and rejected output use the local fallback.
- Tests verify the fallback marker, SSE completion event, persisted user/assistant messages, citations, and tool results.
- Preview checks confirm the profile header and tabs fit at phone width, all destinations are readable, and the app remains usable on desktop.

## Out of scope

- Changing the app-wide bottom navigation or Knowledge Hub sub-tabs.
- Changing the Royal Inventor/Rick chat response endpoint.
- Adding a new model provider, credentials, paid service, database table, or auto-implementation workflow.
- Publishing or changing deployment configuration.
