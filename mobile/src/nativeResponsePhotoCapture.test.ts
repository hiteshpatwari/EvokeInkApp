import {
  CameraDirection,
  EncodingType,
  MediaType,
  type MediaResult,
  type TakePhotoOptions,
} from "@capacitor/camera";
import { describe, expect, it, vi } from "vitest";
import { createNativeResponsePhotoCapture } from "./nativeResponsePhotoCapture";

function result(overrides: Partial<MediaResult> = {}): MediaResult {
  return {
    saved: false,
    type: MediaType.Photo,
    uri: "/private/app/captured.jpg",
    webPath: "capacitor://camera/captured.jpg",
    ...overrides,
  };
}

describe("native response photo capture", () => {
  it("opens the rear camera without saving and returns a JPEG file", async () => {
    const takePhoto = vi.fn(async (_options: TakePhotoOptions) => result());
    const fetchImage = vi.fn(async () =>
      Response.json(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    const fileCleaner = { deleteFile: vi.fn(async () => undefined) };
    const capture = createNativeResponsePhotoCapture(
      { takePhoto },
      fetchImage as typeof fetch,
      fileCleaner,
    );

    const file = await capture();

    expect(takePhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        cameraDirection: CameraDirection.Rear,
        correctOrientation: true,
        encodingType: EncodingType.JPEG,
        saveToGallery: false,
      }),
    );
    expect(fetchImage).toHaveBeenCalledWith("capacitor://camera/captured.jpg");
    expect(file).toBeInstanceOf(File);
    expect(file).toMatchObject({
      name: "captured-response.jpg",
      type: "image/jpeg",
    });
    expect(fileCleaner.deleteFile).toHaveBeenCalledWith({
      path: "/private/app/captured.jpg",
    });
  });

  it("treats closing the camera as cancellation", async () => {
    const capture = createNativeResponsePhotoCapture({
      takePhoto: vi.fn(async () => {
        throw Object.assign(new Error("cancelled"), {
          code: "OS-PLUG-CAMR-0006",
        });
      }),
    });

    await expect(capture()).resolves.toBeNull();
  });

  it("rejects missing or empty native photo results", async () => {
    const missingFileCleaner = { deleteFile: vi.fn(async () => undefined) };
    const missing = createNativeResponsePhotoCapture(
      {
        takePhoto: vi.fn(async () => ({
          saved: false,
          type: MediaType.Photo,
          uri: "/private/app/missing.jpg",
        })),
      },
      undefined,
      missingFileCleaner,
    );
    await expect(missing()).rejects.toThrow("usable photo");
    expect(missingFileCleaner.deleteFile).toHaveBeenCalledWith({
      path: "/private/app/missing.jpg",
    });

    const fileCleaner = { deleteFile: vi.fn(async () => undefined) };
    const empty = createNativeResponsePhotoCapture(
      { takePhoto: vi.fn(async () => result()) },
      vi.fn(async () => new Response()) as typeof fetch,
      fileCleaner,
    );
    await expect(empty()).rejects.toThrow("empty");
    expect(fileCleaner.deleteFile).toHaveBeenCalledWith({
      path: "/private/app/captured.jpg",
    });
  });

  it("rejects the capture if its native temporary file cannot be removed", async () => {
    const capture = createNativeResponsePhotoCapture(
      { takePhoto: vi.fn(async () => result()) },
      vi.fn(
        async () =>
          new Response("jpeg", {
            headers: { "Content-Type": "image/jpeg" },
          }),
      ) as typeof fetch,
      {
        deleteFile: vi.fn(async () => {
          throw new Error("filesystem internals");
        }),
      },
    );

    await expect(capture()).rejects.toThrow(
      "temporary response photo could not be removed",
    );
  });
});
