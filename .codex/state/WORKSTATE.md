# Current workstate

## Objective

Productionize P06: a bundled Capacitor 8 Android shell that reuses the existing
React application, calls the hosted prompt API through an explicit HTTPS build
configuration, remains usable through deterministic fallback, and packages no
provider credential.

## Current status

P06 is implemented and verified on branch `codex/p06-capacitor-shell`. The
production Vite bundle, Capacitor navigation boundary, API 36 / Java 21 Android
host, full debug APK, and emulator launch all pass. P07 native PDF sharing and
P08 Preferences persistence remain separate ready work items and are not
claimed by this shell.

## Completed work

- Added `mobile/` as a pnpm workspace using Capacitor core/CLI/Android 8.5.3,
  Vite 8.3.3, React 19.3.1, and exact direct dependency pins.
- Added a client-only Vite entry that reuses the production `AppShell`, domain
  schemas, deterministic `MockPromptGenerator`, storage behavior, PDF behavior,
  and global styles rather than copying application business logic.
- Added build-time `VITE_PROMPT_API_URL` validation. Production builds fail
  when it is absent, malformed, non-HTTPS, credential-bearing, query-bearing,
  or fragment-bearing.
- Added a native prompt transport that rewrites only `/api/prompts`, applies an
  eight-second timeout, validates HTTP/JSON/schema success, and returns labeled
  deterministic general prompts for rejection, non-2xx, invalid JSON/schema,
  timeout, or an intentionally unconfigured development endpoint.
- Added a production Capacitor config containing no `server.url`,
  `allowNavigation`, or cleartext mode. The bundled Android origin remains
  `https://localhost`.
- Generated the Android project with app id `app.readreflect.mobile`, compile
  SDK 36, target SDK 36, min SDK 24, and explicit Java 21 source/target
  compatibility.
- Added root mobile build/test/typecheck/sync/secret-scan scripts and a mobile
  runbook. Root typecheck now verifies both the Next and mobile projects.
- Added navigation/config, transport, fallback, timeout, and production URL
  tests. The RED phase failed on the absent transport/config modules before the
  implementation was added.
- Added a fail-closed secret scanner for Vite output, synchronized Android
  assets, and every extracted debug APK entry. Missing production artifacts or
  unsafe archive paths fail the scan; extraction uses an owned unique temporary
  directory with cleanup validation. It rejects provider environment names and
  OpenAI key patterns.
- Replaced Capacitor CLI's vulnerable transitive `uuid@7.0.3` with 11.1.1;
  Capacitor sync still passes. The previously accepted vinext-only `braces`
  advisory remains the only audit finding.

## Files or areas changed

- `mobile/**`: production Vite/Capacitor client, transport, tests, generated
  Android host, runbook, and scanners.
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`:
  workspace integration and exact dependency state.
- `.gitignore`, `.prettierignore`, `.eslintignore`: native build/generated-file
  boundaries.
- `.codex/production/ISSUE_REGISTER.md`: P06 marked complete.
- `.codex/state/WORKSTATE.md`: current operational state.

## Validation run

- `pnpm format:check`: passed.
- `pnpm lint`: passed with zero warnings.
- `pnpm typecheck`: passed for Next and mobile TypeScript projects.
- `pnpm test`: 21 files, 107 tests passed, including 16 P06 tests.
- `pnpm build`: Next 16.4.0 production build passed.
- Production mobile build without `VITE_PROMPT_API_URL`: failed as required.
- Production mobile build with the deployed HTTPS mock endpoint: passed; 323
  modules transformed. The existing 763.50 kB chunk warning remains non-fatal.
- `pnpm mobile:sync`: passed and synchronized only Capacitor core/Android.
- Gradle `assembleDebug` with Microsoft JDK 21: 93 tasks, full build passed.
  Android SDK platform 36 revision 2 and Build Tools 35 were installed by the
  licensed Gradle build because API 36 was not previously installed.
- APK inspection: compile SDK 36, target SDK 36, min SDK 24; only INTERNET and
  Capacitor's non-exported dynamic-receiver permission are declared.
- Required-artifact bundle/Android assets/extracted-APK provider-secret scan:
  passed. Focused tests prove missing artifacts and secrets inside compressed
  APK entries fail closed.
- Emulator `Pixel_10_Pro_XL` (`emulator-5554`): APK install returned `Success`;
  bundled UI launched as `app.readreflect.mobile` and exposed the Read & Reflect
  home flow and child-profile actions in the UI hierarchy.
- `pnpm audit --audit-level=moderate`: only the accepted vinext build-tool
  `braces@3.0.3` advisory remains.

## Open issues and blockers

- P07 must implement and verify native PDF cache/share/cleanup while preserving
  browser download and print.
- P08 must implement authoritative atomic Preferences state and verified
  one-time WebView migration.
- Native OpenAI mode remains intentionally blocked until platform attestation is
  implemented; the configured deployed endpoint is currently mock mode.
- iOS compilation, signing, origin validation, and privacy manifests require
  macOS/Xcode and remain P11 gates.

## Immediate next action

Independently review P06, then merge it before starting P07 and P08 from their
non-overlapping ownership boundaries.
