# Current workstate

## Objective

Make routine web and Android release preparation automatic so a verified main
commit produces a deployable web release and downloadable Android artifact with
minimal owner action.

## Current status

The product and repository are now named **Evoke Ink** / `EvokeInkApp`; the
Cloudflare Worker is `evoke-ink-app`. Release automation is enabled on `main`
and has passed its complete hosted path: release quality gate, Android debug APK
build, bundled-secret scan, SHA-256 generation, 30-day artifact upload,
Cloudflare mock deployment, and public home/health/prompt probes. The required
GitHub Cloudflare secrets and enable variable are configured. The public Worker
serves Evoke Ink branding and the old `read-and-reflect` Worker URL returns 404.

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
- Final UX designer verdict: pass. Final independent code review: pass.

## Open issues and blockers

- OpenAI remains intentionally disabled (`AI_PROVIDER=mock`). Live-provider
  activation still requires the documented web-only review and explicit owner
  decision; the deployed mock path is healthy without consuming OpenAI spend.
- The automated Android artifact is debug-signed. Play release signing, account
  ownership, listing approval, and submission remain owner-controlled work.
- Physical-device checks for enlarged system text and safe-area behavior remain
  release acceptance work; browser/native emulation passed.
- Existing transcription provider/privacy gates, native attestation requirement,
  dependency findings, and the mobile bundle-size warning remain unchanged.

## Immediate next action

Complete the documented web-only review. If it passes, explicitly activate the
OpenAI provider under the approved $3 pilot budget and rerun the provider-aware
acceptance checks. Otherwise keep the current healthy deterministic mock release.
