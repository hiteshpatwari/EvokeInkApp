import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  path.join(process.cwd(), "src", "app", "globals.css"),
  "utf8",
);

describe("mobile viewport safety", () => {
  it("consumes every safe-area inset and uses dynamic viewport height", () => {
    expect(styles).toContain("env(safe-area-inset-top, 0px)");
    expect(styles).toContain("env(safe-area-inset-right, 0px)");
    expect(styles).toContain("env(safe-area-inset-bottom, 0px)");
    expect(styles).toContain("env(safe-area-inset-left, 0px)");
    expect(styles).toContain("100dvh");
  });

  it("keeps fixed confirmation dialogs inside the safe viewport", () => {
    const dialogRule = styles.match(/\.confirmation-dialog\s*\{[^}]+\}/s)?.[0];
    expect(dialogRule).toContain("var(--safe-area-top)");
    expect(dialogRule).toContain("var(--safe-area-right)");
    expect(dialogRule).toContain("var(--safe-area-bottom)");
    expect(dialogRule).toContain("var(--safe-area-left)");
  });

  it("keeps the native header over content while the page scrolls", () => {
    const nativeTopbarRule = styles.match(
      /html\[data-native-app="true"\] \.topbar\s*\{[^}]+\}/s,
    )?.[0];
    expect(nativeTopbarRule).toContain("position: sticky");
    expect(nativeTopbarRule).toContain("top: 0");
  });

  it("keeps native navigation compact while allowing hero text to reflow", () => {
    const responsiveNavigationRules = styles
      .match(/html\[data-native-app="true"\] \.topbar nav\s*\{[^}]+\}/gs)
      ?.join("\n");
    expect(responsiveNavigationRules).toContain("flex-direction: row");
    expect(responsiveNavigationRules).toContain("width: auto");
    expect(styles).not.toContain("font-size: min(1rem, 2vw)");
    expect(styles).toMatch(
      /html\[data-native-app="true"\] \.brand-button\s*\{[^}]*display: flex;/s,
    );
    expect(styles).toContain("var(--native-safe-area-top-fallback)");
    expect(styles).toContain("overflow-wrap: anywhere");
    expect(styles).toContain('html[data-native-app="true"] .hero-card h1');
    expect(styles).toContain("font-size: min(2.15rem, 10vw)");
  });

  it("switches navigation labels to icon-only controls on small screens", () => {
    expect(styles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.nav-label\s*\{[^}]*display: none;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.topbar nav button\s*\{[^}]*width: 48px;/,
    );
  });
});
