import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PromptEditor } from "./PromptEditor";
import type { WorksheetPrompt } from "@/domain/schemas";

const prompts: WorksheetPrompt[] = [
  {
    id: "p1",
    text: "Choose an important idea and explain why it matters using evidence.",
    skill: "evidence_and_explanation",
    explanation: "Practices evidence and reasoning.",
    required: true,
    suggestedResponseLength: "4-6 sentences",
    grounding: "generic",
    difficultyLevel: "advanced",
  },
  {
    id: "p2",
    text: "Write one thoughtful question and explain what led you to it.",
    skill: "personal_response",
    explanation: "Practices personal response.",
    required: false,
    suggestedResponseLength: "2-3 sentences",
    grounding: "generic",
    difficultyLevel: "advanced",
  },
];

describe("PromptEditor", () => {
  it("shows the grounding provenance for each prompt", () => {
    render(
      <PromptEditor
        prompts={prompts}
        onChange={vi.fn()}
        onRegenerate={vi.fn()}
        regeneratingIndex={null}
      />,
    );
    expect(screen.getAllByText("General prompt")).toHaveLength(2);
  });

  it("edits prompt text through the visible control", async () => {
    const onChange = vi.fn();
    render(
      <PromptEditor
        prompts={prompts}
        onChange={onChange}
        onRegenerate={vi.fn()}
        regeneratingIndex={null}
      />,
    );
    const text = screen.getByLabelText("Prompt 1");
    fireEvent.change(text, {
      target: { value: "A stronger prompt with evidence." },
    });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall?.[0][0].text).toContain("A stronger prompt");
    expect(onChange.mock.lastCall?.[0][0].parentEdited).toBe(true);
  });

  it("qualifies grounding provenance after a parent edit", () => {
    render(
      <PromptEditor
        prompts={[{ ...prompts[0]!, parentEdited: true }]}
        onChange={vi.fn()}
        onRegenerate={vi.fn()}
        regeneratingIndex={null}
      />,
    );
    expect(
      screen.getByText("Parent-edited · started as general prompt"),
    ).toBeInTheDocument();
  });

  it("changes required versus optional status", async () => {
    const onChange = vi.fn();
    render(
      <PromptEditor
        prompts={prompts}
        onChange={onChange}
        onRegenerate={vi.fn()}
        regeneratingIndex={null}
      />,
    );
    await userEvent.selectOptions(
      screen.getAllByLabelText("Status")[0]!,
      "optional",
    );
    expect(onChange.mock.lastCall?.[0][0].required).toBe(false);
  });

  it("deletes a prompt", async () => {
    const onChange = vi.fn();
    render(
      <PromptEditor
        prompts={prompts}
        onChange={onChange}
        onRegenerate={vi.fn()}
        regeneratingIndex={null}
      />,
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Delete" })[0]!,
    );
    expect(onChange).toHaveBeenCalledWith([prompts[1]]);
  });
});
