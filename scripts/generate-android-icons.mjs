import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourcePath = path.join(projectRoot, "src", "app", "icon.svg");
const resourceRoot = path.join(
  projectRoot,
  "mobile",
  "android",
  "app",
  "src",
  "main",
  "res",
);

const densities = {
  mdpi: { legacy: 48, foreground: 108 },
  hdpi: { legacy: 72, foreground: 162 },
  xhdpi: { legacy: 96, foreground: 216 },
  xxhdpi: { legacy: 144, foreground: 324 },
  xxxhdpi: { legacy: 192, foreground: 432 },
};

const sourceSvg = await readFile(sourcePath, "utf8");
const backgroundColor = sourceSvg.match(
  /<rect\b[^>]*\bfill="(#[0-9a-fA-F]{6})"/,
)?.[1];
const foregroundPaths = sourceSvg.match(/<path\b[^>]*\/>/g);

if (!backgroundColor || !foregroundPaths || foregroundPaths.length === 0) {
  throw new Error(
    `Could not read the canonical logo geometry from ${sourcePath}.`,
  );
}

const adaptiveForegroundSvg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
    <g transform="translate(16 16) scale(1.1875)">
      ${foregroundPaths.join("\n")}
    </g>
  </svg>
`);

for (const [density, sizes] of Object.entries(densities)) {
  const directory = path.join(resourceRoot, `mipmap-${density}`);

  await sharp(Buffer.from(sourceSvg))
    .resize(sizes.legacy, sizes.legacy)
    .png()
    .toFile(path.join(directory, "ic_launcher.png"));

  await sharp(Buffer.from(sourceSvg))
    .resize(sizes.legacy, sizes.legacy)
    .png()
    .toFile(path.join(directory, "ic_launcher_round.png"));

  await sharp(adaptiveForegroundSvg)
    .resize(sizes.foreground, sizes.foreground)
    .png()
    .toFile(path.join(directory, "ic_launcher_foreground.png"));
}

await writeFile(
  path.join(resourceRoot, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${backgroundColor}</color>\n</resources>\n`,
  "utf8",
);

console.log(
  `Generated Android launcher icons from ${path.relative(projectRoot, sourcePath)}.`,
);
