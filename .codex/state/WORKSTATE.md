# Current workstate

## Objective

Make routine web and Android release preparation automatic so a verified main
commit produces a deployable web release and downloadable Android artifact with
minimal owner action.

## Current status

Release automation is implemented locally and ready to commit. Every push to
`main` receives an independent release quality gate, an Android debug APK build,
a bundled-secret scan, SHA-256 generation, and a 30-day GitHub artifact. The web
job becomes automatic after two Cloudflare repository secrets and one enable
variable are configured; it builds, dry-runs, deploys in mock mode, and probes
the public home, health, and prompt contracts.

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

## Validation evidence

- Full Vitest: 49 files / 303 tests passed.
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

- The latest theme has not yet been deployed to the public Worker or installed
  on the physical phone. A local refreshed debug APK has been packaged.
- GitHub currently has no Cloudflare release secrets or enable variable. Web
  auto-deployment will remain skipped until the owner creates a scoped
  Cloudflare API token and configures the documented three repository values.
- The automated Android artifact is debug-signed. Play release signing, account
  ownership, listing approval, and submission remain owner-controlled work.
- Physical-device checks for enlarged system text and safe-area behavior remain
  release acceptance work; browser/native emulation passed.
- Existing transcription provider/privacy gates, native attestation requirement,
  dependency findings, and the mobile bundle-size warning remain unchanged.

## Immediate next action

Commit and push the verified release automation, then observe the first GitHub
run through APK artifact publication. Configure Cloudflare CI credentials once;
subsequent green `main` commits can deploy and probe without manual commands.
