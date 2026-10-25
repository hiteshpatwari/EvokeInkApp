# Current workstate

## Objective

Add an automatic handwriting-extraction workflow to response coaching while
keeping child-image processing explicit, bounded, temporary, and disabled for
live providers until the remaining privacy and release approvals are complete.

## Current status

Phase 3 handwriting transcription is implemented locally across the web,
Cloudflare, and Capacitor code paths. After local photo preparation, the user
must explicitly choose **Read handwriting** before the prepared JPEG leaves the
device. A valid provider result is shown for confirmation or editing, with
**Looks right — get feedback**, **Edit text**, and **Retake photo** actions.
The image is disposed before the separate text-only feedback request.

Mock/key-free mode remains truthful: `/api/transcriptions` returns an unavailable
response and the UI offers retry, retake, or manual entry. It never fabricates
OCR output. Live OpenAI transcription is implemented but remains fail-closed
and has not been activated, deployed, or exercised with child content.

## Completed work

- Added a provider-neutral handwriting transcription contract with strict
  `transcript` and bounded `uncertainSegments` schemas.
- Added an OpenAI Responses API image adapter using structured output,
  `store: false`, a bounded timeout, and `maxRetries: 0` so one user action can
  spend at most one provider attempt.
- Added `/api/transcriptions` as a multipart-only route with exact-origin CORS,
  UUID installation identity, bounded streaming reads, JPEG MIME/signature and
  structural validation, decoded dimension/pixel limits, `no-store`, and
  content-free operational events.
- Added independent transcription quota and estimated-budget controls with a
  separately named Durable Object instance. OpenAI mode requires explicit live
  approval, a server-only key, a stable quota secret, and rejects native origins
  until device attestation exists.
- Replaced the manual-only provisional transcript step with explicit image
  submission, extraction progress, extracted-text review, edit/retake actions,
  uncertain-segment guidance, and honest recovery when extraction is
  unavailable.
- Refactored response feedback so confirmed photo text can be submitted directly
  without stale React state. The prepared image is disposed first and never
  enters `/api/feedback`.
- Added Capacitor transport routing for `/api/transcriptions`; invalid,
  unavailable, offline, or unconfigured hosted results become a truthful 503
  response and never a fabricated transcript.
- Updated the security baseline, store/privacy inputs, response-coaching design,
  UI specification, and work plan with the transient image flow and remaining
  release gates.
- Independent code review passed. Independent security review identified and
  then verified corrections for server JPEG structural/dimension validation,
  zero automatic provider retries, and missing privacy documentation.
- Real browser acceptance in mock mode completed: photo selection remained
  local, **Read handwriting** made one 503 transcription request, manual recovery
  remained usable, and **Looks right — get feedback** made one separate 200
  text-only feedback request.

## Validation evidence

- Full Vitest: 49 files / 301 tests passed.
- Mobile Vitest: 8 files / 57 tests passed.
- Root and mobile TypeScript passed after Next route type generation.
- Oxlint with warnings denied and scoped Prettier/diff checks passed.
- Next.js 16.4.3 production build passed and lists `/api/transcriptions` as a
  dynamic route.
- Vinext/Cloudflare production build passed and includes the transcription route
  plus its dedicated control-store module.
- Mobile production build passed using the current public Worker prompt URL;
  bundle secret scan passed. The existing large-chunk warning remains.
- Browser request evidence: `/api/prompts` 200 mock, `/api/transcriptions` 503
  truthful unavailable, `/api/feedback` 200 mock. The only console error was the
  expected browser resource entry for the deliberate 503 response.

## Open issues and blockers

- No OpenAI API key is configured by user choice, so automatic extraction is not
  yet usable outside injected/test provider results. Manual recovery works.
- Live transcription remains blocked on owner/legal privacy approval, provider
  and hosting retention review, finalized store disclosures, production budget
  approval, exact public origin review, controlled web acceptance, and native
  device attestation. `store: false` is a request setting, not a blanket
  retention guarantee.
- The new route and UI have not been deployed to the public Worker or installed
  as a refreshed Android APK.
- Physical camera/gallery acceptance on the S24 Ultra remains outstanding.
- Existing transitive audit findings for Cloudflare/webpack dependencies remain
  separately scoped and unchanged.

## Immediate next action

Commit and push the verified Phase 3 implementation. Keep transcription provider
mode set to `mock`; do not deploy or add an OpenAI key until the external privacy,
retention, budget, origin, controlled-web, and native-attestation gates are
explicitly approved.
