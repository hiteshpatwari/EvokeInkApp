# Evoke Ink

Evoke Ink is a parent-facing, local-first web app for creating printable reading-to-writing worksheets. A parent chooses a child profile, describes a reading session, reviews four generated prompts, and prints or downloads a Letter-sized worksheet. The child reads the physical book and answers with pen and paper.

Current functionality, verification evidence, and remaining work are tracked in [STATUS.md](./STATUS.md).
The production data-flow inventory, threat model, retention gates, incident steps, and store-review inputs are under [`docs/security`](./docs/security/SECURITY_PRIVACY_BASELINE.md).

## Run locally

Requirements: Node.js 24+, Corepack, and pnpm 10.11.1. The exact pnpm version is recorded in `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

On Windows PowerShell, copy the environment template with `Copy-Item .env.example .env.local`. Keep `.env.local` untracked. Mock mode is the default and needs no credential.

Open [http://localhost:3000](http://localhost:3000). The default `AI_PROVIDER=mock` mode requires no API key and produces deterministic prompts.

Quality checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The GitHub Actions quality workflow runs the same five commands with `AI_PROVIDER=mock` and no OpenAI key. It is intentionally key-free so pull requests and clean clones exercise the deterministic fallback path without access to production credentials.

## AI configuration

All provider calls happen in the server-only `/api/prompts` route. No secret is read by client components or sent to the browser.

```dotenv
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
```

- `mock` is the safe default and works offline after dependencies are installed.
- `openai` uses the official server-side OpenAI SDK and Structured Outputs to select skills and structured worksheet metadata. The server validates the result and renders final wording through controlled, profile-adaptive templates so an otherwise valid provider response cannot introduce unverified book details.
- Missing credentials, provider failures, invalid JSON, and schema violations fall back to deterministic generic prompts.
- To add Claude or another provider, implement the small `PromptGenerator` interface and select it in `src/server/generatePrompts.ts`.

## Architecture and data

- Next.js App Router hosts the React UI and server route in one TypeScript app.
- Zod schemas in `src/domain/schemas.ts` validate browser input, provider output, and persisted records.
- Profiles and saved reflections stay in browser `localStorage` for this first local MVP. There is no account or cloud sync.
- Storage is committed as one canonical version 2 record. Existing version 1 collections migrate safely on the next successful write, and valid records remain available when individual neighboring records are malformed.
- Every saved session contains a full `childSnapshot`. Updating a child’s grade, reading level, Lexile measure, difficulty, or response length does not change past worksheets.
- Every saved session retains the original generated prompt set separately from the final parent-edited prompts.
- Deleting a child profile does not delete historical worksheets. Their immutable profile snapshots remain available in Saved reflections.
- Saved reflections include versioned JSON backup and restore. Merge preserves records absent from the backup and lets imported matching IDs win; replace validates the full file, asks for confirmation, and commits all imported data atomically.
- When stored records cannot be read, the app reports counts and collection names without displaying saved content. Cleanup is explicit and removes only unreadable records.
- School grade/age and independent reading level are separate inputs. Both are included in the server-side generation request when available.
- PDF export uses a deterministic Letter-page layout plan. Prompt blocks move intact to a new page rather than splitting awkwardly.

## Grounding and copyright safety

The app never fetches, scrapes, downloads, or reproduces book text. Title, author, genre, and page range are not treated as evidence of story content. With no parent context, every generated prompt is universal and marked `generic`. Provider output can use only `generic`, `parent_notes`, or `parent_summary` grounding, and every response is schema-validated. Provider-selected skills feed a controlled template renderer; only parent-supplied context can enable summary- or notes-grounded wording. This enforces the no-invention rule at the application boundary instead of relying on prompt instructions alone.

Child names remain in the browser and are not serialized into OpenAI requests. The provider receives only the reading-profile attributes, book metadata, requested skills, and parent-supplied context needed to generate the worksheet.

The seeded Prince Caspian example fills only bibliographic and page-range fields; it deliberately makes no claim about what happens on those pages because editions differ.

## Product assumptions and limitations

- This is a single-browser, single-household MVP with no authentication.
- Deleting browser storage deletes local profiles and worksheets. Download JSON backups for restorable data and export PDFs for durable printable copies.
- Worksheet and profile deletion require confirmation. Deleting a profile retains its historical worksheet snapshots.
- “Regenerate” requests a replacement from the configured provider. In deterministic mock mode it alternates to a second safe prompt set.
- Browser printing and generated PDF output are both Letter-sized. Exact margins can vary when a printer dialog overrides application settings.
- Chromium, Firefox, and Playwright WebKit workflows passed on Windows. Native Safari, physical-printer output, and native print dialogs have not been verified.
- Keyboard modal behavior, touch targets, visible focus, and reduced-motion behavior are implemented. A real screen-reader session and automated WCAG scan remain release follow-ups.
- Telemetry is intentionally deferred for this private local-first MVP.
- No grading, OCR, spelling correction, child accounts, gamification, book database, copyrighted full-text ingestion, or social features are included.

The OpenAI integration follows the official [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) and validates the parsed result again at the application boundary.
