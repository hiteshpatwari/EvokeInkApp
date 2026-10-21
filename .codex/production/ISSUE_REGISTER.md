# Production issue register

Status values: `ready`, `running`, `human-checkpoint`, `failed`, `verified`.

| Package                       | Status   | Dependency    | Current evidence or gate                                                                                                                                                                                                        |
| ----------------------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P00 Source-control baseline   | verified | None          | Local `main` baseline commit `c706a7c`; fresh clone passed frozen install, formatting, lint, typecheck, 62 tests, and build. Remote host and visibility remain an owner checkpoint.                                             |
| P01 Cloudflare feasibility    | verified | P00           | Authenticated vinext deployment passed required mock behaviors. Measured CPU was 121 ms for first home load and 24 ms for valid mock prompt, so Workers Paid is required. Two adapter-chain audit findings remain P02 gates.    |
| P02 Web deployment            | running  | P01           | Mock-only Worker deployed for P05 with exact Android-origin CORS and SQLite Durable Object controls. Workers Paid activation, production web origin, provider secrets, custom domain, and real-AI acceptance remain.            |
| P03 AI controls               | verified | P00           | Integrated at `680c0db`; merged verification passed 20 focused tests, 79 full tests, lint, typecheck, mock build, and audit. Host-native shared atomic enforcement still depends on P01/P02.                                    |
| P04 Privacy and security      | verified | P00           | Integrated at `fd77c1b` plus truthful disclosure correction; documentation synchronized after P03. Owner/counsel policy approval remains required.                                                                              |
| P05 Mobile architecture       | verified | P00           | Bundled Capacitor 8 architecture selected. Android hosted HTTPS/CORS, authoritative Preferences restore, deterministic failure fallback, profile/workflow, PDF share, upgrade preservation, navigation, and secret scan passed. |
| P06 Capacitor shell           | ready    | P05           | Architecture gate is recorded. Implement the bundled Vite client, explicit HTTPS API base, supported API 36 toolchain, and navigation regression check.                                                                         |
| P07 Native PDF sharing        | ready    | P05           | Architecture gate is recorded. Implement the proven jsPDF bytes → cache file → Share flow with cleanup and preserve browser download/print.                                                                                     |
| P08 Mobile persistence        | ready    | P05           | Architecture gate is recorded. Replace the disposable mirror with an atomic Preferences adapter and verified one-time WebView migration.                                                                                        |
| P09 Operations and cost       | ready    | P02, P03, P04 | Await deployed runtime and approved telemetry boundary.                                                                                                                                                                         |
| P10 Android release candidate | ready    | P06-P09       | Play account/payment and submission remain owner actions.                                                                                                                                                                       |
| P11 iOS release candidate     | ready    | P06-P09       | Apple membership, signing, and submission remain owner actions; macOS required.                                                                                                                                                 |
| P12 Independent verification  | ready    | P00-P11       | Must be performed by an agent that did not implement the release work.                                                                                                                                                          |

## Human checkpoints

- Choose and authorize the Git repository host and visibility before pushing or relying on hosted CI.
- Approve any paid hosting upgrade before activation.
- Approve publisher identity, support contact, privacy wording, age positioning, consent approach, and OpenAI retention posture before public real-AI launch.
- Complete identity, terms, payment, MFA, CAPTCHA, signing, store declarations, and final submissions personally.
