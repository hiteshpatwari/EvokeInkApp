# Read & Reflect production test plan

Last repository inspection: 2026-10-20.

## Purpose and evidence boundary

This plan separates checks already implemented in the repository from release checks that require a selected host, service account, emulator, physical device, macOS, or store console. A local test or mock provider does not prove a deployed service, real OpenAI availability, mobile lifecycle behavior, or store compliance.

Current evidence:

- Vitest discovers 15 test files and the merged `main` suite passes 79 tests.
- The test environment is jsdom. Temporary validation clones under `tmp/` are excluded.
- Formatting, lint, TypeScript, mock production build, and dependency audit are separate gates.
- There is no committed browser E2E harness, Cloudflare adapter, Capacitor shell, Android project, or iOS project yet.

## Existing automated inventory

| Boundary                      | Existing proof                                                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain schemas                | Generation input validation, required/optional prompt count, grounding enum rejection, strict network DTO coverage through API tests.                                                                       |
| Deterministic mock generation | Stable four-prompt output, no unsupported book facts, summary/notes grounding, reading-level and age adaptation, selected skill coverage.                                                                   |
| AI provider and fallback      | Child-name exclusion from OpenAI context, `store: false`, bounded timeout/retries/output, missing-key and provider-failure fallback, controlled no-invention rendering.                                     |
| API protection                | JSON/origin/identity/body/schema rejection, child-name/local-ID rejection, installation/IP quota behavior, concurrent reservations, budget circuit, provider timeout/429/5xx fallback, content-free events. |
| Client privacy boundary       | Network DTO omits child name, opaque installation token creation/reuse/repair.                                                                                                                              |
| Main workflow                 | Create profile, generate, validate edits, save/reload, completion status, delete confirmation, import replacement state reset, snapshot-based regeneration, AI disclosure.                                  |
| Profile deletion              | Confirmation/focus behavior and retention/filtering of historical worksheet snapshots.                                                                                                                      |
| Storage                       | Version 2 persistence, malformed-neighbor preservation, privacy-safe diagnostics, cleanup, atomic replacement, rollback on write failure, version 1 migration.                                              |
| Backup and restore            | Complete validation, unsupported/malformed rejection, duplicate/inconsistent rejection, deterministic merge/replace, UI confirmation and failed-save behavior.                                              |
| Prompt editor                 | Grounding provenance, edits, required/optional changes, deletion.                                                                                                                                           |
| PDF layout                    | Letter-page block containment, long-title and maximum-prompt metrics, unsupported punctuation normalization.                                                                                                |
| Browser headers/config        | CSP and security-header configuration plus API `no-store`.                                                                                                                                                  |

## Release-blocking test matrix

| Priority | Layer                     | Scenario and observable acceptance                                                                                                                                         | Environment                                                        | Status / dependency                                                                                 |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| P0       | Static quality            | Frozen install succeeds; formatting, lint, typecheck, 79 tests, mock build, and moderate audit pass.                                                                       | Clean Node 24 / pnpm 10.11.1 checkout                              | Automated now; rerun for every integration and release commit.                                      |
| P0       | API contract              | A captured browser request contains no child name or local profile/session ID; unknown private fields are rejected before provider use.                                    | Production build with request-capture proxy or route test double   | Unit/integration proof exists; deployed capture waits for P02.                                      |
| P0       | Abuse controls            | Parallel requests cannot exceed installation/IP/budget limits; quota state is shared across runtime instances; 429/fallback behavior is stable.                            | Selected host with atomic shared store                             | Local single-isolate proof exists; multi-instance proof waits for P01/P02.                          |
| P0       | Provider resilience       | Timeout, provider 429/5xx, invalid structured output, missing key, and open budget circuit produce deterministic mock prompts without sensitive logs.                      | Local test double, then hosted staging                             | Local automated proof exists; hosted failure drill waits for P02/OpenAI setup.                      |
| P0       | Secret boundary           | No API key or signing secret appears in Git, CI logs, browser JS/source maps, Worker bundle, Android AAB, or iOS IPA.                                                      | Repository, deployed assets, release binaries                      | Repository baseline proven; host/native artifact scans wait for P02/P10/P11.                        |
| P0       | Data recovery             | Existing v1/v2 data migrates without loss; malformed neighbors remain recoverable; merge/replace is atomic; web backup restores on a clean install.                        | Browser production build                                           | Automated storage/backup proof exists; clean-browser E2E remains to automate.                       |
| P0       | Critical browser workflow | Parent creates/updates a profile, generates in mock mode, edits, saves, reopens, downloads a readable Letter PDF, backs up/restores, and handles offline/provider failure. | Chromium, Firefox, WebKit at phone/tablet/desktop widths           | Component coverage and prior manual engine evidence exist; repeat as browser E2E on release commit. |
| P0       | Accessibility             | Keyboard and screen reader complete profile, generate, edit, save, backup, and destructive confirmations; focus restores; 200% text and reduced motion remain usable.      | NVDA + Firefox/Chrome, VoiceOver + Safari, TalkBack + Android      | Keyboard/component proof partial; real assistive-technology sessions remain required.               |
| P0       | Deployed security         | HTTPS, CSP, frame denial, `nosniff`, no-referrer, permissions policy, API `no-store`, restrictive CORS/origin behavior, and no body logging are observed.                  | Selected production-like host                                      | Local header proof exists; deployed probe waits for P02.                                            |
| P0       | Android lifecycle         | Create/generate/save/reopen, restart, upgrade preservation, offline fallback, backup exchange, PDF share, safe cancellation, and no broad storage permission.              | Current Android plus one supported older version; phone and tablet | Waits for P05-P10 and emulator/physical device.                                                     |
| P0       | iOS lifecycle             | Same critical workflow, upgrade persistence, PDF share/print, privacy manifest, and no packaged secret.                                                                    | Supported iPhone/iPad on macOS, TestFlight                         | Waits for P05-P11, macOS, and Apple account.                                                        |
| P0       | Policy truth              | Privacy policy, in-product disclosure, Apple privacy responses, and Play Data Safety answers match the observed binary and network flow.                                   | Reviewed release candidate                                         | Technical inventory exists; owner/counsel/store review remains required.                            |

