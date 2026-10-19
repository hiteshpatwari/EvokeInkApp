# Production issue register

Status values: `ready`, `running`, `human-checkpoint`, `failed`, `verified`.

| Package                       | Status   | Dependency    | Current evidence or gate                                                                                                                                                               |
| ----------------------------- | -------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P00 Source-control baseline   | verified | None          | Local `main` baseline commit `c706a7c`; fresh clone passed frozen install, formatting, lint, typecheck, 62 tests, and build. Remote host and visibility remain an owner checkpoint.    |
| P01 Cloudflare feasibility    | running  | P00           | Isolated branch `codex/p01-cloudflare`.                                                                                                                                                |
| P02 Web deployment            | ready    | P01           | Do not dispatch until P01 selects a viable runtime and plan.                                                                                                                           |
| P03 AI controls               | running  | P00           | Isolated branch `codex/p03-ai-controls`; host-specific atomic enforcement may depend on P01.                                                                                           |
| P04 Privacy and security      | running  | P00           | Isolated branch `codex/p04-privacy-security`; policy approval remains an owner/counsel checkpoint.                                                                                     |
| P05 Mobile architecture       | failed   | P00           | Agent stopped before changes because the account-level usage limit was reached. The isolated worktree is clean; retry when capacity resets. iOS runtime evidence still requires macOS. |
| P06 Capacitor shell           | ready    | P05           | Do not dispatch until the architecture gate passes.                                                                                                                                    |
| P07 Native PDF sharing        | ready    | P05           | Do not dispatch until the architecture gate passes.                                                                                                                                    |
| P08 Mobile persistence        | ready    | P05           | Do not dispatch until the architecture gate passes.                                                                                                                                    |
| P09 Operations and cost       | ready    | P02, P03, P04 | Await deployed runtime and approved telemetry boundary.                                                                                                                                |
| P10 Android release candidate | ready    | P06-P09       | Play account/payment and submission remain owner actions.                                                                                                                              |
| P11 iOS release candidate     | ready    | P06-P09       | Apple membership, signing, and submission remain owner actions; macOS required.                                                                                                        |
| P12 Independent verification  | ready    | P00-P11       | Must be performed by an agent that did not implement the release work.                                                                                                                 |

## Human checkpoints

- Choose and authorize the Git repository host and visibility before pushing or relying on hosted CI.
- Approve any paid hosting upgrade before activation.
- Approve publisher identity, support contact, privacy wording, age positioning, consent approach, and OpenAI retention posture before public real-AI launch.
- Complete identity, terms, payment, MFA, CAPTCHA, signing, store declarations, and final submissions personally.
