import { describe, expect, it } from "vitest";
import type { GenerationInput } from "@/domain/schemas";
import {
  getInstallationToken,
  toNetworkGenerationInput,
} from "./promptRequest";

const input: GenerationInput = {
  child: {
    name: "Aavya Private Name",
    gradeOrAge: "Grade 3",
    readingLevel: "Independent: Grade 5",
    difficulty: "challenging",
    responseLength: "medium",
  },
  book: {
    title: "A Book",
    author: "An Author",
    genre: "fiction",
    progress: "Pages 1-10",
  },
  specificity: "general",
  skills: ["inference"],
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
};

describe("prompt request privacy boundary", () => {
  it("removes the child name before serialization", () => {
    const request = toNetworkGenerationInput(input);
    expect(JSON.stringify(request)).not.toContain("Aavya Private Name");
    expect(request.child).not.toHaveProperty("name");
    expect(request.child.gradeOrAge).toBe("Grade 3");
  });

  it("creates one opaque installation token and reuses it", () => {
    const first = getInstallationToken(localStorage);
    const second = getInstallationToken(localStorage);
    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(second).toBe(first);
  });

  it("replaces a malformed stored installation token", () => {
    localStorage.setItem(
      "read-reflect-installation-token-v1",
      "not-a-valid-token",
    );

    const token = getInstallationToken(localStorage);

    expect(token).toMatch(/^[0-9a-f-]{36}$/i);
    expect(token).not.toBe("not-a-valid-token");
    expect(getInstallationToken(localStorage)).toBe(token);
  });
});
