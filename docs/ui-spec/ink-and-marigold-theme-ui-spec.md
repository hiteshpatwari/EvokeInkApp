# Ink & Marigold Theme UI Specification

## Overview

- Outcome: Replace the generic sage-led presentation with one distinctive,
  calm, accessible editorial system that feels equally intentional in the web
  app and the bundled Capacitor app.
- Scope: Shared application shell, dashboard, forms, prompt review, saved
  reflections, response coaching, photo workflow, notices, and worksheet
  preview styles supplied by `src/app/globals.css`.
- Requirement carrier: User-confirmed visual refresh request from 2026-10-25.
- Explicit exclusions: Navigation or workflow changes, new theme switching,
  dark mode, new icon or component dependencies, remote font loading, content
  changes, and changes to printable worksheet structure.

## Design Evidence

| Source                       | Path / identifier                                                                                           | Decision supplied                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmed requirement        | User request, 2026-10-25                                                                                    | Replace sage green with a beautiful, intuitive system consistent across web and mobile.                                                               |
| Existing shared UI           | `src/app/globals.css`                                                                                       | Preserve the single shared stylesheet, component selectors, safe-area handling, breakpoints, print rules, focus behavior, and 44 px minimum controls. |
| Existing component structure | `src/components/AppShell.tsx`, `ResponseReview.tsx`, `ResponsePhotoPreparation.tsx`, `WorksheetPreview.tsx` | Restyle the existing semantic components without introducing a parallel component system.                                                             |
| Existing product intent      | `docs/ui-spec/response-coaching-ui-spec.md` and current home/profile/worksheet flows                        | Preserve calm parent-oriented hierarchy, non-graded coaching, prominent recovery states, and phone-width usability.                                   |

## Chosen Direction

**Ink & Marigold** is a contemporary reading-journal theme: deep blue-violet
ink provides trust and focus; warm parchment supplies the tactile reading and
writing association; restrained marigold and terracotta accents add energy to
important moments. The result should feel literary and human without becoming
antique, childish, wellness-themed, or corporate.

This is a light-only system for the current scope. Color is semantic and
restrained: indigo owns navigation, selected states, links, focus, and primary
actions; marigold marks optional/editorial accents; terracotta is reserved for
warm highlights; blue-cyan indicates success/information; red remains error and
destructive. No green token leads the interface.

## UI Surface and Flow

| View or state                          | Entry / trigger             | User-visible result                                                                                                                                                                   | Governing requirement / AC                  |
| -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Application shell                      | Any web or native route     | Warm parchment canvas, translucent warm top bar, ink-violet brand mark, and consistent navigation states. At 760 px and below, Home and Saved become two labeled 48 px icon controls. | Consistent web/mobile refresh               |
| Home/dashboard                         | Existing home entry         | Editorial hero with quiet lavender atmosphere, warm accent detail, crisp white panels, and clearer primary action hierarchy.                                                          | Beautiful and intuitive design              |
| Forms and prompt review                | Existing create/edit flows  | Neutral high-readability controls; selected choices use pale violet plus strong indigo border rather than sage fill.                                                                  | User-friendly task completion               |
| Saved and response-coaching cards      | Existing saved/review flows | Saved uses the same contained editorial header, panel width, spacing rhythm, and card system as Home; feedback remains strength-first and non-graded.                                 | Consistency and preserved coaching behavior |
| Loading/success/warning/error/disabled | Existing component states   | Semantic colors remain distinguishable by text, border, icon/copy, and state—not color alone.                                                                                         | Accessible state recognition                |
| Worksheet preview                      | Preview or print            | On-screen desk surround adopts the new neutral palette; printed worksheet remains high-contrast, economical, and free of decorative backgrounds.                                      | Print preservation                          |

## Components and Interactions

