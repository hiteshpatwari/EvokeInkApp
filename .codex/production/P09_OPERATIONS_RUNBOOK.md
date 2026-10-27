# P09 operations and cost runbook

## Status

P09 is **running**, not verified. This repository now has the local operations
contract and rehearsal tools, but no production OpenAI acceptance or telemetry
retention claim is made.

## Privacy-safe event boundary

The prompt route emits one validated, sanitized event per POST outcome. The
only permitted fields are:

- generated UUID request ID;
- minute-coarsened timestamp and bounded duration;
- fixed `/api/prompts` route and bounded HTTP status;
- `mock` or `openai` provider, fallback flag, and normalized error category;
- rate-limit decision and, only for quota denial, a 12-hex-character prefix of
  the HMAC abuse-control key;
- bounded token counts and estimated cost in micros when available.

Unknown fields are discarded before the sink is called. Child, profile, book,
title, author, reading progress, notes, summaries, detail notes, prompts,
worksheets, request bodies, headers, provider responses, API keys, IP addresses,
and raw installation tokens are forbidden. Sink failures are contained and do
not change the prompt response.

`ConsolePromptEventSink` is the default zero-cost platform sink. It emits one
JSON object suitable for host log/event collection. `InMemoryPromptEventSink`
is deterministic test infrastructure. No paid observability dependency is
introduced.

The aggregation helper reports request count, availability, HTTP errors,
fallbacks, quota denials, duration total/max/average, estimated cost, provider
counts, and normalized error counts. Estimated cost is an application control,
not billing truth.

## Synthetic check

The probe uses fixed non-personal data and checks the web page, no-store health
response, and deterministic mock prompt schema. It returns compact JSON and
never includes response bodies or exception messages in failures.

```powershell
pnpm ops:probe -- -BaseUrl https://example.invalid -AllowedOrigin https://example.invalid
```

Success exits 0 with `{"ok":true,...}`. Any failed boundary exits 1 with a
bounded category such as `health_contract_failed`.

## Emergency mock failover

Dry-run is the default. The exact environment/worker confirmation prevents an
ambiguous target. The script builds with `AI_PROVIDER=mock`, deploys, and runs
the synthetic check only when both `-Execute` and PowerShell confirmation are
provided.

```powershell
pnpm ops:failover -- -Environment production -WorkerName evoke-ink-app `
  -AllowedOrigin https://app.example.invalid `
  -ProbeBaseUrl https://app.example.invalid `
  -ConfirmTarget production/evoke-ink-app
```

Review the JSON plan, then repeat with `-Execute`. Never use a native Capacitor
origin in public OpenAI mode. This script was dry-run validated only; it was not
used to mutate Cloudflare during P09 foundation work.

## Rollback

Obtain and independently verify a deployment version ID before rollback. The
script routes 100% to that version and then probes only with `-Execute` and
PowerShell confirmation. It never bypasses deployment checks.

```powershell
pnpm ops:rollback -- -Environment production -WorkerName evoke-ink-app `
  -VerifiedVersionId 00000000-0000-0000-0000-000000000000 `
  -AllowedOrigin https://app.example.invalid `
  -ProbeBaseUrl https://app.example.invalid `
  -ConfirmTarget production/evoke-ink-app/00000000-0000-0000-0000-000000000000
```

Durable Object data is not deleted by code rollback.

## Review cadence and cost reconciliation

Daily during launch, aggregate prompt events and check availability, 5xx rate,
fallback rate, quota denials, latency, and estimated cost. Monthly, compare the
event estimate with OpenAI project usage for the same UTC interval. Record the
two totals, absolute and percentage difference, model/pricing changes, delayed
provider usage, and unexplained variance. Treat OpenAI usage as authoritative.

Provider-side project budget alerts and limits must be configured and tested by
the owner before OpenAI mode. The application budget circuit remains an
additional fail-closed control.

The owner approved a seven-day maximum for privacy-minimized metadata and access
limited to authorized Cloudflare account operators on October 21, 2026.
Persistent Worker logs, traces, observability, and Logpush are currently
disabled, so no persistent collection is active. Re-verify the configured
retention before enabling any persistent destination.

## Gates before P09 can be verified

- configured and verified seven-day metadata retention before persistent
  collection is enabled;
- Workers Paid confirmation, production web origin, secrets, and P02 OpenAI
  deployment acceptance;
- an induced provider failure that produces the expected sanitized fallback
  signal;
- a provider budget alert and limit configured and test-notified;
- one monthly OpenAI usage reconciliation with recorded variance;
- live mock switch and verified-version rollback rehearsals with post-action
  synthetic checks.
