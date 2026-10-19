# Current workstate

## Objective

Finish the remaining Read & Reflect MVP hardening tasks through individually assigned agents, integrate their work, resolve discovered gaps, and report only after combined verification.

## Current status

The requested hardening functionality is integrated. Release documentation is synchronized, the final full quality suite is green, and the independent release re-review has no remaining findings.

A dependency-ordered production execution prompt now defines the low-cost web beta, hosted AI safeguards, Capacitor release path, service-onboarding boundaries, store checkpoints, and independent final verification.

P00 established a local Git repository on `main`, a key-free pinned GitHub Actions quality workflow, expanded secret/build-product ignores, and reproducible Node.js and pnpm setup metadata. No remote is configured because repository host and visibility remain an owner decision.

## Completed work

- Created `.codex/production/PRODUCTION_EXECUTION_PROMPT.md` with 13 atomic work packages (P00-P12), agent ownership, dependency gates, acceptance criteria, human-only service checkpoints, and a dedicated service-onboarding contract.
- Compared current hosting options. Cloudflare Workers is the first compatibility spike; Free remains conditional on measured 10 ms CPU behavior, Workers Paid is the preferred $5/month fallback, Netlify Free is the zero-cost fallback, and Vercel Pro is retained only for a documented compatibility failure.
- Identified a production privacy blocker: the current browser-to-server generation contract includes the child name even though the OpenAI serializer later removes it. P03 now requires a network contract that omits child names and local IDs before public OpenAI mode.
- Established the P00 source-control and reproducibility baseline. The local repository uses `main`; generated output, local environment files, and native signing material are ignored; CI runs frozen install, formatting, lint, typecheck, 62 tests, and build in mock mode.

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

- Application, storage, provider, accessibility, backup, and test changes are integrated across `src/`.
- `STATUS.md`, `README.md`, and this workstate describe the integrated result and verified limitations.

## Decisions

- Deleting a current child profile never deletes historical worksheets or their immutable `childSnapshot` values.
- Backup import must validate the complete file before any write and must be atomic.
- Corrupt-storage warnings must reveal counts and collection names only, never stored child, book, note, or prompt content.
- Child names remain local and are excluded from OpenAI request context.
- Telemetry remains deferred. Reconsider only for a hosted beta with explicit consent, retention, and privacy requirements.
- Safari and physical-printer checks cannot be claimed on this Windows host unless actually available.
- External account creation, legal agreements, identity checks, payment, MFA, CAPTCHA, store declarations, and production submissions remain owner actions. Agents may prepare, configure after authorization, and verify.
- Real-AI public launch requires route abuse controls, spend limits, disclosure/consent review, and an approved OpenAI data-retention posture; a mock-only preview can precede those gates.

## Validation already run

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm audit --audit-level=moderate` passed.
- The final full suite passed 62/62 tests, including the additional malformed-storage guard.
- The independent re-review passed the backup-replacement modal criterion with no findings; its focused 4/4-test check also passed.
- Repository and backup suites including that guard passed 20/20 tests.
- Clean mock install: frozen install, formatting, lint, typecheck, tests, build, development and production HTTP startup, and mock prompt API passed.
- Firefox and Playwright WebKit application and Letter print-media checks passed on Windows.
- P00 proved a fresh key-free clone with `pnpm install --frozen-lockfile`, formatting, lint, typecheck, all 62 tests, and the production build. All checks passed after adding the repository-level LF policy required for reproducible Windows checkouts.

## Open issues and blockers

- A real screen-reader session and automated WCAG scanner have not been run.
- Native Safari is unavailable on Windows; Playwright WebKit passed. Physical-printer output and native print dialogs remain unverified.
- The product remains local-first with no cloud sync or account recovery.
- Controlled templates intentionally trade free-form OpenAI prose for enforceable no-invention behavior.
- Telemetry remains deferred.
- Key-free temporary validation copies under the ignored `tmp/` directory could not be recursively removed because command policy blocked deletion. They contain no `.env.local` or copied API key.
- The local Git repository has no remote. The owner must choose or authorize the repository host and visibility before any push or hosted CI run.
- Cloudflare Workers Free compatibility and CPU headroom are unverified.
- Child names currently reach the hosted Next.js prompt route and must be removed from the network contract before a public real-AI beta.
- COPPA/store classification and OpenAI retention posture require owner and qualified privacy/legal review.

## Immediate next action

Dispatch P01, P03, P04, and P05 in parallel from `.codex/production/PRODUCTION_EXECUTION_PROMPT.md`. Repository-host selection may proceed independently but must not block local branches and worktrees.
