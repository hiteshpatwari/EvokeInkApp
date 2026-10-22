# Response Coaching UI Specification

## Overview

- Outcome: A family can submit one response to one saved worksheet prompt and receive age-appropriate, constructive coaching that identifies strengths, missing prompt elements, and one revision step.
- Scope: Saved worksheet detail, ephemeral response entry and feedback review, and later photo-transcription states.
- Requirement carrier: Confirmed conversation scope from 2026-10-22, recorded in `docs/design/response-coaching-design.md`.
- Explicit exclusions: Numeric or letter grades, pass/fail judgments, unsupported factual verification, personality judgments, complete-answer rewriting, saved feedback history, teacher dashboards, student ranking, autonomous chat, multi-page submissions, and cloud response history.

## Design Evidence

| Source                    | Path / identifier                            | Decision supplied                                                                                          |
| ------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Existing UI               | `src/components/AppShell.tsx`                | Extend the saved-worksheet workflow and preserve the current parent-oriented shell.                        |
| Existing worksheet        | `src/components/WorksheetPreview.tsx`        | Associate ephemeral feedback with the selected prompt snapshot.                                            |
| Existing profile snapshot | `src/domain/schemas.ts:readingSessionSchema` | Adapt tone and complexity from the generation-time child snapshot rather than the mutable current profile. |
| Existing privacy notice   | `src/components/AppShell.tsx`                | Place a just-in-time disclosure before any future content upload.                                          |

## UI Surface and Flow

| View or state                        | Entry / trigger                                        | User-visible result                                                                                                                          | Governing requirement / AC |
| ------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Saved worksheet                      | Open an existing worksheet                             | Each prompt offers `Review a response`.                                                                                                      | AC-001                     |
| Response entry                       | Select `Review a response`                             | The selected prompt is visible with a bounded text area. Phase 1 accepts typed or pasted text.                                               | AC-001                     |
| Empty validation                     | Submit blank or whitespace-only text                   | Inline guidance asks for a response and focus returns to the field.                                                                          | AC-002                     |
| Reviewing                            | Submit a valid response                                | The action is disabled and announces `Reviewing response...`.                                                                                | AC-003                     |
| Feedback                             | Review succeeds                                        | A coaching card shows strengths, observed evidence, missing or unclear prompt parts, one next step, a revision question, and any limitation. | AC-004, AC-005             |
| Feedback unavailable                 | Provider or validation fails                           | The response remains editable and the family sees a retry-safe message without technical/provider details.                                   | AC-006                     |
| Close review                         | Choose `Done` or navigate back                         | The response draft and feedback are discarded; the saved worksheet remains unchanged.                                                        | Approved ephemeral scope   |
| Photo selection, later phase         | Choose `Use a photo` after its privacy gate is enabled | One image can be captured or selected, cropped, rotated, or retaken.                                                                         | AC-007                     |
| Transcript confirmation, later phase | Image transcription succeeds                           | Extracted text is editable and no coaching request is made until the user confirms it.                                                       | AC-008                     |

## Components and Interactions

| Component responsibility    | Reuse / extend / new                         | Inputs or state                            | Interaction and response                                                                    | Governing source |
| --------------------------- | -------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------- |
| Response-review entry point | Extend saved worksheet actions in `AppShell` | Session and prompt ID                      | Opens the review flow for exactly one prompt.                                               | AC-001           |
| Response editor             | New                                          | Prompt text and response draft             | Enforces bounded non-empty input and preserves the draft after recoverable errors.          | AC-002, AC-006   |
| Coaching card               | New                                          | Validated structured feedback              | Renders bounded fields in strength-first order. It never synthesizes fields in the browser. | AC-004           |
| Grounding limitation        | New                                          | Feedback grounding and limitation          | Clearly distinguishes writing/prompt coaching from factual book verification.               | AC-005           |
| Image/transcript step       | New, later phase                             | One local image and provisional transcript | Requires transcript confirmation before feedback; provides manual entry fallback.           | AC-007, AC-008   |

### State / Display Detail

| Component       | State or condition                                    | Display                                                                                                                              | Recovery / transition                                | Source         |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------- |
| Response editor | Response exceeds the schema limit                     | Inline length guidance; no request is sent.                                                                                          | Shorten the text and resubmit.                       | AC-002         |
| Coaching card   | Context cannot verify a book detail                   | `I can help improve how this response explains its thinking, but I cannot confirm every book detail from the available information.` | Family may revise or ask an adult to check the book. | AC-005         |
| Coaching card   | Output fails schema validation                        | Generic unavailable state; malformed provider text is not displayed.                                                                 | Retry or keep editing locally.                       | AC-006         |
| Image step      | Blurry, cut off, unsupported, or low-confidence image | Specific retake guidance and manual-entry option.                                                                                    | Retake, choose another image, or type the response.  | AC-007, AC-008 |

## Visual Constraints

| Element / view  | Constraint                                                                                 | Repository or approved design source | Acceptance observation                                                       |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------- |
| Coaching card   | Strengths appear before improvement guidance; one primary next step is visually prominent. | Confirmed scope                      | No score, grade, pass/fail label, or red failure treatment appears.          |
| Response entry  | The exact worksheet prompt remains visible while entering or revising the response.        | Existing worksheet workflow          | A user can confirm which question is being reviewed without navigating back. |
| Mobile controls | Primary actions remain usable at phone width and with system font scaling.                 | Existing P06 acceptance              | No clipped action or horizontal scrolling at supported mobile sizes.         |

## Accessibility Requirements

| Component / interaction | Keyboard, semantic, announcement, or contrast behavior                                   | Source                            | Acceptance observation                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| Review flow             | A semantic heading names the selected prompt; the response field has a persistent label. | Existing accessible form patterns | Keyboard and screen-reader users can identify the question and input.        |
| Async review            | Loading, success, and failure are announced without moving focus unexpectedly.           | Existing notice/error behavior    | A screen reader announces the result once.                                   |
| Feedback card           | Sections use headings or a list structure; meaning does not depend on color.             | Confirmed feedback structure      | Strength and next-step content remain understandable without visual styling. |

## Acceptance Traceability

| AC / requirement | View, component, or interaction    | Observable UI proof                                             |
| ---------------- | ---------------------------------- | --------------------------------------------------------------- |
| AC-001           | Saved worksheet and response entry | One prompt opens one correctly associated response editor.      |
| AC-002           | Response editor                    | Invalid text is blocked locally with specific guidance.         |
| AC-003           | Reviewing state                    | Duplicate submissions are prevented and status is announced.    |
| AC-004           | Coaching card                      | Validated strength-first coaching is displayed without a score. |
| AC-005           | Grounding limitation               | Unsupported factual verification is explicitly disclaimed.      |
| AC-006           | Failure state                      | Draft remains and raw provider output is never shown.           |
| AC-007           | Photo step                         | One image is locally bounded and can be retaken or discarded.   |
| AC-008           | Transcript confirmation            | No feedback request occurs before transcript confirmation.      |

## Open User Decisions

None for Phase 1. Camera/image-provider activation remains an operational and privacy approval gate, not an unresolved Phase 1 UI requirement.

## Update History

| Date       | Version | Changes                                           |
| ---------- | ------- | ------------------------------------------------- |
| 2026-10-22 | 1.0     | Initial approved response-coaching specification. |
