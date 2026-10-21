# Current workstate

## Objective

Verify the Workers Paid mock deployment and exact production client origins
without enabling OpenAI.

## Current status

Workers Paid is confirmed active. The latest `main` build is deployed in mock
mode at `https://read-and-reflect.hiteshpatwari.workers.dev`; the exact public
web origin and Android origin both pass synthetic probes. Worker observability,
persistent logs, traces, and Logpush remain disabled. P02 and P09 stay
`running` because no OpenAI secrets or real-provider acceptance exist.

## Completed work

- Fixed the reading-progress validation/UI mismatch: concise ranges such as
  `1-60` and completion values `full`, `complete`, and `completed` are accepted;
  ambiguous values such as `1` remain rejected. Focused and full tests pass.
- Added a validated operational-event boundary containing only a generated
  request ID, minute timestamp, bounded latency/status/provider/fallback/error,
  rate-limit decision, optional bounded token/cost fields, and a short HMAC
  prefix only for quota-denial correlation.
- Unknown/private inputs are stripped before emission. Synchronous sink throws
  and asynchronous sink rejections are contained immediately, do not create
  unhandled rejections, and do not affect the user response.
- Added zero-cost console and deterministic in-memory sinks plus aggregation for
  availability, HTTP errors, fallback, quota denial, latency, estimated cost,
  provider, and normalized error counters.
- Instrumented all prompt POST outcomes at the route/control boundary and set
  prompt responses to `Cache-Control: no-store`.
- Added a non-personal synthetic web/health/mock-prompt probe that reports only
  bounded machine-readable failure categories.
- Added exact-target, dry-run-first PowerShell tools for mock failover and
  verified-version rollback. Execution requires an explicit switch and
  PowerShell confirmation, followed by the synthetic probe.
- Added the P09 runbook and local evidence record; marked P09 `running`.

## Files or areas changed

- `src/server/promptOperations.ts`, prompt route controls, synthetic probe, and
  focused tests.
- `scripts/Invoke-SyntheticProbe.ps1`, `Invoke-MockFailover.ps1`, and
  `Invoke-WorkerRollback.ps1`.
- P09 issue status, runbook/evidence, package scripts, and this workstate.

## Validation evidence

- Full Vitest: 34 files / 172 tests passed, including route-level response/CORS
  equivalence and unhandled-rejection guards for an asynchronously failing sink.
- Formatting, lint, root/mobile TypeScript, and Next production build passed.
- Vinext reported 9 supported, 0 partial, 0 issues; vinext build passed.
- Cloudflare prebuilt deploy dry-run passed and made no deployment.
- Local vinext synthetic probe passed web, no-store health, and four-prompt mock
  response with exactly three required prompts.
- Failover and rollback plans returned valid dry-run JSON; ambiguous-target
  rejection is automated.

## Open issues and blockers

- Seven-day metadata-only retention and authorized-operator access are approved,
  but persistent Worker logs are currently disabled.
- P02 still needs OpenAI secrets and real-AI acceptance. Native OpenAI remains
  blocked pending attestation.
- P09 still needs an induced live provider failure, configured/tested provider
  budget alert, one monthly OpenAI usage reconciliation, and live mock
  failover/rollback rehearsals.
- P10/P11/P12 remain dependency- and owner-gated.

## Immediate next action

Keep the paid deployment mock-only while product/privacy testing continues.
When ready for real AI, create and configure the server-side OpenAI and stable
quota-hash secrets, approve provider retention, then run P02/P09 provider quota,
budget, failure-signal, reconciliation, failover, and rollback acceptance.
