# P02 Cloudflare production deployment

## Decision and current gate

Cloudflare Workers Paid is the selected web runtime. The authenticated P01
measurement exceeded the Free plan CPU allowance, so an owner must confirm the
paid-plan activation before the first production deployment. Until then,
`AI_PROVIDER=mock` is the safe default and no public real-AI endpoint is
approved.

Workers Paid was confirmed active on October 21, 2026. The paid mock release is
deployed at `https://read-and-reflect.hiteshpatwari.workers.dev` as version
`addba605-7cc8-4bf8-8d15-6548aa1cc31c`. Its exact origin allowlist contains the
public Workers URL and Android's `https://localhost`; both synthetic probes
pass. The deployment declares no OpenAI secrets and remains mock-only.

The Worker is `read-and-reflect`. It exports a SQLite-backed Durable Object
named `PromptControlDurableObject`; every production prompt reservation is
serialized through the single `global-v1` object. The application remains
usable in deterministic mock mode when OpenAI is disabled or unavailable.

## Production environment contract

Set non-secret bindings before building/deploying:

- `AI_PROVIDER`: `mock` for the initial release; change to `openai` only after
  all real-AI gates pass.
- `APP_ALLOWED_ORIGINS`: comma-separated exact application origins. Do not use
  wildcards. Browser production origins must use HTTPS. The Capacitor origins
  `https://localhost` (Android) and `capacitor://localhost` (iOS) may be
  configured only while `AI_PROVIDER=mock`; startup fails closed if either is
  combined with `AI_PROVIDER=openai`. Real-AI native access remains blocked
  until a verified device-attestation boundary is implemented.
- `OPENAI_MODEL`: currently `gpt-5-mini` unless an approved model is selected.
- `OPENAI_TIMEOUT_MS`: default `15000`.
- `OPENAI_MAX_RETRIES`: default `1`.
- `AI_MAX_REQUEST_BYTES`: default `12000`.
- `AI_INSTALLATION_MONTHLY_LIMIT`: default `20`.
- `AI_IP_MONTHLY_LIMIT`: default `200`.
- `AI_MONTHLY_BUDGET_USD`: default `250`; lower this for beta.
- `AI_ESTIMATED_REQUEST_COST_USD`: conservative per-request estimate used by
  the local budget circuit.
- `PROMPT_CONTROL_STORE`: fixed to `cloudflare` by the production config.

OpenAI mode requires both values below as Cloudflare Worker secrets. Mock mode
declares neither binding, so the initial deterministic deployment remains
key-free and does not require placeholder secret values:

- `OPENAI_API_KEY`
- `AI_QUOTA_HASH_SECRET` (a stable, independently generated high-entropy value)

Never put production secret values in `.env`, shell history, source, CI logs,
or command arguments. The interactive commands below prompt for values without
placing them in the command line:

```powershell
pnpm exec cf workers secrets update OPENAI_API_KEY --worker read-and-reflect
pnpm exec cf workers secrets update AI_QUOTA_HASH_SECRET --worker read-and-reflect
```

Provision both secrets before changing `AI_PROVIDER` from `mock` to `openai`.
The Cloudflare configuration declares both bindings together in OpenAI mode, so
a missing secret blocks that deployment. The runtime separately fails closed
when the quota hash secret is unavailable. The quota hash secret must remain
stable across deployments. Rotating it resets
the effective pseudonymous quota identities and requires an incident/change
record.

## Build and pre-deployment gate

Run from the repository root with `AI_PROVIDER=mock` unless explicitly testing
the approved OpenAI configuration:

```powershell
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:vinext
pnpm exec cf deploy --dry-run --prebuilt
pnpm audit --audit-level=moderate
```

The audit currently has one documented exception: `braces@3.0.3` is reached
only through vinext's build-time Vite file-matching chain, has no
registry-published patched version, and is absent from the generated Worker and
browser JavaScript. Do not pass untrusted glob patterns to the build. Recheck
the advisory whenever vinext is upgraded; any additional runtime or client
finding blocks release.

