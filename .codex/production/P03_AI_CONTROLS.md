# P03 AI controls deployment binding

## Implemented boundary

- The browser serializes a dedicated network DTO that excludes child names and local record identifiers.
- The route rejects unknown network fields, non-JSON requests, disallowed origins, malformed or oversized bodies, and invalid installation tokens.
- A privacy-preserving random installation token and a coarse IP key are independently quota-limited. Both are HMAC-pseudonymized before they reach the counter store.
- The default policy permits 20 OpenAI generations per installation per rolling 30 days and 200 per coarse IP key. Both are server-configurable. Explicit mock mode remains available without consuming provider quota.
- The monthly provider circuit reserves an estimated request cost before the provider call and switches to deterministic mock prompts when the configured budget would be exceeded.
- OpenAI calls have a 15-second timeout, one SDK retry, and a 2,500-token output ceiling. Timeout, rate-limit, server-error, invalid-output, and missing-key failures retain deterministic fallback behavior.
- Operational events contain only outcome category, provider, and duration. They exclude IPs, installation tokens, child/book/note/prompt content, and provider error text.

## Required production binding

`InMemoryPromptControlStore` is intentionally a single-isolate reference implementation. It is atomic for concurrent requests handled by that isolate, but cold starts and multiple instances can reset or divide counters. Before public OpenAI mode, bind the `PromptControlStore` interface to a host-native atomic store. For Cloudflare, use one Durable Object as the authoritative quota and budget reservation boundary. Configure provider-side OpenAI project budget alerts and limits as the final backstop; application estimates are not billing truth.

The production deployment must also set `APP_ALLOWED_ORIGINS` to the exact web origin. Native mobile clients require a separate attestation decision after P05 selects the shell architecture. Do not weaken origin enforcement by allowing `*`; add a verified native attestation implementation at the deployment boundary. Cloudflare Turnstile is the preferred web bot signal if public abuse testing shows installation-plus-IP controls are insufficient.

The deployment adapter must supply the client address from a trusted platform header and strip or overwrite caller-supplied forwarding headers. The route prefers Cloudflare's `CF-Connecting-IP`, then the first forwarded address; deploying it behind an untrusted proxy would make the IP-aware limit spoofable. The independent installation limit still applies, but is not a substitute for this host binding.

Set `AI_QUOTA_HASH_SECRET` as a stable host secret. Without it, each process uses an ephemeral value; that is suitable for local development but cannot produce shared quota keys across production instances.

## Environment contract

See `.env.example`. Monetary values are dollars; internally they are converted to integer micro-dollars. Quota values and body limits must be positive numbers. Invalid values fall back to the documented defaults.
