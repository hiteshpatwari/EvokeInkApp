# Current workstate

## Objective

Make routine web and Android release preparation automatic so a verified main
commit produces a deployable web release and downloadable Android artifact with
minimal owner action.

## Current status

The product and repository are now named **Evoke Ink** / `EvokeInkApp`; the
Cloudflare Worker is `evoke-ink-app`. Release automation is enabled on `main`
and has passed its complete hosted web and signed Android paths. The owner's
upload-keystore secrets and `ENABLE_ANDROID_RELEASE=true` are configured; direct
`main` releases now produce signed, non-debuggable, minified APK and AAB
artifacts. Debug APKs remain local QA only. Web release automation still covers
Cloudflare deployment, and public home/health/prompt probes. Web prompt
generation now uses OpenAI with a $2.70 in-app ceiling and a 45-second bounded
timeout, no implicit retries, a five-request hourly IP limit, and a 40-request
monthly IP limit. Both `https://evokeink.hiteshpatwari.com` and the direct Workers URL
are approved web origins; the custom domain is canonical for release probes and
Android API packaging. Native origins remain excluded. The required GitHub Cloudflare secrets
and enable variable are configured. The public Worker serves Evoke Ink branding
and the old `read-and-reflect` Worker URL returns 404.

The Android and Capacitor application ID is now `app.evokeink.mobile`, selected
before the first Google Play upload. The legacy `read-reflect:*` persistence keys
and backup format marker remain unchanged as internal data-format identifiers.

`next-env.d.ts` is now generated and ignored as Next.js recommends. A tracked
`vinext-env.d.ts` owns the vinext augmentation, and `typecheck` explicitly runs
`next typegen`, removing the previous dependence on stale `.next` output.

## Completed work

- Added a durable UI specification at
  `docs/ui-spec/ink-and-marigold-theme-ui-spec.md` covering semantic tokens,
  typography, responsive behavior, accessibility, native layout, and print.
- Reworked the shared stylesheet so both web and Capacitor receive the same
  palette, editorial hierarchy, cards, form states, notices, coaching UI,
  worksheet treatment, focus indicators, and selected states.
- Added `aria-current` to top-level navigation and regression coverage for the
  active destination.
- Corrected native/mobile layout issues found during UX critique: the brand and
  horizontal navigation remain usable at 320 px, content no longer receives an
  oversized safe-area offset, decorative hero art cannot cover narrow text, and
  programmatic page focus does not show an unwanted outline.
- Corrected accessibility issues found in code review: stronger line contrast,
  approved eyebrow tracking, and 48 px controls (including icon buttons) for
  narrow and native layouts.
- Preserved reduced-motion, forced-colors, and black-and-white print behavior.
- Reconciled the Saved reflections screen with the Home composition: contained
  gradient introduction, surfaced filter toolbar, full-width empty state, and
  aligned backup panel.
- Added inline Home and Saved icons without a new dependency. Desktop retains
  icon plus text; narrow web and native views retain accessible names/tooltips
  while showing two icon-only navigation controls.
- Added `.github/workflows/release.yml`. It repeats the full release gate on the
  privileged direct-main trigger, then packages Android. Cloudflare deployment
  is restricted to `main`, deterministic mock mode, and an explicit repository
  enable variable.
- Added `scripts/Invoke-AndroidRelease.ps1` and the `release:android` and
  `release:android:install` package commands. The script validates Java/Android
  tooling, builds and syncs Capacitor, scans secrets, assembles the APK, hashes
  it, and installs/launches only when exactly one authorized device is present.
- Added `docs/RELEASE_AUTOMATION.md` with one-time setup and unavoidable manual
  store, signing, iOS, and physical-acceptance boundaries.
- Added `.codex/state` to `.prettierignore` so ignored operational snapshots no
  longer break unattended formatting checks.
- Gemma4:26b was started twice through the required global router and confirmed
  in Ollama, but both runs drifted into unrelated Mobbin tasks. They were stopped
  before modifying the workspace; implementation was completed by a scoped
  worker and independently reviewed instead.
- Renamed the visible web/mobile product, metadata, PDF heading, share title,
  backup filename, package/workspace labels, Android artifact, Worker target,
  release URLs, operational scripts, and active documentation to Evoke Ink.
  Preserved the Android application ID, local-storage keys, native migration
  key, and `read-and-reflect-backup` format marker so installed-app identity and
  existing user data remain compatible.
- Changed prepared OpenAI credentials to unconditional Cloudflare secret
  bindings even while mock mode is active, avoiding dashboard-secret removal or
  configuration conflicts during a mock release. Reduced the default
  in-application prompt budget from $250 to the approved $3 pilot allowance.

