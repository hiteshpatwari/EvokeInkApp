# Current workstate

## Objective

Complete P01 Cloudflare production feasibility, record the runtime decision, and leave P02 with explicit cost, security, and deployment gates.

## Current status

P01 is complete on the isolated `codex/p01-cloudflare` branch. An authenticated mock-only vinext Worker passed the required application and API probes after a Cloudflare global-scope initialization defect was fixed. Cloudflare Workers Free is rejected by measured CPU; Workers Paid is the selected P02 runtime, pending owner approval and resolution of two adapter dependency advisories.

A dependency-ordered production execution prompt now defines the low-cost web beta, hosted AI safeguards, Capacitor release path, service-onboarding boundaries, store checkpoints, and independent final verification.

P00 established a Git repository on `main`, a key-free pinned GitHub Actions quality workflow, expanded secret/build-product ignores, and reproducible Node.js and pnpm setup metadata. The owner authorized a private GitHub repository under `hiteshpatwari`; `origin` now points to that repository.

P03 and P04 are integrated on `main`. The browser-to-server DTO excludes child names and local identifiers; the prompt route enforces bounded JSON, an origin allowlist, pseudonymous installation and IP quotas, an estimated monthly budget circuit, bounded provider execution, deterministic fallback, and content-free operational events. P04 adds security headers, `store: false`, a just-in-time disclosure, threat/data-flow documentation, and incident/rotation guidance. The local reference counter is not sufficient for a multi-instance public deployment; the selected host must bind the platform-neutral interface to an atomic shared store.

## Completed work

- Created `.codex/production/PRODUCTION_EXECUTION_PROMPT.md` with 13 atomic work packages (P00-P12), agent ownership, dependency gates, acceptance criteria, human-only service checkpoints, and a dedicated service-onboarding contract.
- Compared current hosting options. Cloudflare Workers is the first compatibility spike; Free remains conditional on measured 10 ms CPU behavior, Workers Paid is the preferred $5/month fallback, Netlify Free is the zero-cost fallback, and Vercel Pro is retained only for a documented compatibility failure.
- Resolved the production request-privacy blocker: the browser-to-server generation contract now omits child names and local IDs, and the route rejects unknown private fields.
- Established the P00 source-control and reproducibility baseline. The local repository uses `main`; generated output, local environment files, and native signing material are ignored; CI runs frozen install, formatting, lint, typecheck, 62 tests, and build in mock mode.
- Added the required production issue register with P00-P12 dependency and human-checkpoint status.
- Implemented and integrated P03 AI safeguards with request-capture, high-concurrency quota and budget, timeout, provider-failure, origin/content-type/body-size, invalid-token recovery, nested unknown-field rejection, and privacy-safe event tests.
- Integrated P04 security/privacy controls and synchronized its data-flow documentation after P03 removed child names from the network request.
- Added `.codex/production/PRODUCTION_TEST_PLAN.md`, grounded in the current 15-file/79-test inventory, with release-blocking, dependency-gated, and post-launch suites.
- Completed the P01 vinext spike on an authenticated temporary Worker. The home page, security headers, valid mock prompts, invalid input, private-field rejection, origin rejection, and privacy-safe operational events passed.
- Measured Cloudflare CPU at 121 ms for the first home request and 24 ms for the valid mock prompt request, exceeding the Workers Free 10 ms limit. Selected Workers Paid for P02, subject to owner approval.
- Fixed a deployed Worker error caused by generating a fallback UUID during route-module initialization. The prompt handler and environment config now initialize lazily inside the first request, with a regression test.

- Accessible worksheet deletion confirmation with cancel, Escape, and focus restoration.
- Child-profile deletion confirmation. Historical worksheet snapshots remain available and filterable after profile deletion.
- Versioned backup schema, strict backup parsing, deterministic merge/replace resolution, atomic repository replacement, and Saved reflections backup/restore UI.
- Storage diagnostics and cleanup foundation that preserves valid neighboring records and exposes no stored contents.
- Canonical version 2 local storage with safe version 1 migration, atomic writes, malformed-record preservation, a privacy-safe warning, and explicit invalid-record cleanup UI.
- OpenAI context serialization excludes child names while retaining the reading-profile attributes needed for adaptation.
- Modal semantics, focus containment and restoration, Escape handling, touch targets, visible focus, and reduced-motion behavior for accessibility-sensitive interactions.
- The destructive backup-replacement confirmation now uses the same named modal `alertdialog` contract, including initial focus, Tab containment, Escape cancellation, trigger-focus restoration, and blocked background interaction.
- Firefox and Playwright WebKit workflow and print-media verification on Windows.
- Clean key-free mock installation verified in an isolated copy through install, quality checks, development/production HTTP startup, and prompt API behavior.
- Telemetry was assessed and deliberately deferred because this is a private local-first household MVP with no hosted reliability question.

## Files and areas currently changed

- P03 and P04 application changes are integrated and committed on `main`.
- P01 changes are isolated in `C:\projects\HandwrittenApp-worktrees\p01-cloudflare` on `codex/p01-cloudflare` and are pending final commit/integration.
- P05 remains unimplemented.

