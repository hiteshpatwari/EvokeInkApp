# Design Document: Response Coaching

## Overview

- Outcome: A family receives trustworthy, age-appropriate coaching for one response to one saved worksheet prompt, with one or two strengths and one actionable revision step.
- Scope: Structured response-feedback contracts, deterministic mock feedback, an ephemeral typed-response workflow, and a fail-closed photo-transcription workflow.
- UI Spec: `docs/ui-spec/response-coaching-ui-spec.md`
- Governing ADRs: `docs/adr/0001-capacitor-mobile-runtime.md`

## Requirement Boundary

- Requirement carrier: This document embeds the convergence record explicitly approved by the user on 2026-10-22.
- Current requirements:
  - Review one response against one saved worksheet prompt.
  - Require user confirmation or correction of image-derived transcription before analysis.
  - Adapt language and depth using the worksheet's immutable child-profile snapshot.
  - Return strength-first feedback covering observed evidence, missed or unclear prompt parts, one next step, and one revision question.
  - State limitations when supplied context cannot support factual book verification.
  - Validate every request and response against strict schemas and provide a deterministic mock path.
  - Keep provider credentials server-side and exclude child name and local identifiers from network payloads.
  - Keep raw answer photos transient and unsaved by default.
- Non-goals: Grades or numeric scores; pass/fail; saved feedback history; teacher replacement; unsupported factual verification; behavioral, mental-health, or handwriting-quality assessment; face recognition; plagiarism detection; complete-answer rewriting; multi-page submissions; teacher dashboards; student ranking; autonomous chat; cloud image or review history; training on submitted content.
- Open requirement fields: None. Live image analysis remains blocked until the existing child-data retention and native-attestation gates are approved.

## Acceptance Criteria

- **AC-001** — **When** a family selects one prompt on a saved worksheet, the system shall open a response review associated only with that session and prompt. Source: approved outcome.
- **AC-002** — **If** response text is empty, whitespace-only, over the configured bound, or contains unknown request fields, **then** the system shall reject it before provider execution and show actionable guidance. Source: validated-input requirement.
- **AC-003** — **When** a valid typed response is submitted in mock mode, the system shall return deterministic structured feedback without requiring an API key. Source: deterministic mock requirement.
- **AC-004** — **When** valid feedback is displayed, it shall contain one or two strengths, observed evidence, zero or more missed or unclear prompt parts, one next step, one revision question, grounding, and any limitation. Source: approved feedback range.
- **AC-005** — **If** the available context cannot verify a book-specific claim, **then** feedback shall avoid correctness claims and state the limitation. Source: no invented facts requirement.
- **AC-006** — **If** a provider times out, fails, or returns invalid output, **then** the application shall show only schema-valid fallback feedback or a bounded retry-safe failure while preserving the response draft. Source: safe fallback requirement.
- **AC-007** — **Before** any later photo leaves the device, the system shall crop and downscale it, strip metadata, show a just-in-time disclosure, and require explicit submission. Source: approved photo workflow and privacy boundary.
- **AC-008** — **When** a later image is transcribed, the system shall require user confirmation or correction of the transcript before requesting feedback. Source: handwriting-error boundary.

## Existing Evidence

