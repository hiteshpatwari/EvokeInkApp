# Current workstate

## Objective

Complete P06 Android usability and notes-grounding repairs before starting P07
native PDF sharing or P08 native persistence.

## Current status

The Android Back and system-bar/safe-area defects and the notes-specific
fallback grounding gaps are repaired on branch `codex/p06-ux-fixes`. Automated
checks, independent UX code review, Android packaging, and emulator acceptance
pass. P06 is verified. P07 is the next package, followed by P08.

## Completed work

- Added exact `@capacitor/app@8.0.1` integration. The Capacitor host dispatches
  one cancellable native Back event; only an unconsumed Home event calls
  `App.exitApp()`.
- Added a shared Back transition for `preview → review → create → home` and
  `profile/saved → home`.
- AppShell consumes Back to dismiss session/profile deletion dialogs first,
  restoring focus to the initiating control, and otherwise navigates through
  the logical screen history. Browser behavior remains unchanged.
- Added unit/component coverage for transitions, Capacitor listener behavior,
  dialog dismissal, and AppShell screen navigation.
- Enabled AndroidX edge-to-edge in `MainActivity` after bridge creation and
  configured Capacitor SystemBars for CSS inset handling, a covered viewport,
  visible bars, and dark icons on the light application background.
- Applied top/right/bottom/left safe-area variables to the header, page,
  preview, loading, fixed-dialog, and action regions; dynamic viewport height
  replaces static-only viewport assumptions.
- The native header is sticky over scrolled content. Narrow native layouts stack
  navigation, hide the redundant logo/Home control, and reflow hero/navigation
  text. This removes the font-scale 2.0 status collision and clipped Saved
  reflections label without reducing normal-scale navigation text.
- Updated `fflate` to 0.8.3 and added the root override needed to remove the
  vulnerable transitive copy. The known vinext-only `braces@3.0.3` advisory
  remains accepted because no patched release exists.
- Preserved notes specificity, parent summary, parent notes, and detail notes
  in the on-device deterministic fallback instead of degrading it to general
  prompts.
- The deterministic generator now handles detail-only notes and includes
  bounded excerpts of both note fields when both are supplied.
- Added integration coverage for empty-notes validation, the exact privacy-safe
  request body, provenance labels, and notes-grounded offline fallback.

## Files or areas changed

- `mobile/src/nativeBack.ts`, `mobile/src/main.tsx`, mobile tests and config.
- `mobile/android/**` plugin registration and AndroidX edge-to-edge host setup.
- `src/client/nativeBack.ts`, `src/components/AppShell.tsx`, and associated
  transition/component tests.
- `src/app/globals.css` and `src/app/globals.test.ts` for safe-area, dynamic
  viewport, sticky-header, and large-text behavior.
- `package.json`, `mobile/package.json`, and `pnpm-lock.yaml` for exact native
  plugin/security dependency state.
- `mobile/src/promptTransport.ts`, the deterministic mock generator, and their
  focused tests for notes-preserving fallback.
- P06 audit and issue register for the completed device acceptance gate.

## Validation evidence

- RED phase: native Back tests initially failed because the transition/listener
  modules did not exist.
- Focused Back, edge-to-edge, config, component, and CSS regression tests pass.
- Mobile Vite production build, Capacitor sync, and Gradle `assembleDebug` pass
  with Microsoft JDK 21 and Android API 36. The existing large-chunk warning is
  non-fatal.
- On `Pixel_10_Pro_XL` (`emulator-5554`, API 37), Create → system Back returned
  Home; profile deletion → system Back dismissed the dialog; the activity stayed
  resumed.
- Portrait, landscape, scrolling, dialogs, and font scale 2.0 were visually
  checked after the final APK install. Navigation labels remain complete and
  content stays outside system controls.
- Keyboard-open acceptance at font scale 1.0 kept Book title focused and visible;
  Android reported `mInputShown=true` and `mIsInputViewShown=true`.
- Formatting, lint, root/mobile typecheck, 127 tests, Next production build,
  configured mobile Vite build, Capacitor sync, artifact secret scan, and
  Gradle `assembleDebug` passed.
- The installed APK's hosted notes flow displayed parent-summary and
  parent-notes provenance. With WebView networking emulated offline, the same
  three note fields produced grounded deterministic prompts and the explicit
  offline notice; both parentNotes and detailNotes appeared in the bounded
  note-grounded prompt.

## Open issues and blockers

- P07 must implement native PDF cache/share/cleanup while preserving browser
  download and print.
- P08 must implement authoritative atomic Preferences state and verified
  one-time WebView migration.
- Native OpenAI mode remains intentionally blocked until platform attestation is
  implemented; the deployed endpoint remains mock mode.
- iOS compilation, signing, origin validation, and privacy manifests require
  macOS/Xcode and remain P11 gates.

## Immediate next action

Start P07 native PDF cache/share/cleanup while preserving browser download and
print behavior, then complete P08.
