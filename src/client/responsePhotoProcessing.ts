export const RESPONSE_PHOTO_LIMITS = {
  maxInputBytes: 8 * 1024 * 1024,
  maxDecodedDimension: 8192,
  maxDecodedPixels: 32_000_000,
  maxOutputDimension: 2048,
  maxOutputBytes: 4 * 1024 * 1024,
} as const;

const ACCEPTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const OUTPUT_MEDIA_TYPE = "image/jpeg";

export type ResponsePhotoMediaType = (typeof ACCEPTED_MEDIA_TYPES)[number];
export type ResponsePhotoRotation = 0 | 90 | 180 | 270;

export interface ResponsePhotoCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResponsePhotoTransform {
  crop?: ResponsePhotoCrop;
  rotation?: ResponsePhotoRotation;
}

export interface DecodedResponsePhoto {
  width: number;
  height: number;
  source: CanvasImageSource;
  close: () => void;
}

export interface ResponsePhotoRenderRequest {
  decoded: DecodedResponsePhoto;
  crop: ResponsePhotoCrop;
  rotation: ResponsePhotoRotation;
  outputWidth: number;
  outputHeight: number;
  outputType: typeof OUTPUT_MEDIA_TYPE;
}

export interface ResponsePhotoRuntime {
  decode: (file: File) => Promise<DecodedResponsePhoto>;
  render: (request: ResponsePhotoRenderRequest) => Promise<Blob>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
}

export interface ProcessedResponsePhoto {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  dispose: () => void;
}

export type PhotoProcessingErrorCode =
  | "empty_file"
  | "unsupported_type"
  | "type_mismatch"
  | "invalid_image"
  | "input_too_large"
  | "dimensions_too_large"
  | "pixel_count_too_large"
  | "invalid_crop"
  | "invalid_rotation"
  | "processing_failed"
  | "output_too_large"
  | "cleanup_failed";

export class PhotoProcessingError extends Error {
  constructor(
    public readonly code: PhotoProcessingErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PhotoProcessingError";
  }
}

function isAcceptedMediaType(value: string): value is ResponsePhotoMediaType {
  return ACCEPTED_MEDIA_TYPES.some((type) => type === value);
}

function bytesMatch(bytes: Uint8Array, expected: readonly number[]) {
  return expected.every((value, index) => bytes[index] === value);
}

