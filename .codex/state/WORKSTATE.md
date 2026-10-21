# Current workstate

## Objective

Complete P02 for the selected Cloudflare Workers Paid runtime: production
configuration, atomic public-AI controls, environment/secret contract, health
check, dependency disposition, deployment procedure, live probes, and rollback
proof.

## Current status

P02 implementation is complete on branch `codex/p02-cloudflare-production` but
not committed or deployed. The remaining gates are external/human: confirm the
Cloudflare Workers Paid subscription, choose the exact production HTTPS origin,
set production secrets, deploy, run live probes, and demonstrate rollback.

The production Worker is named `read-and-reflect`. It uses vinext 1.3.0 and
`@vinext/cloudflare` 1.2.0 with a custom Worker entrypoint. Two bindings are
declared as Cloudflare secrets (`OPENAI_API_KEY`, `AI_QUOTA_HASH_SECRET`); all
non-secret runtime controls are explicit text bindings with safe mock defaults.
`PROMPT_CONTROL_STORE=cloudflare` selects the host adapter.

## Completed work

- Added a SQLite-backed `PromptControlDurableObject` and a platform-neutral
  core that performs installation, IP, and estimated-budget reservation inside
  one storage transaction.
- Added `CloudflarePromptControlStore`, lazily selected by the prompt route so
  Node/local mock operation remains independent of Cloudflare modules.
- Made `AI_QUOTA_HASH_SECRET` mandatory for OpenAI mode. Mock mode is key-free
  and deterministic and no longer generates a random fallback secret during
  route-module initialization.
- Added `/api/health`, returning only `{ "status": "ok" }` with
  `Cache-Control: no-store`.
- Added Cloudflare config for the custom entrypoint, secret/text bindings,
  Durable Object binding/export, SQLite storage, assets, and current limits.
- Upgraded Vite 8.3.0 to 8.3.3, vinext 1.2.1 to 1.3.0, and
  `@vinext/cloudflare` 1.1.1 to 1.2.0.
- Overrode vulnerable transitive `fflate` 0.7.3 with compatible 0.7.5.
- Added `tmp/` to TypeScript exclusions so ignored validation clones do not
  pollute application typechecking.
- Added `.codex/production/P02_CLOUDFLARE_DEPLOYMENT.md` with the environment
  contract, interactive secret commands, build/release gates, smoke probes,
  mock failover, version rollback, and stop conditions.
- Updated the production issue register: P02 is `running` until live external
  gates pass.

## Validation evidence

- Focused health/config/Durable Object/route tests: 18/18 passed during TDD.
- Local Cloudflare workerd test used OpenAI mode with a deliberately open
  estimated-budget circuit, so no provider call or API key was needed. Twenty
  concurrent requests against an installation limit of 2 produced exactly two
  `200` deterministic mock fallbacks and eighteen `429` quota rejections. This
  proves the actual RPC binding, Durable Object subclass, SQLite-backed runtime,
  and atomic reservation boundary work together.
- `pnpm format:check`: passed.
- `pnpm lint`: passed with warnings denied.
- `pnpm build`: passed; Next routes include `/`, `/api/health`, and
  `/api/prompts`.
- `pnpm typecheck`: passed after the canonical Next build refreshed generated
  route types.
- `pnpm test`: 18 files and 87/87 tests passed.
- `pnpm build:vinext`: passed; generated Cloudflare output includes the Durable
  Object binding/export and both secret declarations.
- `pnpm exec cf deploy --dry-run --prebuilt`: passed; 23 asset files and about
  2,382.76 KiB uncompressed / 677.49 KiB gzip were accepted.
- Generated Worker and client JavaScript contain none of `fflate`, `braces`,
  `micromatch`, `fast-glob`, or `vite-plugin-dynamic-import`. The temporary
  local integration-only quota secret was also absent.
- No non-empty local OpenAI or quota-hash secret existed to scan in generated
  output.
- `git diff --check`: passed.

## Dependency disposition

`pnpm audit --audit-level=moderate` reports one high advisory for
`braces@3.0.3` through vinext's build-only
`vite-plugin-commonjs -> vite-plugin-dynamic-import -> fast-glob -> micromatch`
chain. The registry reports no patched version. The package is absent from all
generated Worker/browser JavaScript and the build receives repository-owned
patterns only. This is a documented, narrow build-tool exception; recheck on
every vinext upgrade. Any new runtime/client advisory remains release-blocking.

## Decisions and constraints

- Cloudflare Workers Free remains rejected because authenticated P01 probes
  measured 121 ms CPU for the first home request and 24 ms for a mock prompt,
  above the Free 10 ms gate. Workers Paid is required before production traffic.
- Default deployment mode remains `AI_PROVIDER=mock`. Real AI requires the
  stable quota-hash secret, exact HTTPS origin, conservative beta limits,
  provider budget controls, and owner-approved privacy/retention posture.
- Child names/local IDs stay out of network requests. Operational logs contain
  category/outcome/provider/timing only.
- Billing activation, payment, production secrets, DNS/origin selection, and
  production deployment remain owner checkpoints. No paid service was activated
  and no Worker was deployed in this turn.

## Immediate next action

Owner confirms whether the Cloudflare account is already on Workers Paid. If
not, owner activates it. Then set the exact production HTTPS origin and beta
limits, enter both Worker secrets interactively, build/deploy in mock mode, run
the documented live health/security/prompt/concurrency probes, deploy a second
version, and demonstrate rollback before P02 can become `verified`.
