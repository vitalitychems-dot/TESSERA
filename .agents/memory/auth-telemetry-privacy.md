---
name: Authentication telemetry privacy
description: Project rule for IP addresses in authentication logs, persisted ingress audit, and rate-limit keys.
---

Do not log or persist raw client IP addresses in authentication/session telemetry or ingress audit. Keep any rate-limit address check in process memory behind a purpose-separated HMAC keyed with process-random material; never persist the derived key.

**Why:** The project explicitly treats IP addresses as personal data; rate limiting needs short-lived bucket equality, not a durable address record.

**How to apply:** When changing auth gates, session records, or audit fields, review request serializers, warning logs, filesystem/database records, and throttle maps. Redact legacy addresses where safe and document retention.
