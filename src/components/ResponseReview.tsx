"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getInstallationToken } from "@/client/promptRequest";
import { toNetworkAnswerFeedbackInput } from "@/client/answerFeedbackRequest";
import {
  answerFeedbackSchema,
  type AnswerFeedback,
} from "@/domain/answerFeedbackSchemas";
import type { ChildProfile, WorksheetPrompt } from "@/domain/schemas";

interface ResponseReviewProps {
  childSnapshot: ChildProfile;
  prompt: WorksheetPrompt;
  onDone: () => void;
}

const UNAVAILABLE_MESSAGE =
  "Feedback is unavailable right now. Your response is still here, so you can try again.";

export function ResponseReview({
  childSnapshot,
  prompt,
  onDone,
}: ResponseReviewProps) {
  const [responseText, setResponseText] = useState("");
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const responseRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (reviewing) return;

    let input;
    try {
      input = toNetworkAnswerFeedbackInput({
        prompt,
        childSnapshot,
        responseText,
      });
    } catch {
      setError(
        responseText.trim().length === 0
          ? "Enter the response before requesting feedback"
          : responseText.trim().length > 4000
            ? "Keep the response under 4,000 characters"
            : "Check the response and try again",
      );
      responseRef.current?.focus();
      return;
    }

    setReviewing(true);
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Installation-Token": getInstallationToken(),
        },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Feedback request failed");
      const body = (await response.json()) as { feedback?: unknown };
      const validated = answerFeedbackSchema.parse(body.feedback);
      if (mountedRef.current) setFeedback(validated);
    } catch {
      if (mountedRef.current) setError(UNAVAILABLE_MESSAGE);
    } finally {
      if (mountedRef.current) setReviewing(false);
    }
  };

  return (
    <main className="page response-review" tabIndex={-1}>
      <button type="button" className="back-button" onClick={onDone}>
        ← Back to worksheet
      </button>
      <header className="response-review__header">
        <p className="eyebrow">RESPONSE COACHING</p>
        <h1>Review this response</h1>
        <p>
          Get constructive coaching on how clearly the response answers this
          prompt. This review is temporary and is not saved.
        </p>
      </header>

      <section
        className="selected-prompt"
        aria-labelledby="selected-prompt-heading"
      >
        <p className="eyebrow">SELECTED PROMPT</p>
        <h2 id="selected-prompt-heading">{prompt.text}</h2>
        <p>Aim for {prompt.suggestedResponseLength}.</p>
      </section>

      <form
        className="response-editor"
        onSubmit={(event) => void submit(event)}
      >
        <label htmlFor="student-response">Student response</label>
        <textarea
          ref={responseRef}
          id="student-response"
          rows={9}
          value={responseText}
          aria-describedby="student-response-help"
          aria-invalid={error ? true : undefined}
          disabled={reviewing}
          onChange={(event) => {
            setResponseText(event.target.value);
            setFeedback(null);
            setError("");
          }}
        />
        <div className="response-editor__meta" id="student-response-help">
          <span>Type or paste one response. Maximum 4,000 characters.</span>
          <span>{responseText.length.toLocaleString()} / 4,000</span>
        </div>
        {error && (
          <p className="response-error" role="alert">
            {error}
          </p>
        )}
        {reviewing && (
          <p className="response-status" role="status" aria-live="polite">
            Reviewing response...
          </p>
        )}
        <div className="response-review__actions">
          <button type="submit" className="primary-button" disabled={reviewing}>
            {reviewing
              ? "Reviewing response..."
              : error === UNAVAILABLE_MESSAGE
                ? "Try again"
                : "Get feedback"}
          </button>
          <button type="button" className="secondary-button" onClick={onDone}>
            Done
          </button>
        </div>
      </form>

      {feedback && <CoachingCard feedback={feedback} />}
    </main>
  );
}

function CoachingCard({ feedback }: { feedback: AnswerFeedback }) {
  return (
    <section
      className="coaching-card"
      aria-labelledby="coaching-heading"
      aria-live="polite"
    >
      <p className="eyebrow">COACHING NOTES</p>
      <h2 id="coaching-heading">What you did well</h2>
      <ul>
        {feedback.strengths.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2>What your response includes</h2>
      <ul>
        {feedback.observedEvidence.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2>What may be missing or unclear</h2>
      {feedback.missedOrUnclear.length > 0 ? (
        <ul>
          {feedback.missedOrUnclear.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>No major prompt parts were identified as missing.</p>
      )}
      <div className="coaching-next-step">
        <h2>Try this next</h2>
        <p>{feedback.nextStep}</p>
      </div>
      <h2>Revision question</h2>
      <p>{feedback.revisionQuestion}</p>
      <aside className="coaching-limitation" aria-label="Review limitation">
        <strong>Keep in mind</strong>
        <p>{feedback.limitation}</p>
      </aside>
    </section>
  );
}
