import {
  Camera,
  CameraDirection,
  EncodingType,
  MediaType,
  type MediaResult,
  type TakePhotoOptions,
} from "@capacitor/camera";
import { Filesystem } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import type { RestoredListenerEvent } from "@capacitor/app";

export interface ResponsePhotoCaptureContext {
  sessionId: string;
  promptId: string;
}

interface PendingCaptureRecord extends ResponsePhotoCaptureContext {
  cleanupUri?: string;
}

export interface RestoredResponsePhoto {
  context: ResponsePhotoCaptureContext;
  file?: File;
  error?: string;
}

type NativeCamera = {
  takePhoto(options: TakePhotoOptions): Promise<MediaResult>;
};
type CapturedFileCleaner = {
  deleteFile(options: { path: string }): Promise<void>;
};
type PendingCaptureStore = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
};
type CameraFailure = Error & { code?: string };
type RestoreListener = (result: RestoredResponsePhoto) => void;

class CapturedPhotoImportError extends Error {
  constructor(
    message: string,
    readonly cleanupComplete: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

const CANCELLED_PHOTO_CODE = "OS-PLUG-CAMR-0006";
export const PENDING_RESPONSE_PHOTO_KEY = "evoke-ink:pending-response-photo:v1";

function isCaptureContext(
  value: unknown,
): value is ResponsePhotoCaptureContext {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["sessionId"] === "string" &&
    candidate["sessionId"].length > 0 &&
    typeof candidate["promptId"] === "string" &&
    candidate["promptId"].length > 0
  );
}

async function importAndDeleteCapturedPhoto(
  result: MediaResult,
  fetchImage: typeof fetch,
  fileCleaner: CapturedFileCleaner,
): Promise<File> {
  if (!result.uri) {
    throw new CapturedPhotoImportError(
      "The device camera did not return a usable photo",
      true,
    );
  }
  let capturedFile: File | undefined;
  let captureFailure: unknown;
  try {
    if (result.type !== MediaType.Photo || !result.webPath) {
      throw new Error("The device camera did not return a usable photo");
    }
    const response = await fetchImage(result.webPath);
    if (!response.ok) {
      throw new Error("The captured response photo could not be opened");
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("The captured response photo was empty");
    }
    capturedFile = new File([blob], "captured-response.jpg", {
      type: blob.type || "image/jpeg",
    });
  } catch (cause) {
    captureFailure = cause;
  }

  try {
    await fileCleaner.deleteFile({ path: result.uri });
  } catch (cause) {
    throw new CapturedPhotoImportError(
      "The temporary response photo could not be removed",
      false,
      { cause },
    );
  }
  if (captureFailure) {
    throw new CapturedPhotoImportError(
      captureFailure instanceof Error
        ? captureFailure.message
        : "The captured response photo could not be opened",
      true,
      { cause: captureFailure },
    );
  }
  if (!capturedFile)
    throw new Error("The device camera did not return a usable photo");
  return capturedFile;
}

export function createNativeResponsePhotoCapture(
  camera: NativeCamera = Camera,
  fetchImage: typeof fetch = globalThis.fetch.bind(globalThis),
  fileCleaner: CapturedFileCleaner = Filesystem,
  pendingStore: PendingCaptureStore = Preferences,
) {
  let bufferedResult: RestoredResponsePhoto | null = null;
  const listeners = new Set<RestoreListener>();
  const clearPending = () =>
    pendingStore.remove({ key: PENDING_RESPONSE_PHOTO_KEY });
  const recordCleanup = async (
    context: ResponsePhotoCaptureContext,
    cleanupUri: string | undefined,
  ) => {
    if (!cleanupUri) return false;
    try {
      await pendingStore.set({
        key: PENDING_RESPONSE_PHOTO_KEY,
        value: JSON.stringify({ ...context, cleanupUri }),
      });
      return true;
    } catch {
      return false;
    }
  };
  const readPending = async (): Promise<PendingCaptureRecord | null> => {
    const value = (await pendingStore.get({ key: PENDING_RESPONSE_PHOTO_KEY }))
      .value;
    if (!value) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (!isCaptureContext(parsed)) return null;
      const cleanupUri = (parsed as unknown as Record<string, unknown>)[
        "cleanupUri"
      ];
      return {
        ...parsed,
        ...(typeof cleanupUri === "string" && cleanupUri.length > 0
          ? { cleanupUri }
          : {}),
      };
    } catch {
      return null;
    }
  };
  const deliver = (result: RestoredResponsePhoto) => {
    if (listeners.size === 0) {
      bufferedResult = result;
      return;
    }
    for (const listener of listeners) listener(result);
  };

