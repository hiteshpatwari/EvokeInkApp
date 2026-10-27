# Evoke Ink production execution prompt

Use this prompt to coordinate independent agents that prepare Evoke Ink for a public web beta and later iOS and Android distribution.

## Mission

Take the existing application at `C:\projects\HandwrittenApp` from a verified local MVP to a low-cost, production-ready public beta while preserving its core product boundaries:

- Parents create and print reading-reflection worksheets.
- Children do not create accounts and do not type answers in the product.
- Child profiles and worksheets remain device-local for the beta. Backup and restore remain available.
- The OpenAI API key stays server-side. Public clients never receive or store it.
- Prompt generation continues to work through the deterministic mock fallback when OpenAI is unavailable, invalid, rate-limited, or over budget.
- The system does not invent book facts and does not ingest copyrighted book text.
- Existing worksheet snapshots retain the profile values used at generation time.
- No grading, handwriting OCR, gamification, subscriptions, social sharing, or cloud sync is added in this production pass.

## Current evidence

- Framework: Next.js 16.4, React 19, TypeScript, pnpm.
- AI route: Node-style `POST /api/prompts`, with server-only OpenAI and mock providers.
- Persistence: versioned browser `localStorage` with validated backup and restore.
- PDF: client-side jsPDF; printing uses the browser print flow.
- Quality baseline: formatting, lint, typecheck, 62 tests, build, and dependency audit previously passed.
- Repository warning: `C:\projects\HandwrittenApp` currently has no discoverable Git metadata. Treat source-control initialization or connection as a prerequisite, not an assumed fact.
- Cloudflare is a candidate, not a settled deployment target. As of October 19, 2026, Cloudflare recommends vinext for new Next.js 16 deployments. Workers Free allows 100,000 requests per day but only 10 ms CPU per invocation. Prove this application in the Workers runtime before selecting it.

## Target outcome

A parent can install or open Evoke Ink, create a profile, generate and edit a worksheet, save it locally, share or download a Letter-size PDF, and recover from AI failure. A public client cannot obtain the provider key or create uncontrolled provider spend. Deployment and mobile release procedures are repeatable, observable, and reversible.

## Cost target

- Web beta fixed infrastructure: $0/month when Cloudflare Workers Free passes the compatibility and load gates; otherwise use Workers Paid at $5/month before considering Vercel Pro.
- AI: target below $0.01 per monthly active user under the documented normal-use assumptions; enforce a hard provider budget and per-installation allowance.
- Apple Developer Program: owner-paid $99/year only when the iOS release candidate is ready.
- Google Play Console: owner-paid $25 one-time only when the Android release candidate is ready.
- No paid analytics, database, authentication, email, or observability service in the beta unless a failed acceptance criterion proves it necessary.

## Operating rules for every agent

1. Read `AGENTS.md`, `.codex/state/WORKSTATE.md`, current repository status, and only the files required for the assigned task.
2. Do not remap the whole repository. Do not modify files outside the task ownership boundary.
3. Preserve unrelated work. Other agents may be active.
4. Use a dedicated branch or isolated worktree after source control exists. One task maps to one branch and one reviewable change.
5. Read the relevant Next.js 16 guide under `node_modules/next/dist/docs/` before changing Next.js behavior.
6. Never expose secrets, place secrets in source control, log child/book/note content, or send child names to OpenAI.
7. Implement the smallest complete change that satisfies the acceptance criteria. Do not add speculative infrastructure.
8. Run the focused tests for the task, then the repository quality suite when the task changes executable behavior.
9. Report exact commands and results. A check that was not run must be labeled unverified.
10. Update `.codex/state/WORKSTATE.md` after a material state change.
11. Stop and return evidence when a human-owned decision, identity check, payment, terms acceptance, CAPTCHA, MFA, DNS ownership action, or store declaration is required.
12. Never purchase a service, accept legal terms, create a legal identity, or submit an app for review on the owner's behalf.

## Dependency order

```text
P00 Source control baseline
 ├─ P01 Cloudflare compatibility spike ─ P02 Production web deployment
 ├─ P03 AI cost and abuse controls ─────┘
 ├─ P04 Security and privacy baseline ──┤
 └─ P05 Mobile architecture spike ──────┬─ P06 Capacitor shell
                                        ├─ P07 Native PDF sharing
                                        └─ P08 Mobile storage lifecycle

P02 + P03 + P04 ─ P09 Production operations
P06 + P07 + P08 + P09 ─ P10 Android release candidate
P06 + P07 + P08 + P09 ─ P11 iOS release candidate
P00-P11 ─ P12 Independent release verification
```

P01, P03, P04, and P05 may run in parallel after P00. P06-P08 may run in parallel only after P05 records the selected native approach and assigns non-overlapping files.