| Evidence                                      | Location                                                         | Design effect                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Strict domain and network schemas             | `src/domain/schemas.ts`                                          | Add separate feedback schemas and a name/ID-free network DTO using the existing Zod pattern.                                            |
| Provider interface and deterministic fallback | `src/domain/promptGenerator.ts`, `src/server/generatePrompts.ts` | Add a separate `AnswerFeedbackProvider`; do not overload prompt generation.                                                             |
| Immutable worksheet profile snapshot          | `src/domain/schemas.ts:readingSessionSchema`                     | Feedback input uses `childSnapshot` values from generation time.                                                                        |
| Atomic versioned local state                  | `src/storage/repository.ts`                                      | Keep feedback ephemeral so the approved outcome adds no unrequested history or migration.                                               |
| Browser-to-relay privacy boundary             | `src/client/promptRequest.ts`, `src/server/promptApiControls.ts` | Reuse strict DTO construction, exact-origin handling, quota controls, and `no-store`; never send names or local IDs.                    |
| Local-first native persistence                | `mobile/src/nativePersistence.ts`                                | Preserve canonical state unchanged; no response or feedback is saved in the approved scope.                                             |
| Answer-image data inventory                   | `docs/security/SECURITY_PRIVACY_BASELINE.md`                     | The transient flow is documented; live activation still requires owner, legal, host, provider-retention, and store-disclosure approval. |
| Current native AI restriction                 | `.codex/state/PROJECT_MEMORY.md`                                 | Native real AI remains blocked pending verified attestation.                                                                            |
| Repository checks                             | `package.json`                                                   | Use Vitest, oxlint, TypeScript, browser/mobile builds, and secret scanning.                                                             |

## Design

### Selected Design

Deliver the feature in vertical stages. The typed-feedback phase proves the educational contract with typed text and a deterministic mock provider. It adds no camera permission and makes no external provider call. Response feedback uses a separate provider contract because its inputs, safety behavior, output schema, quotas, and future image boundary differ from prompt generation.

The typed feedback request contains only the exact worksheet prompt, its skill and difficulty metadata, the confirmed response text, and immutable profile fields needed to adapt language and depth: grade or age, optional reading measures, difficulty, and response length. A strict network DTO excludes child name, child/session/prompt IDs, timestamps, book metadata, progress, parent summaries and notes, and unrelated saved data.

The response is controlled structured data, not provider-authored presentation markup. The client renders fields only after schema validation. The deterministic mock evaluates only observable structural signals, such as response length and detail or reasoning cue language. It does not claim semantic prompt alignment or book-fact knowledge; its limitation explains that full content review requires the gated real provider.

The photo workflow accepts one image and processes it locally before any network action. Selection, rotation, cropping, downscaling, and JPEG re-encoding remain on-device. The user then explicitly chooses `Read handwriting`; the client sends only the prepared JPEG to a separate transcription route. The route and OpenAI adapter are fail-closed in mock mode and never fabricate OCR. A valid transcript is shown for confirmation or correction before the image is discarded and a separate text-only feedback request begins.

The transient server relay and real multimodal adapter remain disabled for live child content. Activation requires separate release gates for privacy, provider and host retention, store disclosures, quotas, cost, content-free logging, and a controlled web pilot. Native activation additionally requires server-verified device attestation. The image, transcript, and coaching result never enter canonical state or backups.

### Change Surface

| Responsibility or expected file                        | Change                                                                                                                                           | Governing source          | Unaffected boundary to preserve                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------- |
| `src/domain/schemas.ts` or a focused schema module     | Add response-review input and feedback schemas with strict network variants.                                                                     | AC-002, AC-004            | Existing prompt, worksheet, and persisted schemas remain compatible.             |
| `src/domain/answerFeedbackProvider.ts`                 | Define the provider-neutral text-feedback interface.                                                                                             | AC-003, AC-006            | `PromptGenerator` remains unchanged.                                             |
| `src/domain/mockAnswerFeedbackProvider.ts`             | Produce deterministic, profile-adapted, non-factual coaching.                                                                                    | AC-003 to AC-005          | No API key or network dependency.                                                |
| `src/server/generateAnswerFeedback.ts`                 | Validate and bound provider execution and output; provide a safe fallback.                                                                       | AC-002 to AC-006          | Existing `/api/prompts` behavior remains unchanged.                              |
| `src/app/api/feedback/route.ts` and controls           | Add a strict POST boundary with exact origins, separate quotas and budget category, and `Cache-Control: no-store`.                               | AC-002, AC-006            | No content logging; prompt quotas are not silently reused.                       |
| `src/components/AppShell.tsx` plus focused components  | Add the typed review flow and ephemeral feedback controls.                                                                                       | UI Spec, AC-001 to AC-006 | Existing create, edit, save, and PDF flows remain intact.                        |
| `mobile/src/promptTransport.ts` or a sibling transport | Route feedback requests through an explicit HTTPS endpoint with deterministic offline behavior.                                                  | AC-003, AC-006            | No provider credential in the bundle.                                            |
| Image modules and transcription route                  | Add one-image selection or capture, local processing, explicit submission, strict transcription, transient cleanup, and transcript confirmation. | AC-007, AC-008            | No raw image persistence, broad gallery permission, or invented mock transcript. |
| Privacy and store documentation                        | Record answer text and transient image data flow before live-provider activation.                                                                | AC-007                    | Disabled live mode and remaining approvals stay explicit.                        |

