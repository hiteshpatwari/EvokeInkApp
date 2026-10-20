# P01 Cloudflare production-feasibility spike

Date: October 19, 2026

## Verdict

**Workers Paid required.**

The current application builds and runs in Cloudflare's local Workers runtime
through vinext. The home page, static assets, the prompt route's deterministic
mock path, and invalid-input rejection all worked without changing product
behavior. The generated Worker is also below Cloudflare's upload-size limit.

Workers Free is not approved because its 10 ms CPU limit was not proven. Local
Worker wall times were 98 ms for the first home request and 22 ms for the first
mock prompt request; warm mock prompt requests were 2-3 ms in the runtime log.
Wall time is not Cloudflare CPU time, so these measurements cannot certify the
Free plan. Production CPU metrics require an authenticated temporary deployment,
which is an owner checkpoint outside this spike. Use Workers Paid for P02 unless
a controlled Workers Free deployment records CPU below 10 ms with adequate cold
start headroom.

OpenNext was not installed. Cloudflare's current documentation recommends
vinext for new Next.js 16 applications and describes OpenNext as the maintenance
path for existing OpenNext applications. Vinext passed the required application
behaviors, so adding a second adapter would add cost without resolving the CPU
measurement gap.

## Configuration selected for the spike

- `vinext` 1.2.1 and `@vinext/cloudflare` 1.1.1
- Cloudflare Vite plugin 2.0.0 beta and `cf` 1.0.0 beta.18
- `nodejs_compat` with compatibility date `2026-10-19`
- Static assets served through an `ASSETS` binding
- `AI_PROVIDER` declared as the non-secret `mock` binding
- `OPENAI_API_KEY` declared as a required secret binding; no value is committed
- The existing Next.js development and production scripts remain available

The adapter and Cloudflare tooling are beta dependencies. P02 must pin and
review upgrades rather than floating them.

## Executed evidence

### Compatibility and builds

- `pnpm exec vinext check` — passed: 100% compatible, 8 supported, 0 partial,
  0 issues. It detected the App Router page/layout, the route handler, Zod,
  React Hook Form, and the supported `next/server` import.
- `pnpm build:vinext` with mock mode — passed. It produced `/` and
  `/api/prompts`; vinext reported the API route classification as unknown
  because its classifier cannot yet detect every dynamic API use.
- `pnpm exec cf deploy --dry-run --prebuilt` — passed without authentication or
  upload. The dry run reported 22 asset files and a Worker upload of 2371.83 KiB
  uncompressed / 672.47 KiB gzip.
- `pnpm build` — retained as the canonical Next.js build and must remain green
  in combined verification.

Build warnings were limited to vinext/Vite source-map warnings, ineffective
dynamic-import notices, and a client chunk over 500 KiB. They did not prevent
the build but should be reviewed before enabling production source-map upload.

### Local Workers runtime

The production vinext output was served with:

```text
AI_PROVIDER=mock pnpm start:vinext -- --host 127.0.0.1 --port 4173
```

Observed requests:

- `GET /` — HTTP 200; 6,711-byte HTML response; first runtime log 98 ms.
- A generated `/_next/static/...` JavaScript module was referenced by the HTML
  and served by the configured static-assets binding.
- Valid `POST /api/prompts` — HTTP 200, provider `mock`, four prompts; first
  runtime log 22 ms.
- Invalid `POST /api/prompts` with `{}` — HTTP 400; runtime log 3 ms.
- Twenty valid mock requests — client-observed wall time average 6.49 ms,
  minimum 5.19 ms, maximum 9.25 ms; Worker logs reported warm handling at
  2-3 ms.

The local preview log contained request method, path, status, and duration only;
it did not log request or response content.

### OpenAI route and secret boundary

The Worker bundle successfully includes the current OpenAI SDK-backed route,
and the route runs in the Workers runtime in mock mode. A live OpenAI call was
not made: this task may not create or expose a production key, and the local
runtime needs its value supplied through the declared secret binding. P02/P03
must verify the real-provider path after the owner provisions a restricted key
at the approved secret destination.

### Dependency audit

`pnpm audit --audit-level=moderate` returned non-zero after the vinext toolchain
was added:

- high: `braces` through vinext build tooling; the registry reported no patched
  version for the advisory.
- moderate: `fflate` 0.7.x through vinext -> `@vercel/og` -> satori; patched in
  0.7.5.

These are new transitive adapter findings and prevent declaring the spike
configuration production-ready. P02 must either update the adapter chain to
versions that clear the repository audit gate, document that an affected
package is build-only and unreachable in the deployed bundle with evidence, or
reject vinext. Do not waive the repository's moderate-or-higher production
vulnerability gate silently.

## Official sources checked

- Cloudflare Next.js guide, updated August 25, 2026:
  <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>
- Cloudflare OpenNext guide, updated October 12, 2026:
  <https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/>
- Cloudflare Workers limits:
  <https://developers.cloudflare.com/workers/platform/limits/>
- Installed Next.js 16.4 route-handler, runtime, and environment-variable guides
  under `node_modules/next/dist/docs/01-app/`.

## P02 gates and owner checkpoint

Before public deployment, P02 must:

1. Resolve or formally demonstrate non-production reachability for the two new
   audit findings.
2. Authenticate to an owner-controlled Cloudflare account and create only a
   temporary mock-mode deployment first.
3. Record Cloudflare CPU time for cold and warm home and prompt requests. Free
   can replace this spike's Paid verdict only if CPU remains under 10 ms with a
   documented safety margin.
4. Provision `OPENAI_API_KEY` only through the Worker secret binding and confirm
   it is absent from client assets, logs, responses, and source maps.
5. Verify the real OpenAI path, mock fallback, runtime environment switching,
   production logs, security headers, rollback, and rate-limit/storage bindings
   required by P03/P04.

No Cloudflare account, paid resource, Worker, domain, secret value, or external
deployment was created by this spike.
