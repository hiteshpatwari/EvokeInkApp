# Current workstate

## Objective

Add safe local photo preparation and transcript confirmation to response
coaching without uploading or persisting student images.

## Current status

Response-coaching Phase 2 is implemented and independently reviewed. A family
can choose one JPEG, PNG, or WebP response photo, prepare it locally, rotate or
trim it, type and confirm a provisional transcript, and then use the existing
text-only coaching request. Images remain in memory, are never uploaded or
persisted, and are disposed on every terminal path. Automatic handwriting OCR
and live image-provider processing remain disabled.

## Completed work

- Added strict response-feedback request and result schemas. The request carries
  only the selected prompt, bounded typed response, and reading profile fields;
  names, local IDs, book metadata, summaries, and parent notes are excluded.
- Added a provider-neutral feedback interface and deterministic mock provider.
  The mock makes only observable structural claims and always states that it
  cannot verify prompt alignment or book facts.
- Added `/api/feedback` with exact-origin CORS, UUID installation token checks,
  bounded request bodies, `no-store`, content-free operational events, and a
  feedback-specific quota/budget category and Durable Object namespace.
- Added the saved-worksheet response-review flow with explicit prompt context,
  validation, loading/retry states, strength-first coaching, keyboard/focus
  behavior, and native Back cleanup. Drafts survive recoverable request errors;
  closing the flow does not mutate canonical storage.
- Added Capacitor feedback transport. It derives the sibling HTTPS feedback
  route from the configured prompt endpoint, validates hosted responses, and
  falls back locally to deterministic feedback when offline or invalid.
- Fixed the React StrictMode lifecycle guard and independently re-reviewed both
  UI/mobile corrections with no remaining must-fix findings.
- Completed a real Playwright flow at desktop and 375x812: generated and saved a
  worksheet, opened the correct response review, submitted a typed response,
  and observed the full coaching result without application console errors.
- Ran the guided Next.js security upgrade in a dedicated worktree, checked local
  and remote branches plus open GitHub pull requests for duplicate work, and
  found none. Pinned Next.js 16.4.3 and enabled `experimental.agentUpgrade` in
  security mode as required by the updater.
- Compared dependency audits before and after: two critical and one high
  Next.js findings were removed. Remaining Zod, Undici, and fast-uri findings
  are unchanged transitive Cloudflare/webpack dependencies and were not
  introduced by this patch.
- Added strict local photo processing with MIME plus magic-byte validation,
  decoded byte/dimension/pixel bounds, rectangular trim, quarter-turn rotation,
  bounded canvas re-encoding to JPEG, and idempotent object-URL disposal.
- Added an accessible photo workspace with an on-device privacy disclosure,
  platform camera/file picker, visible rotate/trim/replace/discard controls,
  manual provisional transcript, explicit confirmation, and typed fallback.
- Closed the transcript-confirmation bypass by hiding the feedback form during
  photo mode and guarding submission defensively. Focus moves into the photo
  workflow and returns to the response field on confirmation or typed fallback.
- Verified the real browser journey at 375px: local image upload, rotate, trim,
  transcript edit and confirmation produced no `/api/feedback` request; the
  separate Get feedback action produced exactly one text-only request.

## Files or areas changed

- `src/domain/answerFeedback*` and focused schema/mock tests.
- `src/server/*AnswerFeedback*`, `src/app/api/feedback/`, and route/control tests.
- `src/components/ResponseReview.tsx`, worksheet/AppShell/native Back integration,
  responsive styles, and React integration tests.
- `mobile/src/promptTransport.ts` and transport tests.
- Response-coaching UI Spec, Design Doc, and Work Plan under `docs/`.

## Validation evidence

- Full Vitest: 41 files / 247 tests passed.
- Root and mobile TypeScript passed; oxlint passed with no warnings; scoped
  Prettier check and `git diff --check` passed.
- Next production build passed after the required security-nudge retry and lists
  `/api/feedback` as dynamic. Vinext/Cloudflare production build passed.
- Mobile production build against the public Worker passed; production bundle
  secret scan passed. Existing >500 kB chunk warnings remain non-blocking.
- Independent domain, API, and UI/mobile reviews all passed after fixes.
- On Next.js 16.4.3: 41 test files / 247 tests passed; root/mobile TypeScript,
  lint, formatting, Next production build, Vinext/Cloudflare build, mobile web
  build, clean Android debug APK build, artifact secret scan, and diff checks
  passed. The installed main-checkout version reports `Next.js v16.4.3`.
- Phase 2 full Vitest: 43 files / 271 tests passed. Root/mobile TypeScript,
  oxlint, scoped formatting, Next build, Vinext/Cloudflare build, mobile build,
  and diff checks passed. Independent security and UI reviews passed after the
  confirmation and focus fixes.

## Open issues and blockers

- `pnpm audit` still reports pre-existing transitive findings: Zod through
  Cloudflare config, Undici through Miniflare, and fast-uri through webpack.
  These need a separately scoped compatible dependency remediation.
- Automatic handwriting recognition is not implemented; the current
  provisional transcript is entered and confirmed manually after local photo
  preparation.
- Live transcription/feedback adapters remain disabled pending privacy/store
  approval, retention review, budget controls, controlled web acceptance, and
  native device attestation.
- This phase has not been deployed to the public Worker or installed on a
  physical Android device in this turn.

## Immediate next action

Commit and push Phase 2, then build/install the refreshed Android APK and run a
physical camera/gallery acceptance pass. After device acceptance, Phase 3 may
add disabled real transcription/feedback adapters; do not activate image or
child-authored text processing until every external release gate passes.
