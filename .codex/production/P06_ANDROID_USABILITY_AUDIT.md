# P06 Android usability audit

## Decision

The two Android UX defects found by this audit are repaired and independently
code-reviewed. P06 remains `running`, rather than `verified`, while the
separately identified notes-specific fallback grounding gaps are repaired and
device-verified. P07 and P08 must not begin before that remaining P06 work.

The original release blockers were:

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

Resolution evidence (October 20, 2026):

- Added the exact `@capacitor/app@8.0.1` plugin and a cancellable native Back
  event shared by the Capacitor host and React shell.
- Back now dismisses session/profile deletion dialogs first, then follows
  `preview → review → create → home` and `profile/saved → home`. Home alone
  leaves the event unconsumed so Android can exit/background the application.
- Transition, host-listener, component-dialog, and AppShell integration tests
  pass.
- On `emulator-5554`, Back from Create returned to Home and Back from the
  profile-deletion dialog dismissed the dialog while the activity remained the
  top resumed activity.

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

Resolution evidence (October 20, 2026):

- Enabled AndroidX edge-to-edge after Capacitor bridge creation and configured
  Capacitor SystemBars CSS inset handling with a light system-bar style.
- Applied all four safe-area insets to shell/header/page/preview/dialog regions,
  used dynamic viewport units, and kept the native header sticky while content
  scrolls.
- Native narrow layouts stack the navigation and hide its redundant logo/Home
  control. This removed status-bar collisions and text clipping at Android font
  scale 2.0 without viewport-capping normal navigation text.
- Portrait and landscape checks passed at font scale 2.0; labels remained
  complete, scrollable content remained reachable, and no horizontal clipping
  was observed. Normal-scale keyboard-open testing kept the focused Book title
  field visible and `dumpsys input_method` reported both input-view flags true.
- Safe-area, large-text reflow, SystemBars configuration, and Android host
  ordering have focused regression tests.

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

## Remaining verification order

1. Repair and test the separately tracked notes-specific fallback grounding
   gaps.
2. Repeat device acceptance for those notes scenarios.
3. Mark P06 verified only after all P06 gates pass together.
4. Start P07, then P08.

The emulator was restored after the audit to automatic rotation, font scale
1.0, and enabled Wi-Fi/mobile data.