function matchesMediaSignature(
  mediaType: ResponsePhotoMediaType,
  bytes: Uint8Array,
) {
  switch (mediaType) {
    case "image/jpeg":
      return bytes.length >= 3 && bytesMatch(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return (
        bytes.length >= 8 &&
        bytesMatch(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
    case "image/webp":
      return (
        bytes.length >= 12 &&
        bytesMatch(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        bytesMatch(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
      );
  }
}

async function readBlobBytes(blob: Blob) {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("The image header could not be read"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsArrayBuffer(blob);
  });
}

async function validateSourceFile(file: File) {
  if (file.size === 0) {
    throw new PhotoProcessingError(
      "empty_file",
      "Choose a photo that contains image data.",
    );
  }
  if (file.size > RESPONSE_PHOTO_LIMITS.maxInputBytes) {
    throw new PhotoProcessingError(
      "input_too_large",
      "Choose a photo smaller than 8 MB.",
    );
  }
  if (!isAcceptedMediaType(file.type)) {
    throw new PhotoProcessingError(
      "unsupported_type",
      "Choose a JPEG, PNG, or WebP image.",
    );
  }

  let header: Uint8Array;
  try {
    header = await readBlobBytes(file.slice(0, 16));
  } catch (error) {
    throw new PhotoProcessingError(
      "invalid_image",
      "The photo could not be read. Retake it or choose another image.",
      { cause: error },
    );
  }
  if (!matchesMediaSignature(file.type, header)) {
    const format =
      file.type === "image/jpeg"
        ? "JPEG"
        : file.type === "image/png"
          ? "PNG"
          : "WebP";
    throw new PhotoProcessingError(
      "type_mismatch",
      header.length < 3
        ? `Choose a valid ${format} image.`
        : "MIME and file contents do not match. Choose another image.",
    );
  }
}

function validateRotation(
  rotation: number,
): asserts rotation is ResponsePhotoRotation {
  if (
    rotation !== 0 &&
    rotation !== 90 &&
    rotation !== 180 &&
    rotation !== 270
  ) {
    throw new PhotoProcessingError(
      "invalid_rotation",
      "Rotate the photo in 90-degree steps.",
    );
  }
}

function validateDecodedBounds(decoded: DecodedResponsePhoto) {
  if (
    !Number.isSafeInteger(decoded.width) ||
    !Number.isSafeInteger(decoded.height) ||
    decoded.width <= 0 ||
    decoded.height <= 0
  ) {
    throw new PhotoProcessingError(
      "invalid_image",
      "The photo could not be read. Retake it or choose another image.",
    );
  }
  if (
    decoded.width > RESPONSE_PHOTO_LIMITS.maxDecodedDimension ||
    decoded.height > RESPONSE_PHOTO_LIMITS.maxDecodedDimension
  ) {
    throw new PhotoProcessingError(
      "dimensions_too_large",
      "The photo dimensions are too large. Retake it at a lower resolution.",
    );
  }
  if (decoded.width * decoded.height > RESPONSE_PHOTO_LIMITS.maxDecodedPixels) {
    throw new PhotoProcessingError(
      "pixel_count_too_large",
      "The photo contains too many pixels. Retake it at a lower resolution.",
    );
  }
}

function resolveCrop(
  crop: ResponsePhotoCrop | undefined,
  decoded: DecodedResponsePhoto,
): ResponsePhotoCrop {
  const resolved = crop ?? {
    x: 0,
    y: 0,
    width: decoded.width,
    height: decoded.height,
  };
  const values = [resolved.x, resolved.y, resolved.width, resolved.height];
  if (
    values.some((value) => !Number.isFinite(value)) ||
    resolved.x < 0 ||
    resolved.y < 0 ||
    resolved.width <= 0 ||
    resolved.height <= 0 ||
    resolved.x + resolved.width > decoded.width ||
    resolved.y + resolved.height > decoded.height
  ) {
    throw new PhotoProcessingError(
      "invalid_crop",
      "Adjust the crop so it stays inside the photo.",
    );
  }
  return resolved;
}

function outputDimensions(
  crop: ResponsePhotoCrop,
  rotation: ResponsePhotoRotation,
) {
  const swapsAxes = rotation === 90 || rotation === 270;
  const rotatedWidth = swapsAxes ? crop.height : crop.width;
  const rotatedHeight = swapsAxes ? crop.width : crop.height;
  const scale = Math.min(
    1,
    RESPONSE_PHOTO_LIMITS.maxOutputDimension / rotatedWidth,
    RESPONSE_PHOTO_LIMITS.maxOutputDimension / rotatedHeight,
  );
  return {
    width: Math.max(1, Math.round(rotatedWidth * scale)),
    height: Math.max(1, Math.round(rotatedHeight * scale)),
  };
}

function asProcessingError(error: unknown) {
  if (error instanceof PhotoProcessingError) return error;
  return new PhotoProcessingError(
    "processing_failed",
    "The photo could not be prepared. Retake it or type the response instead.",
    { cause: error },
  );
}

export async function processResponsePhoto(
  file: File,
  transform: ResponsePhotoTransform = {},
  runtime: ResponsePhotoRuntime = browserResponsePhotoRuntime,
): Promise<ProcessedResponsePhoto> {
  const rotation = transform.rotation ?? 0;
  validateRotation(rotation);
  await validateSourceFile(file);

  let decoded: DecodedResponsePhoto;
  try {
    decoded = await runtime.decode(file);
  } catch (error) {
    throw new PhotoProcessingError(
      "invalid_image",
      "The photo could not be read. Retake it or choose another image.",
      { cause: error },
    );
  }

  let output: Blob | undefined;
  let dimensions: { width: number; height: number } | undefined;
  let operationError: PhotoProcessingError | undefined;
  try {
    validateDecodedBounds(decoded);
    const crop = resolveCrop(transform.crop, decoded);
    dimensions = outputDimensions(crop, rotation);
    output = await runtime.render({
      decoded,
      crop,
      rotation,
      outputWidth: dimensions.width,
      outputHeight: dimensions.height,
      outputType: OUTPUT_MEDIA_TYPE,
    });
    if (output.type !== OUTPUT_MEDIA_TYPE || output.size === 0) {
      throw new PhotoProcessingError(
        "processing_failed",
        "The photo could not be prepared. Retake it or type the response instead.",
      );
    }
    if (output.size > RESPONSE_PHOTO_LIMITS.maxOutputBytes) {
      throw new PhotoProcessingError(
        "output_too_large",
        "The prepared photo is still too large. Crop it more tightly or retake it.",
      );
    }
  } catch (error) {
    operationError = asProcessingError(error);
  }
  try {
    decoded.close();
  } catch (error) {
    operationError = new PhotoProcessingError(
      "cleanup_failed",
      "The temporary photo could not be cleared. Close this review and try again.",
      { cause: error },
    );
  }
  if (operationError) throw operationError;
  if (!output || !dimensions) {
    throw new PhotoProcessingError(
      "processing_failed",
      "The photo could not be prepared. Retake it or type the response instead.",
    );
  }

  let previewUrl: string;
  try {
    previewUrl = runtime.createObjectURL(output);
  } catch (error) {
    throw new PhotoProcessingError(
      "processing_failed",
      "The photo preview could not be created. Retake it or type the response instead.",
      { cause: error },
    );
  }

  let disposed = false;
  return {
    blob: output,
    previewUrl,
    width: dimensions.width,
    height: dimensions.height,
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        runtime.revokeObjectURL(previewUrl);
      } catch (error) {
        throw new PhotoProcessingError(
          "cleanup_failed",
          "The temporary photo could not be cleared. Close this review and try again.",
          { cause: error },
        );
      }
    },
  };
}

async function decodeInBrowser(file: File): Promise<DecodedResponsePhoto> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      close: () => bitmap.close(),
    };
  }
  if (typeof Image === "undefined") {
    throw new Error("Image decoding is unavailable");
  }

  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image decoding failed"));
      image.src = sourceUrl;
    });
    let closed = false;
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      source: image,
      close: () => {
        if (closed) return;
        closed = true;
        image.removeAttribute("src");
        URL.revokeObjectURL(sourceUrl);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(sourceUrl);
    throw error;
  }
}

