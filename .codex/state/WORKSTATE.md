# Current workstate

## Objective

Establish a distinctive, accessible visual system shared by the web and
Capacitor applications without changing their product behavior.

## Current status

The **Ink & Marigold** theme is implemented locally across the shared web/mobile
UI. It replaces the generic sage palette with warm parchment surfaces, deep
indigo structure, marigold accents, and restrained terracotta/status colors.
The UX design authority and final code reviewer both passed the corrected
implementation. It has not been deployed or installed as a refreshed APK.

## Completed work

- Added a durable UI specification at
  `docs/ui-spec/ink-and-marigold-theme-ui-spec.md` covering semantic tokens,
  typography, responsive behavior, accessibility, native layout, and print.
- Reworked the shared stylesheet so both web and Capacitor receive the same
  palette, editorial hierarchy, cards, form states, notices, coaching UI,
  worksheet treatment, focus indicators, and selected states.
- Added `aria-current` to top-level navigation and regression coverage for the
  active destination.
- Corrected native/mobile layout issues found during UX critique: the brand and
  horizontal navigation remain usable at 320 px, content no longer receives an
  oversized safe-area offset, decorative hero art cannot cover narrow text, and
  programmatic page focus does not show an unwanted outline.
- Corrected accessibility issues found in code review: stronger line contrast,
  approved eyebrow tracking, and 48 px controls (including icon buttons) for
  narrow and native layouts.
- Preserved reduced-motion, forced-colors, and black-and-white print behavior.
- Gemma4:26b was started twice through the required global router and confirmed
  in Ollama, but both runs drifted into unrelated Mobbin tasks. They were stopped
  before modifying the workspace; implementation was completed by a scoped
  worker and independently reviewed instead.

## Validation evidence

- Full Vitest: 49 files / 302 tests passed.
- Root and mobile TypeScript passed.
- Oxlint with warnings denied, scoped Prettier, and `git diff --check` passed.
- Next.js 16.4.3 production build passed.
- Mobile production build passed using the current public Worker prompt URL;
  bundle secret scan passed. The existing >500 kB chunk warning remains.
- Browser review covered desktop, 430 px mobile web, and 320 px native-emulated
  layouts with no horizontal overflow. The child-profile form also remained
  usable at the narrow native viewport.
- Final UX designer verdict: pass. Final independent code review: pass.

## Open issues and blockers

- The theme has not yet been deployed to the public Worker or packaged and
  installed as a refreshed Android APK.
- Physical-device checks for enlarged system text and safe-area behavior remain
  release acceptance work; browser/native emulation passed.
- Existing transcription provider/privacy gates, native attestation requirement,
  dependency findings, and the mobile bundle-size warning remain unchanged.

## Immediate next action

Commit and push the verified Ink & Marigold theme. Deployment and refreshed APK
installation can then be handled as the next explicit release step.
