# Current workstate

## Objective

Complete the production mobile path after P06. P07 native PDF sharing and P08
authoritative native persistence are now implemented and verified on Android.

## Current status

P08 is verified on branch `codex/p08-native-persistence`; independent re-review
approved the transactional rollback, queue recovery, migration-marker, UI-copy,
automated, build, and Android acceptance evidence. The Android client awaits an
official Capacitor Preferences adapter before React renders, migrates only valid
canonical WebView state once, treats native state as authoritative, and verifies
queued writes/removals before the UI reports success. Browser storage and the
verified P06/P07 paths remain intact.

## Completed work

- Added exact `@capacitor/preferences@8.0.1` and a dependency-injected native
  adapter that stores one canonical v2 document, serializes mutations, verifies
  read-after-write/removal, and exposes `flush()` as the durability gate.
- Added non-destructive one-time migration with exact state and marker
  verification. Invalid, unsupported, and empty legacy values remain eligible
  for a later valid migration; corrupt native data is never replaced from
  WebView.
- AppShell now awaits native flush before changing visible persisted state or
  showing success. Browser defaults, backup merge/replace, corruption recovery,
  immutable child snapshots, prompt generation, and PDF sharing are preserved.
- Recorded P08 proof in `.codex/production/P08_NATIVE_PERSISTENCE.md`.

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

- `src/storage/repository.ts`, `src/components/AppShell.tsx`,
  `src/components/DataBackupPanel.tsx`, and focused tests.
- `mobile/src/nativePersistence.ts`, awaited bootstrap, focused tests, exact
  dependency, lockfile, and synchronized Android plugin Gradle files.
- P08 production evidence, mobile README, issue register, and this workstate.

## Validation evidence

- Root Vitest passed 31 files / 160 tests; mobile Vitest passed 8 files / 45
  tests. Focused async backup and native durability tests passed.
- Formatting, lint, root/mobile TypeScript, Next build, Vite build, Capacitor
  sync, Java 21/API 36 `assembleDebug` (214 tasks), and secret scan passed.
- APK upgraded over P07 on `emulator-5554`; one profile and worksheet migrated
  to Preferences. Removing only WebView canonical state and relaunching restored
  both records from Preferences.
- Profile Grade 3→4 persisted while the old worksheet snapshot stayed Grade 3.
- Corrupt native state showed the recovery warning, did not fall back to stale
  WebView data, and remained preserved; the valid sandbox backup was restored.

## Open issues and blockers

- P02 public OpenAI launch still requires paid hosting activation, production
  secrets/origins, custom-domain decisions, and real-AI acceptance.
- Native OpenAI remains blocked until platform attestation is verified.
- P09 depends on the production P02/P03/P04 runtime. P10 also requires owner Play
  account, signing, policy, payment, and submission checkpoints.
- P11 iOS compilation, privacy manifests, signing, upgrade, and runtime evidence
  require macOS/Xcode. P12 remains an independent final verification gate.

## Immediate next action

Continue P09-P12 in dependency order without weakening attestation or
owner-action gates.
