# P09 local operations foundation evidence

## Implemented

- Strict privacy-safe prompt operational event schema, sanitizer, sink
  isolation, console sink, deterministic in-memory sink, and counter
  aggregation.
- One route-level event for successful, rejected, fallback, quota, budget, and
  internal-error outcomes. Prompt responses are explicitly `no-store`.
- Fixed-data synthetic web/health/mock-prompt probe with machine-readable
  failure categories.
- Dry-run-first PowerShell mock failover and verified-version rollback tools
  with exact target confirmation and post-action probing.

## Boundary proof

Automated tests inject disallowed content through extra event fields, error
objects, request content, and sink failures. Only schema fields reach the sink,
request IDs are generated UUIDs, quota abuse keys are bounded HMAC prefixes,
and synchronous throws or asynchronous sink rejections cannot fail the user
request or escape as unhandled rejections. The route-level regression proves
status, response body, CORS, and cache headers remain identical and only one
event attempt occurs. Synthetic success/failure, aggregation arithmetic,
ambiguous-target rejection, and both dry-run plans are covered.

## Honest limitation

All evidence here is local. No Cloudflare deployment, failover, rollback,
provider failure, provider alert, retention configuration, or OpenAI billing
reconciliation was performed. Those gates are listed in the runbook, and P09
remains running.

## Validation executed

- `pnpm test` — 34 files / 172 tests passed.
- `pnpm lint`, `pnpm typecheck`, and `pnpm format:check` — passed.
- Mock Next production build — passed.
- `pnpm exec vinext check` — 100% compatible: 9 supported, 0 partial,
  0 issues.
- `pnpm build:vinext` — passed with existing vinext/Vite warnings.
- `pnpm exec cf deploy --dry-run --prebuilt` — passed without deployment.
- Local vinext preview synthetic probe — web, health, no-store, and mock prompt
  contract passed.
- Mock failover and rollback scripts returned valid dry-run JSON. No Cloudflare
  mutation occurred.
