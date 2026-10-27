# Security and privacy baseline

Last verified against the repository on 2026-10-25.

## Release decision

Mock mode is suitable for a key-free preview. P03 now removes `child.name` and local record identifiers from the browser-to-relay request. Public OpenAI mode remains blocked until all of these conditions are met:

1. The owner approves the product's age positioning, consent approach, publisher identity, support contact, privacy policy, and OpenAI retention posture with qualified legal advice where needed.
2. The production host is configured to avoid request-body logging and to retain only the minimal request metadata described below.
3. The production OpenAI project has Zero Data Retention enabled before processing personal data of a child under 13 or the applicable age of digital consent.
4. The selected host supplies the shared atomic quota/budget store, stable hashing secrets, trusted client-IP boundary, and exact production origin allowlist required by P03 and response coaching.
5. The privacy policy and mobile-store disclosures cover student-authored response text and the optional transient answer image.
6. Native image transcription has server-verified device attestation or remains disabled. A Capacitor origin is not proof of app identity.

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

### Response coaching and handwriting transcription

`POST /api/feedback` receives only the selected worksheet prompt, the confirmed or typed response text, and the immutable reading-profile fields needed to adapt the coaching. It excludes the child name, local IDs, book title and author, reading progress, parent summary, and parent notes. The response and feedback are temporary UI state and are not written to canonical storage, backups, or review history.

The optional photo workflow first validates, rotates, crops, downsizes, and re-encodes one image as a bounded JPEG in device memory. This processing removes the selected file's metadata from the prepared copy. Selection and editing do not cause a network request. The prepared JPEG leaves the device only after the user chooses `Read handwriting` following the just-in-time disclosure.

`POST /api/transcriptions` receives the prepared JPEG plus the opaque installation token used for quota enforcement. It does not receive the child profile, child name, local IDs, book metadata, worksheet prompt, parent notes, or prior response history. The route revalidates the request, uses a transcription-specific quota and estimated-budget reservation, returns `Cache-Control: no-store`, and does not persist the image or transcript. The client discards the in-memory image when the user continues to feedback, replaces or discards the photo, switches to typed entry, or leaves the review.

Mock mode never invents a transcript. It returns an unavailable response and offers retry, retake, or manual entry. Live image processing remains disabled unless the separate transcription provider flag, explicit live-approval flag, OpenAI server secret, stable quota secret, exact web origin, and release approvals are all present. Native origins are rejected in live mode until server-verified device attestation exists.

### Hosted relay to OpenAI

OpenAI receives:

- Grade or age range, optional reading level and Lexile measure, preferred difficulty, and preferred response length.
- Book title, author, genre, and reading progress.
- Specificity choice, selected skills, and parent-supplied summary/notes only when notes-based generation is selected.

The serializer excludes child name, local IDs, timestamps, saved worksheets, and prior profile/session records. The request sets `store: false`, which disables Responses API application-state storage under the documented API behavior. Standard abuse-monitoring retention still applies unless the project is approved and configured for Zero Data Retention.

For approved live handwriting transcription, OpenAI receives only the prepared JPEG and a fixed instruction to transcribe visible handwriting without correcting or completing it. Image text is explicitly classified as untrusted data: the transcription provider must never follow instructions embedded in handwriting, printed worksheet text, or the background. The request sets `store: false` and validates the structured transcript before returning it. The user must confirm or edit the transcript before the separate feedback step. `store: false` is an API request setting, not a blanket provider-retention guarantee. Provider abuse-monitoring, Zero Data Retention eligibility and approval, host handling, and contractual retention must be reviewed and recorded before live child-image processing.

### Third-party and host metadata

The hosted relay and OpenAI necessarily receive ordinary connection metadata such as IP address and request timing. Cloud/CDN providers may generate access or security logs. No repository code can prove or set the final provider retention period; the deployment owner must record and verify those settings.

## Production logging and retention

Application code must never log request bodies, prompts, notes, summaries, names, book metadata, response text, transcripts, images, API keys, authorization headers, or provider responses. Current request handlers emit content-free operational events only.

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

