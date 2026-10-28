import {
  Camera,
  CameraDirection,
  EncodingType,
  MediaType,
  type MediaResult,
  type TakePhotoOptions,
} from "@capacitor/camera";
import { Filesystem } from "@capacitor/filesystem";

type NativeCamera = {
  takePhoto(options: TakePhotoOptions): Promise<MediaResult>;
};

type CapturedFileCleaner = {
  deleteFile(options: { path: string }): Promise<void>;
};

type CameraFailure = Error & { code?: string };

const CANCELLED_PHOTO_CODE = "OS-PLUG-CAMR-0006";

export function createNativeResponsePhotoCapture(
  camera: NativeCamera = Camera,
  fetchImage: typeof fetch = globalThis.fetch.bind(globalThis),
  fileCleaner: CapturedFileCleaner = Filesystem,
) {
  return async (): Promise<File | null> => {
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
      if ((cause as CameraFailure)?.code === CANCELLED_PHOTO_CODE) return null;
      throw new Error("The device camera could not capture a response photo", {
        cause,
      });
    }

    if (!result.uri) {
      throw new Error("The device camera did not return a usable photo");
    }

    let capturedFile: File;
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
    } finally {
      try {
        await fileCleaner.deleteFile({ path: result.uri });
      } catch (cause) {
        throw new Error("The temporary response photo could not be removed", {
          cause,
        });
      }
    }

    return capturedFile;
  };
}

export const captureNativeResponsePhoto = createNativeResponsePhotoCapture();
