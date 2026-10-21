# P07 native PDF sharing

Status: verified on Android on 2026-10-21.

## Implemented contract

- Browser preview retains its existing `Print` and `Download PDF` actions.
- The bundled Capacitor client replaces those controls with one truthful
  `Share PDF` action; it does not imply that a file has been downloaded or that
  direct printing is available.
- The existing jsPDF worksheet document is emitted as exact bytes, encoded as
  base64, and written under a sanitized, bounded filename in
  `Directory.Cache` through official `@capacitor/filesystem@8.1.5`.
- The resulting content URI is passed to the Android chooser through official
  `@capacitor/share@8.0.3`.
- Cleanup is attempted after chooser success, cancellation, and sharing
  failure. A cleanup failure is reported without replacing the primary share
  outcome. Duplicate export requests are disabled while an operation is in
  flight.
- No broad storage permission and no direct printer plugin were added.

## Automated evidence

- RED: the native export tests initially failed because
  `mobile/src/nativeWorksheetExport.ts` did not exist.
- Root Vitest: 28 files, 140 tests passed. This includes browser-export
  regression and native AppShell copy/state coverage.
- Mobile Vitest: 6 files, 30 tests passed. Native export coverage verifies
  bytes/base64, filename sanitization, share success, cancellation, failure,
  cleanup in all post-write outcomes, cleanup-failure reporting, and
  unavailable sharing.
- Root/mobile TypeScript, lint, formatting, Next production build, Vite mobile
  production build, Capacitor sync, and the mobile artifact secret scan passed.
- Capacitor sync registered App 8.0.1, Filesystem 8.1.5, and Share 8.0.3.
- Java 21 / Android API 36 `assembleDebug` passed with 184 executed tasks.
- The dependency audit reports only the already-accepted vinext build-tool
  `braces@3.0.3` advisory, which has no patched version and is not introduced by
  P07.

## Emulator acceptance

The production APK installed successfully on `emulator-5554`. A saved Prince
Caspian worksheet opened from the installed bundled UI. Its preview exposed
`Share PDF`, did not expose the browser-only `Print` control, and opened
Android's `ChooserActivity` with a content URI.

While the chooser was open,
`cache/the-chronicles-of-narnia-prince-caspian-reflection.pdf` existed in the
application-private cache. Android Back cancelled the chooser; the app resumed,
displayed `Sharing cancelled. No PDF was saved.`, and the PDF was absent from
cache afterward. APK inspection reported only `android.permission.INTERNET`
plus Android's application-scoped dynamic-receiver permission.

## Remaining platform gate

iOS share-sheet behavior and the Filesystem privacy-manifest reason must be
validated on macOS/Xcode under P11. P07 does not implement P08 native state or
migration.