## First deployment

1. Owner confirms Workers Paid activation and billing alert/budget settings.
2. Operator confirms Cloudflare authentication and the intended account.
3. Set the exact production origin and conservative beta limits in the shell.
4. Build with `pnpm build:vinext`.
5. Deploy the prebuilt output with a clear release message:

```powershell
pnpm exec cf deploy --prebuilt --tag production --message "P02 production release"
```

6. Keep `AI_PROVIDER=mock` for the first public smoke test; this deployment
   intentionally has no provider-secret bindings. Enabling `openai` is a
   separate controlled deployment: provision/verify both secrets first, set
   `AI_PROVIDER=openai`, rebuild, and deploy only after all real-AI gates pass.

## Post-deployment checks

Replace `<origin>` with the actual HTTPS origin:

```powershell
Invoke-WebRequest -UseBasicParsing "<origin>/api/health"
Invoke-WebRequest -UseBasicParsing "<origin>/"
```

Release requires:

- `/api/health` returns `200`, `{ "status": "ok" }`, and `Cache-Control:
no-store`.
- `/` returns `200` with the CSP, `X-Content-Type-Options`, frame,
  referrer, permissions, COOP, and CORP headers defined in `next.config.ts`.
- A valid prompt request from the exact allowed origin succeeds; a disallowed
  origin is `403`, private/unknown fields are `400`, and an invalid installation
  token is `400`.
- An allowed-origin preflight returns `204`, reflects only that exact origin,
  permits only `POST, OPTIONS` and `Content-Type, X-Installation-Token`, and
  includes `Vary: Origin`. Prompt responses carry the same exact-origin and
  `Vary` protection without credentialed CORS.
- A low-limit concurrency probe proves the Durable Object admits exactly the
  configured number and rejects the remainder with `429`.
- Logs contain outcome/category/timing only, never prompts, notes, book data,
  child/profile data, request bodies, API keys, or quota inputs.
- Generated browser assets, Worker JavaScript, source maps, and responses do
  not contain secret values.

## Failover and rollback

Fast failover is a new deployment with `AI_PROVIDER=mock`. It preserves the
application and worksheet workflow while removing OpenAI cost and availability
dependency. After the mock deployment, repeat the health and prompt probes.

List deployments; the first item is the version currently serving traffic:

```powershell
pnpm exec cf workers deployments list --worker read-and-reflect
```

To roll back, create a 100% deployment for the previously verified version:

```powershell
pnpm exec cf workers deployments create --worker read-and-reflect --versions '[{"version_id":"<verified-version-id>","percentage":100}]'
```

Do not use `--bypass-deployment-checks` as a routine rollback. A changed secret
may intentionally block an unsafe older version; resolve that condition before
forcing traffic. Record the restored version ID and rerun post-deployment
checks. Durable Object data is not deleted by a code rollback.

## Stop conditions

### Paid mock verification record

On October 21, 2026, the authenticated account reported the `workers_paid`
subscription in state `Paid` at $5 per month. The latest mock version received
100% of traffic. Public-web and Android-origin probes passed the web, no-store
health, and four-prompt contracts. Attacker origin returned 403 without CORS;
unknown private fields and an invalid installation token returned 400. The home
response included the required security headers. Failover and rollback tools
produced dry-run plans without changing the serving deployment.

Worker observability, persistent logs, traces, and Logpush were disabled. The
approved seven-day metadata-only maximum therefore has no active persistent
collection to configure. Mock mode intentionally does not reserve OpenAI quota
or budget, so Durable Object low-limit rejection and provider-budget acceptance
remain later OpenAI gates. No OpenAI or quota-hash secret was configured.

Stop or return to mock mode if the paid plan is unconfirmed, the origin is not
exact, either secret is absent, the quota hash secret is unstable, the Durable
Object concurrency probe fails, audit adds a runtime/client vulnerability, or
the owner has not approved the OpenAI privacy/retention posture.
