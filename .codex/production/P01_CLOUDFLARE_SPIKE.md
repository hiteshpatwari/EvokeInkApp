# P01 Cloudflare production-feasibility spike

Date: October 20, 2026

## Verdict

**Workers Paid required.**

The current application builds and runs on Cloudflare Workers through vinext.
An authenticated temporary mock-only Worker verified the home page, security
headers, static assets, prompt route, invalid-input rejection, private-field
rejection, origin enforcement, and content-free application events.

Workers Free is rejected because measured edge CPU exceeded its 10 ms request
limit. A first home request used 121 ms CPU and the valid mock prompt request
used 24 ms CPU. Invalid requests ranged from 3 ms to 39 ms. These are Cloudflare
real-time log measurements, not client wall-time estimates. Use Workers Paid for
P02 unless an architecture change produces new measurements below the Free limit
with adequate headroom.

OpenNext was not installed. Cloudflare's current documentation recommends
vinext for new Next.js 16 applications and describes OpenNext as the maintenance
path for existing OpenNext applications. Vinext passed the required application
behaviors, so adding a second adapter would add cost without resolving the CPU
measurement gap.

## Configuration selected for the spike

- `vinext` 1.2.1 and `@vinext/cloudflare` 1.1.1
- Cloudflare Vite plugin 2.0.0 beta.v.3 and `cf` 1.0.0 beta.19
- `nodejs_compat` with compatibility date `2026-10-19`
- Static assets served through an `ASSETS` binding
- `AI_PROVIDER` declared as the non-secret `mock` binding
- An exact temporary `APP_ALLOWED_ORIGINS` binding for the spike Worker
- No `OPENAI_API_KEY` binding or value in the P01 deployment
- The existing Next.js development and production scripts remain available

The temporary origin binding was removed from the checked-in spike config after
the Worker was deleted. P02 must supply the exact staging or production origin
when it provisions a persistent environment.

The adapter and Cloudflare tooling are beta dependencies. P02 must pin and
review upgrades rather than floating them.

## Executed evidence

### Compatibility and builds

- `pnpm exec vinext check` — passed: 100% compatible, 9 supported, 0 partial,
  0 issues. It detected the App Router page/layout, the route handler, Zod,
  React Hook Form, and the supported `next/server` import.
- `pnpm build:vinext` with mock mode — passed. It produced `/` and
  `/api/prompts`; vinext reported the API route classification as unknown
  because its classifier cannot yet detect every dynamic API use.
- `pnpm exec cf deploy --dry-run --prebuilt` — passed. It reported 22 asset
  files and a Worker upload of 2380.52 KiB uncompressed / 675.30 KiB gzip.
- `pnpm build` — retained as the canonical Next.js build and must remain green
  in combined verification.

Build warnings were limited to vinext/Vite source-map warnings, ineffective
dynamic-import notices, and a client chunk over 500 KiB. They did not prevent
the build but should be reviewed before enabling production source-map upload.

Running a vinext build after the canonical Next build rewrites generated type
artifacts under `.next`; a subsequent standalone typecheck reported stale route
exports. Running the canonical `pnpm build` regenerated the Next artifacts and
restored a passing typecheck. P02 should isolate build output or make this order
explicit in CI.

### Authenticated Workers deployment

The temporary `read-and-reflect-spike` Worker deployed successfully with no
OpenAI key, custom domain, DNS change, or paid-plan activation. The final tested
version was `1982281b-36c5-4b88-a0ec-1d2edc2fbb5d`.

Observed over HTTPS:

- `GET /` — HTTP 200, 6,711 bytes; CSP, `DENY`, `nosniff`, and `no-referrer`
  headers present; 121 ms CPU on the first measured request.
- Valid `POST /api/prompts` — HTTP 200, provider `mock`, four prompts,
  `Cache-Control: no-store`; 24 ms CPU.
- Empty JSON — HTTP 400; 5 ms CPU.
- Payload containing a child name — HTTP 400; 39 ms CPU.
- Disallowed origin — HTTP 403; 3 ms CPU.

Real-time logs redacted the installation token. Application events contained
only outcome, category, provider, and duration, with no request or response body.

The first deployed prompt requests exposed a runtime incompatibility:
`promptApiConfigFromEnvironment()` generated a fallback UUID while the route
module loaded, but Workers forbids random generation in global scope. The route
now initializes and caches its handler on the first request. A regression test
proves the module loads when random generation is unavailable in global scope.
The redeployed prompt route passed.

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
not made and no key was configured. P02 must provision `OPENAI_API_KEY` only as
an encrypted Worker secret after the shared-store and privacy gates pass.

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
2. Adopt Workers Paid only after explicit owner approval; P01 did not activate
   or purchase a paid plan.
3. Preserve the measured CPU evidence and repeat it after the P02 shared-store
   integration.
4. Provision `OPENAI_API_KEY` only through the Worker secret binding and confirm
   it is absent from client assets, logs, responses, and source maps.
5. Verify the real OpenAI path, mock fallback, runtime environment switching,
   production logs, security headers, rollback, and rate-limit/storage bindings
   required by P03/P04.

The spike used the owner's existing Cloudflare account and created one temporary
mock-only Worker on `workers.dev`. The Worker was deleted after evidence capture.
The spike created no paid subscription, custom domain, DNS record, OpenAI secret,
or production deployment.