| Component responsibility    | Reuse / extend / new                                                            | Inputs or state                                   | Interaction and response                                                                                                                                 | Governing source                               |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Global tokens               | Extend `:root` in `src/app/globals.css`                                         | Semantic theme values                             | All color, shadow, radius, and typography choices resolve through named tokens; obsolete sage tokens are removed or replaced.                            | Chosen direction                               |
| Typography hierarchy        | Extend existing `html`, heading, label, and eyebrow rules                       | Heading level and UI role                         | Body/UI uses the existing reliable system sans stack; headings and editorial text use Charter/Iowan/Palatino/Georgia system serif fallback.              | Literary product fit without remote dependency |
| Primary actions             | Restyle `.primary-button` and brand mark                                        | Default, hover/press, focus, disabled             | Indigo fill, warm-white text, modest lift/darken on hover; no glow or excessive motion.                                                                  | Clear primary hierarchy                        |
| Secondary and quiet actions | Restyle `.secondary-button`, `.text-button`, `.back-button`, `.quiet-button`    | Same states                                       | Warm-white/transparent surfaces, ink border/text, pale violet hover.                                                                                     | Familiar low-risk actions                      |
| Cards and panels            | Restyle existing grouped card selectors                                         | Default and selected                              | Warm-white surface, taupe border, restrained cool shadow; selected rows add indigo border and tinted surface.                                            | Shared web/mobile consistency                  |
| Form controls               | Restyle `input`, `textarea`, `select`, radio and checkbox cards                 | Default, hover, focus, checked, invalid, disabled | Warm-white field, neutral border, strong indigo focus ring, pale violet checked state; error copy/border remains red.                                    | Intuitive accessible forms                     |
| Status surfaces             | Restyle `.notice`, `.error-message`, `.storage-warning`, response states, pills | Success/info, warning, error, required, optional  | Semantic pale background + darker text + border; labels never depend on fill alone.                                                                      | State clarity                                  |
| Top-level navigation        | Extend existing semantic navigation buttons                                     | Current destination and viewport                  | Show icon plus text on larger screens; at 760 px and below, retain exactly two 48 px icon buttons with `aria-label`, tooltip text, and active treatment. | Compact, accessible mobile navigation          |
| Print view                  | Extend existing `@media print` and worksheet rules                              | Screen vs print                                   | Screen preview uses neutral desk color; print forces white background, black/dark ink, no shadow, no decorative gradient, and hides no-print controls.   | Print preservation                             |

## Visual Constraints

### Semantic palette

| Token                            |     Value | Use and contrast intent                                                                                              |
| -------------------------------- | --------: | -------------------------------------------------------------------------------------------------------------------- |
| `--ink` / `--color-foreground`   | `#202338` | Default text on parchment and warm-white; target WCAG AA for normal text.                                            |
| `--muted`                        | `#666777` | Secondary text only on light surfaces; do not use below 14 px without stronger weight.                               |
| `--paper` / `--color-background` | `#F7F2E9` | App canvas and native safe-area background.                                                                          |
| `--surface`                      | `#FFFDF9` | Cards, fields, dialogs, and worksheet surround elements.                                                             |
| `--surface-subtle`               | `#F0EAF6` | Selected, hover, and editorial-tinted regions.                                                                       |
| `--primary`                      | `#3F3B78` | Primary buttons, active navigation, links, brand mark; use warm-white text.                                          |
| `--primary-hover`                | `#302D63` | Hover/pressed primary action.                                                                                        |
| `--primary-soft`                 | `#E7E3F2` | Selected rows, chips, and quiet hover backgrounds.                                                                   |
| `--accent`                       | `#C47A18` | Marigold editorial accent, optional labels, small rules, and decorative details; not body text on light backgrounds. |
| `--accent-soft`                  | `#F8E8C7` | Optional/status tint with dark ink text.                                                                             |
| `--terracotta`                   | `#B9573A` | Avatar and warm secondary accent, not a competing primary action.                                                    |
| `--line`                         | `#D9D0C4` | Standard borders and dividers.                                                                                       |
| `--line-strong`                  | `#8F8499` | Selected/interactive borders where stronger definition is needed and at least 3:1 non-text contrast is required.     |
| `--info`                         | `#285F74` | Success/information text and borders.                                                                                |
| `--info-soft`                    | `#E2F0F4` | Success/information background.                                                                                      |
| `--warning`                      | `#76520A` | Warning text and border.                                                                                             |
| `--warning-soft`                 | `#FFF0C8` | Warning background.                                                                                                  |
| `--danger`                       | `#9E3644` | Error/destructive text and border.                                                                                   |
| `--danger-soft`                  | `#F9E4E7` | Error/destructive background.                                                                                        |
| `--focus`                        | `#5B50A4` | Three-pixel focus outline with two-pixel offset; visible on both paper and surface.                                  |

### Type, shape, and elevation

