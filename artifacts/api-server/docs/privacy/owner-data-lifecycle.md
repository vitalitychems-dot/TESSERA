# Owner data inventory, export, and deletion

## Scope and owner boundary

TESSERA has no user accounts or per-record owner IDs. The existing owner session cookie is the boundary for the private, single-owner workspace. The data controls below are available only to that session; a chat write still uses the existing chat sigil gate. They do not create an account system or change sign-in.

No live database rows were read while creating this inventory. It is based on schema and application code only.

## Stored-data inventory

| Store | Data classes in schema | Access and handling |
| --- | --- | --- |
| `conversations`, `messages` | Chat titles, message roles, full message text, timestamps | Conversation/message API reads require the owner session; chat writes also require the chat sigil. Included in owner export/delete. |
| `provider_calls` | Provider/model identifiers, request messages, response text, errors, token and latency metrics | Legacy rows can contain chat or fetched text. Provider-history APIs now require the owner session. New writes retain metrics only; prompt, response, and provider error text are omitted. Included in export/delete. |
| `provider_diffs` | Prompts, providers, responses, similarity results | History APIs now require the owner session. New records retain derived comparison results and provider IDs, not the prompt or response content. Included in export/delete. |
| `message_feedback` | Rating, conversation/message references, optional free-text query/reason/response fields | All feedback routes require the owner session. New writes keep the rating and bounded routing metadata only; free-text fields are discarded. Included in export/delete. |
| `model_routing_log` | Query text, model/tier, routing metadata, token estimate | New chat entries replace query text with a fixed redaction marker. Included in export/delete. |
| `natal_chart` | Father identity, birth date/time/place, calculated chart and derived keys | The natal-chart API is owner-session gated. Included in export/delete; deletion writes a tombstone so the database row is not automatically reseeded. The source value in `FATHER_NATAL_CHART_JSON` is a Replit Secret and is not read, exported, or removed by this feature. |
| `identity_verification_log` | Identity label, verification question key, result, timestamp | Included in owner export/delete. |
| `father_chat_sigils` | Sigil and session hashes, pending-rotation hashes, generation | Authentication material, not owner content. Never included in export or deletion. |
| `vector_embeddings`, `decision_history`, `system_state`, and security/system audit stores | Shared agent, system, and ingested knowledge state; some columns can hold arbitrary text or JSON | These stores have no reliable owner scope and can include shared/system data. They are intentionally excluded from this all-owner-data action until provenance and ownership are reviewed. Do not infer their contents from this inventory. |

## Export, deletion, and retention

Settings provides an owner-only JSON export and a two-step deletion flow. The private data routes require the owner session and are limited to 30 requests per minute per running server process. The deletion review shows record counts, expires after ten minutes, and requires the owner to type `DELETE MY TESSERA DATA`. The server rechecks counts and deletes the included records in one database transaction. Failed, expired, or stale reviews do not delete data. No deletion or migration is run automatically by the application or by this change.

Included records have no automatic expiry today. The retention policy is owner-controlled: records remain until the owner exports and explicitly deletes them. The summary and export responses are marked `no-store`; the export excludes credentials, Replit Secrets, and shared system state. The configured natal-chart secret remains in Replit Secrets and requires separate owner action there.

## Third-party and telemetry minimization

External chat-model use is off by default per chat and is capped at 40 qualifying requests per hour per running server process. If the owner enables it, the current message and non-sensitive retrieved evidence may be sent; saved conversation history and private system context are not sent. Pattern checks block detected credential, email, phone, street-address, US SSN-like, and payment-card-like text. These checks are safeguards, not a complete PII detector; keep external use off for confidential material.

Raw prompt/response content is no longer written to provider-call logs, provider comparisons, feedback records, or new model-routing rows. Legacy rows remain available only through owner-gated routes until the owner chooses the reviewed export/delete flow. Application errors in these routes use generic client messages and do not log request bodies.
