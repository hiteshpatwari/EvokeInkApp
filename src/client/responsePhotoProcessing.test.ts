import { describe, expect, it, vi } from "vitest";
import {
  PhotoProcessingError,
  processResponsePhoto,
  type DecodedResponsePhoto,
  type ResponsePhotoRuntime,
} from "./responsePhotoProcessing";

const signatures = {
  jpeg: [0xff, 0xd8, 0xff, 0xe1, 0x45, 0x78, 0x69, 0x66],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  webp: [
    0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ],
} as const;

function imageFile(
  type: string,
  bytes: readonly number[] = signatures.jpeg,
  name = "response.jpg",
) {
  return new File([new Uint8Array(bytes)], name, { type });
}

function runtimeFixture(
  overrides: Partial<ResponsePhotoRuntime> = {},
  dimensions = { width: 1200, height: 800 },
) {
  const close = vi.fn();
  const decoded: DecodedResponsePhoto = {
    ...dimensions,
    source: {} as CanvasImageSource,
    close,
  };
  const runtime: ResponsePhotoRuntime = {
    decode: vi.fn(async () => decoded),
    render: vi.fn(
      async () =>
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], {
          type: "image/jpeg",
        }),
    ),
    createObjectURL: vi.fn(() => "blob:processed-response"),
    revokeObjectURL: vi.fn(),
    ...overrides,
  };
  return { runtime, close };
}

