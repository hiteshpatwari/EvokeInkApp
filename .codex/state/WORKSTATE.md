# Current workstate

## Objective

Complete P05 by proving the selected Capacitor architecture on Android and close its hosted API/CORS dependency through a safe P02 mock deployment.

## Current status

P05 is verified on branch `codex/p05-mobile-architecture`. The bundled Capacitor 8 architecture passed the local-first workflow, authoritative Preferences restore, native PDF share, hosted HTTPS mock generation, deterministic unreachable-endpoint fallback, upgrade preservation, navigation, permissions, and secret-scan checks on `emulator-5554`.

P02 remains running on branch `codex/p02-cloudflare-production`. A key-free deterministic mock Worker is live at `https://read-and-reflect.hiteshpatwari.workers.dev` with exact Android-origin CORS and a SQLite Durable Object. This is sufficient for P05 proof, but it is not approval to enable native OpenAI traffic or a declaration that P02 production launch is complete.

## Completed work

- Recorded the Capacitor architecture in `docs/adr/0001-capacitor-mobile-runtime.md` and the proof in `.codex/production/P05_MOBILE_ARCHITECTURE_SPIKE.md`.
- Used a bounded read-only Gemma4:26b pass plus independent Android, hosted-API, and security reviewers. They found two proof gaps: the original persistence mirror was not authoritative, and P02 lacked CORS preflight/native-attestation boundaries.
- Repaired the ignored proof harness under `tmp/p05-mobile-spike/`: Preferences is authoritative before React starts; writes are serialized and directly observable; one-time WebView migration is read back before marking complete; hosted fetch has an eight-second timeout and validates HTTP status, JSON, and prompt schema; rejection, non-2xx, invalid JSON/schema, and timeout use labeled deterministic fallback.
- P02 commits `6bd0a3a` and `c15dbcd` add exact-origin OPTIONS/POST CORS, mock-only native origins, and key-free mock deploy configuration. Native-origin OpenAI mode fails closed until verified platform attestation exists.
- Authenticated the Cloudflare CLI through the owner's browser approval and deployed P02 in mock mode with `APP_ALLOWED_ORIGINS=https://localhost`.
- Proved live endpoint behavior: health 200/no-store; allowed preflight 204 with exact ACAO, POST/OPTIONS, and limited headers; allowed POST 200 with four prompts/three required/generic grounding; attacker origin 403 with no ACAO.
- Rebuilt, synchronized, packaged, and installed the repaired Android APK with the live endpoint configured.
- From the installed WebView, received four hosted prompts with `fallback=false`, then emulated an unreachable network and received four deterministic prompts with `fallback=true` and the offline notice.
- Flushed and directly read 4,450 bytes of canonical state from Preferences, removed only legacy WebView state, force-stopped/relaunched, and observed `P05Reader`, one saved session, and `Prince Caspian` restored from native state.

## Files or areas changed

- Primary P05 branch: `.codex/production/P05_MOBILE_ARCHITECTURE_SPIKE.md`, `.codex/production/ISSUE_REGISTER.md`, and this workstate.
- Ignored proof artifacts: `tmp/p05-mobile-spike/**`.
- P02 branch/worktree: committed CORS/security/config fixes at `6bd0a3a` and `c15dbcd`; worktree is clean.

## Decisions

- Bundle a client-only Vite/React UI in Capacitor; never use production `server.url`.
- Native prompts use an explicit HTTPS API URL and package no provider secret.
- Android origin is exactly `https://localhost`. The iOS origin remains a P11 runtime check and is not deployed in the allowlist yet.
- Native origins are mock-only until Play Integrity/App Attest or equivalent server-verified attestation is implemented. Exact origin is a CORS boundary, not app identity.
- Browser state remains `localStorage`; production native state uses an atomic Preferences adapter for the canonical versioned JSON plus verified one-time migration.
- Native PDFs use jsPDF bytes, cache storage, Share, and cleanup with no broad storage permission.

## Validation run

- P02: 91/91 tests, lint, format, typecheck, Next build, vinext build, and mock dry-run passed in the implementing agent. Primary-session live build/deploy passed; a pre-build standalone typecheck encountered stale `.next` route types, while the agent's fresh `next typegen` + typecheck passed.
- P05 harness: 10/10 tests, TypeScript, Vite build (336 modules), Capacitor sync (three plugins), and Gradle `:app:packageDebug` (129 tasks) passed.
- APK install returned `Success`; live hosted WebView request and unreachable-network fallback both passed.
- Authoritative Preferences restore passed after removing only WebView state.
- Earlier PDF, upgrade, permissions, cache cleanup, and secret-scan evidence remains valid.
- Independent Android and security re-reviews reported no remaining must-fix issues; the focused CORS/security suite passed 16/16.

## Open issues and blockers

- P02 public production launch still requires Workers Paid activation, production web origins, provider secrets, custom-domain/operational decisions, and real-AI acceptance. The current account subscription observed by CLI did not prove Workers Paid activation.
- Native OpenAI traffic is intentionally blocked until platform attestation is implemented and verified.
- P06 must productionize the shell using the supported API 36 toolchain and add navigation regression coverage.
- P07 must productionize PDF sharing while preserving browser download/print tests.
- P08 must productionize atomic Preferences persistence and migration recovery.
- iOS build, signing, privacy manifests, origin validation, and runtime evidence require macOS/Xcode and remain P11 gates.

## Immediate next action

Start P06-P08 from their recorded ownership boundaries; do not enable native OpenAI until attestation exists.
