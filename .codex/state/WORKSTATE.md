# Current workstate

## Objective

Ship a production-ready Evoke Ink web and Android application, with a camera-first
student-answer workflow that remains safe and usable if Android recreates the app
while the system camera is open.

## Current status

`main` is clean and pushed at commit `cb61fa1` (`Restore Android response photos
after camera restart`). Hosted Release Automation run `40748169667` passed all
three jobs: release verification, Cloudflare deploy/public probes, and signed
Android AAB/APK build plus secret scan and artifact upload. The public web app is
deployed. The signed Android artifact was downloaded locally to
`C:\Users\hites\AppData\Local\Temp\evoke-ink-release-40748169667`.

The Android camera-first response flow is implemented. The user can open the
rear system camera, take a response photo without saving it to the gallery,
review/rotate/trim it locally, explicitly request handwriting transcription,
confirm the transcript, and then request text-only coaching. Existing-photo
selection remains a secondary option.

Physical S24 Ultra testing of the first camera build proved that Samsung Camera
opened and captured successfully, but Android killed the Evoke Ink process under
memory pressure. The app restarted at Home and lost the return destination. The
new commit implements Capacitor `appRestoredResult` recovery: a bounded pending
record stores only session ID, prompt ID, and—only if cleanup needs recovery—the
plugin temporary URI. A returned photo is copied to an in-memory `File`, the
native temporary file is deleted, and the exact saved worksheet/prompt is
reopened at the prepared-photo screen. React StrictMode replay and one-time
consumption are covered so a restored sensitive photo cannot be re-offered after
discarding it.

If temporary deletion fails, the failure is visible and the cleanup URI remains
bounded in Preferences for a retry on the next startup. Cleanup bookkeeping is
best-effort and never prevents an immediate in-memory deletion attempt. Malformed
restored results without a cleanup target clear their pending marker and report
an unusable photo instead of creating a permanent recovery loop.

## Validation completed

- Full serialized Vitest: 53 files / 326 tests passed.
- Focused Android recovery tests: 8/8 passed.
- Focused response-photo and AppShell recovery tests: 11/11 passed.
- Root and mobile TypeScript passed.
- Oxlint with warnings denied passed.
- Prettier and `git diff --check` passed.
- Next.js 16.4.3 production build passed.
- Mobile Vite production build passed using
  `https://evokeink.hiteshpatwari.com/api/prompts`.
- Capacitor sync and Android debug assembly passed: 248 Gradle tasks.
- Independent code review passed after StrictMode, one-time consumption, and
  malformed-result corrections.
- Independent security review passed after observable cleanup errors, retained
  retry state, and Preferences-failure-safe deletion were added.
- Hosted run `40748169667` passed formatting, lint, types, all tests, web build,
  production Cloudflare deployment/probes, signed Android build, bundle secret
  scan, and artifact upload.

## Remaining blocker / immediate next action

The signed APK still needs one final physical acceptance run on the Galaxy S24
Ultra. `adb devices -l` currently shows no device; the earlier wireless-debugging
port has expired. Once the owner re-enables Wireless debugging and provides the
current pairing/connect port if needed, install:

`C:\Users\hites\AppData\Local\Temp\evoke-ink-release-40748169667\apk\release\app-release.apk`

Then repeat: Saved reflections -> View & reprint -> Review a response ->
Photograph handwritten answer -> Open camera -> capture -> accept. Confirm that
even if Evoke Ink is killed, it returns to the same prompt and shows the prepared
photo preview rather than Home. This device proof is the only open item for the
camera acquisition/recovery slice.

Live native handwriting transcription remains a separate production gate. The
native provider is intentionally disabled until device attestation and the
associated privacy/quota approval are complete; the honest manual-transcript
fallback remains expected behavior.