### Components and Flow

| Stage             | Data flow                                                                          | Persistence                                                     |
| ----------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Typed entry       | Saved worksheet prompt plus typed response to strict local input                   | Draft remains component state.                                  |
| Typed review      | Network-safe feedback input to mock service to validated feedback                  | Response and feedback disappear when the flow closes.           |
| Photo preparation | One local image to bounded processing; no request occurs until `Read handwriting`  | Prepared image exists only in memory.                           |
| Transcription     | Prepared JPEG to separate relay/provider boundary to validated editable transcript | No application persistence; image is discarded before feedback. |
| Live feedback     | Confirmed text and bounded context to server provider to validated feedback        | Image is excluded; the client creates no review history.        |

### Contracts, State, and Persistence

| Boundary                        | Input / exact format                                                                                   | Output / exact format                                    | Error or state behavior                                                                                              | Compatibility                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| UI to feedback domain           | Selected prompt snapshot and response text                                                             | Parsed internal feedback input                           | Local validation errors retain the draft.                                                                            | New boundary.                                |
| Client to `/api/feedback`       | Strict JSON without names, IDs, book data, or notes; opaque installation token header                  | `{ feedback, provider, fallback, notice? }`              | Invalid input returns 4xx; provider failure returns safe fallback or bounded unavailability; response is `no-store`. | Additive route.                              |
| Feedback provider               | Validated prompt, profile learning fields, and response                                                | Strict `answerFeedbackSchema`                            | Invalid output is discarded before rendering.                                                                        | Separate from `PromptGenerator`.             |
| Canonical state                 | Existing profiles and sessions only                                                                    | Existing versioned canonical JSON                        | Response drafts and feedback are not persisted.                                                                      | Existing state and backups remain unchanged. |
| Client to `/api/transcriptions` | One locally prepared JPEG plus opaque installation token; no profile, book, prompt, note, or ID fields | `{ transcription, provider: "openai", fallback: false }` | Invalid or unavailable output returns retry, retake, or manual-entry guidance; response is `no-store`.               | Additive route; live mode remains gated.     |
| Transcription provider          | Prepared JPEG plus fixed transcription instructions                                                    | Strict transcript and bounded uncertain segments         | `store: false`; no automatic SDK retry; invalid output is discarded.                                                 | Server-only OpenAI adapter.                  |

### Security Boundary

Response text and images are untrusted child content. Instructions inside them remain data and cannot change the rubric or invoke tools. Reject unknown fields and oversized content before provider execution. Do not log response text, worksheet prompts, transcripts, images, or provider payloads.

The device accepts JPEG, PNG, or WebP, decodes it within dimension and pixel limits, and re-encodes the bounded result as JPEG. The server independently checks the prepared JPEG's media type, structure, dimensions, pixel count, and compressed size before provider execution. SVG, PDF, HEIC, multi-page input, background upload, and automatic paid retries are excluded. Remove in-memory images on success, cancellation, replacement, manual fallback, and failure.

`store: false` is not a retention guarantee. Live child-response processing stays disabled until the owner approves the provider's under-18 and retention posture. Native live AI stays disabled until server-verified attestation or an equivalent authorization boundary exists; CORS is not app identity.

### Repository-Owned Flag and Deployment Behavior