## Atomic work packages

### P00: Source-control and reproducibility baseline

**Agent:** repository steward

**Owns:** `.gitignore`, package-manager metadata, CI definition, repository initialization/remote preparation, documentation for reproducible setup.

**Work:** Establish Git history or connect the intended remote without overwriting existing files. Ensure `.env.local`, generated output, signing material, native credentials, and platform build products are ignored. Add a key-free CI job that runs the existing quality suite in mock mode.

**Acceptance:** A clean clone can install with the frozen lockfile and pass formatting, lint, typecheck, tests, and build without an OpenAI key. No secret or generated artifact is tracked.

**Human checkpoint:** The owner chooses or authorizes the repository host and visibility if no remote exists.

### P01: Cloudflare production-feasibility spike

**Agent:** hosting compatibility engineer

**Owns:** spike-only deployment configuration and a written decision record. Avoid application behavior changes.

**Work:** Test the current Next.js 16 app with the currently supported Cloudflare path. Evaluate vinext first because Cloudflare recommends it for new Next.js 16 deployments; evaluate OpenNext only if vinext fails a documented requirement. Verify the OpenAI SDK route, Zod parsing, SSR/static assets, response time, Worker bundle size, and Free-plan CPU behavior. Use a temporary project and mock provider first.

**Acceptance:** Record exact deploy/preview commands and results for home load, `POST /api/prompts` mock success, invalid request rejection, production build, and runtime logs. Record measured CPU where available. Select one of: `Workers Free passes`, `Workers Paid required`, or `Cloudflare rejected` with the failing requirement.

**Stop rule:** Do not migrate the main application until this gate passes.

### P02: Production web deployment

**Agent:** deployment engineer

**Depends on:** P01.

**Owns:** selected hosting configuration, deploy workflow, security headers, environment-variable contract, health check, rollback runbook.

**Work:** Deploy the application to the selected low-cost host. Prefer Cloudflare Workers Free when P01 passes; use Workers Paid when Free CPU limits fail; use Vercel Pro only when Cloudflare fails a required application behavior. Store `OPENAI_API_KEY` as a provider secret. Keep `AI_PROVIDER=mock` available for emergency failover.

**Acceptance:** HTTPS works on the provider domain; headers meet the agreed baseline; mock and OpenAI modes can be switched without a rebuild when the platform supports it; rollback is demonstrated; secrets do not appear in client bundles, source maps, logs, or responses.

**Human checkpoint:** The owner authenticates to the provider and performs any DNS ownership or billing action.

### P03: AI spend, abuse, and resilience controls

**Agent:** backend and cost-control engineer

**Owns:** prompt API protection, provider timeout/retry policy, quota counters or equivalent enforcement, privacy-safe usage logging, tests.

**Work:** First replace the browser-to-server generation profile with a dedicated network type that never contains the child name or local record IDs. Add request-size and output-token limits, content-type and origin checks, provider timeout, bounded retries, per-installation and IP-aware throttling, a monthly server-side budget/circuit breaker, and mock fallback. Do not trust a client-supplied identifier as the only abuse boundary. Use a privacy-preserving installation token and platform-appropriate bot/attestation signal selected during implementation. Keep arbitrary prompts impossible; clients submit only the validated worksheet schema.

**Initial policy:** 20 AI generations per installation per rolling month, one controlled regeneration action per request, and a $250 OpenAI project hard budget. Make quotas configurable without a client release. Avoid collecting child names or raw notes in logs.

**Acceptance:** A request-capture test proves child names and local record IDs never leave the device. Automated tests prove normal generation, wrong content type and disallowed-origin rejection, invalid and oversized body rejection, quota exhaustion, concurrent quota requests, provider timeout, provider 429/5xx, budget-open circuit, and deterministic fallback. Load testing shows the limiter does not create an obvious bypass through parallel requests.

### P04: Security, privacy, and store-disclosure baseline

**Agent:** security and privacy engineer

**Owns:** threat model, data-flow inventory, privacy policy draft inputs, retention/logging configuration, secret-rotation runbook, security tests.

**Work:** Document every field stored locally and every field transmitted to the AI relay. Confirm child names are excluded from all network traffic. Add a just-in-time disclosure that profile attributes, book metadata, and optional parent notes are sent to the hosted relay and OpenAI. Minimize production logs, define retention, add content-security and browser security headers compatible with the app, audit dependencies, and document incident/rotation steps. Evaluate OpenAI Zero Data Retention eligibility because free-text notes may contain personal data; keep real AI disabled or constrain the product to a separately approved privacy posture until this is resolved. Prepare factual inputs for COPPA and App Store/Play data-safety review; flag legal judgments for counsel or owner approval.

