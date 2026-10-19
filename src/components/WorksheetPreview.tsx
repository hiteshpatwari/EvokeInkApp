import type { ReadingSession } from "@/domain/schemas";

const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function answerLineCount(length: string) {
  const first = Number.parseInt(length.match(/\d+/)?.[0] ?? "3", 10);
  return Math.max(4, Math.min(8, first + 2));
}

export function WorksheetPreview({ session }: { session: ReadingSession }) {
  return (
    <section className="worksheet" aria-label="Printable worksheet preview">
      <header className="worksheet__header">
        <div>
          <p className="worksheet__brand">READ &amp; REFLECT</p>
          <h1>{session.book.title}</h1>
          <p>by {session.book.author}</p>
        </div>
        <div className="worksheet__meta">
          <p>
            <strong>Reader</strong> {session.childSnapshot.name}
          </p>
          <p>
            <strong>Date</strong> __________________
          </p>
          <p>
            <strong>Reading</strong> {session.book.progress}
          </p>
          <p>
            <strong>Genre</strong> {label(session.book.genre)}
          </p>
        </div>
      </header>
      <p className="worksheet__permission">
        Take your time. You may look back at the book while answering.
      </p>
      <div className="worksheet__prompts">
        {session.prompts.map((prompt, index) => (
          <article className="worksheet-prompt" key={prompt.id}>
            <div className="worksheet-prompt__eyebrow">
              <span>
                {prompt.required
                  ? `Reflection ${index + 1}`
                  : "Optional reflection"}
              </span>
              <span>{label(prompt.skill)}</span>
            </div>
            <h2>{prompt.text}</h2>
            <p className="worksheet-prompt__hint">
              Aim for {prompt.suggestedResponseLength}.
            </p>
            <div className="writing-lines" aria-hidden="true">
              {Array.from(
                { length: answerLineCount(prompt.suggestedResponseLength) },
                (_, line) => (
                  <span key={line} />
                ),
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
