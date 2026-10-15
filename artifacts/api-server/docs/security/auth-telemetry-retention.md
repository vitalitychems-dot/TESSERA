# Authentication telemetry and retention

## Address handling

- Authentication and Father-key rate limits use per-purpose HMAC address buckets held only in process memory. The HMAC key is generated at process start and is neither logged nor persisted; a process restart invalidates the buckets.
- Owner-session records do not retain client IP addresses. The API request logger serializes only request id, method, path, and response status.
- Ingress audit records contain timestamp, route, response status, and an optional one-way session identifier. They do not contain client IPs, cookies, or credentials.
- Startup redacts legacy IP-address fields from the active ingress file and its rolling backup before new audit writes are allowed; invalid JSON rows are dropped. If redaction fails, ingress writes are disabled and only a static warning is emitted.

## Retention

The ingress audit uses size-based retention: the default active-file cap is 1 MiB (minimum 64 KiB), with one rolling `.1` backup. A subsequent rollover replaces the prior backup. There is no time-based expiry; older events are discarded by rollover. Rate-limit buckets exist only for the configured in-memory windows and are not written to disk.

The configured active-file cap can be set with `INGRESS_AUDIT_MAX_BYTES`. Operators who change it should account for the same cap applying to the active file; only one previous rollover is retained.
