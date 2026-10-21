# P05 mobile architecture and plugin spike

## Status

Architecture selected; the available Android emulator passed the local-first
workflow, native PDF share, offline fallback, and upgrade-preservation checks.
P05 remains open only for the hosted HTTPS prompt-API row, which needs the P02
endpoint. iOS runtime checks cannot be completed on this Windows host.

## Compatibility finding

The selected approach is a **bundled Capacitor 8 client with an explicit HTTPS
prompt API base URL**. The decision and rejected alternatives are recorded in
`docs/adr/0001-capacitor-mobile-runtime.md`.

The existing Next application cannot be copied directly into a Capacitor shell:

- `src/components/AppShell.tsx` calls the relative `/api/prompts` endpoint;
- `src/storage/repository.ts` uses a synchronous Web Storage-shaped contract;
- `src/pdf/downloadWorksheet.ts` invokes browser download behavior; and
- the Next application contains a request-dependent POST route and server
  security headers, so it is not an unchanged static-export target.

P06 must add a client-only Vite entry and explicit transport configuration. P07
and P08 must add narrow native adapters without changing the browser adapters.

## Host evidence

| Requirement    | Observed evidence                                                                                                             | Result                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Node.js        | Repository requires Node 24; Capacitor 8 requires Node 22 or newer.                                                           | Compatible                                                      |
| Android Studio | `C:\Program Files\Android\Android Studio` reports `AI-261.26222.65.2614.16204760`; Capacitor 8 requires 2025.2.1 or newer.    | Compatible                                                      |
| Java           | Microsoft OpenJDK 21.0.12.1 is installed. Android Studio's Java 25 runtime was too new for the generated Gradle 8.14.3 build. | Compatible                                                      |
| Android SDK    | `ANDROID_HOME=C:\Users\hites\AppData\Local\Android\Sdk`; platform 37.0 and build-tools 36.0.0 are installed.                  | Compatible candidate; generated project build remains the proof |
| Emulator       | `Pixel_10_Pro_XL`; `emulator-5554` is online with Android 37.1 Google Play x86_64.                                            | Available                                                       |
| iOS toolchain  | Capacitor 8 requires macOS and Xcode 26 or newer. This host is Windows.                                                       | Deferred to P11                                                 |

## Plugin review

Registry versions observed during the spike were Capacitor core/CLI/Android
8.5.3, Preferences 8.0.1, Filesystem 8.1.5, and Share 8.0.3. Pin exact versions
when P06-P08 install them and keep all Capacitor major versions aligned.

All selected packages are official Capacitor packages under the Capacitor MIT
license. No community plugin is needed. The security-minimal set is:

- Preferences for one small canonical JSON state;
- Filesystem for a user-initiated PDF in the app cache only; and
- Share for the OS chooser.

P11 must add the documented Apple privacy-manifest reasons for Preferences
(`CA92.1`) and Filesystem file timestamp access (`C617.1`). These reason codes
must be rechecked against the installed plugin versions rather than copied
blindly into a release archive.

## Required implementation contracts

### Prompt transport

- Web keeps the relative `/api/prompts` endpoint.
- Native receives an HTTPS API base URL at build time; missing production
  configuration fails the production native build.
- The mobile bundle contains no OpenAI key and cannot select a provider key.
- The server validates exact web and native origins and retains quota/budget
  controls. Origin validation is not authentication.
- Offline/network failure uses deterministic mock prompts and clearly labels
  the fallback without inventing book facts.

### Persistence

- Browser: existing synchronous `localStorage` adapter.
- Native: asynchronous Preferences adapter storing the same versioned v2 JSON
  document.
- First native launch imports valid legacy WebView state once, writes and reads
  back the native value, and only then marks migration complete.
- Invalid-state diagnostics, atomic replacement, backups, and immutable child
  snapshots remain intact.
- Upgrade tests install a second APK over the first; uninstall/reinstall is not
  an upgrade-preservation test and is expected to clear app-private data.

### PDF sharing