## Validation evidence

- Full Vitest: 49 files / 304 tests passed.
- Root and mobile TypeScript passed.
- Oxlint with warnings denied, scoped Prettier, and `git diff --check` passed.
- Next.js 16.4.3 production build passed.
- Repository-wide Prettier now passes without touching ignored state files.
- `actionlint` 1.7.12 and `zizmor` 1.31.1 pedantic passed the release workflow
  with zero findings. An unsafe `workflow_run` draft was rejected and replaced
  with a direct-main trigger plus an internal verification job.
- Local `pnpm release:android` passed: 214 Gradle tasks produced
  `app-debug.apk`; the mobile secret scan passed and SHA-256 was recorded.
- The first hosted release run passed its full verification job and exposed a
  clean-run ordering defect: the APK scanner ran before Gradle. The script now
  assembles before scanning, and the corrected order passed locally. Checkout
  and setup-node were also advanced to pinned Node 24 action releases after the
  runner flagged their older Node 20 runtimes.
- The separate Quality run exposed one timing-sensitive native-persistence
  assertion under hosted load. Its wait is now bounded at five seconds; the
  focused test passes locally without changing application behavior.
- Hosted parallel execution also starved several jsdom/user-event tests. Both
  CI quality gates now serialize test files on the two-core runner. The full
  serialized suite passed locally: 49 files and 303 tests in 62 seconds.
- Hosted jsdom truncated both rapid typing and clipboard simulation in a few
  setup-only paths, especially under StrictMode. Those paths now seed the form
  with one atomic change event while a dedicated user-event test retains actual
  keystroke coverage. The two focused files passed five consecutive runs (35
  tests total), followed by the full serialized suite (303 tests).
- The authoritative hosted Release Automation run passed formatting, lint,
  types, 303 tests, production web build, Android build, bundled-secret scan,
  SHA generation, and artifact upload. Cloudflare deploy skipped by design
  because the enable variable and secrets are not configured.
- Hosted Release Automation run `40568368750` passed at commit `18e5f69`:
  formatting, lint, types, 304 tests, production web build, Android build,
  bundled-secret scan, SHA generation, and renamed artifact upload passed. The
  Cloudflare job skipped because its GitHub enable variable and secrets remain
  unset. A process-startup test exposed by the preceding run now has a narrow
  15-second ceiling and passed five consecutive local runs before the hosted
  rerun passed.
- Hosted Release Automation run `40574662630` passed at commit `0d53869` after
  a one-time interactive reconciliation of the dashboard-owned Worker
  configuration. It passed the complete quality gate, Android artifact build
  and scan, unattended Cloudflare deployment, and hosted synthetic probe.
- The public synthetic probe returned `web=true`, `health=true`, and
  `prompt=true`. The public home returned 200, contains `Evoke Ink`, and does
  not contain the retired `Read & Reflect` brand.
- `Quality` now runs for pull requests and manual dispatch only. Direct `main`
  pushes use the stricter Release Automation gate, avoiding a redundant second
  full test/build run and conflicting status signal.
- `docs/RELEASE_AUTOMATION.md` now contains operator-grade setup sections for a
  dedicated OpenAI project/key, Cloudflare Worker secret storage, the separate
  reviewed OpenAI activation gate, a least-privilege Cloudflare deployment
  token, GitHub secret/variable entry, verification, and rollback.
- Vinext/Cloudflare production build and `cf deploy --dry-run --prebuilt`
  passed in mock mode.
- Mobile production build passed using the current public Worker prompt URL;
  bundle secret scan passed. The existing >500 kB chunk warning remains.
- Browser review covered desktop, 430 px mobile web, and 320 px native-emulated
  layouts with no horizontal overflow. The child-profile form also remained
  usable at the narrow native viewport.
- Follow-up browser review covered the corrected Saved reflections screen at
  desktop and 375 x 812. The two icon controls, active state, stacked filters,
  contained empty state, and backup panel rendered correctly.
- Removed the generic 720 px intro cap from the Saved reflections header so it
  aligns exactly with the library toolbar, cards, and backup panel. Replaced
  the initials tile and legacy sage favicon with the Evoke Ink open-page,
  rising-ink, and marigold-spark mark across web and the shared mobile UI.
- Rendered verification measured the library intro, toolbar, and empty state at
  1144 px each on desktop and the intro/toolbar at 415 px each at the narrow
  breakpoint. Narrow navigation retained exactly two icon-only controls with
  no horizontal overflow; the 38 px logo remained legible.
