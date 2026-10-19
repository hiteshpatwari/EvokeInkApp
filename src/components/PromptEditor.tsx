"use client";

import type { WorksheetPrompt } from "@/domain/schemas";

interface PromptEditorProps {
  prompts: WorksheetPrompt[];
  onChange: (prompts: WorksheetPrompt[]) => void;
  onRegenerate: (index: number) => void;
  regeneratingIndex: number | null;
}

const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const groundingLabel = {
  generic: "General prompt",
  parent_notes: "Based on parent notes",
  parent_summary: "Based on parent summary",
} as const;

export function PromptEditor({
  prompts,
  onChange,
  onRegenerate,
  regeneratingIndex,
}: PromptEditorProps) {
  const update = (index: number, change: Partial<WorksheetPrompt>) => {
    onChange(
      prompts.map((prompt, promptIndex) =>
        promptIndex === index ? { ...prompt, ...change } : prompt,
      ),
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= prompts.length) return;
    const next = [...prompts];
    const current = next[index];
    const target = next[nextIndex];
    if (!current || !target) return;
    next[index] = target;
    next[nextIndex] = current;
    onChange(next);
  };

  return (
    <section className="prompt-list" aria-label="Generated prompts">
      {prompts.map((prompt, index) => (
        <article className="prompt-card" key={prompt.id}>
          <div className="prompt-card__header">
            <div>
              <span
                className={`status-pill ${prompt.required ? "status-pill--required" : ""}`}
              >
                {prompt.required ? "Required" : "Optional"}
              </span>
              <span className="skill-label">{label(prompt.skill)}</span>
              <span className="grounding-label">
                {prompt.parentEdited
                  ? `Parent-edited · started as ${groundingLabel[prompt.grounding].toLowerCase()}`
                  : groundingLabel[prompt.grounding]}
              </span>
            </div>
            <div
              className="icon-actions"
              role="group"
              aria-label={`Reorder prompt ${index + 1}`}
            >
              <button
                type="button"
                className="quiet-button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move prompt up"
              >
                ↑
              </button>
              <button
                type="button"
                className="quiet-button"
                onClick={() => move(index, 1)}
                disabled={index === prompts.length - 1}
                aria-label="Move prompt down"
              >
                ↓
              </button>
            </div>
          </div>
          <label>
            Prompt {index + 1}
            <textarea
              value={prompt.text}
              onChange={(event) =>
                update(index, {
                  text: event.target.value,
                  parentEdited: true,
                })
              }
              rows={4}
            />
          </label>
          <p className="practice-note">{prompt.explanation}</p>
          <div className="prompt-controls">
            <label>
              Status
              <select
                value={prompt.required ? "required" : "optional"}
                onChange={(event) =>
                  update(index, { required: event.target.value === "required" })
                }
              >
                <option value="required">Required</option>
                <option value="optional">Optional</option>
              </select>
            </label>
            <label>
              Response length
              <input
                value={prompt.suggestedResponseLength}
                onChange={(event) =>
                  update(index, { suggestedResponseLength: event.target.value })
                }
              />
            </label>
          </div>
          <div className="card-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => onRegenerate(index)}
              disabled={regeneratingIndex !== null}
            >
              {regeneratingIndex === index
                ? "Regenerating…"
                : "Regenerate this prompt"}
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() =>
                onChange(
                  prompts.filter((_, promptIndex) => promptIndex !== index),
                )
              }
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