  return {
    async capture(context: ResponsePhotoCaptureContext): Promise<File | null> {
      await pendingStore.set({
        key: PENDING_RESPONSE_PHOTO_KEY,
        value: JSON.stringify(context),
      });
      let result: MediaResult;
      try {
        result = await camera.takePhoto({
          cameraDirection: CameraDirection.Rear,
          correctOrientation: true,
          editable: "no",
          encodingType: EncodingType.JPEG,
          includeMetadata: true,
          quality: 90,
          saveToGallery: false,
          targetHeight: 2048,
          targetWidth: 2048,
        });
      } catch (cause) {
        await clearPending();
        if ((cause as CameraFailure)?.code === CANCELLED_PHOTO_CODE)
          return null;
        throw new Error(
          "The device camera could not capture a response photo",
          {
            cause,
          },
        );
      }
      let cleanupRecorded = false;
      try {
        cleanupRecorded = await recordCleanup(context, result.uri);
        const file = await importAndDeleteCapturedPhoto(
          result,
          fetchImage,
          fileCleaner,
        );
        await clearPending();
        return file;
      } catch (cause) {
        if (
          cause instanceof CapturedPhotoImportError &&
          cause.cleanupComplete
        ) {
          await clearPending();
        } else if (!cleanupRecorded) {
          await recordCleanup(context, result.uri);
        }
        throw cause;
      }
    },

    async retryPendingCleanup(): Promise<void> {
      const pending = await readPending();
      if (!pending?.cleanupUri) return;
      try {
        await fileCleaner.deleteFile({ path: pending.cleanupUri });
        await clearPending();
        deliver({
          context: pending,
          error:
            "A temporary response photo was cleared after Android reopened Evoke Ink. Please take the photo again.",
        });
      } catch {
        deliver({
          context: pending,
          error:
            "A temporary response photo still could not be cleared. Close and reopen Evoke Ink before taking another photo.",
        });
      }
    },

    async handleRestoredResult(event: RestoredListenerEvent): Promise<void> {
      if (event.pluginId !== "Camera" || event.methodName !== "takePhoto") {
        return;
      }
      const context = await readPending();
      if (!context || !event.success || !event.data) {
        await clearPending();
        return;
      }
      const mediaResult = event.data as MediaResult;
      let cleanupRecorded = false;
      try {
        cleanupRecorded = await recordCleanup(context, mediaResult.uri);
        const file = await importAndDeleteCapturedPhoto(
          mediaResult,
          fetchImage,
          fileCleaner,
        );
        deliver({ context, file });
        await clearPending();
      } catch (cause) {
        const cleanupComplete =
          cause instanceof CapturedPhotoImportError && cause.cleanupComplete;
        if (cleanupComplete) await clearPending();
        else if (!cleanupRecorded) {
          await recordCleanup(context, mediaResult.uri);
        }
        deliver({
          context,
          error: cleanupComplete
            ? "The restored photo could not be opened. Retake it or choose an existing photo."
            : "The restored photo could not be cleared safely. Close and reopen Evoke Ink before taking another photo.",
        });
      }
    },

    subscribe(listener: RestoreListener) {
      listeners.add(listener);
      if (bufferedResult) {
        const result = bufferedResult;
        bufferedResult = null;
        listener(result);
      }
      return () => listeners.delete(listener);
    },
  };
}

export const nativeResponsePhotoCapture = createNativeResponsePhotoCapture();
