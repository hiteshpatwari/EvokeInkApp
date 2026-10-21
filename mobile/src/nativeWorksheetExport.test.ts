import { describe, expect, it, vi } from "vitest";
import type { ReadingSession } from "@/domain/schemas";
import {
  bytesToBase64,
  createNativeWorksheetExporter,
  sanitizeWorksheetFilename,
} from "./nativeWorksheetExport";

const session = {
  book: { title: "A/B: Book?!", author: "Author" },
} as ReadingSession;

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    buildPdfBytes: vi.fn(() => new Uint8Array([0, 255, 1, 2])),
    canShare: vi.fn(async () => true),
    writeCacheFile: vi.fn(async () => "content://worksheet.pdf"),
    shareFile: vi.fn(async () => undefined),
    deleteCacheFile: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("native worksheet export", () => {
  it("creates a bounded portable PDF filename", () => {
    expect(sanitizeWorksheetFilename("  A/B: Book?!  ")).toBe(
      "a-b-book-reflection.pdf",
    );
    expect(sanitizeWorksheetFilename("***")).toBe("reading-reflection.pdf");
    expect(sanitizeWorksheetFilename("x".repeat(200))).toHaveLength(96);
  });

  it("encodes every PDF byte as base64 without text conversion", () => {
    expect(bytesToBase64(new Uint8Array([0, 255, 1, 2]))).toBe("AP8BAg==");
  });

  it("writes to cache, shares its URI, and deletes it after success", async () => {
    const deps = dependencies();
    const exporter = createNativeWorksheetExporter(deps);

    await expect(exporter.export(session)).resolves.toEqual({
      status: "shared",
    });
    expect(deps.writeCacheFile).toHaveBeenCalledWith(
      "a-b-book-reflection.pdf",
      "AP8BAg==",
    );
    expect(deps.shareFile).toHaveBeenCalledWith(
      "content://worksheet.pdf",
      "a-b-book-reflection.pdf",
    );
    expect(deps.deleteCacheFile).toHaveBeenCalledWith(
      "a-b-book-reflection.pdf",
    );
  });

  it("reports cancellation and still removes the cache file", async () => {
    const cancelled = Object.assign(new Error("Share cancelled"), {
      name: "AbortError",
    });
    const deps = dependencies({
      shareFile: vi.fn(async () => Promise.reject(cancelled)),
    });

    await expect(
      createNativeWorksheetExporter(deps).export(session),
    ).resolves.toEqual({
      status: "cancelled",
    });
    expect(deps.deleteCacheFile).toHaveBeenCalledOnce();
  });

  it("preserves the primary share failure while reporting cleanup failure", async () => {
    const deps = dependencies({
      shareFile: vi.fn(async () =>
        Promise.reject(new Error("provider failed")),
      ),
      deleteCacheFile: vi.fn(async () =>
        Promise.reject(new Error("delete failed")),
      ),
    });

    await expect(
      createNativeWorksheetExporter(deps).export(session),
    ).rejects.toMatchObject({
      message: "The PDF could not be shared. Please try again.",
      cleanupFailed: true,
      cause: expect.objectContaining({ message: "provider failed" }),
    });
  });

  it("reports cleanup failure after a successful share without changing success", async () => {
    const deps = dependencies({
      deleteCacheFile: vi.fn(async () =>
        Promise.reject(new Error("delete failed")),
      ),
    });
    await expect(
      createNativeWorksheetExporter(deps).export(session),
    ).resolves.toEqual({
      status: "shared",
      cleanupFailed: true,
    });
  });

  it("does not create a file when the OS share capability is unavailable", async () => {
    const deps = dependencies({ canShare: vi.fn(async () => false) });
    await expect(
      createNativeWorksheetExporter(deps).export(session),
    ).resolves.toEqual({
      status: "unavailable",
    });
    expect(deps.writeCacheFile).not.toHaveBeenCalled();
    expect(deps.deleteCacheFile).not.toHaveBeenCalled();
  });

  it("attempts cleanup when writing succeeds but sharing fails", async () => {
    const deps = dependencies({
      shareFile: vi.fn(async () => Promise.reject(new Error("share failed"))),
    });
    await expect(
      createNativeWorksheetExporter(deps).export(session),
    ).rejects.toThrow("The PDF could not be shared. Please try again.");
    expect(deps.deleteCacheFile).toHaveBeenCalledOnce();
  });

  it("attempts cleanup when a cache write fails after it starts", async () => {
    const deps = dependencies({
      writeCacheFile: vi.fn(async () =>
        Promise.reject(new Error("write failed")),
      ),
    });
    await expect(
      createNativeWorksheetExporter(deps).export(session),
    ).rejects.toMatchObject({
      message: "The PDF could not be shared. Please try again.",
      cleanupFailed: false,
      cause: expect.objectContaining({ message: "write failed" }),
    });
    expect(deps.deleteCacheFile).toHaveBeenCalledWith(
      "a-b-book-reflection.pdf",
    );
  });
});
