# Work Plan: Response Coaching Implementation

Created Date: 2026-10-22
Type: feature
Related Issue/PR: None
Review Scope: Response-feedback contracts and API, ephemeral saved-worksheet UI, mobile transport, later image/transcription boundary, and privacy documentation.

## Implementation Authorization

- **Authorization**: On 2026-10-22, the user approved one typed or photographed response for one worksheet question, parent-confirmed transcription, strength-first constructive coaching, missing prompt elements, and one revision step without grades or unsupported correctness claims.

## Governing Documents

- Design Doc: `docs/design/response-coaching-design.md`
- UI Spec: `docs/ui-spec/response-coaching-ui-spec.md`
- ADR: `docs/adr/0001-capacitor-mobile-runtime.md`

## Implementation Scope

Deliver response coaching in dependency order, proving ephemeral typed deterministic feedback first and enabling photo or live-provider behavior only after its implementation and external release gates pass.

## Implementation Phases

### Phase 1: Typed deterministic feedback

#### Tasks

- [x] **P1-T1: Add strict response-feedback domain contracts**
  - **Source**: Design `Requirement Boundary`, `Contracts, State, and Persistence`; AC-002, AC-004, AC-005
  - **Scope**: Focused feedback schemas/types and schema tests
  - **Depends on**: none
  - **Verification**: Focused Vitest proving bounds, strict network exclusions, structured output, and limitation fields
  - **Primary failure**: A name, local ID, book/parent context, or malformed provider field crosses the boundary.
  - **Observable check**: Unknown/private/unnecessary fields and incomplete feedback fail parsing.

- [x] **P1-T2: Implement deterministic mock response coaching**
  - **Source**: Design `Selected Design`; AC-003 to AC-005
  - **Scope**: New provider interface, mock provider, and unit tests
  - **Depends on**: P1-T1
  - **Verification**: Focused Vitest over early-elementary, advanced, incomplete, and context-limited cases
  - **Primary failure**: Mock feedback implies factual knowledge or changes between identical inputs.
  - **Observable check**: Identical input produces identical bounded feedback and the factual-verification limitation.

- [x] **P1-T3: Add validated mock feedback API route**
  - **Source**: Design `Security Boundary`, `Contracts`; AC-002, AC-003, AC-006
  - **Scope**: Server orchestration, route controls, client DTO construction, and route tests
  - **Depends on**: P1-T1, P1-T2
  - **Verification**: Route/control tests for strict input, exact origin, installation token, no-store, timeout, invalid output, and content-free events
  - **Primary failure**: Response content reaches logs or unvalidated output reaches the client.
  - **Observable check**: Captured DTO and operational event contain no name, local ID, book data, notes, response text, or prompt text outside the request body required by the provider boundary; logs/events contain none of that content.

- [x] **P1-T4: Deliver typed response-review UI**
  - **Source**: UI Spec `UI Surface and Flow`, `Components and Interactions`; AC-001 to AC-006
  - **Scope**: Per-prompt entry, response editor, coaching card, errors, focus, native Back behavior, and integration tests
  - **Depends on**: P1-T3
  - **Verification**: React Testing Library flow from saved prompt through feedback and retry; accessibility assertions
  - **Primary failure**: Feedback is associated with the wrong prompt, a draft is lost on recoverable failure, or closing the flow mutates saved state.
  - **Observable check**: The selected prompt remains visible, the draft survives failure, and canonical storage remains byte-for-byte unchanged.

#### Phase Completion

- [x] A saved worksheet produces deterministic, strength-first typed-response coaching in mock mode without an API key or persisted review history.

### Phase 2: Photo and transcript preparation

#### Tasks