## Decisions

- Deleting a current child profile never deletes historical worksheets or their immutable `childSnapshot` values.
- Backup import must validate the complete file before any write and must be atomic.
- Corrupt-storage warnings must reveal counts and collection names only, never stored child, book, note, or prompt content.
- Child names remain local and are excluded from OpenAI request context.
- Telemetry remains deferred. Reconsider only for a hosted beta with explicit consent, retention, and privacy requirements.
- Safari and physical-printer checks cannot be claimed on this Windows host unless actually available.
- External account creation, legal agreements, identity checks, payment, MFA, CAPTCHA, store declarations, and production submissions remain owner actions. Agents may prepare, configure after authorization, and verify.
- Real-AI public launch requires route abuse controls, spend limits, disclosure/consent review, and an approved OpenAI data-retention posture; a mock-only preview can precede those gates.
- Cloudflare Workers Paid is the P02 target because live Worker CPU measurements exceeded the Free plan's 10 ms request limit.

## Validation already run

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm audit --audit-level=moderate` passed.
- The final full suite passed 62/62 tests, including the additional malformed-storage guard.
- The independent re-review passed the backup-replacement modal criterion with no findings; its focused 4/4-test check also passed.
- Repository and backup suites including that guard passed 20/20 tests.
- Clean mock install: frozen install, formatting, lint, typecheck, tests, build, development and production HTTP startup, and mock prompt API passed.
- Firefox and Playwright WebKit application and Letter print-media checks passed on Windows.
- P00 proved a fresh key-free clone with `pnpm install --frozen-lockfile`, formatting, lint, typecheck, all 62 tests, and the production build. All checks passed after adding the repository-level LF policy required for reproducible Windows checkouts.
- After merging P03 with P04, the focused AI boundary passed 20 tests, the full suite passed 79/79 tests, lint and typecheck passed, the mock production build passed, and `pnpm audit --audit-level=moderate` found no known vulnerabilities.
- The repository-wide formatting check found only an ignored lifecycle snapshot; application and tracked documentation formatting are checked separately before commit.
- GitHub publication preflight on 2026-10-20 passed the tracked-tree release audit with zero findings, found no key-shaped secrets in reachable history, and found no tracked or historical blobs at least 5 MB. Tracked-file Prettier, lint, typecheck, all 79 tests, production build, and `pnpm audit --audit-level=moderate` passed. The broad `pnpm format:check` still reports only ignored Codex lifecycle/state files.
- P01 refreshed baseline: formatting, lint, canonical mock build, typecheck, and 80/80 tests passed. Focused AI and route initialization coverage passed 21/21 tests. Vinext reported 100% compatibility, and Cloudflare dry-run/upload size was 2380.52 KiB uncompressed / about 675.3 KiB gzip.
- Authenticated Worker probes passed: home 200 with security headers, valid mock prompt 200 with four prompts and `no-store`, empty/private-field payloads 400, and disallowed origin 403. Real-time logs showed 121 ms CPU for first home load and 24 ms for valid mock prompt.
- The temporary mock Worker was deleted after evidence capture; no public spike endpoint remains.

## Open issues and blockers

- A real screen-reader session and automated WCAG scanner have not been run.
- Native Safari is unavailable on Windows; Playwright WebKit passed. Physical-printer output and native print dialogs remain unverified.
- The product remains local-first with no cloud sync or account recovery.
- Controlled templates intentionally trade free-form OpenAI prose for enforceable no-invention behavior.
- Telemetry remains deferred.
- Key-free temporary validation copies under the ignored `tmp/` directory could not be recursively removed because command policy blocked deletion. They contain no `.env.local` or copied API key.
- Cloudflare Workers Free fails the measured CPU gate. Workers Paid requires owner approval before P02 activation.
- The vinext dependency chain adds one high `braces` advisory with no registry-published patch and one moderate `fflate` advisory. P02 must resolve them, prove affected code is build-only and absent from the deployed runtime with evidence, or reject vinext.
- P03's in-memory quota/budget store is single-isolate only. Public OpenAI mode remains gated on a host-native atomic binding (Cloudflare Durable Object if Cloudflare is selected), a stable `AI_QUOTA_HASH_SECRET`, an exact production origin allowlist, and provider-side budget configuration. Native attestation remains dependent on P05's architecture decision.
- COPPA/store classification and OpenAI retention posture require owner and qualified privacy/legal review.
- P05 execution remains pending.
- The read-only local Gemma test-planning pass was stopped after entering a telemetry-warning loop; it made no workspace changes. The primary session completed the plan from direct repository evidence.

## Immediate next action

Review and integrate the P01 branch, then begin P02 only after owner approval for Workers Paid. Resolve the adapter advisories, bind `PromptControlStore` to a Durable Object or equivalent atomic store, and keep real OpenAI mode disabled until deployed concurrency, secret, privacy, and rollback gates pass. P05 may proceed independently.
