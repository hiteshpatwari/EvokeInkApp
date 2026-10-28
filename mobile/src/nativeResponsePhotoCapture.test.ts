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
  const context = { sessionId: "session-1", promptId: "prompt-1" };
  const pendingStore = () => {
    let value: string | null = null;
    return {
      get: vi.fn(async () => ({ value })),
      set: vi.fn(async (options: { key: string; value: string }) => {
        value = options.value;
      }),
      remove: vi.fn(async () => {
        value = null;
      }),
    };
  };

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
      pendingStore(),
    );

    const file = await capture.capture(context);

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
    const capture = createNativeResponsePhotoCapture(
      {
        takePhoto: vi.fn(async () => {
          throw Object.assign(new Error("cancelled"), {
            code: "OS-PLUG-CAMR-0006",
          });
        }),
      },
      undefined,
      undefined,
      pendingStore(),
    );

    await expect(capture.capture(context)).resolves.toBeNull();
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
      pendingStore(),
    );
    await expect(missing.capture(context)).rejects.toThrow("usable photo");
    expect(missingFileCleaner.deleteFile).toHaveBeenCalledWith({
      path: "/private/app/missing.jpg",
    });

    const fileCleaner = { deleteFile: vi.fn(async () => undefined) };
    const empty = createNativeResponsePhotoCapture(
      { takePhoto: vi.fn(async () => result()) },
      vi.fn(async () => new Response()) as typeof fetch,
      fileCleaner,
      pendingStore(),
    );
    await expect(empty.capture(context)).rejects.toThrow("empty");
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
      pendingStore(),
    );

    await expect(capture.capture(context)).rejects.toThrow(
      "temporary response photo could not be removed",
    );
  });

  it("buffers a restored Android camera result until the UI subscribes", async () => {
    const store = pendingStore();
    await store.set({ key: "unused", value: JSON.stringify(context) });
    const fileCleaner = { deleteFile: vi.fn(async () => undefined) };
    const capture = createNativeResponsePhotoCapture(
      { takePhoto: vi.fn() },
      vi.fn(
        async () =>
          new Response("jpeg", {
            headers: { "Content-Type": "image/jpeg" },
          }),
      ) as typeof fetch,
      fileCleaner,
      store,
    );

    await capture.handleRestoredResult({
      pluginId: "Camera",
      methodName: "takePhoto",
      success: true,
      data: result(),
    });
    const listener = vi.fn();
    capture.subscribe(listener);

    expect(listener).toHaveBeenCalledWith({
      context,
      file: expect.objectContaining({ name: "captured-response.jpg" }),
    });
    expect(fileCleaner.deleteFile).toHaveBeenCalledWith({
      path: "/private/app/captured.jpg",
    });
    await expect(store.get()).resolves.toEqual({
      value: null,
    });
  });

  it("retains and retries native cleanup when restored-photo deletion fails", async () => {
    const store = pendingStore();
    await store.set({ key: "unused", value: JSON.stringify(context) });
    const deleteFile = vi
      .fn()
      .mockRejectedValueOnce(new Error("busy"))
      .mockResolvedValueOnce(undefined);
    const capture = createNativeResponsePhotoCapture(
      { takePhoto: vi.fn() },
      vi.fn(async () => new Response("jpeg")) as typeof fetch,
      { deleteFile },
      store,
    );
    const listener = vi.fn();
    capture.subscribe(listener);

    await capture.handleRestoredResult({
      pluginId: "Camera",
      methodName: "takePhoto",
      success: true,
      data: result(),
    });
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("could not be cleared"),
      }),
    );
    expect((await store.get()).value).toContain("cleanupUri");

    await capture.retryPendingCleanup();
    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(await store.get()).toEqual({ value: null });
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("was cleared"),
      }),
    );
  });

  it("still deletes the native photo when cleanup bookkeeping cannot be saved", async () => {
    let value: string | null = null;
    const store = {
      get: vi.fn(async () => ({ value })),
      set: vi
        .fn()
        .mockImplementationOnce(async (options: { value: string }) => {
          value = options.value;
        })
        .mockRejectedValueOnce(new Error("preferences unavailable")),
      remove: vi.fn(async () => {
        value = null;
      }),
    };
    const deleteFile = vi.fn(async () => undefined);
    const capture = createNativeResponsePhotoCapture(
      { takePhoto: vi.fn(async () => result()) },
      vi.fn(async () => new Response("jpeg")) as typeof fetch,
      { deleteFile },
      store,
    );

    await expect(capture.capture(context)).resolves.toBeInstanceOf(File);
    expect(deleteFile).toHaveBeenCalledWith({
      path: "/private/app/captured.jpg",
    });
    expect(value).toBeNull();
  });

  it("clears a malformed restored result that has no cleanup target", async () => {
    const store = pendingStore();
    await store.set({ key: "unused", value: JSON.stringify(context) });
    const capture = createNativeResponsePhotoCapture(
      { takePhoto: vi.fn() },
      undefined,
      undefined,
      store,
    );
    const listener = vi.fn();
    capture.subscribe(listener);

    await capture.handleRestoredResult({
      pluginId: "Camera",
      methodName: "takePhoto",
      success: true,
      data: { type: MediaType.Photo, saved: false },
    });

    expect(await store.get()).toEqual({ value: null });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("could not be opened"),
      }),
    );
  });
});
