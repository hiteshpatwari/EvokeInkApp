# ADR 0001: Bundle the mobile UI in Capacitor

- Status: accepted for P06-P08 implementation
- Date: 2026-10-20
- Governing package: P05 in `.codex/production/PRODUCTION_EXECUTION_PROMPT.md`

## Context

Read & Reflect is a local-first Next.js application. Its browser UI currently
persists one canonical versioned JSON state in `localStorage`, calls the prompt
endpoint with `fetch("/api/prompts")`, and downloads generated PDFs through the
browser. The mobile release must preserve offline mock operation, avoid shipping
an OpenAI key, survive app upgrades, and use the operating-system share sheet.

Two Capacitor shapes were evaluated:

1. load the deployed website into a WebView; or
2. bundle a separately built client application and call an explicit HTTPS API.

Capacitor documents `server.url` as a live-reload facility that is not intended
for production. A hosted WebView would also remove the reliable offline UI,
couple app startup to the website, and create a thin website-wrapper review
risk. The current Next application cannot be exported unchanged because it has
a request-dependent POST route and server security-header behavior.

## Decision

Use Capacitor 8 with bundled Vite-built React assets and an explicit,
environment-specific HTTPS prompt API base URL.

- Keep the existing Next/Cloudflare web application and its server route.
- P06 will add a mobile client entry that reuses shared React, domain, and PDF
  code without packaging Next server code.
- The production Capacitor configuration must not contain `server.url`, enable
  cleartext traffic, or allow arbitrary WebView navigation.
- The mobile prompt transport will call only the configured production API
  origin. Cloudflare must explicitly allow the Capacitor origins used by the
  shipped configuration. No provider credential is packaged in the app.
- Network failure, timeout, or unavailable hosted AI must fall back to the same
  deterministic, general-purpose mock prompts available in local development.
- P08 will store the canonical versioned JSON state through Capacitor
  Preferences. `localStorage` remains the browser adapter and a one-time native
  migration source, not the authoritative native store.
- P07 will render the existing Letter-size jsPDF document, write its binary data
  to the application cache with Capacitor Filesystem, invoke Capacitor Share,
  and then remove the temporary file. It will not request broad filesystem
  access.

## Selected official plugins

| Package                  | Purpose                              | Scope and security boundary                                                                 |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `@capacitor/core`        | Native bridge and platform detection | Runtime foundation; expose only required official plugins.                                  |
| `@capacitor/android`     | Android project                      | Generated native host; no secrets or remote production URL.                                 |
| `@capacitor/ios`         | iOS project                          | Generated on macOS in P11; no Windows runtime claim.                                        |
| `@capacitor/preferences` | Small canonical state document       | UserDefaults/SharedPreferences; app-private, removed on uninstall, not a backup substitute. |
| `@capacitor/filesystem`  | Temporary PDF file                   | Cache directory only; no broad storage permission.                                          |
| `@capacitor/share`       | OS share sheet                       | Share only the generated cache-file URI initiated by the user.                              |

The selected Capacitor repository and official plugins are MIT licensed. P11
must include the Apple privacy-manifest reasons required by Preferences and
Filesystem before archive validation.

## Consequences

The mobile app has a second frontend build target but continues to share domain,
validation, repository, prompt, and PDF logic. Browser behavior remains
unchanged. P06, P07, and P08 can proceed independently after P05's emulator
proof completes, provided they own the shell, PDF, and persistence modules
respectively.

The API CORS policy becomes a release contract. The native origin is not a
trusted identity or an abuse-control substitute; quotas and budget enforcement
remain server-side. iOS compilation, signing, privacy-manifest validation, and
runtime testing require macOS/Xcode and remain P11 gates.

## Rejected alternatives

- **Production `server.url` / hosted website:** rejected because Capacitor marks
  it as non-production, it breaks dependable offline startup, and it creates a
  thin-wrapper dependency on the hosted web release.
- **Next static export of the current application:** rejected because the
  request-dependent prompt POST route and server behavior are not compatible
  with an unchanged static export.
- **Native `localStorage` as the durable store:** rejected because WebView
  storage is not the documented durable native preference boundary and may be
  cleared by the operating system.
- **Direct printer plugin:** deferred. The share sheet supplies printing and
  document destinations without another permission-bearing dependency.
