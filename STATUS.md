# Evoke Ink implementation status

Last verified: October 16, 2026

The requested local MVP workflow is implemented. No required MVP function is currently known to be missing. This file tracks verified behavior, remaining verification work, and intentionally deferred product scope.

## Implemented functionality

- Child profiles store name, grade or age range, optional independent reading level, optional Lexile measure, preferred difficulty, and preferred response length.
- Grade or age and reading level remain separate inputs. Prompt wording, vocabulary, reasoning demand, and response length adapt from the saved profile.
- Saved worksheets retain an immutable child-profile snapshot. Later profile changes do not rewrite earlier worksheets or their regeneration context.
- Reading sessions retain both the original generated prompts and the final parent-edited prompts.
- Parents can create a reading session, select skills, choose general or notes-based prompts, and provide a summary, parent notes, or detail notes.
- Selectable skill coverage includes evidence and explanation, inference, cause and effect, character motivation, conflict and problem solving, theme, author’s purpose, comparison, and prediction. Every worksheet also includes a concise summary and an optional personal response unless prediction is selected for the optional slot.
- Generation returns three required prompts and one optional prompt with skill, explanation, response length, grounding source, and difficulty metadata.
- Prompt review supports text edits, required or optional status changes, deletion, reordering, and single-prompt regeneration.
- Grounding labels distinguish generic, parent-summary, parent-notes, and parent-edited wording. Notes-based prompts include a bounded excerpt of the source that the child can read.
- Parents can preview, print, download a Letter-sized PDF, save, reopen, duplicate, filter, delete, reprint, and mark a reflection ready or completed.
- Worksheet deletion requires confirmation and supports cancel, Escape, focus containment, and focus restoration.
- Parents can delete a child profile after confirmation. Historical worksheets remain available with the immutable child-profile snapshot used when each worksheet was generated.
- The dashboard separates saved worksheet count from completed reflection count and shows a simple non-graded skill history.
- Parents can download a versioned JSON backup and restore it using either merge or replace. Imports are fully validated before an atomic write, and replace requires an additional confirmation.
- Browser data uses one canonical version 2 storage record. Existing version 1 profile and worksheet collections migrate safely on the next successful write.
- A saved-data warning reports unreadable record counts without exposing their contents. The parent can explicitly remove only the unreadable records while retaining valid neighboring records.
- The provider layer includes `PromptGenerator`, `MockPromptGenerator`, and a server-only `OpenAIPromptGenerator`. Missing credentials, provider failures, invalid output, and invalid grounding fall back to deterministic mock prompts.
- OpenAI selects structured prompt direction. The server validates provenance and renders final text through controlled profile-adaptive templates so provider text cannot introduce unsupported book facts.
- Child names remain local and are not included in OpenAI requests. Grade or age, reading level, difficulty, response length, book metadata, parent context, and requested skills are sent when needed for generation.
- Confirmation dialogs use modal semantics, keyboard focus containment, Escape handling, and trigger-focus restoration. Interactive controls have touch-friendly targets, and nonessential motion is removed when the browser requests reduced motion.
- The Aavya and Prince Caspian examples are seed actions only. Production behavior is not tied to that child, grade, reading level, or book edition.

## Current verification evidence

The following checks passed on October 16, 2026:

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` with all 62 tests passing, including the final malformed-storage guard
- The repository and backup suites with the malformed-storage guard: 20/20 tests passed
- `pnpm build`
- `pnpm audit --audit-level=moderate` with no known vulnerabilities
- Live server request using the configured OpenAI provider: four prompts, three required, no fallback, and exact generic, summary, and notes provenance where expected
- Live server request for author’s purpose and comparison: no fallback and both selected categories appeared in the required prompts
- Chromium workflow: profile creation, generation, review, save, reload, preview, saved reflection, and PDF download
- Chromium status workflow: mark completed, reload, dashboard count persistence, duplicate, and correct Draft status display
- Responsive Chromium inspection at 375 by 812 pixels
- PDF inspection: two Letter pages rendered through Poppler, with intact prompt blocks and usable handwriting lines
- Firefox and Playwright WebKit browser workflows, including Letter print-media layout, passed on Windows
- An isolated key-free installation passed frozen dependency installation, mock prompt generation, the quality checks, and development and production HTTP startup

## Outstanding work

### Known MVP limitations

- Profiles and worksheets remain local to one browser. JSON backup and restore protect against accidental browser-data loss, but there is no account recovery, cloud sync, or automatic off-device backup.
- OpenAI mode needs outbound network access and a server-side API key. Mock mode remains the supported offline fallback after dependencies are installed.
- OpenAI returns structured prompt text and metadata, but the final worksheet wording is rendered from controlled templates. This is an intentional safety tradeoff that prevents a schema-valid provider response from introducing unsupported book facts; it also means the final question prose is not free-form AI-authored text.
- Browser print margins can vary if the operating-system print dialog overrides Letter sizing or application margins.
- A real screen-reader session and an automated WCAG rules-engine scan have not been run.
- Native Safari is unavailable on this Windows host. Playwright WebKit passed, but it is not a substitute for native Safari verification.
- Physical-printer output and native operating-system print dialogs remain unverified.
- Product telemetry is deferred for this private local-first MVP.
- One key-free temporary validation copy remains on disk because recursive cleanup was blocked by command policy. It contains no `.env.local` file or copied API key.

### Intentionally deferred scope

Authentication, child accounts, collaboration, grading, handwriting recognition, spelling correction, book scraping, copyrighted full-text ingestion, external book databases, reading-time tracking, gamification, analytics-heavy dashboards, calendar integration, native mobile apps, subscriptions, and payments remain out of scope for this MVP.

## Next recommended increments

1. Run a real screen-reader session and automated WCAG scan before a public release.
2. Verify native Safari, operating-system print dialogs, and a physical Letter-size printer when that hardware is available.
3. If multi-device use becomes a real requirement, design consent, identity, and cloud synchronization around the existing versioned backup format.
4. Add privacy-preserving telemetry only if a hosted beta creates a specific reliability question that local testing cannot answer.
