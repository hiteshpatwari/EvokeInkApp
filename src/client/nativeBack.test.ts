import { describe, expect, it } from "vitest";
import { getPreviousScreen } from "./nativeBack";

describe("native Back navigation", () => {
  it.each([
    ["preview", "review"],
    ["review", "create"],
    ["create", "home"],
    ["profile", "home"],
    ["saved", "home"],
    ["home", null],
  ] as const)("maps %s to %s", (screen, expected) => {
    expect(getPreviousScreen(screen)).toBe(expected);
  });
});