## Recommended automation additions

1. Add a Playwright release suite after P01 selects the hosting/runtime shape. Cover the complete parent workflow, network-payload capture, offline fallback, backup round trip, security headers, print CSS, and responsive phone/tablet/desktop viewports in Chromium, Firefox, and WebKit.
2. Add a host-adapter contract suite with the selected atomic `PromptControlStore`. Run concurrent requests through at least two runtime instances and prove one shared threshold and one shared budget reservation.
3. Add a production artifact secret scan in CI covering `.next`, Worker output, source maps, and later Android/iOS artifacts. Fail on provider-key patterns and signing material.
4. Add PDF artifact inspection, not only layout planning: generate the file, parse page size/count/text, render representative pages, and visually check maximum-content fixtures.
5. Add clean-install and upgrade fixtures for every persisted schema version retained by the product. Preserve fixtures as data, not copied application repositories under `tmp/`.
6. Add automated accessibility scanning as a supplement to keyboard and real screen-reader sessions; triage findings rather than treating scanner output as conclusive.

## Test fixtures

Use synthetic names and notes only. Required profiles:

- Early elementary, accessible, short response.
- Grade 3 with substantially higher independent reading level.
- Secondary/adult reader, advanced, long response.
- Optional reading level/Lexile omitted.

Required content cases:

- General mode with no supplied story context: every prompt remains generic.
- Parent summary only, notes only, and maximum-length free text.
- Maximum title/author/progress values and Unicode punctuation.
- Malformed and partially valid persisted records.
- Valid, duplicate-ID, unsupported-version, truncated, and inconsistent-snapshot backups.
- Provider success, invalid JSON/schema, timeout, 429, 5xx, missing key, quota exhausted, and budget-open cases.

Never use real child data in CI, screenshots, deployed probes, logs, or provider tests.

## Commands available now

```powershell
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
$env:AI_PROVIDER='mock'; pnpm build
pnpm audit --audit-level=moderate
```

Focused AI boundary:

```powershell
pnpm exec vitest run src/client/promptRequest.test.ts src/server/promptApiControls.test.ts src/server/openAIPromptGenerator.test.ts src/server/generatePrompts.test.ts
```

## Dependency-gated checks

- P01: Cloudflare adapter build/preview, Worker bundle size, runtime logs, CPU time, mock route, and invalid-request behavior.
- P02: deployed HTTPS/header/cache/logging/secret/rollback and multi-instance quota tests.
- P05: Capacitor architecture proof on a real Android emulator or device; record iOS gaps on Windows.
- P06-P08: navigation allowlist, native PDF sharing, persistence/upgrade, web-mobile backup compatibility, and offline lifecycle.
- P09: synthetic availability probe, redacted failure signal, cost reconciliation, and emergency mock switch drill.
- P10-P11: signed artifact scans, internal/TestFlight install, physical-device workflows, privacy declarations, and rollback/versioning.
- P12: independent verifier reruns every available gate and returns `PASS` or `NOT READY`; unavailable environmental checks must remain explicit.

## Post-launch, non-blocking suite

- Longer soak tests for quota expiry, monthly reset, and operational counter retention.
- Larger prompt-quality evaluation sets across genres and reader bands.
- Additional printers and PDF viewers beyond one verified path per supported platform.
- More browser/OS combinations than the declared support matrix.
- Performance regression budgets after real traffic establishes representative baselines.

## Release decision rule

The application is not production-ready until every P0 row either passes with recorded evidence or is explicitly removed from the supported release scope. A green unit suite or mock deployment alone is insufficient. Any untested physical-device, assistive-technology, production-host, OpenAI-retention, or store-submission boundary must remain listed as `NOT READY` or `BLOCKED BY OWNER ACTION`.
