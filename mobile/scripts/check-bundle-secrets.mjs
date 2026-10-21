import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const roots = [
  path.resolve(import.meta.dirname, "../dist"),
  path.resolve(import.meta.dirname, "../android/app/src/main/assets"),
];
const apk = path.resolve(
  import.meta.dirname,
  "../android/app/build/outputs/apk/debug/app-debug.apk",
);
const forbidden = [
  /OPENAI_API_KEY/,
  /AI_QUOTA_HASH_SECRET/,
  /sk-proj-[A-Za-z0-9_-]+/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? files(target) : [target];
    }),
  );
  return nested.flat();
}

const scanTargets = [];
for (const root of roots) {
  if (await stat(root).catch(() => undefined))
    scanTargets.push(...(await files(root)));
}
if (await stat(apk).catch(() => undefined)) scanTargets.push(apk);

for (const file of scanTargets) {
  const contents = await readFile(file).catch(() => Buffer.alloc(0));
  for (const pattern of forbidden) {
    if (pattern.test(contents.toString("utf8"))) {
      throw new Error(
        `Forbidden provider secret marker found in ${path.relative(import.meta.dirname, file)}`,
      );
    }
  }
}

console.log("Mobile bundle secret scan passed.");