| Threat                                                        | Existing control                                                                                                                                                                                        | Required follow-up                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| OpenAI key exposed to a browser or repository                 | Server-only environment variable; no `NEXT_PUBLIC_` key; secret files ignored                                                                                                                           | Scan release artifacts and host configuration; rotate on suspected exposure                                                  |
| Child identity transmitted unnecessarily                      | Dedicated browser network DTO and relay schema exclude name and local IDs                                                                                                                               | Reconfirm against deployed network traffic and host logs                                                                     |
| Notes retained by provider                                    | Responses request sets `store: false`                                                                                                                                                                   | Obtain and enable Zero Data Retention or keep public real-AI mode disabled for applicable minors                             |
| Answer image retained or exposed                              | Local re-encoding; explicit submission; no app persistence; `store: false`; transient cleanup                                                                                                           | Approve provider/host retention and store disclosures; verify deployed logs; keep live image mode disabled until then        |
| Malformed or oversized image causes excess work               | Client and server media, size, dimension, and pixel bounds; one image per request                                                                                                                       | Retain adversarial fixtures and one-attempt provider policy when image handling changes                                      |
| Sensitive content exposed in logs                             | Application emits no request/response logs                                                                                                                                                              | Disable body/header capture at CDN, Worker, and observability layers                                                         |
| Cross-site framing or injected content                        | CSP, frame denial, MIME sniffing protection, restrictive referrer and permissions policy                                                                                                                | Verify headers at the deployed URL and revise CSP only for measured compatibility needs                                      |
| Cross-site request abuse and spend exhaustion                 | Origin/body validation, bounded provider execution, quotas, and estimated budget circuit                                                                                                                | Bind controls to the selected host's shared atomic store and configure provider-side spend limits                            |
| Malformed stored data or backup                               | Zod validation, versioned backup schema, atomic replacement, corruption diagnostics                                                                                                                     | Keep validation at every persistence/import boundary                                                                         |
| Prompt injection in notes, handwriting, or a student response | Untrusted text is delimited as data; transcription instructions prohibit obeying image text; structured output and schema validation; deterministic feedback currently executes no student instructions | Preserve the same instruction/data separation in every future live feedback provider and retain adversarial regression cases |
| Shared-device disclosure                                      | Browser storage is readable to anyone using that browser profile                                                                                                                                        | Tell users this is single-household local storage; provide deletion and backup controls                                      |
| Dependency compromise                                         | Exact versions and frozen lockfile; pinned CI action revisions                                                                                                                                          | Run dependency audit for each release and review lockfile changes                                                            |

## Browser policy

`proxy.ts` generates a fresh nonce for every page request and applies the strict
script and style policy recommended by the installed Next.js 16.4 guidance.
Arbitrary inline scripts and styles are not allowed. The policy otherwise
limits resources and connections to the same origin, denies framing and
plugins, and restricts browser capabilities the app does not use. This makes
page rendering dynamic; deployment checks must continue measuring Worker cost
and caching behavior.

## Verification checklist

- Inspect the deployed browser network request and verify no child name or local identifier appears.
- Inspect the relay-to-OpenAI request through a test double and verify `store: false` and serializer exclusions.
- Verify photo selection, rotation, and trimming make no request; `Read handwriting` sends only one prepared JPEG; and `/api/feedback` contains only confirmed text.
- Verify success, retake, discard, manual fallback, failure, and unmount remove the in-memory image.
- Verify transcription operational events and deployed host logs contain no image, transcript, prompt, response text, or request headers.
- Verify security headers and `Cache-Control: no-store` against the deployed HTTPS URL.
- Verify host logs using synthetic non-personal data and confirm bodies, headers, and content are absent.
- Run `pnpm audit --audit-level=moderate` and resolve production findings before release.
- Confirm `AI_PROVIDER=mock` and `HANDWRITING_TRANSCRIPTION_PROVIDER=mock` remain the fail-closed deployment modes until all applicable real-AI gates are approved.