describe("processResponsePhoto", () => {
  it.each([
    ["image/jpeg", signatures.jpeg],
    ["image/png", signatures.png],
    ["image/webp", signatures.webp],
  ])(
    "accepts a bounded %s file with matching magic bytes",
    async (type, bytes) => {
      const { runtime, close } = runtimeFixture();

      const result = await processResponsePhoto(
        imageFile(type, bytes),
        {},
        runtime,
      );

      expect(result.previewUrl).toBe("blob:processed-response");
      expect(result.blob.type).toBe("image/jpeg");
      expect(runtime.decode).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["image/jpeg", signatures.png, "MIME and file contents do not match"],
    ["image/svg+xml", [0x3c, 0x73, 0x76, 0x67], "JPEG, PNG, or WebP"],
    ["application/pdf", [0x25, 0x50, 0x44, 0x46], "JPEG, PNG, or WebP"],
    ["image/heic", [0x00, 0x00, 0x00, 0x18], "JPEG, PNG, or WebP"],
    ["image/jpeg", [0xff, 0xd8], "valid JPEG"],
  ])(
    "rejects invalid input type %s before decode",
    async (type, bytes, message) => {
      const { runtime } = runtimeFixture();

      await expect(
        processResponsePhoto(imageFile(type, bytes), {}, runtime),
      ).rejects.toThrow(message);
      expect(runtime.decode).not.toHaveBeenCalled();
      expect(runtime.createObjectURL).not.toHaveBeenCalled();
    },
  );

  it("rejects an oversized compressed file before decode", async () => {
    const { runtime } = runtimeFixture();
    const oversized = new File(
      [new Uint8Array(signatures.jpeg), new Uint8Array(8 * 1024 * 1024)],
      "large.jpg",
      { type: "image/jpeg" },
    );

    await expect(
      processResponsePhoto(oversized, {}, runtime),
    ).rejects.toMatchObject({ code: "input_too_large" });
    expect(runtime.decode).not.toHaveBeenCalled();
  });

  it.each([
    [{ width: 9000, height: 100 }, "dimensions_too_large"],
    [{ width: 7000, height: 5000 }, "pixel_count_too_large"],
  ])(
    "rejects unsafe decoded bounds and closes the decoder",
    async (dimensions, code) => {
      const { runtime, close } = runtimeFixture({}, dimensions);

      await expect(
        processResponsePhoto(imageFile("image/jpeg"), {}, runtime),
      ).rejects.toMatchObject({ code });
      expect(close).toHaveBeenCalledOnce();
      expect(runtime.render).not.toHaveBeenCalled();
    },
  );

  it("applies a bounded crop, quarter-turn rotation, and output resize", async () => {
    const { runtime } = runtimeFixture({}, { width: 5000, height: 3000 });

    const result = await processResponsePhoto(
      imageFile("image/jpeg"),
      {
        crop: { x: 500, y: 400, width: 3000, height: 2000 },
        rotation: 90,
      },
      runtime,
    );

    expect(runtime.render).toHaveBeenCalledWith(
      expect.objectContaining({
        crop: { x: 500, y: 400, width: 3000, height: 2000 },
        rotation: 90,
        outputWidth: 1365,
        outputHeight: 2048,
        outputType: "image/jpeg",
      }),
    );
    expect(result).toMatchObject({ width: 1365, height: 2048 });
  });

  it.each([
    [{ x: -1, y: 0, width: 100, height: 100 }],
    [{ x: 0, y: 0, width: 0, height: 100 }],
    [{ x: 1100, y: 0, width: 200, height: 100 }],
  ])("rejects an out-of-bounds crop and closes decoded data", async (crop) => {
    const { runtime, close } = runtimeFixture();

    await expect(
      processResponsePhoto(imageFile("image/jpeg"), { crop }, runtime),
    ).rejects.toMatchObject({ code: "invalid_crop" });
    expect(close).toHaveBeenCalledOnce();
    expect(runtime.render).not.toHaveBeenCalled();
  });

  it("rejects invalid rotation before decoding", async () => {
    const { runtime } = runtimeFixture();

    await expect(
      processResponsePhoto(
        imageFile("image/jpeg"),
        { rotation: 45 as 90 },
        runtime,
      ),
    ).rejects.toMatchObject({ code: "invalid_rotation" });
    expect(runtime.decode).not.toHaveBeenCalled();
  });

  it("fails closed when re-encoding fails and still closes decoded data", async () => {
    const { runtime, close } = runtimeFixture({
      render: vi.fn(async () => {
        throw new Error("canvas failed");
      }),
    });

    await expect(
      processResponsePhoto(imageFile("image/jpeg"), {}, runtime),
    ).rejects.toMatchObject({ code: "processing_failed" });
    expect(close).toHaveBeenCalledOnce();
    expect(runtime.createObjectURL).not.toHaveBeenCalled();
  });

  it("fails closed when decoded data cannot be released", async () => {
    const { runtime } = runtimeFixture({
      decode: vi.fn(async () => ({
        width: 1200,
        height: 800,
        source: {} as CanvasImageSource,
        close: () => {
          throw new Error("release failed");
        },
      })),
    });

    await expect(
      processResponsePhoto(imageFile("image/jpeg"), {}, runtime),
    ).rejects.toMatchObject({ code: "cleanup_failed" });
    expect(runtime.createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects oversized encoded output before creating a preview URL", async () => {
    const { runtime, close } = runtimeFixture({
      render: vi.fn(
        async () =>
          new Blob([new Uint8Array(4 * 1024 * 1024 + 1)], {
            type: "image/jpeg",
          }),
      ),
    });

    await expect(
      processResponsePhoto(imageFile("image/jpeg"), {}, runtime),
    ).rejects.toMatchObject({ code: "output_too_large" });
    expect(close).toHaveBeenCalledOnce();
    expect(runtime.createObjectURL).not.toHaveBeenCalled();
  });

  it("returns idempotent preview cleanup", async () => {
    const { runtime } = runtimeFixture();
    const result = await processResponsePhoto(
      imageFile("image/jpeg"),
      {},
      runtime,
    );

    result.dispose();
    result.dispose();

    expect(runtime.revokeObjectURL).toHaveBeenCalledOnce();
    expect(runtime.revokeObjectURL).toHaveBeenCalledWith(
      "blob:processed-response",
    );
  });

  it("uses bounded, actionable error types", () => {
    const error = new PhotoProcessingError(
      "unsupported_type",
      "Choose a JPEG, PNG, or WebP image.",
    );
    expect(error.name).toBe("PhotoProcessingError");
    expect(error.code).toBe("unsupported_type");
  });
});
