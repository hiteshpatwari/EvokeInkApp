# Current workstate

## Objective

Ship a production-ready Evoke Ink web and Android application, including a
camera-first handwritten-response workflow that survives Android process death
while the system camera is open.

## Current status

`main` is pushed at commit `0583a82` (`Use recoverable Android camera result
flow`). The Galaxy S24 Ultra is connected over wireless ADB as `SM_S928U1`.
Release Automation run `40753859839` is green on attempt 2. Verification, the
signed Android build, Cloudflare deployment, and deployed OpenAI prompt-contract
probe all passed. Attempt 1's prompt probe had returned the transient
`prompt_contract_failed`; rerunning only the failed hosted job passed without a
code change.

The signed APK from run `40753859839` was installed in place on the S24. Android
reported `Success`, so the existing local profiles and saved worksheet were
preserved. The installed package is `app.evokeink.mobile`, version 1.0 / code 1,
updated at 2026-10-28 12:30:34 local device time.

## Camera recovery result

The first recovery implementation correctly buffered and consumed
`appRestoredResult`, but physical testing exposed a Capacitor 8 boundary:
Camera `takePhoto` uses an Activity Result launcher whose in-memory
`currentCall` is lost when Android kills the process. It does not populate
Capacitor Bridge's persisted last-activity call, so no restored result reached
the app.

The response-photo path now uses Camera `getPhoto` with an explicit camera
source and URI result. Although deprecated in favor of the newer media API, its
Android implementation uses Capacitor's plugin activity-result contract, which
persists and restores the call across process recreation. The adapter normalizes
the returned legacy `Photo` to the existing internal media shape and remains
compatible with a pending `takePhoto` restoration from an older installed
build. Cancellation, in-memory import, plugin-temp deletion, bounded cleanup
retry state, and one-time restored-photo consumption remain intact.

Physical acceptance passed on the S24 using the actual failure sequence:

1. Opened a saved worksheet and selected **Review a response**.
2. Selected **Photograph handwritten answer** and **Open camera**.
3. Confirmed Samsung Camera was foreground, then ran
   `adb shell am kill app.evokeink.mobile`; the Evoke Ink PID disappeared while
   Camera remained active.
4. Captured a photo and accepted Samsung's preview.
5. Android recreated Evoke Ink at the exact response review. The UI displayed
   `Photo restored after Android reopened Evoke Ink.`
6. Local preparation completed and exposed **Rotate right**, **Trim edges**,
   **Choose another photo**, **Discard photo**, and **Read handwriting**.

This proves both destination recovery and usable recovered-photo preparation on
the physical target device.

## Validation completed

- Focused camera regression: 9/9 tests passed, including both cancellation
  signals and restored `getPhoto` handling.
- Full Vitest: 53 files / 327 tests passed.
- `pnpm lint` passed with warnings denied.
- `pnpm typecheck` passed for Next.js and the mobile client.
- `git diff --check` passed.
- Mobile Vite production build passed against
  `https://evokeink.hiteshpatwari.com/api/prompts`.
- Capacitor Android sync and local debug Gradle build passed (248 tasks).
- Hosted release verification passed.
- Hosted signed Android AAB/APK build, bundle secret scan, and artifact upload
  passed; artifact `evoke-ink-android-0583a821...` was downloaded and installed.
- Hosted Cloudflare deployment and the live OpenAI prompt-contract probe passed
  on run `40753859839` attempt 2.
- Physical S24 forced-process-death camera recovery passed as described above.

## Remaining product gate

The camera acquisition and process-recovery slice is complete. Live native
handwriting transcription remains a separate production gate. It is
intentionally disabled until device attestation and privacy/quota approval are
complete; manual transcript entry remains the honest fallback.
