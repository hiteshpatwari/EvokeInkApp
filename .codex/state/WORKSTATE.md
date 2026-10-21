# Current workstate

## Objective

Complete P05 by proving the selected Capacitor architecture on Android and close its remaining hosted API/CORS dependency through P02.

## Current status

P05 is running on branch `codex/p05-mobile-architecture` from `main` at `6ae436d`. The bundled Capacitor 8 architecture is recorded. Every device-local Android acceptance row passed on `emulator-5554`: bundled startup, non-demo profile creation, deterministic mock generation, save/reopen, native PDF sharing, explicit offline fallback, versioned upgrade preservation, selected navigation configuration, temporary-file cleanup, permissions review, and secret-pattern scan.

P05 remains open only because there is no permanent P02 HTTPS endpoint on this branch against which to prove the explicit native API URL and exact Capacitor-origin CORS behavior. This does not block P06-P08 implementation because the architecture gate is recorded and the issue register assigns non-overlapping ownership.

## Completed work

- Created `docs/adr/0001-capacitor-mobile-runtime.md` with the architecture, plugin set, security boundaries, consequences, and rejected alternatives.
- Created `.codex/production/P05_MOBILE_ARCHITECTURE_SPIKE.md` with the compatibility report, implementation contracts, observed Android evidence, and macOS/iOS follow-up matrix.
- Updated `.codex/production/ISSUE_REGISTER.md`: P05 remains `running`; P06-P08 are ready to implement the recorded architecture.
- Installed Microsoft OpenJDK 21.0.12.1 after owner UAC approval. Android Studio's bundled Java 25 was incompatible with Gradle 8.14.3.
- Built a disposable Vite client under ignored `tmp/p05-mobile-spike/` that reuses the production `AppShell`, provides deterministic offline prompts, mirrors canonical state through Preferences, and adapts actual jsPDF bytes to Filesystem and Share.
- Generated and synchronized Capacitor 8.5.3 Android with only Preferences 8.0.1, Filesystem 8.1.5, and Share 8.0.3.
- Built and installed the disposable APK on the Pixel 10 Pro XL emulator.
- Created profile `P05Reader` with Grade 5, independent reading level `Advanced`, Lexile `900L`, grade-level difficulty, and medium response length.
- Generated and saved four structured mock prompts without an API key.
- Force-stopped/relaunched and observed the profile and worksheet still present.
- Shared the actual Prince Caspian PDF to Android's chooser. The Print target loaded it as a two-page Letter document; the sanitized filename was visible.
- Disabled Wi-Fi and mobile data, relaunched, and generated the labeled deterministic offline fallback successfully.
- Installed versionCode 2/versionName 1.1 over versionCode 1 and observed profile and worksheet preservation.
- Confirmed the application cache contained no PDF after sharing and the APK declared no broad storage permission.
- Ran a second bounded read-only Gemma4:26b document review after the first broad routed run was stopped. It identified hosted-endpoint failover and one-time storage migration as missing explicit gates; both are now recorded.

## Files currently changed

- `.codex/production/ISSUE_REGISTER.md`
- `.codex/production/P05_MOBILE_ARCHITECTURE_SPIKE.md`
- `docs/adr/0001-capacitor-mobile-runtime.md`

All proof code, generated native projects, APKs, screenshots, UI XML, and package installations are ignored under `tmp/p05-mobile-spike/` and are not production implementation.

## Decisions

- Bundle a client-only Vite/React UI in Capacitor; never use production `server.url`.
- Native prompts use an explicit HTTPS API URL. No provider secret is packaged. Network failure falls back to deterministic general prompts.
- Browser persistence remains `localStorage`; production native persistence uses an atomic Preferences adapter for the existing canonical versioned JSON plus verified one-time migration.
- Native PDFs use jsPDF bytes, application cache, and Share, followed by cleanup. No broad filesystem permission or direct printer plugin.
- Official Capacitor packages only: core, Android, iOS, Preferences, Filesystem, and Share.
- iOS compilation, signing, privacy manifests, and runtime evidence require macOS/Xcode and remain P11 gates.

## Validation run

- Targeted Prettier write/check passed for all tracked P05 documents.
- Disposable Vite build passed with 334 modules.
- `cap sync android` passed and detected exactly three selected plugins.
- `:app:packageDebug --no-daemon --max-workers=4` passed: 129 tasks; the APK was about 4.7 MB.
- A full `assembleDebug` produced the installable APK but lingered in Capacitor Android's `extractDebugAnnotations` library task. P06 must run the canonical full build with the supported API 36 SDK installed.
- Because platform 36/build-tools 35 downloads stalled, the disposable proof compiled against installed platform 37/build-tools 36 while retaining targetSdk 36. This is proof-only; P06 must pin Capacitor's supported API 36 combination.
- APK installation and versioned upgrade both returned `Success`.
- Android chooser showed the generated PDF; Print reported `Letter` and `1/2` pages.
- Offline UI and prompt generation passed with both Wi-Fi and mobile data disabled; networking was restored afterward.
- Built web/native assets contained no `OPENAI_API_KEY`, `sk-proj-`, or key-shaped `sk-` value.
- APK permissions were `INTERNET` and the app's non-exported dynamic-receiver permission only.

## Open issues and blockers

- Hosted prompt API/CORS proof awaits the P02 HTTPS endpoint and exact native-origin configuration.
- P06 must replace proof-only tooling overrides, add a navigation regression check, and complete canonical `assembleDebug` on supported API 36 tools.
- P07 must implement the native PDF adapter in production code and preserve browser download/print tests.
- P08 must replace the polling proof mirror with atomic asynchronous Preferences persistence and migration.
- iOS runtime evidence remains impossible on this Windows host.

## Immediate next action

Review the bounded Gemma result, commit the tracked P05 decision/evidence artifacts, then begin P06-P08 from the recorded ownership boundaries. Close P05's final hosted API/CORS row as soon as P02 exposes the permanent HTTPS endpoint.
