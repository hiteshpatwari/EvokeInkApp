# P02 Cloudflare production deployment

## Decision and current gate

Cloudflare Workers Paid is the selected web runtime. The authenticated P01
measurement exceeded the Free plan CPU allowance, so an owner must confirm the
paid-plan activation before the first production deployment. Until then,
`AI_PROVIDER=mock` is the safe default and no public real-AI endpoint is
approved.

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

Store these only as Cloudflare Worker secrets:

- `OPENAI_API_KEY`
- `AI_QUOTA_HASH_SECRET` (a stable, independently generated high-entropy value)

Never put production secret values in `.env`, shell history, source, CI logs,
or command arguments. The interactive commands below prompt for values without
placing them in the command line:

```powershell
pnpm exec cf workers secrets update OPENAI_API_KEY --worker read-and-reflect
pnpm exec cf workers secrets update AI_QUOTA_HASH_SECRET --worker read-and-reflect
```

The quota hash secret must remain stable across deployments. Rotating it resets
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

6. Add/verify both secrets interactively. Keep `AI_PROVIDER=mock` for the first
   public smoke test. Enabling `openai` is a separate controlled deployment.

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

Stop or return to mock mode if the paid plan is unconfirmed, the origin is not
exact, either secret is absent, the quota hash secret is unstable, the Durable
Object concurrency probe fails, audit adds a runtime/client vulnerability, or
the owner has not approved the OpenAI privacy/retention posture.
