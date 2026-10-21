# P06 Android usability audit

## Decision

P06 is functionally complete but is not usability-verified for release. Two
Android defects must be fixed before P07 and P08 implementation begins:

1. Android system Back exits or backgrounds the application from nested screens
   and confirmation dialogs instead of returning through the workflow.
2. Application content renders beneath the Android status bar in portrait and
   landscape.

The audit was performed on October 20, 2026, with
`app.readreflect.mobile` version 1.0 on the `Pixel_10_Pro_XL` emulator
(`emulator-5554`), Android API 37. The application targets API 36.

## Observed working functionality

- The first-use home screen and child-profile creation flow worked.
- The Aavya demo action populated Grade 3, advanced reading level, 1100L, and
  advanced difficulty. Saving returned to Home.
- The reading-session form and Prince Caspian example worked.
- Online prompt generation returned four prompts.
- With Wi-Fi and mobile data disabled, prompt generation returned four
  deterministic fallback prompts without crashing or blocking the workflow.
- Prompt text was editable. Editing changed the displayed provenance to
  `Parent-edited · started as general prompt.`
- Save and preview produced the worksheet preview.
- The child profile and saved worksheet survived force-stop and relaunch through
  the current WebView `localStorage` adapter. This is not evidence for P08's
  atomic native persistence or migration requirements.
- The profile-deletion confirmation explained that the saved worksheet would
  remain and provided Delete and Keep actions.
- Portrait, landscape, and Android font scale 1.3 remained scrollable. No
  horizontal overflow was observed at those settings.

## Confirmed defects

### P06-UX-01: Android Back exits nested workflows

Severity: high.

Reproduction:

1. Open Home and choose Create worksheet.
2. Press the Android system Back control.
3. The launcher appears instead of Home.

The same behavior occurs when Back is pressed from the profile-deletion dialog:
the application leaves the foreground instead of dismissing the dialog.

The React application keeps navigation in local `screen` state, while the
Capacitor host has no native back-button integration. This makes a standard
Android navigation action behave like application exit.

Required fix:

- Define one testable back-navigation transition for application screens and
  modal state.
- Register Capacitor's native back-button event through the official App
  plugin.
- Dismiss an open dialog first.
- Navigate `preview → review → create → home` and `profile/saved → home`.
- Allow application exit or backgrounding only from Home.
- Add unit tests for every transition and repeat the emulator scenarios.

### P06-UX-02: content overlaps Android system bars

Severity: high.

The logo, screen eyebrow, and prompt-review heading were observed beneath the
status-bar time and security icons. Scrolled fields also moved through the same
area. The overlap occurred in portrait and landscape and became more visible at
font scale 1.3.

The mobile viewport enables `viewport-fit=cover`, but the application does not
consume the safe-area inset values.

Required fix:

- Choose one explicit Android edge-to-edge strategy.
- Apply `env(safe-area-inset-top)`, `env(safe-area-inset-right)`,
  `env(safe-area-inset-bottom)`, and `env(safe-area-inset-left)` to the
  top-level shell and fixed or sticky interaction regions.
- Replace viewport-height assumptions with dynamic viewport sizing where
  needed.
- Verify Home, create, review, preview, saved worksheets, and dialogs in
  portrait and landscape, while scrolled and with the keyboard open.
- Repeat at font scales 1.0, 1.3, and 2.0.

## P07 and P08 observations

These are expected missing capabilities, not new P06 regressions:

- Print did not open Android print UI.
- Download PDF did not show a chooser, toast, or file in Downloads.
- P07 must replace the native worksheet actions with the planned jsPDF bytes,
  cache file, Capacitor Share, and cleanup flow. Until P07 lands, native actions
  should not imply that printing or downloading succeeded.
- Current `localStorage` survived force-stop and relaunch, but it does not meet
  P08 requirements for authoritative atomic Preferences state, verified
  migration, or recovery.

## Additional hardening after the two release blockers

- Give Android controls a 48 dp minimum target and adequate separation.
- Add semantic mobile keyboard hints such as `inputMode`, `autoComplete`,
  `autoCapitalize`, and `enterKeyHint` where appropriate.
- Verify 320 dp width and maximum Android font/display scaling. Source review
  found non-wrapping profile and action rows that may crowd at these extremes,
  although no overflow was observed at font scale 1.3.
- Run a manual TalkBack pass. UIAutomator did not expose enough WebView DOM
  detail to claim screen-reader verification.

## Repair and verification order

1. Fix Android Back navigation and add transition tests.
2. Fix safe-area and dynamic-viewport behavior.
3. Run focused unit and component tests plus the full repository checks.
4. Rebuild and install the API 36 debug APK.
5. Repeat the emulator matrix for Back, dialogs, portrait, landscape, scrolling,
   keyboard-open, and font scales 1.0, 1.3, and 2.0.
6. Mark P06 verified again only after an independent agent reviews the code and
   repeats the two failing emulator scenarios.
7. Start P07, then P08.

The emulator was restored after the audit to automatic rotation, font scale
1.0, and enabled Wi-Fi/mobile data.
