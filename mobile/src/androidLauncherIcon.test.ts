import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dimensions = (png: Buffer) => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
});

describe("Android launcher icon", () => {
  it("uses the canonical Evoke Ink logo color at every Android density", () => {
    const projectRoot =
      path.basename(process.cwd()) === "mobile"
        ? path.resolve(process.cwd(), "..")
        : process.cwd();
    const resourceRoot = path.join(
      projectRoot,
      "mobile",
      "android",
      "app",
      "src",
      "main",
      "res",
    );
    const sourceSvg = readFileSync(
      path.join(projectRoot, "src", "app", "icon.svg"),
      "utf8",
    );
    const background = sourceSvg.match(
      /<rect\b[^>]*\bfill="(#[0-9a-fA-F]{6})"/,
    )?.[1];
    const androidBackground = readFileSync(
      path.join(resourceRoot, "values", "ic_launcher_background.xml"),
      "utf8",
    );

    expect(background).toBe("#433b78");
    expect(androidBackground).toContain(background);

    const densities = {
      mdpi: { legacy: 48, foreground: 108 },
      hdpi: { legacy: 72, foreground: 162 },
      xhdpi: { legacy: 96, foreground: 216 },
      xxhdpi: { legacy: 144, foreground: 324 },
      xxxhdpi: { legacy: 192, foreground: 432 },
    };

    for (const [density, sizes] of Object.entries(densities)) {
      const directory = path.join(resourceRoot, `mipmap-${density}`);
      expect(
        dimensions(readFileSync(path.join(directory, "ic_launcher.png"))),
      ).toEqual({
        width: sizes.legacy,
        height: sizes.legacy,
      });
      expect(
        dimensions(readFileSync(path.join(directory, "ic_launcher_round.png"))),
      ).toEqual({
        width: sizes.legacy,
        height: sizes.legacy,
      });
      expect(
        dimensions(
          readFileSync(path.join(directory, "ic_launcher_foreground.png")),
        ),
      ).toEqual({
        width: sizes.foreground,
        height: sizes.foreground,
      });
    }
  });
});
