# Current workstate

## Objective

Finish the Android-native handwriting-transcription production gate without
exposing the OpenAI key, accepting forged native origins, exceeding the approved
AI budget, or weakening the existing transient-image privacy boundary.

## Current status

The implementation is complete in the working tree but is not committed or
deployed. `main` remains at `a558946`. Live handwriting transcription remains
disabled by default. The production Worker configuration now contains the
server-only Play Integrity credentials and handwriting quota-hash secret, but
the feature flags remain disabled and no real child image is processed.

Android now uses Google Play Integrity standard requests for the explicit
**Read handwriting** action. A local Capacitor plugin wraps Play Integrity 1.6.0,
warms the standard token provider at app startup, and requests one token per
transcription action. The request hash uses a versioned canonical payload bound
to the fixed POST route, the validated installation UUID, and the SHA-256 digest
of the exact prepared JPEG. Attestation is time-bounded; failure or timeout
returns the existing manual-entry fallback without uploading the image. An
expired or failed native token provider is discarded so a later action can
prepare a fresh provider.

The Worker decodes the encrypted token through Google's Play Integrity API
using a server-only service-account credential. Before any paid quota
reservation or OpenAI call it requires the Evoke Ink package, the exact request
hash, a token no more than two minutes old, `PLAY_RECOGNIZED`, an allowlisted
Play App Signing certificate, `LICENSED`, and `MEETS_DEVICE_INTEGRITY`.
Untrusted verdicts fail closed with generic UI-safe copy. Google standard
requests supply replay protection. Invalid-token traffic is also limited
atomically to ten Google decode attempts per coarse IP per hour; this attempt
limiter does not consume the paid OpenAI budget.

Prompt generation, feedback, and handwriting transcription now use one named
SQLite-backed Durable Object (`provider-ai-v2`) for the provider-budget counter.
Feature-prefixed installation/IP quota hashes remain separate. The
transcription path uses the same `AI_MONTHLY_BUDGET_USD` ceiling as prompt
generation, so one feature cannot authorize spend above the shared application
budget. Production remains configured at $2.70 below the $3 provider hard
limit.

## Changed areas

- Android/Capacitor: Play Integrity dependency, build project number, native
  plugin, startup warmup, request-bound mobile transport, timeout/recovery tests.
- Worker/server: Google service-account OAuth, token decoding and strict verdict
  validation, native attestation enforcement, pre-verification abuse limit,
  shared provider-budget object, and focused tests.
- Release automation: Android Cloud project-number variable and disabled-by-
  default Worker activation variables.
- Documentation: activation runbook, security baseline, and P3-T2 completion.

## Validation completed

- Focused security/transport suite: 5 files, 58 tests passed.
- Full Vitest suite: 55 files, 343 tests passed.
- `pnpm typecheck` passed for Next.js and mobile.
- `pnpm lint` passed with warnings denied.
- `pnpm format:check` and `git diff --check` passed.
- `pnpm audit --audit-level=moderate`: no known vulnerabilities.
- `pnpm build` passed when run serially after `pnpm typecheck`.
- `pnpm build:vinext` and Cloudflare prebuilt dry-run passed in mock mode.
- Production mobile Vite build and Capacitor Android sync passed.
- Android `:app:compileDebugJavaWithJavac` passed, 109 tasks.
- Final security re-review passed with no remaining must-fix code findings.

The first parallel Next/vinext build attempt produced stale generated Next route
types. This was a build-output race caused by running both generators at the
same time, not a source failure. The repository's normal serial CI order passed.

## External activation gates

The Play Console app is linked to Google Cloud project `evoke-ink-app`
(project number `189448515979`). Play Integrity is enabled with app licensing,
application integrity, and device integrity verdicts. The GitHub repository
variable `PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER` is set. A dedicated role-free
service account exists, and the production Worker now shows these secrets with
encrypted values:

- `PLAY_INTEGRITY_SERVICE_ACCOUNT_EMAIL`
- `PLAY_INTEGRITY_SERVICE_ACCOUNT_PRIVATE_KEY`
- `HANDWRITING_TRANSCRIPTION_QUOTA_HASH_SECRET`

The downloaded one-time Google JSON credential was deleted from the local
Downloads folder after the Worker secrets were verified. The remaining
owner-controlled activation gates are:

1. Add the Play App Signing certificate SHA-256 digest to the approved Worker
   configuration.
2. Record approval for OpenAI under-18/Zero Data Retention posture, Cloudflare
   body/header logging and retention, the privacy policy, and Play Data safety
   disclosures.
3. Upload the signed AAB to Play Internal testing, install it from Google Play
   on the S24, and run the synthetic valid/tampered/replay acceptance matrix. A
   sideloaded APK cannot prove `PLAY_RECOGNIZED` and `LICENSED`.

Until those steps pass, keep `HANDWRITING_TRANSCRIPTION_PROVIDER=mock`,
`HANDWRITING_TRANSCRIPTION_LIVE_APPROVED=false`, and
`PLAY_INTEGRITY_ENABLED=false`. Manual transcript entry remains available.

## Immediate next action

Review and commit the implementation. Then add the Play App Signing certificate
digest and complete the privacy approvals before uploading an internal-test AAB
and running the Play-installed S24 acceptance matrix. Do not enable the live
transcription flags before those gates pass.