async function renderInBrowser(request: ResponsePhotoRenderRequest) {
  if (typeof document === "undefined") {
    throw new Error("Canvas rendering is unavailable");
  }
  const canvas = document.createElement("canvas");
  canvas.width = request.outputWidth;
  canvas.height = request.outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable");

  const radians = (request.rotation * Math.PI) / 180;
  const swapsAxes = request.rotation === 90 || request.rotation === 270;
  const rotatedWidth = swapsAxes ? request.crop.height : request.crop.width;
  const rotatedHeight = swapsAxes ? request.crop.width : request.crop.height;
  const scale = Math.min(
    request.outputWidth / rotatedWidth,
    request.outputHeight / rotatedHeight,
  );

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.save();
  context.translate(request.outputWidth / 2, request.outputHeight / 2);
  context.rotate(radians);
  context.drawImage(
    request.decoded.source,
    request.crop.x,
    request.crop.y,
    request.crop.width,
    request.crop.height,
    -(request.crop.width * scale) / 2,
    -(request.crop.height * scale) / 2,
    request.crop.width * scale,
    request.crop.height * scale,
  );
  context.restore();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Canvas encoding failed")),
      request.outputType,
      0.86,
    );
  });
}

export const browserResponsePhotoRuntime: ResponsePhotoRuntime = {
  decode: decodeInBrowser,
  render: renderInBrowser,
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
};
