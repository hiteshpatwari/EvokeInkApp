# Current workstate

## Objective

Complete the production mobile path after P06: P07 native PDF sharing is now
verified; P08 authoritative native persistence and migration is next.

## Current status

P07 is implemented and verified on branch `codex/p07-native-pdf`. Browser users
retain Print and Download PDF. The Android client presents a truthful Share PDF
action backed by official Capacitor Filesystem and Share plugins, keeps the PDF
in application-private cache only for the chooser operation, and attempts
cleanup for success, cancellation, and failure.

## Completed work

- Added a host-neutral worksheet-export boundary. The browser default retains
  existing jsPDF download behavior and reports that browser Print is available.
- Added an injected native export adapter that emits the existing jsPDF bytes,
  preserves every byte through base64 encoding, sanitizes and bounds the cache
  filename, writes through `Directory.Cache`, and shares the returned content
  URI through the Android chooser.
- Added exact `@capacitor/filesystem@8.1.5` and `@capacitor/share@8.0.3`
  dependencies and synchronized their Android projects.
- Native preview copy now says `Share PDF` and omits the non-working browser
  Print action. The control is disabled as `Preparing PDF…` while active.
- Sharing success, cancellation, unavailable capability, and failure have
  distinct user-visible outcomes. Cleanup failure is reported without hiding or
  replacing the primary outcome.
- Added automated coverage for bytes/base64, filename safety, success,
  cancellation, failure, cleanup in every post-write path, cleanup failure,
  unavailable sharing, duplicate-action prevention, host installation, and
  browser regression.
- Recorded full implementation and emulator evidence in
  `.codex/production/P07_NATIVE_PDF_SHARING.md` and marked P07 verified.

## Files or areas changed

- `src/pdf/worksheetExport.ts` and focused browser/host-boundary tests.
- `src/components/AppShell.tsx` and focused PDF export UI tests.
- `mobile/src/nativeWorksheetExport.ts`, its focused tests, and mobile bootstrap.
- `mobile/package.json`, `pnpm-lock.yaml`, and synchronized Android plugin Gradle
  files.
- P07 production evidence, issue register, and this workstate.

## Validation evidence

- TDD RED failed because the native export module did not exist; GREEN passes.
- Root Vitest: 28 files / 142 tests passed.
- Mobile Vitest: 6 files / 30 tests passed.
- Root/mobile TypeScript, lint, formatting, Next build, mobile Vite production
  build, Capacitor sync, and artifact secret scan passed.
- Java 21 / Android API 36 Gradle `assembleDebug` passed with 184 tasks executed.
- APK install on `emulator-5554` returned Success. The installed saved worksheet
  preview showed Share PDF and no browser-only Print control.
- Android ChooserActivity opened with a content URI. The sanitized PDF existed
  in private cache while the chooser was open; Android Back cancelled sharing,
  the app reported cancellation, and the temporary PDF was removed.
- A verifier-found sticky-header hit-target overlap was repaired by focusing new
  screens with `preventScroll` and then resetting the document scroll root. A
  normal portrait/font-1.0 tap opened Share instead of Home; portrait bounds had
  a 97 CSS-pixel header-to-button gap. Landscape/font-2.0 bounds also had no
  overlap, and focused regression coverage passes.
- APK permissions contain INTERNET and the application-scoped dynamic-receiver
  permission only; no broad storage permission was added.
- `pnpm audit --audit-level=moderate` continues to report only the documented
  unpatched vinext-only `braces@3.0.3` exception.

## Open issues and blockers

- P08 must implement authoritative atomic Preferences state, startup hydration,
  and verified one-time WebView localStorage migration with recovery tests.
- P02 public OpenAI launch still requires paid hosting activation, production
  secrets/origins, custom-domain decisions, and real-AI acceptance.
- Native OpenAI remains blocked until platform attestation is verified.
- iOS compilation, Filesystem privacy-manifest validation, sharing acceptance,
  signing, and release evidence require macOS/Xcode under P11.

## Immediate next action

Independently review P07, then start P08 mobile persistence and migration without
changing the verified PDF export boundary.