- `ANSWER_FEEDBACK_PROVIDER=mock` is the fail-closed default. A real provider value does not inherit `AI_PROVIDER=openai` implicitly.
- `HANDWRITING_TRANSCRIPTION_PROVIDER=mock` is the fail-closed image default. It returns unavailable rather than fabricated transcription.
- `HANDWRITING_TRANSCRIPTION_LIVE_APPROVED=true`, the server key, a stable transcription quota secret, and every external release approval are required before the web provider can run.
- Native origins remain rejected in live transcription mode until server-verified device attestation is implemented.
- Transcription and feedback have separate quotas and budget estimates because current prompt assumptions do not apply.
- Existing canonical state and backup formats remain unchanged.

## Implementation Approach

- Slicing: Hybrid, starting with a typed vertical slice.
- Dependency order: Contracts and deterministic provider, typed UI/API slice, image/transcript fixtures, disabled real-provider adapters, external release gates, native activation.
- First observable checkpoint: A saved worksheet accepts typed response text and renders deterministic, schema-valid, strength-first coaching in mock mode without an API key.
- Rationale: This proves educational value and the feedback contract before accepting image, retention, permission, and provider-cost risk.

## Verification Strategy

| Claim / AC                       | Level | Repository command or operation                                                | Observable pass condition                                                                                                      |
| -------------------------------- | ----- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Schemas and deterministic mock   | L1    | Focused feedback schema and mock-provider Vitest files                         | Bounds, profile adaptation, non-factual limitations, and deterministic results pass.                                           |
| Provider failure and privacy DTO | L1/L2 | Focused server/client Vitest files                                             | Names, IDs, book data, notes, and unknown fields are rejected; invalid output never reaches the UI.                            |
| Typed response workflow          | L2    | AppShell response-coaching integration test                                    | One prompt opens, reviews, revises, retries, and closes without mutating the saved worksheet.                                  |
| Existing behavior                | L2    | `pnpm test`                                                                    | Current profile, worksheet, PDF, prompt, backup, and mobile tests remain passing.                                              |
| Static quality                   | L1    | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`                             | All commands exit zero.                                                                                                        |
| Build boundaries                 | L2    | `pnpm build`; production-configured `pnpm mobile:build`; `pnpm mobile:secrets` | Web and mobile artifacts build and contain no provider secrets.                                                                |
| Image/transcription flow         | L2/L3 | Fixture-based browser and route tests, then physical Android/iOS acceptance    | No upload occurs before `Read handwriting`; no feedback occurs before confirmation; images are removed on every terminal path. |

- Early verification point: Typed deterministic slice.
- Data/persistence boundary: N/A; drafts and feedback remain ephemeral.
- Existing observable-output comparison: Saved worksheets, PDFs, canonical state, and backup output remain unchanged.

## Material Risks

| Risk                               | Evidence                                           | In-scope response or verification                                                |
| ---------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Feedback criticizes an OCR error   | Handwriting transcription is probabilistic.        | Require editable transcript confirmation before analysis.                        |
| Model invents book correctness     | The repository has no authoritative book text.     | Controlled limitation; no correctness field, confidence score, or grade.         |
| Private content leaks through logs | Answers and photos may identify a child.           | Content-free events, strict DTOs, transient images, and log/artifact review.     |
| Native endpoint is abused          | Exact-origin CORS does not establish app identity. | Keep native live AI disabled until attestation acceptance.                       |
| Image spend bypasses controls      | Image cost and size differ from text generation.   | Separate quotas, budget category, bounded inputs, and no automatic paid retries. |

## References

- `docs/ui-spec/response-coaching-ui-spec.md`
- `src/domain/schemas.ts`
- `src/server/generatePrompts.ts`
- `src/server/promptApiControls.ts`
- `docs/security/SECURITY_PRIVACY_BASELINE.md`
- `.codex/production/P03_AI_CONTROLS.md`

## Update History

| Date       | Version | Changes                                                                                                               |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-10-22 | 1.1     | Narrowed to ephemeral feedback, minimal typed DTO, aligned stages and external release gates.                         |
| 2026-10-25 | 1.2     | Recorded the fail-closed transient transcription boundary, explicit consent, cleanup, and remaining activation gates. |