- Preserve browser download and print.
- Native obtains the jsPDF bytes/base64, writes a sanitized filename to the
  cache, calls Share with that file URI, and attempts cleanup on completion or
  cancellation.
- No broad filesystem permission and no direct printer plugin.

## Android proof matrix

The proof used the `Pixel_10_Pro_XL` AVD at `emulator-5554`. The disposable APK
targeted Android API 36 and, because only platform 37/build-tools 36 were already
installed, compiled against platform 37 with an explicit proof-only override.
P06 must pin the officially supported SDK combination rather than inherit this
workaround.

| Acceptance check                             | Observed evidence                                                                                                                                                              | Status                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Bundled production UI starts without network | Wi-Fi and mobile data were disabled; bundled UI launched and displayed the saved profile and worksheet.                                                                        | passed                                                                         |
| Create profile                               | Created `P05Reader` with Grade 5, independent level `Advanced`, Lexile `900L`, grade-level difficulty, and medium response length.                                             | passed                                                                         |
| Mock generation                              | Generated four structured deterministic prompts with no API URL or API key, then saved the worksheet.                                                                          | passed                                                                         |
| Hosted prompt API                            | Reach a configured HTTPS mock endpoint without any packaged secret, then make it unreachable and observe deterministic fallback.                                               | pending — requires the P02 endpoint and exact native-origin CORS configuration |
| Save/reopen                                  | Force-stopped and relaunched; profile and Prince Caspian worksheet remained through the Preferences-backed proof mirror.                                                       | passed                                                                         |
| Native PDF share                             | Android chooser received `the-chronicles-of-narnia-prince-caspian-reflection.pdf`; the Print target opened it as a two-page Letter document.                                   | passed                                                                         |
| Offline fallback                             | With Wi-Fi and mobile data disabled, generation reached Prompt Review and displayed `Offline mode used reliable general prompts.`                                              | passed                                                                         |
| Upgrade preservation                         | Installed versionCode 2/versionName 1.1 over versionCode 1; profile and worksheet remained after relaunch.                                                                     | passed                                                                         |
| Navigation boundary                          | Bundled config contains no `server.url` or `allowNavigation`; all observed WebView loads were local `https://localhost` assets.                                                | passed for selected configuration; P06 must add a regression check             |
| Secret scan                                  | Built web/native assets contained no `OPENAI_API_KEY`, `sk-proj-`, or key-shaped `sk-` value. APK requested only `INTERNET` plus its non-exported dynamic-receiver permission. | passed                                                                         |

The share adapter deleted the temporary PDF: the application cache contained
only WebView and crash-report directories after returning from the share target.
No storage permission appeared in the APK manifest.

The proof started with fresh native data, so it did not exercise a one-time
legacy WebView-to-Preferences migration or migration failure recovery. That is
an explicit P08 gate, not evidence supplied by the upgrade-preservation result.

The disposable Vite build passed with 334 modules, `cap sync android` detected
only Preferences, Filesystem, and Share, and `:app:packageDebug` completed
successfully with 129 tasks. A full `assembleDebug` emitted the same installable
APK but lingered in Capacitor Android's `extractDebugAnnotations` library task;
P06 must run the canonical full build with the supported API 36 SDK installed.

## iOS follow-up matrix

P11 must run these checks on macOS with Xcode 26 or newer:

- generate the iOS project and build on the oldest supported deployment target;
- validate the Capacitor local origin and Cloudflare CORS allowlist;
- test iPhone and iPad portrait/landscape layouts and safe areas;
- verify Preferences migration and data across an installed upgrade;
- verify PDF sharing and printing from the iOS share sheet;
- verify offline fallback and API-failure behavior;
- validate privacy manifests for every privacy-sensitive plugin;
- archive with no packaged secret, signing key, or unexpected entitlement.

## Gate to P06-P08

The architecture is selected and every device-local acceptance row passed. P06,
P07, and P08 may use this decision for implementation, but P05 must remain
`running` until the hosted HTTPS prompt endpoint and native-origin CORS row is
observed. P06 owns shell/build files, P07 owns PDF export/share modules, and P08
owns persistence/migration modules to avoid overlapping implementation.