- Final UX designer verdict: pass. Final independent code review: pass.
- Fixed prompt regeneration so each prompt owns a monotonically increasing
  variant counter. Deterministic mock regeneration now preserves the selected
  skill plan while changing the visible wording; an unchanged provider result
  is reported honestly instead of claiming that the prompt was refreshed.
- Replaced the disabled-at-two focus-skill interaction with direct selection:
  choosing another core skill replaces the oldest selected core skill and an
  accessible inline status explains the change. Prediction remains the
  independent optional fourth-prompt choice.
- Focused regeneration/skill regressions passed (22 tests). Full serialized
  Vitest passed (49 files / 306 tests), as did root/mobile typecheck, lint with
  warnings denied, scoped Prettier, `git diff --check`, and the Next.js
  production build. A live local browser check confirmed enabled alternative
  skills, replacement feedback, and two visibly distinct consecutive
  regenerations.
- Release Automation run `40581611129` passed for commit `ad84be0`: the hosted
  release gate, Android APK build and bundled-secret scan, artifact upload,
  Cloudflare deployment, and public synthetic probes all completed successfully.
- The first OpenAI activation deployment (`52208b5`) correctly failed its live
  no-fallback probe because an outer 15-second fallback timer ignored the
  configured provider timeout. Traffic was restored to verified mock version
  `8c0beb46-15f8-4d74-ac2f-70a55a99d03b`; the rollback command was updated for
  the current Cloudflare CLI. The timer now uses the same bounded 30-second
  OpenAI policy. A local real-provider run then returned `provider: openai` and
  `fallback: false` in 15.35 seconds.
- Release Automation run `40586808335` passed at commit `d972ac3`, including
  308 tests, Android artifact build/scan, web-only OpenAI deployment, and a live
  synthetic OpenAI/no-fallback probe. An independent public request returned
  HTTP 200, four prompts (three required), `provider: openai`,
  `fallback: false`, and `Cache-Control: no-store` in 15.17 seconds.
- Replaced the child-specific profile helper label with **Use sample values**;
  the seeded values remain available without naming the demo child in the UI.
  Added the owned `https://evokeink.hiteshpatwari.com` origin alongside the
  direct Workers URL and made it the canonical probe/mobile API hostname.
- OpenAI production latency was observed near the former 30-second ceiling
  (one custom-domain probe fell back while a direct-origin request succeeded in
  29.34 seconds). The bounded provider and outer fallback policy is now 45
  seconds. Release Automation run `40589089163` passed at commit `39435ee`,
  including Android packaging, custom-domain deployment, and a real
  OpenAI/no-fallback probe. Browser verification on the deployed custom domain
  confirmed the **Use sample values** control.
- Prompt-creation inputs are now natively disabled as one field group while a
  generation request is in flight, and the form exposes `aria-busy`. This locks
  book details, notes, specificity, demo loading, and focus-skill selection to
  the exact submitted snapshot until the request finishes. A delayed-request
  integration regression passed.
- The observed pilot cost was $0.03 for one generation, so the default and
  production `AI_ESTIMATED_REQUEST_COST_USD` reservation now uses $0.03 rather
  than $0.01. At the unchanged $2.70 application ceiling, this conservatively
  reserves capacity for approximately 90 generations per 30-day budget window.
- Release Automation run `40593552653` passed at commit `93604c9`: full hosted
  checks, Android artifact build/scan, custom-domain deployment, and the single
  paid OpenAI/no-fallback probe all succeeded. A fresh deployed browser session
  confirmed **Use sample values**; no additional paid UI generation was sent.
- Completed the security-audit remediation pass. Disabled transcription now
  rejects before reading image bytes; OpenAI transcription and prompt context
  treat embedded text as untrusted data; the browser uses per-request nonce CSP
  without `unsafe-inline`; Android cloud backup is disabled; hidden OpenAI
  retries are disabled; and dependency overrides reduce `pnpm audit` to zero
  known vulnerabilities.
- Replaced release-workflow debug APK publication with an opt-in signed release
  APK/AAB job. A disposable local signing key proved R8 shrinking, APK/AAB
  creation, artifact secret scans, hashes, and APK v2 signature verification.
  The disposable key was removed afterward.
- Security regression/full validation passed: 51 files / 314 tests, root/mobile
  types, lint, formatting, diff check, Next and vinext builds, Cloudflare deploy
  dry-run, dependency audit, local QA APK scan, signed release build/scan, and
  live vinext nonce-header inspection.
- Commit `b6f6568324ce5ef6f4558d4bfc14c11912241d26` was pushed to `main`, and
  Release Automation run `40601897956` passed its complete hosted path: release
  verification, Cloudflare production deployment, live web/OpenAI probe, signed
  Android APK/AAB build, bundled-secret scan, hashes, and artifact upload.