- [x] **P2-T1: Add fixture-driven image and transcript state machine**
  - **Source**: UI Spec photo/transcript states; Design AC-007, AC-008
  - **Scope**: One-image selection contract, crop/rotate/retake states, provisional transcript editor, manual-entry fallback, and fixture tests
  - **Depends on**: P1-T4
  - **Verification**: Browser/mobile component tests proving no feedback request before transcript confirmation
  - **Primary failure**: OCR output is analyzed without user confirmation.
  - **Observable check**: Selection, rotation, and trimming make no request; feedback remains blocked until confirmed text is submitted.

- [x] **P2-T2: Implement bounded local image processing and cleanup**
  - **Source**: Design `Security Boundary`; AC-007
  - **Scope**: Raster type and magic-byte validation, dimension/pixel/size limits, local resize, metadata removal, transient cleanup
  - **Depends on**: P2-T1
  - **Verification**: Fixture tests plus Android cancellation/error/success cleanup proof
  - **Primary failure**: A raw or metadata-bearing image persists after a terminal path.
  - **Observable check**: Success, cancellation, rejection, and error leave no temporary image.

#### Phase Completion

- [x] Photo UX and local processing pass with fixtures; no child response or image is sent externally.

### Phase 3: Disabled real-provider capability

#### Tasks

- [ ] **P3-T1: Add real transcription and feedback adapters behind a fail-closed flag**
  - **Source**: Design `Selected Design`, `Security Boundary`; AC-004 to AC-008
  - **Scope**: Server-only adapters, strict output, transient image relay, timeout/fallback, separate quotas/budget, checked-in privacy inventory changes, and adversarial tests
  - **Depends on**: P2-T2
  - **Verification**: Test-double suite, injection fixtures, artifact secret scan, and proof that disabled configuration never invokes the provider
  - **Primary failure**: Instructions inside student content change the rubric or one user action triggers automatic paid retries.
  - **Observable check**: Injection content remains answer data and one action spends at most one configured image-analysis attempt.
  - **Implemented transcription slice**: Provider-neutral strict transcription contract, server-only OpenAI image adapter with `store: false`, explicit `Read handwriting` upload, confirm/edit/retake UX, truthful mock unavailability, independent quota/budget controls, content-free events, transient cleanup, and web/native fail-closed configuration.
  - **Still required for task completion**: Integrated adversarial verification, real feedback-provider adapter, owner and provider-retention approval, controlled web acceptance, and the external release evidence listed below. No live child content has been processed.

- [ ] **P3-T2: Implement native attestation enforcement while activation remains disabled**
  - **Source**: Design `Security Boundary`; current mobile architecture constraint
  - **Scope**: Verified Play Integrity/App Attest or equivalent authorization and mobile transport integration
  - **Depends on**: P3-T1
  - **Verification**: Test doubles and controlled acceptance show valid claims pass while replayed, missing, invalid, and origin-only claims fail closed
  - **Primary failure**: A copied native origin can spend the shared provider key.
  - **Observable check**: Requests without valid server-verified attestation cannot invoke the real provider.

#### Phase Completion

- [ ] Disabled real-provider code passes contracts, injection tests, quota controls, secret scans, and attestation failure tests without processing live child content.

## External Release Gate

These are operational approvals, not repository implementation tasks. Every condition must pass before a controlled live pilot is activated:

- Owner approval of the provider's child-data, retention, and under-18 posture.
- Updated privacy policy and mobile-store disclosures for student-authored text and images.
- Verified content-free host logging and approved retention.
- Configured and tested transcription-specific and feedback-specific quota and cost budgets.
- Controlled web pilot approval; native activation additionally requires verified device attestation.
- Induced provider failure, rollback, and cost-reconciliation evidence.

## Completion Criteria

- [ ] Every Design Doc obligation needed for implementation is covered by at least one task.
- [ ] Every task cites its governing sections and acceptance criteria.
- [ ] Dependencies permit execution in the listed order.
- [ ] Phase 1 exposes the earliest representative vertical slice.
- [ ] Existing prompt generation, worksheets, PDFs, backups, web persistence, and native persistence remain passing and unchanged.
- [ ] Live photo/provider behavior remains disabled until every external release gate is proven.
