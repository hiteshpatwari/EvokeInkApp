# Security and privacy baseline

Last verified against the repository on 2026-10-19.

## Release decision

Mock mode is suitable for a key-free preview. P03 now removes `child.name` and local record identifiers from the browser-to-relay request. Public OpenAI mode remains blocked until all of these conditions are met:

1. The owner approves the product's age positioning, consent approach, publisher identity, support contact, privacy policy, and OpenAI retention posture with qualified legal advice where needed.
2. The production host is configured to avoid request-body logging and to retain only the minimal request metadata described below.
3. The production OpenAI project has Zero Data Retention enabled before processing personal data of a child under 13 or the applicable age of digital consent.
4. The selected host supplies the shared atomic quota/budget store, stable hashing secret, trusted client-IP boundary, and exact production origin allowlist required by P03.

OpenAI's under-18 guidance says not to process that personal data without Zero Data Retention. Zero Data Retention requires prior OpenAI approval. The Responses API is eligible, but standard API abuse-monitoring logs may contain customer content for up to 30 days. See [OpenAI under-18 guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance) and [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

This document supplies technical facts. It is not a legal conclusion about COPPA, state law, GDPR, age assurance, or store classification.

## Data-flow inventory

### Stored only in the browser

The canonical `read-reflect:state:v2` local-storage record contains:

- Child profile: local ID, name, grade or age range, optional independent reading level, optional Lexile measure, preferred difficulty, preferred response length, and created/updated timestamps.
- Reading session: local session ID, child ID, immutable child-profile snapshot, book title, author, genre, pages or chapters completed, specificity choice, selected skills, parent notes, parent summary, detail notes, original generated prompts, edited prompts, status, and created/updated timestamps.
- Generated and edited prompt fields: local ID, text, skill, explanation, required/optional status, suggested response length, grounding source, difficulty level, and parent-edited status.

The same fields can appear in a user-downloaded JSON backup. Generated PDFs and browser print output contain worksheet display fields selected by the application. The application has no account, cloud database, sync, analytics, advertising, or telemetry.

Local records remain until the user deletes them, clears browser/app storage, replaces data with a backup, or uninstalls/clears the native app. A deleted current profile is intentionally retained inside historical worksheet snapshots. The UI must explain that behavior wherever profile deletion is offered.

### Browser to hosted relay

`POST /api/prompts` currently receives:

- Grade or age range, independent reading level, Lexile measure, preferred difficulty, and preferred response length. The dedicated network schema excludes the child name.
- Book title, author, genre, and reading progress.
- Specificity choice, selected skills, parent notes, parent summary, detail notes, and an optional mock variant number.
- An opaque installation token in a request header for pseudonymous quota enforcement. Local profile and session IDs are not transmitted.

The route rejects unknown nested fields, including attempts to add a child name or local identifiers. The response contains four generated prompts plus provider/fallback metadata and an optional generic notice.

The route validates input and does not intentionally persist or log request bodies. Responses from `/api/prompts` carry `Cache-Control: no-store`. Hosting-layer request capture is outside this repository and must be checked during deployment.

### Hosted relay to OpenAI

OpenAI receives:

- Grade or age range, optional reading level and Lexile measure, preferred difficulty, and preferred response length.
- Book title, author, genre, and reading progress.
- Specificity choice, selected skills, and parent-supplied summary/notes only when notes-based generation is selected.

The serializer excludes child name, local IDs, timestamps, saved worksheets, and prior profile/session records. The request sets `store: false`, which disables Responses API application-state storage under the documented API behavior. Standard abuse-monitoring retention still applies unless the project is approved and configured for Zero Data Retention.

### Third-party and host metadata

The hosted relay and OpenAI necessarily receive ordinary connection metadata such as IP address and request timing. Cloud/CDN providers may generate access or security logs. No repository code can prove or set the final provider retention period; the deployment owner must record and verify those settings.

## Production logging and retention

Application code must never log request bodies, prompts, notes, summaries, names, book metadata, API keys, authorization headers, or provider responses. Current application code emits no production logs.

P03's operational event contract allows only:

- generated request ID;
- coarse timestamp and duration;
- route name and response status;
- provider name and fallback boolean;
- normalized error category;
- input/output token counts and estimated cost when supplied as numeric metadata by the provider;
- rate-limit decision and non-reversible coarse abuse-control key.

Recommended host retention is seven days for these metadata-only logs, unless a shorter practical setting is available. This is an operational recommendation, not a claim about current host configuration. Security-event records may need a separately approved period. Access must be restricted to operators who need it.

## Threat model

| Threat                                        | Existing control                                                                         | Required follow-up                                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| OpenAI key exposed to a browser or repository | Server-only environment variable; no `NEXT_PUBLIC_` key; secret files ignored            | Scan release artifacts and host configuration; rotate on suspected exposure                       |
| Child identity transmitted unnecessarily      | Dedicated browser network DTO and relay schema exclude name and local IDs                | Reconfirm against deployed network traffic and host logs                                          |
| Notes retained by provider                    | Responses request sets `store: false`                                                    | Obtain and enable Zero Data Retention or keep public real-AI mode disabled for applicable minors  |
| Sensitive content exposed in logs             | Application emits no request/response logs                                               | Disable body/header capture at CDN, Worker, and observability layers                              |
| Cross-site framing or injected content        | CSP, frame denial, MIME sniffing protection, restrictive referrer and permissions policy | Verify headers at the deployed URL and revise CSP only for measured compatibility needs           |
| Cross-site request abuse and spend exhaustion | Origin/body validation, bounded provider execution, quotas, and estimated budget circuit | Bind controls to the selected host's shared atomic store and configure provider-side spend limits |
| Malformed stored data or backup               | Zod validation, versioned backup schema, atomic replacement, corruption diagnostics      | Keep validation at every persistence/import boundary                                              |
| Prompt injection or invented book facts       | No book-text fetch; structured output; grounding validation; controlled final templates  | Retain controlled rendering and schema validation when provider code changes                      |
| Shared-device disclosure                      | Browser storage is readable to anyone using that browser profile                         | Tell users this is single-household local storage; provide deletion and backup controls           |
| Dependency compromise                         | Exact versions and frozen lockfile; pinned CI action revisions                           | Run dependency audit for each release and review lockfile changes                                 |

## Browser policy

`next.config.ts` applies a CSP derived from the Next.js 16.4 static CSP guidance. The policy limits resources and connections to the same origin, denies framing and plugins, and restricts browser capabilities the app does not use. Static Next.js output requires inline-script/style allowances in this configuration; development additionally permits eval for framework tooling. A stricter nonce-based policy would force dynamic rendering and should be considered only with measured hosting and caching impact.

## Verification checklist

- Inspect the deployed browser network request and verify no child name or local identifier appears.
- Inspect the relay-to-OpenAI request through a test double and verify `store: false` and serializer exclusions.
- Verify security headers and `Cache-Control: no-store` against the deployed HTTPS URL.
- Verify host logs using synthetic non-personal data and confirm bodies, headers, and content are absent.
- Run `pnpm audit --audit-level=moderate` and resolve production findings before release.
- Confirm `AI_PROVIDER=mock` remains the fail-closed deployment mode until all real-AI gates are approved.
