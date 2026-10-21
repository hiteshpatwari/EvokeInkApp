# P08 authoritative native persistence

Status: verified on Android on 2026-10-21; independent re-review approved.

## Implemented contract

- Browser builds continue to use the existing `localStorage` repository by
  default. The mobile entry point waits for a dependency-injected native store
  before rendering React and does not replace `window.localStorage`.
- Official `@capacitor/preferences@8.0.1` stores the complete existing version-2
  canonical document under one key. Every canonical write and removal is
  serialized and read back before `flush()` resolves.
- AppShell awaits that durability gate before updating in-memory lists or
  showing a save, delete, status-change, cleanup, duplication, or import success
  message. Failure copy is privacy-safe and does not claim success.
- One-time migration accepts only a fully valid, supported canonical version-2
  WebView document. It writes and byte-verifies the document before writing and
  verifying the migration marker. Empty, invalid, unsupported, and invalid-record
  legacy values remain undecided so a later valid launch can still migrate; no
  WebView data or unrelated key is deleted.
- Native state wins after migration, including corrupt native state. Corrupt
  native bytes remain available for diagnostics/recovery and are never silently
  replaced from WebView storage.
- Existing recovery, cleanup, backup merge/replace, and immutable
  `childSnapshot` semantics remain in the shared repository.

## Automated evidence

- Root Vitest: 31 files / 160 tests passed. Mobile Vitest: 8 files / 45 tests
  passed. Focused coverage includes migration validation, native-wins behavior,
  corruption preservation, verified rollback, hard-disable-after-failure,
  failure/relaunch behavior, ordered writes, mismatch rejection, verified removal,
  awaited startup, UI durability gating, browser defaults, and async backup failure.
- A failed native mutation is rolled back to its prior native value (or removed
  when previously absent) and that rollback is read-back verified. If rollback
  cannot be verified, copy states only that storage must be confirmed after
  reload. The adapter is hard-disabled until reload and queued later writes are
  rolled back in the facade without reaching Preferences.
- Formatting, lint, root/mobile TypeScript, Next production build, Vite mobile
  production build, and Capacitor sync passed. Sync registered App 8.0.1,
  Filesystem 8.1.5, Preferences 8.0.1, and Share 8.0.3.
- Java 21 / Android API 36 `assembleDebug` passed with 214 executed tasks. The
  built bundle, synchronized Android assets, and APK passed the production
  secret scan.

## Emulator acceptance

The production APK upgraded over the P07 installation on `emulator-5554`
without uninstalling. Before upgrade, WebView held one valid Aavya profile and
one Prince Caspian worksheet. First launch created `CapacitorStorage.xml` with
the migration marker and a 4,460-character canonical document containing the
same one profile and one worksheet.

After removing only the WebView canonical key, force-stop/relaunch restored
Aavya and the Prince Caspian worksheet from Preferences. Editing the current
profile from Grade 3 to Grade 4 was present in Preferences and survived another
force-stop/relaunch, while the existing worksheet's immutable
`childSnapshot.gradeOrAge` remained Grade 3.

For corruption recovery proof, the Preferences XML was backed up inside the app
sandbox, the native canonical version was changed to an unsupported version,
and the app was relaunched. It displayed `Some saved data could not be loaded`,
did not repopulate Aavya from stale WebView data, and preserved the corrupt
native bytes. The verified backup was then restored and the temporary copy was
removed. Controlled write rejection/read-back mismatch is covered by automated
adapter and UI tests because forcing a production Android SharedPreferences I/O
failure safely is not deterministic.

## Remaining platform gate

iOS Preferences privacy-manifest behavior, signing, upgrade, and recovery proof
require macOS/Xcode under P11.