**Acceptance:** The data-flow inventory matches observed network traffic; no secret or child name is transmitted unexpectedly; logs contain request metadata and error categories only; dependency audit has no unresolved moderate-or-higher production vulnerability; policy statements match actual behavior.

**Human checkpoint:** The owner approves publisher identity, support contact, privacy-policy wording, age positioning, consent approach, OpenAI retention posture, and any legal interpretation.

### P05: Mobile architecture and plugin spike

**Agent:** mobile platform engineer

**Owns:** disposable Capacitor proof, compatibility report, selected plugin list and license/security review.

**Work:** Prove that a Capacitor shell can load the production UI safely, reach the hosted prompt API, persist data across restarts/upgrades, and invoke a native share sheet for a generated PDF. Determine whether the app should bundle static UI assets or load the hosted app. Prefer bundled assets with an explicit API base URL when it preserves offline/mock behavior and avoids an app-store “website wrapper” risk.

**Acceptance:** A real Android emulator or device completes create-profile, mock generation, save/reopen, PDF share, offline fallback, and upgrade-preservation tests. Record iOS items that cannot be tested on Windows. Select the architecture before P06-P08 begin.

### P06: Capacitor application shell

**Agent:** mobile shell engineer

**Depends on:** P05.

**Owns:** Capacitor configuration and native shell projects. Does not own PDF or storage migration modules.

**Work:** Add the selected Capacitor integration, app identity, icons/splash assets, deep-link/network allowlist, safe-area behavior, keyboard behavior, and environment-specific API base URL. Preserve browser deployment.

**Acceptance:** Web build remains green; Android debug build launches; the app cannot navigate to arbitrary origins; no API secret is packaged; basic phone and tablet layouts are usable in portrait and landscape.

### P07: Native PDF export and sharing

**Agent:** document-export engineer

**Depends on:** P05.

**Owns:** PDF save/share abstraction and tests.

**Work:** Preserve browser download/print. On native platforms, write the generated Letter-size PDF to an application cache/document location and open the OS share sheet. Do not request broad filesystem access. Defer direct printer integration unless share-sheet printing fails on a target platform.

**Acceptance:** Android shares a readable PDF to at least one installed target; browser download and print tests still pass; filenames are safe; temporary files are cleaned according to the documented lifecycle; cancellation is non-destructive.

### P08: Mobile persistence and lifecycle safety

**Agent:** local-data engineer

**Depends on:** P05.

**Owns:** native persistence adapter, migration, backup/restore integration, lifecycle tests.

**Work:** Prove whether WebView storage meets upgrade and OS-pressure requirements. If it does not, add the smallest native storage adapter behind the existing repository interface. Migrate atomically, preserve malformed-record recovery, and retain immutable worksheet profile snapshots.

**Acceptance:** Data survives restart and app upgrade; migration failure leaves the previous source recoverable; backup created on web restores on mobile and vice versa; uninstall behavior is documented truthfully.

### P09: Production operations and cost dashboard

**Agent:** reliability engineer

**Depends on:** P02-P04.

**Owns:** privacy-safe operational counters, alerts, runbooks, status/rollback checks.

**Work:** Add only the telemetry required to answer availability, error rate, latency, quota denials, mock fallback rate, and estimated AI cost. Do not send book, child, notes, prompts, or worksheet content. Configure provider budget alerts and a one-action emergency switch to mock mode.

**Acceptance:** A synthetic probe verifies the web app and mock API; an induced provider failure raises the expected signal without logging content; monthly spend can be reconciled against OpenAI usage; rollback and mock failover are rehearsed.

### P10: Android release candidate

**Agent:** Android release engineer

**Depends on:** P06-P09.

**Owns:** Android identifiers, signing configuration references, release build, store listing draft, Play data-safety evidence. Signing secrets remain outside the repository.

**Work:** Produce a signed release candidate after the owner creates the Play Console account and signing identity. Test current Android versions and one supported older version, phone and tablet, offline behavior, backup/restore, PDF sharing, API failure, and upgrade migration.

**Acceptance:** Reproducible AAB build, clean static/security checks, internal-test installation, completed factual data-safety worksheet, no packaged secrets, and a rollback/versioning plan.

**Human checkpoint:** The owner pays the one-time fee, accepts terms, completes identity verification, controls the signing account, approves listing declarations, and submits the release.

### P11: iOS release candidate

**Agent:** iOS release engineer on a macOS host

**Depends on:** P06-P09.

**Owns:** iOS identifiers/entitlements, signing references, archive, store listing draft, privacy manifest evidence. Certificates and keys remain outside the repository.

**Work:** Produce a TestFlight candidate after the owner creates the Apple developer membership and signing identity. Test supported iPhone/iPad layouts, PDF sharing/printing through the share sheet, local data across upgrades, offline behavior, and AI fallback.