- The uploaded artifact
  `evoke-ink-android-b6f6568324ce5ef6f4558d4bfc14c11912241d26` was downloaded
  independently. Its APK and AAB SHA-256 files both matched their binaries. The
  public custom domain returned HTTP 200 with Evoke Ink branding and the
  expected per-request nonce CSP. Local `HEAD` and `origin/main` matched exactly,
  and the worktree was clean after the push.
- Manually dispatched Release Automation run `40733293364` against the same
  verified `main` commit on 2026-10-28. Release verification, Cloudflare deploy
  and live probe, signed Android APK/AAB build, bundled-secret scan, and artifact
  upload all passed. The newly uploaded artifact was downloaded; both recorded
  SHA-256 hashes matched, and `apksigner` verified one RSA-4096 signer with APK
  Signature Scheme v2.
- Removed the incompatible debug-signed installation from the authorized Galaxy
  S24 Ultra (`SM-S928U1`) with owner approval, then installed and launched the
  verified signed APK from run `40733293364`. That artifact used the superseded
  pre-Play package identity and is retained only as historical validation.
- Migrated the Android/Capacitor identity to `app.evokeink.mobile`, including the
  Gradle namespace/application ID, Java package path, Android resources,
  Capacitor configuration, release installer, regression test, Play runbook,
  and durable project memory. The locally assembled APK reports package
  `app.evokeink.mobile`, label `Evoke Ink`, launcher
  `app.evokeink.mobile.MainActivity`, version `1.0`/code `1`, and SDK 36.
  Mobile tests passed 59/59; the mobile production build, Capacitor sync, Gradle
  QA package, bundled-secret scan, full 51-file/314-test suite, formatting,
  lint, root/mobile types, Next production build, dependency audit, and diff
  check passed.
- Pushed package-identity commit `9eb8d6986d17435c0902fb2cb28a730543cd42c4`
  to `main`. Release Automation run `40737583873` passed verification,
  Cloudflare deployment/probe, signed Android APK/AAB build, secret scan, and
  artifact upload. The downloaded APK and AAB hashes matched; the APK reports
  `app.evokeink.mobile`, label `Evoke Ink`, version `1.0`/code `1`, SDK 36, one
  RSA-4096 signer, and APK Signature Scheme v2. The signed APK installed and
  launched successfully on the S24 Ultra. The superseded
  `app.readreflect.mobile` package remains separately installed and was not
  removed because Android treats the new ID as a different app.
- Replaced every legacy and adaptive Android launcher asset that still contained
  Capacitor's default blue icon. `src/app/icon.svg` is now the canonical source;
  `pnpm icons:android` deterministically regenerates five density sets plus the
  adaptive foreground and background. The generated assets visually match the
  Evoke Ink page/ink/spark mark and remain inside Android's adaptive safe zone.
  A regression verifies canonical background color and PNG dimensions. Full
  validation passed: 52 files / 315 tests, types, lint, formatting, web build,
  dependency audit, Android QA package, and bundled-secret scan.
- Added `docs/GOOGLE_PLAY_RELEASE_RUNBOOK.md`, an operator-ready path from the
  verified GitHub AAB through Play App Signing, store setup, privacy/Data safety
  and target-audience declarations, internal and closed testing, physical-device
  certification, production review, staged rollout, monitoring, and rollback.
  It uses repository facts from `docs/security/STORE_PRIVACY_INPUTS.md`, clearly
  leaves legal/publisher declarations to their owners, and is linked from
  `docs/RELEASE_AUTOMATION.md`.

## Open issues and blockers

- OpenAI is enabled only for the production web origin. Android/native origins
  intentionally receive no live provider access until verified device
  attestation exists.
- Google Play account ownership, listing preparation, internal-track upload,
  review, and submission remain owner work. The signed `app.evokeink.mobile`
  AAB from run `40737583873` is ready for that process; workflow artifact
  retention is not permanent storage for the upload keystore or release binaries.
- Physical-device checks for enlarged system text and safe-area behavior remain
  release acceptance work; browser/native emulation passed.
- Existing transcription provider/privacy gates, native attestation requirement,
  and the mobile bundle-size warning remain. The dependency findings are resolved.

## Immediate next action

Download and retain the verified artifact from run `40737583873`, then follow
`docs/GOOGLE_PLAY_RELEASE_RUNBOOK.md` to create the Play app with package
`app.evokeink.mobile` and start internal testing. Escrow the upload keystore;
the privacy-policy URL and publisher decisions remain explicit store-release
blockers. Continue monitoring the OpenAI $3 hard limit; do not enable native or
handwriting-provider traffic until its separate release gates are satisfied.
