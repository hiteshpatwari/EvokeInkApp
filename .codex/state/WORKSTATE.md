# Current workstate

## Objective

Build the local P09 production-operations foundation without claiming or
performing owner-gated production OpenAI activation.

## Current status

P09 is running on branch `codex/p09-operations-foundation`. Privacy-safe prompt
events, deterministic counters, a fixed-data synthetic probe, and dry-run-first
mock failover/rollback tooling are implemented and locally verified. P09 is not
verified because production retention/access, provider alerts, live failure,
usage reconciliation, and live switch/rollback evidence remain outstanding.

## Completed work

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

- Seven-day metadata retention is recommended but not configured or approved;
  operator access and deletion responsibility are not proven.
- P02 still needs Workers Paid confirmation, a production web origin/secrets,
  and real-AI acceptance. Native OpenAI remains blocked pending attestation.
- P09 still needs an induced live provider failure, configured/tested provider
  budget alert, one monthly OpenAI usage reconciliation, and live mock
  failover/rollback rehearsals.
- P10/P11/P12 remain dependency- and owner-gated.

## Immediate next action

Independently review this branch, then merge the bounded P09 foundation while
keeping P09 running. Resume live gates only after the owner approves the
production telemetry and hosting boundaries.