**Acceptance:** Reproducible archive, TestFlight install, privacy manifest matching actual SDK behavior, no packaged secrets, factual App Privacy responses, and a rollback/versioning plan.

**Human checkpoint:** The owner pays the annual fee, accepts agreements, completes identity/tax/legal steps, controls signing, approves privacy declarations, and submits for review.

### P12: Independent production release verification

**Agent:** independent release verifier who did not implement P00-P11

**Owns:** verification report only.

**Work:** Verify requirements from observable behavior and inspect the final diff. Run the full quality suite, production-host smoke tests, secret scans, dependency audit, quota/adversarial tests, backup compatibility tests, Android tests, and iOS evidence review. Do not repair findings in the verification task; return atomic must-fix tasks to the orchestrator.

**Acceptance:** Produce PASS or NOT READY with exact evidence. PASS requires no unresolved must-fix finding and clearly lists environmental checks that could not be run.

## Dedicated service-onboarding agent contract

Create one reusable `service-onboarding` agent. It may:

- Compare current plans using official provider sources.
- Prepare exact signup fields, DNS records, environment-variable names, callback URLs, app identifiers, and least-privilege access settings.
- Open the relevant signup page and navigate to the first identity, payment, terms, CAPTCHA, MFA, or submission boundary when UI automation is available.
- Resume after the owner completes that boundary.
- Configure projects, non-secret settings, deployment connections, budgets, alerts, and access roles with explicit owner authorization.
- Verify the finished setup and record evidence without exposing secret values.

It must stop before:

- Creating or asserting a legal identity.
- Accepting provider terms, developer agreements, tax forms, or store declarations.
- Entering payment details or authorizing a charge.
- Solving CAPTCHA or MFA.
- Creating/exporting a provider key unless the owner is present and the approved secret destination is known.
- Publishing or submitting an app to production review.

Use it in this order to minimize spend:

1. Git repository host, free.
2. Cloudflare account and Workers Free compatibility deployment, free.
3. OpenAI production project with a hard budget and restricted operational access, usage-based.
4. Domain registration only when the beta URL is approved, roughly $10-$25/year.
5. Cloudflare Workers Paid only after Free fails measured CPU/traffic criteria, $5/month minimum.
6. Google Play Console only when the Android release candidate is ready, $25 one-time.
7. Apple Developer Program only when the iOS release candidate and a macOS release path are ready, $99/year.
8. Vercel Pro only when the Cloudflare spike records a required incompatibility that is cheaper to accept than fix, about $20/month before usage overages.

## Orchestrator completion contract

The orchestrator must:

1. Create task branches/worktrees only after P00 establishes the repository boundary.
2. Assign each work package to one agent and avoid overlapping ownership.
3. Wait for every dependency before dispatching its consumers.
4. Review each result against its acceptance criteria and delegate gaps as new atomic tasks.
5. Keep an issue register with status: `ready`, `running`, `human-checkpoint`, `failed`, or `verified`.
6. Never label the app production-ready based only on builds or unit tests.
7. Finish only after P12 passes or report `NOT READY` with the smallest remaining task set.

## Required final report

Return:

- Release verdict: `PASS`, `NOT READY`, or `BLOCKED BY OWNER ACTION`.
- Production URLs and release channels actually verified.
- Exact validations executed and their results.
- Monthly fixed cost, observed AI cost, configured hard limits, and the conditions that trigger a paid upgrade.
- Services created and their owners; never include secret values.
- Remaining owner actions, each with the exact page or console and required decision.
- Known limitations, including any untested physical device, operating system, printer, or store-review boundary.

## Current hosting recommendation

Start with the Cloudflare compatibility spike. Cloudflare Workers Free is the best cost candidate, but the 10 ms CPU limit makes it a measured gate rather than an assumption for this Next.js application. If the app exceeds that limit, Workers Paid starts at $5/month and includes 10 million requests per month before request overages. If full-stack Next.js proves too heavy, test a static frontend plus a minimal Worker relay before paying for Vercel. Netlify Free is the zero-cost fallback worth testing because its current Next.js adapter supports route handlers and commercial projects, although its credit cap can pause all sites on the account. Vercel Hobby is not suitable for a commercial public beta because its documented use is restricted to personal, non-commercial projects. Keep Vercel Pro as the lowest-migration paid fallback.

Authoritative platform references, checked October 19, 2026:

- [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Netlify Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Netlify pricing](https://www.netlify.com/pricing/)
- [OpenAI under-18 API guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)
- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [FTC COPPA compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business)
- [Google Play Families policy](https://support.google.com/googleplay/android-developer/answer/9893335)
