"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  PhotoProcessingError,
  processResponsePhoto,
  type ProcessedResponsePhoto,
  type ResponsePhotoTransform,
} from "@/client/responsePhotoProcessing";

export interface ResponsePhotoPreparationProps {
  onConfirmTranscript: (transcript: string) => void;
  onUseTypedEntry: () => void;
  processPhoto?: typeof processResponsePhoto;
}

const GENERIC_PHOTO_ERROR =
  "The photo could not be prepared. Retake it or type the response instead.";

export function ResponsePhotoPreparation({
  onConfirmTranscript,
  onUseTypedEntry,
  processPhoto = processResponsePhoto,
}: ResponsePhotoPreparationProps) {
  const [photo, setPhoto] = useState<ProcessedResponsePhoto | null>(null);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);
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
        "Photo ready. Type the response exactly as it appears, then confirm the transcript.",
      );
      window.setTimeout(() => transcriptRef.current?.focus(), 0);
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
    setError("");
    setStatus("");
    fileInputRef.current?.click();
  };

  const discard = () => {
    operationRef.current += 1;
    if (!clearCurrentPhoto()) return;
    setTranscript("");
    setError("");
    setStatus("Photo discarded. Choose another photo or type the response.");
  };

  const useTypedEntry = () => {
    operationRef.current += 1;
    if (!clearCurrentPhoto()) return;
    setTranscript("");
    onUseTypedEntry();
  };

  const confirmTranscript = () => {
    const confirmed = transcript.trim();
    if (!confirmed) {
      setError("Type the response from the photo before confirming it.");
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
    onConfirmTranscript(confirmed);
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
        Your photo is processed temporarily on this device and is not saved or
        uploaded. It is discarded when you confirm, discard, or leave this
        review.
      </p>
      <p>
        Automatic handwriting transcription is not enabled yet. After the photo
        is ready, type what it says and confirm the transcript before requesting
        feedback.
      </p>
      <label className="response-photo__picker" htmlFor="response-photo-file">
        Choose one response photo
      </label>
      <input
        ref={fileInputRef}
        id="response-photo-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={processing}
        onChange={(event) => void selectPhoto(event)}
      />
      <p className="muted">JPEG, PNG, or WebP. One image, up to 8 MB.</p>
      {processing && (
        <p className="response-status" role="status" aria-live="polite">
          Preparing photo locally...
        </p>
      )}
      {error && (
        <p className="response-error" role="alert">
          {error}
        </p>
      )}
      {!processing && status && (
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
              disabled={processing}
              onClick={() => void transformCurrent({ rotation: 90 })}
            >
              Rotate right
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={processing || !trim}
              onClick={() => trim && void transformCurrent({ crop: trim })}
            >
              Trim edges
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={processing}
              onClick={chooseAnother}
            >
              Choose another photo
            </button>
            <button
              type="button"
              className="text-button"
              disabled={processing}
              onClick={discard}
            >
              Discard photo
            </button>
          </div>
          <label htmlFor="provisional-transcript">Provisional transcript</label>
          <textarea
            ref={transcriptRef}
            id="provisional-transcript"
            rows={7}
            value={transcript}
            aria-describedby="provisional-transcript-help"
            aria-invalid={error ? true : undefined}
            disabled={processing}
            onChange={(event) => {
              setTranscript(event.target.value);
              setError("");
            }}
          />
          <div
            id="provisional-transcript-help"
            className="response-editor__meta"
          >
            <span>Check this text against the handwritten response.</span>
            <span>{transcript.length.toLocaleString()} / 4,000</span>
          </div>
          <div className="response-photo__actions">
            <button
              type="button"
              className="primary-button"
              disabled={processing}
              onClick={confirmTranscript}
            >
              Confirm transcript
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={processing}
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
