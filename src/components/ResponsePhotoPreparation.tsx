"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  PhotoProcessingError,
  processResponsePhoto,
  type ProcessedResponsePhoto,
  type ResponsePhotoTransform,
} from "@/client/responsePhotoProcessing";
import {
  requestHandwritingTranscription,
  type HandwritingTranscription,
} from "@/client/handwritingTranscriptionRequest";

export interface ResponsePhotoPreparationProps {
  onConfirmTranscript: (transcript: string) => void | Promise<void>;
  onUseTypedEntry: () => void;
  processPhoto?: typeof processResponsePhoto;
  transcribePhoto?: (image: Blob) => Promise<HandwritingTranscription>;
  capturePhoto?: () => Promise<File | null>;
}

const GENERIC_PHOTO_ERROR =
  "The photo could not be prepared. Retake it or type the response instead.";

export function ResponsePhotoPreparation({
  onConfirmTranscript,
  onUseTypedEntry,
  processPhoto = processResponsePhoto,
  transcribePhoto = requestHandwritingTranscription,
  capturePhoto,
}: ResponsePhotoPreparationProps) {
  const [photo, setPhoto] = useState<ProcessedResponsePhoto | null>(null);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [extractionAttempted, setExtractionAttempted] = useState(false);
  const [uncertainSegments, setUncertainSegments] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);
  const readButtonRef = useRef<HTMLButtonElement>(null);
  const extractedHeadingRef = useRef<HTMLHeadingElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const photoRef = useRef<ProcessedResponsePhoto | null>(null);
  const mountedRef = useRef(true);
  const operationRef = useRef(0);

  const storePhoto = (next: ProcessedResponsePhoto | null) => {
    photoRef.current = next;
    if (mountedRef.current) setPhoto(next);
  };

  const dispose = (target: ProcessedResponsePhoto | null) => {
    if (!target) return true;
    try {
      target.dispose();
      return true;
    } catch {
      if (mountedRef.current) {
        setError(
          "The temporary photo could not be cleared. Close this review and try again.",
        );
      }
      return false;
    }
  };

  const clearCurrentPhoto = () => {
    const current = photoRef.current;
    storePhoto(null);
    return dispose(current);
  };

  useEffect(() => {
    mountedRef.current = true;
    headingRef.current?.focus();
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
      const current = photoRef.current;
      photoRef.current = null;
      try {
        current?.dispose();
      } catch {
        // The view is closing and no sensitive content is persisted.
      }
    };
  }, []);

  const prepare = async (
    file: File,
    transform: ResponsePhotoTransform = {},
  ) => {
    const operation = ++operationRef.current;
    setProcessing(true);
    setError("");
    setTranscript("");
    setUncertainSegments([]);
    setEditingTranscript(false);
    setExtractionAttempted(false);
    setStatus("Preparing photo locally...");
    try {
      const prepared = await processPhoto(file, transform);
      if (!mountedRef.current || operation !== operationRef.current) {
        try {
          prepared.dispose();
        } catch {
          // A stale result is never made visible or submitted.
        }
        return;
      }
      const previous = photoRef.current;
      if (previous && !dispose(previous)) {
        dispose(prepared);
        return;
      }
      storePhoto(prepared);
      setStatus(
        "Photo ready. Review it, then choose Read handwriting when you are ready to send the prepared copy.",
      );
      window.setTimeout(() => readButtonRef.current?.focus(), 0);
    } catch (cause) {
      if (!mountedRef.current || operation !== operationRef.current) return;
      setError(
        cause instanceof PhotoProcessingError
          ? cause.message
          : GENERIC_PHOTO_ERROR,
      );
      setStatus("");
    } finally {
      if (mountedRef.current && operation === operationRef.current) {
        setProcessing(false);
      }
    }
  };

  const selectPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await prepare(file);
  };

  const openCamera = async () => {
    if (!capturePhoto || capturing || processing || extracting) return;
    setCapturing(true);
    setError("");
    setStatus("Opening camera...");
    try {
      const file = await capturePhoto();
      if (!mountedRef.current) return;
      if (!file) {
        setStatus("Camera closed. No photo was added.");
        return;
      }
      await prepare(file);
    } catch {
      if (!mountedRef.current) return;
      setStatus("");
      setError(
        "The camera could not open. Check camera access, try again, or choose an existing photo.",
      );
    } finally {
      if (mountedRef.current) setCapturing(false);
    }
  };

  const transformCurrent = async (transform: ResponsePhotoTransform) => {
    const current = photoRef.current;
    if (!current || processing) return;
    const file = new File([current.blob], "prepared-response.jpg", {
      type: current.blob.type,
    });
    await prepare(file, transform);
  };

  const chooseAnother = () => {
    operationRef.current += 1;
    if (!clearCurrentPhoto()) return;
    setTranscript("");
    setUncertainSegments([]);
    setEditingTranscript(false);
    setExtractionAttempted(false);
    setError("");
    setStatus("");
    fileInputRef.current?.click();
  };

  const discard = () => {
    operationRef.current += 1;
    if (!clearCurrentPhoto()) return;
    setTranscript("");
    setUncertainSegments([]);
    setEditingTranscript(false);
    setExtractionAttempted(false);
    setError("");
    setStatus("Photo discarded. Choose another photo or type the response.");
  };

  const retake = () => {
    operationRef.current += 1;
    if (!clearCurrentPhoto()) return;
    setTranscript("");
    setUncertainSegments([]);
    setEditingTranscript(false);
    setExtractionAttempted(false);
    setError("");
    setStatus("");
    if (capturePhoto) void openCamera();
    else fileInputRef.current?.click();
  };

  const useTypedEntry = () => {
    operationRef.current += 1;
    if (!clearCurrentPhoto()) return;
    setTranscript("");
    onUseTypedEntry();
  };

  const readHandwriting = async () => {
    const current = photoRef.current;
    if (!current || processing || extracting) return;
    const operation = ++operationRef.current;
    setExtracting(true);
    setExtractionAttempted(true);
    setError("");
    setStatus("Reading handwriting...");
    try {
      const result = await transcribePhoto(current.blob);
      if (!mountedRef.current || operation !== operationRef.current) return;
      setTranscript(result.transcript);
      setUncertainSegments(result.uncertainSegments);
      setEditingTranscript(false);
      setStatus(
        "Handwriting read. Check the extracted text before requesting feedback.",
      );
      window.setTimeout(() => extractedHeadingRef.current?.focus(), 0);
    } catch {
      if (!mountedRef.current || operation !== operationRef.current) return;
      setTranscript("");
      setUncertainSegments([]);
      setEditingTranscript(false);
      setStatus("");
      setError(
        "The handwriting could not be read right now. Try again, type it yourself, or retake the photo.",
      );
      window.setTimeout(() => retryButtonRef.current?.focus(), 0);
    } finally {
      if (mountedRef.current && operation === operationRef.current) {
        setExtracting(false);
      }
    }
  };

  const confirmTranscript = async () => {
    const confirmed = transcript.trim();
    if (!confirmed) {
      setError("Enter the response before requesting feedback.");
      transcriptRef.current?.focus();
      return;
    }
    if (confirmed.length > 4000) {
      setError("Keep the transcript under 4,000 characters.");
      transcriptRef.current?.focus();
      return;
    }
    operationRef.current += 1;
    if (!clearCurrentPhoto()) return;
    await onConfirmTranscript(confirmed);
  };

  const startManualEntry = () => {
    setTranscript("");
    setUncertainSegments([]);
    setEditingTranscript(true);
    setError("");
    setStatus("Type the response while comparing it with the photo.");
    window.setTimeout(() => transcriptRef.current?.focus(), 0);
  };

  const trim = photo
    ? {
        x: photo.width * 0.05,
        y: photo.height * 0.05,
        width: photo.width * 0.9,
        height: photo.height * 0.9,
      }
    : undefined;

  return (
    <section
      className="response-photo"
      aria-labelledby="response-photo-heading"
    >
      <p className="eyebrow">PHOTO RESPONSE</p>
      <h2 ref={headingRef} id="response-photo-heading" tabIndex={-1}>
        Prepare one response photo
      </h2>
      <p className="response-photo__privacy">
        Choosing, rotating, and trimming stay on this device. Only when you
        choose Read handwriting is the prepared copy sent securely for
        transcription. It is not saved by this app and is discarded when you
        continue, retake, discard, or leave this review.
      </p>
      <p>
        Check the extracted text before feedback so handwriting mistakes do not
        lead to unfair coaching.
      </p>
      {capturePhoto && (
        <button
          type="button"
          className="primary-button response-photo__camera-action"
          disabled={capturing || processing || extracting}
          onClick={() => void openCamera()}
        >
          {capturing ? "Opening camera..." : "Open camera"}
        </button>
      )}
      <label
        className={
          capturePhoto
            ? "secondary-button response-photo__picker"
            : "response-photo__picker"
        }
        htmlFor="response-photo-file"
      >
        {capturePhoto
          ? "Choose an existing response photo"
          : "Choose one response photo"}
      </label>
      <input
        ref={fileInputRef}
        id="response-photo-file"
        type="file"
        className={capturePhoto ? "visually-hidden" : undefined}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={capturing || processing || extracting}
        onChange={(event) => void selectPhoto(event)}
      />
      <p className="muted">JPEG, PNG, or WebP. One image, up to 8 MB.</p>
      {(capturing || processing || extracting) && (
        <p className="response-status" role="status" aria-live="polite">
          {capturing
            ? "Opening camera..."
            : extracting
              ? "Reading handwriting..."
              : "Preparing photo locally..."}
        </p>
      )}
      {error && (
        <p className="response-error" role="alert">
          {error}
        </p>
      )}
      {!capturing && !processing && !extracting && status && (
        <p className="response-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
      {photo && (
        <div className="response-photo__workspace">
          <img
            className="response-photo__preview"
            src={photo.previewUrl}
            alt="Selected response photo"
          />
          <div className="response-photo__controls" aria-label="Photo controls">
            <button
              type="button"
              className="secondary-button"
              disabled={processing || extracting}
              onClick={() => void transformCurrent({ rotation: 90 })}
            >
              Rotate right
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={processing || extracting || !trim}
              onClick={() => trim && void transformCurrent({ crop: trim })}
            >
              Trim edges
            </button>
            {!transcript && !extractionAttempted && (
              <button
                type="button"
                className="secondary-button"
                disabled={processing || extracting}
                onClick={chooseAnother}
              >
                Choose another photo
              </button>
            )}
            <button
              type="button"
              className="text-button"
              disabled={processing || extracting}
              onClick={discard}
            >
              Discard photo
            </button>
          </div>
          {!transcript && !editingTranscript && !extractionAttempted && (
            <button
              ref={readButtonRef}
              type="button"
              className="primary-button"
              disabled={processing || extracting}
              onClick={() => void readHandwriting()}
            >
              {extracting ? "Reading handwriting..." : "Read handwriting"}
            </button>
          )}
          {(transcript || editingTranscript) && (
            <div aria-labelledby="extracted-transcript-heading">
              <h3
                ref={extractedHeadingRef}
                id="extracted-transcript-heading"
                tabIndex={-1}
              >
                Check the extracted text
              </h3>
              <label htmlFor="provisional-transcript">
                {extractionAttempted
                  ? "Extracted response"
                  : "Student response"}
              </label>
              <textarea
                ref={transcriptRef}
                id="provisional-transcript"
                rows={7}
                value={transcript}
                readOnly={!editingTranscript}
                aria-describedby="provisional-transcript-help"
                aria-invalid={error ? true : undefined}
                disabled={processing || extracting}
                onChange={(event) => {
                  setTranscript(event.target.value);
                  setError("");
                }}
              />
              <div
                id="provisional-transcript-help"
                className="response-editor__meta"
              >
                <span>Compare this text with the handwritten response.</span>
                <span>{transcript.length.toLocaleString()} / 4,000</span>
              </div>
              {uncertainSegments.length > 0 && (
                <p className="muted">
                  Double-check: {uncertainSegments.join("; ")}
                </p>
              )}
            </div>
          )}
          <div className="response-photo__actions">
            {transcript && (
              <button
                type="button"
                className="primary-button"
                disabled={processing || extracting}
                onClick={() => void confirmTranscript()}
              >
                Looks right — get feedback
              </button>
            )}
            {transcript && !editingTranscript && (
              <button
                type="button"
                className="secondary-button"
                disabled={processing || extracting}
                onClick={() => {
                  setEditingTranscript(true);
                  window.setTimeout(() => transcriptRef.current?.focus(), 0);
                }}
              >
                Edit text
              </button>
            )}
            {(transcript || extractionAttempted) && (
              <button
                type="button"
                className="secondary-button"
                disabled={processing || extracting}
                onClick={retake}
              >
                Retake photo
              </button>
            )}
            {extractionAttempted && !transcript && (
              <button
                ref={retryButtonRef}
                type="button"
                className="secondary-button"
                disabled={processing || extracting}
                onClick={() => void readHandwriting()}
              >
                Try reading again
              </button>
            )}
            {extractionAttempted && !transcript && !editingTranscript && (
              <button
                type="button"
                className="secondary-button"
                onClick={startManualEntry}
              >
                Type it myself
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              disabled={processing || extracting}
              onClick={useTypedEntry}
            >
              Type the response instead
            </button>
          </div>
        </div>
      )}
      {!photo && !processing && (
        <button
          type="button"
          className="secondary-button"
          onClick={useTypedEntry}
        >
          Type the response instead
        </button>
      )}
    </section>
  );
}
