import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import type { FlushableStorage } from "@/storage/repository";

function storageWithFlush(flush: () => Promise<void>): FlushableStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    flush,
  };
}

async function fillProfile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: "Create child profile" }),
  );
  await user.type(screen.getByLabelText("Child name"), "Aavya");
  await user.type(
    screen.getByLabelText("School grade or age range"),
    "Grade 3",
  );
}

describe("AppShell native durability gate", () => {
  beforeEach(() => localStorage.clear());

  it("does not claim or display a saved profile before native flush completes", async () => {
    let release!: () => void;
    const flush = vi.fn(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const user = userEvent.setup();
    render(<AppShell storage={storageWithFlush(flush)} />);
    await fillProfile(user);
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(flush).toHaveBeenCalledOnce();
    expect(
      screen.queryByText("Aavya’s profile is ready."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Tell us about the reader" }),
    ).toBeInTheDocument();
    release();
    expect(
      await screen.findByText("Aavya’s profile is ready."),
    ).toBeInTheDocument();
  });

  it("shows a privacy-safe failure and no false success when native flush rejects", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        storage={storageWithFlush(async () => {
          throw new Error("private native contents");
        })}
      />,
    );
    await fillProfile(user);
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(
      await screen.findByText(/change could not be saved safely/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Aavya’s profile is ready."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/private native contents/i),
    ).not.toBeInTheDocument();
  });

  it("keeps browser behavior synchronous when no flush capability is injected", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await fillProfile(user);
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(localStorage.getItem("read-reflect:state:v2")).not.toBeNull(),
    );
    expect(screen.getByText("Aavya’s profile is ready.")).toBeInTheDocument();
  });
});