| Element / view           | Constraint                                                                                                                                    | Repository or approved design source        | Acceptance observation                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| Body and controls        | `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; minimum 16 px for main reading/form content on mobile. | Reliable local/system stack                 | No font network request; text remains stable offline in Capacitor.       |
| Headings and prompt text | `Charter, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`; weight 600 where available.                                      | Ink & Marigold direction                    | Literary hierarchy without novelty/script typography.                    |
| Eyebrows/labels          | System sans, 700–800, restrained tracking (`0.11em` maximum).                                                                                 | Existing hierarchy, reduced visual shouting | Labels remain readable at 200% zoom.                                     |
| Cards                    | 16–20 px radius, one-pixel taupe border, `0 14px 40px rgb(43 37 65 / 9%)`.                                                                    | Existing card system                        | Cards feel related; no excessive floating/glass effects.                 |
| Hero                     | 26–30 px radius, parchment-to-lavender gradient, one restrained marigold/terracotta decorative motif.                                         | Chosen direction                            | Primary message/action remains dominant; decoration never overlaps text. |
| Controls                 | 10–12 px radius; minimum 44 px desktop and 48 px native/narrow touch targets.                                                                 | Preserved interaction behavior              | All actions remain comfortably tappable on phone.                        |
| Motion                   | Color, border, shadow, and transform transitions limited to 160–200 ms; hover lift at most 1 px.                                              | Accessible polish                           | No layout shift or attention-seeking animation.                          |

### Exact implementation surface

The implementation should remain predominantly in `src/app/globals.css`.
Update `:root`, global canvas/type/focus rules, `.topbar`, `.brand-button`, nav,
`.hero-card`, `.routine-card`, button families, common card group, selected
profile/radio/chip states, notices and warnings, form controls, prompt/status
labels, preview surround, worksheet screen colors, response coaching/photo
surfaces, and existing responsive/print blocks. Change React markup only when a
decorative effect cannot be expressed with an existing pseudo-element or when a
semantic state lacks a class; do not add wrapper markup solely for decoration.

Both web and mobile consume the same shared `src/app/globals.css`; do not create
a parallel mobile theme. Preserve `html[data-native-app="true"]` safe-area and
sticky-header rules, updating only their color/elevation tokens.

## Accessibility Requirements

| Component / interaction  | Keyboard, semantic, announcement, or contrast behavior                                                                                                           | Source                             | Acceptance observation                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| All interactive controls | Retain `:focus-visible` with 3 px `--focus` outline and 2 px offset. Focus must not rely on box-shadow alone.                                                    | Existing behavior + chosen palette | Keyboard pass shows a visible ring on paper, surface, and tinted backgrounds. |
| Text and controls        | Normal text targets 4.5:1; large text and non-text UI boundaries target 3:1. Accent colors that miss normal-text contrast are decorative or paired with `--ink`. | WCAG AA project quality rule       | Contrast audit has no critical violations on representative screens.          |
| State messaging          | Success, warning, and error continue using text/role semantics and border differences; color is supplemental.                                                    | Existing notice/error behavior     | Grayscale view still distinguishes labels and messages.                       |
| Reduced motion           | Under `prefers-reduced-motion: reduce`, remove transform-based hover/entry motion and reduce transition duration to effectively zero.                            | UI system rule                     | No element visibly moves during hover/focus with reduced motion.              |
| Zoom and mobile          | Preserve responsive stacking and no horizontal scroll at 320, 375, and 430 px; test 200% browser zoom and enlarged mobile text.                                  | User-friendly mobile requirement   | Primary actions, labels, and long prompt text remain visible and operable.    |
| Native safe areas        | Preserve safe-area padding and sticky navigation behavior.                                                                                                       | Existing Capacitor rules           | Header/content avoids status/navigation bars on the Android device.           |
| Compact navigation       | At 760 px and below, hide visible menu text and show Home and Saved icons while retaining accessible names and 48 px targets.                                    | User-requested mobile refinement   | Exactly two understandable icon controls remain visible and operable.         |

## Acceptance Traceability

| AC / requirement                       | View, component, or interaction                            | Observable UI proof                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| THEME-001 No generic sage-led UI       | Entire application                                         | No sage token or green-led primary/selected surface remains; indigo ink and warm parchment clearly lead.                          |
| THEME-002 Beautiful, calm, distinctive | Home/dashboard and primary flows                           | Editorial typography, warm canvas, restrained marigold detail, consistent cards, and clear action hierarchy appear as one system. |
| THEME-003 Web/mobile consistency       | Shared web and Capacitor builds                            | Both consume the same tokens and component rules; only native safe-area/sticky adaptations differ.                                |
| THEME-004 Intuitive operation          | Forms, prompt review, saved reflections, response coaching | Primary, secondary, selected, disabled, loading, warning, and error states are visually consistent without changing workflow.     |
| THEME-005 Accessible implementation    | Representative screens and states                          | Keyboard focus, touch targets, contrast, zoom, reduced motion, and no-horizontal-scroll checks pass.                              |
| THEME-006 Print preservation           | Worksheet preview and printed/PDF result                   | Printed worksheet remains white/high-contrast with no app background, shadows, or decorative color dependency.                    |

## Update History

| Date       | Version | Changes                                                                                          |
| ---------- | ------- | ------------------------------------------------------------------------------------------------ |
| 2026-10-25 | 1.0     | Selected Ink & Marigold and defined its cross-platform implementation and verification contract. |
