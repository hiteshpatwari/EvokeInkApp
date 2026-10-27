import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const forbidden = [
  /OPENAI_API_KEY/,
  /AI_QUOTA_HASH_SECRET/,
  /sk-proj-[A-Za-z0-9_-]+/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
];

async function requireDirectory(directory, label) {
  const metadata = await stat(directory).catch(() => undefined);
  if (!metadata?.isDirectory()) {
    throw new Error(`Required ${label} directory is missing: ${directory}`);
  }
}

async function requireFile(file, label) {
  const metadata = await stat(file).catch(() => undefined);
  if (!metadata?.isFile()) {
    throw new Error(`Required ${label} file is missing: ${file}`);
  }
}

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

function safeArchiveTarget(extractionRoot, archivePath) {
  const normalized = archivePath.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split("/").includes("..")
  ) {
    throw new Error(`Unsafe mobile artifact entry path: ${archivePath}`);
  }
  const target = path.resolve(extractionRoot, normalized);
  const prefix = `${path.resolve(extractionRoot)}${path.sep}`;
  if (!target.startsWith(prefix)) {
    throw new Error(
      `Mobile artifact entry escapes extraction directory: ${archivePath}`,
    );
  }
  return target;
}

async function extractArchive(artifact, extractionRoot) {
  const entries = unzipSync(new Uint8Array(await readFile(artifact)));
  for (const [archivePath, contents] of Object.entries(entries)) {
    const target = safeArchiveTarget(extractionRoot, archivePath);
    if (archivePath.endsWith("/")) {
      await mkdir(target, { recursive: true });
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
}

async function scanFiles(targets, displayRoot) {
  for (const file of targets) {
    const contents = await readFile(file);
    for (const pattern of forbidden) {
      if (pattern.test(contents.toString("utf8"))) {
        throw new Error(
          `Forbidden provider secret marker found in ${path.relative(displayRoot, file)}`,
        );
      }
    }
  }
}

function assertOwnedTemporaryDirectory(directory) {
  const resolvedDirectory = path.resolve(directory);
  const resolvedTempRoot = path.resolve(os.tmpdir());
  if (
    path.dirname(resolvedDirectory) !== resolvedTempRoot ||
    !path.basename(resolvedDirectory).startsWith("read-reflect-apk-scan-")
  ) {
    throw new Error(
      `Refusing to remove unowned temporary directory: ${directory}`,
    );
  }
}

export async function scanProductionArtifacts({ mobileRoot, artifacts = [] }) {
  const resolvedMobileRoot = path.resolve(mobileRoot);
  const dist = path.join(resolvedMobileRoot, "dist");
  const synchronizedAssets = path.join(
    resolvedMobileRoot,
    "android/app/src/main/assets",
  );
  const artifactPaths = artifacts.map((artifact) => path.resolve(artifact));

  await requireDirectory(dist, "mobile build");
  await requireDirectory(synchronizedAssets, "synchronized Android assets");
  if (artifactPaths.length === 0) {
    throw new Error(
      "At least one APK or AAB artifact is required for scanning.",
    );
  }
  for (const artifact of artifactPaths) {
    if (!artifact.startsWith(`${resolvedMobileRoot}${path.sep}`)) {
      throw new Error(
        `Mobile artifact is outside the mobile project: ${artifact}`,
      );
    }
    await requireFile(artifact, "mobile artifact");
  }

  const extractionRoot = await mkdtemp(
    path.join(os.tmpdir(), "read-reflect-apk-scan-"),
  );
  try {
    const extractedArtifacts = [];
    for (const [index, artifact] of artifactPaths.entries()) {
      const extractionDirectory = path.join(extractionRoot, String(index));
      await mkdir(extractionDirectory, { recursive: true });
      await extractArchive(artifact, extractionDirectory);
      extractedArtifacts.push(...(await files(extractionDirectory)));
    }
    await scanFiles(
      [
        ...(await files(dist)),
        ...(await files(synchronizedAssets)),
        ...extractedArtifacts,
      ],
      resolvedMobileRoot,
    );
  } finally {
    assertOwnedTemporaryDirectory(extractionRoot);
    await rm(extractionRoot, { recursive: true, force: true });
  }
}

const invokedScript = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (invokedScript) {
  const mobileRoot = path.resolve(import.meta.dirname, "..");
  const artifacts = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    if (process.argv[index] === "--") continue;
    if (process.argv[index] !== "--artifact" || !process.argv[index + 1]) {
      throw new Error("Use --artifact <APK-or-AAB-path> for each artifact.");
    }
    artifacts.push(process.argv[index + 1]);
    index += 1;
  }
  await scanProductionArtifacts({ mobileRoot, artifacts });
  console.log("Mobile production artifact secret scan passed.");
}
