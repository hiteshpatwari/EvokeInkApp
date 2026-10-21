"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { ChildProfile, ReadingSession } from "@/domain/schemas";
import {
  BackupValidationError,
  createBackupJson,
  parseBackupJson,
  resolveBackupImport,
  type BackupFile,
  type BackupImportMode,
} from "@/storage/backup";

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

function readFileText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The selected file was not text."));
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

type DataBackupPanelProps = {
  profiles: ChildProfile[];
  sessions: ReadingSession[];
  onImport: (data: {
    profiles: ChildProfile[];
    sessions: ReadingSession[];
  }) => Promise<void> | void;
};

export function DataBackupPanel({
  profiles,
  sessions,
  onImport,
}: DataBackupPanelProps) {
  const [candidate, setCandidate] = useState<BackupFile | null>(null);
  const [replacePending, setReplacePending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const replaceTriggerRef = useRef<HTMLButtonElement>(null);
  const replaceConfirmRef = useRef<HTMLButtonElement>(null);
  const replaceDialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (replacePending) replaceConfirmRef.current?.focus();
  }, [replacePending]);

  useEffect(() => {
    const dialog = replaceDialogRef.current;
    if (!replacePending || !dialog) return;

    const keepInteractionInsideDialog = (event: Event) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        replaceConfirmRef.current?.focus();
      }
    };

    document.addEventListener("click", keepInteractionInsideDialog, true);
    document.addEventListener("focusin", keepInteractionInsideDialog, true);
    return () => {
      document.removeEventListener("click", keepInteractionInsideDialog, true);
      document.removeEventListener(
        "focusin",
        keepInteractionInsideDialog,
        true,
      );
    };
  }, [replacePending]);

  const cancelReplacement = () => {
    const trigger = replaceTriggerRef.current;
    setReplacePending(false);
    queueMicrotask(() => trigger?.focus());
  };

  const containDialogFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelReplacement();
      return;
    }
    if (event.key !== "Tab") return;

    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const exportBackup = () => {
    const json = createBackupJson(profiles, sessions);
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `read-and-reflect-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setError("");
    setMessage(
      `Backup downloaded with ${profiles.length} child ${profiles.length === 1 ? "profile" : "profiles"} and ${sessions.length} ${sessions.length === 1 ? "worksheet" : "worksheets"}.`,
    );
  };

  const selectBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setCandidate(null);
    setReplacePending(false);
    setMessage("");
    setError("");

    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError("That backup is larger than 10 MB. Choose a smaller JSON file.");
      input.value = "";
      return;
    }

    try {
      const backup = parseBackupJson(await readFileText(file));
      setCandidate(backup);
    } catch (reason) {
      setError(
        reason instanceof BackupValidationError
          ? reason.message
          : "The backup could not be read. Choose the JSON file again.",
      );
    } finally {
      input.value = "";
    }
  };

  const applyImport = async (mode: BackupImportMode) => {
    if (!candidate) return;
    const result = resolveBackupImport({ profiles, sessions }, candidate, mode);
    try {
      await onImport(result);
      setCandidate(null);
      setReplacePending(false);
      setError("");
      setMessage(
        mode === "merge"
          ? "Backup merged. Imported records replaced matching records, and the rest of your data was kept."
          : "Backup restored. Your previous profiles and worksheets were replaced.",
      );
    } catch {
      setError(
        "The backup could not be saved. Reload the app and confirm your current data before making more changes.",
      );
    }
  };

  return (
    <section className="panel" aria-labelledby="backup-heading">
      <p className="eyebrow">Data safety</p>
      <h2 id="backup-heading">Backup &amp; restore</h2>
      <p className="muted">
        Download a private JSON backup, or restore profiles and worksheets from
        an earlier backup.
      </p>
      <div className="card-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={exportBackup}
        >
          Download backup
        </button>
        <label className="secondary-button file-button" htmlFor="backup-file">
          Choose backup file
        </label>
        <input
          id="backup-file"
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={selectBackup}
        />
      </div>

      {candidate && (
        <section className="form-card" aria-labelledby="backup-review-heading">
          <h2 id="backup-review-heading">Review this backup</h2>
          <p>
            Created {new Date(candidate.exportedAt).toLocaleString()} with{" "}
            {candidate.profiles.length} child profiles and{" "}
            {candidate.sessions.length} worksheets.
          </p>
          <p className="muted">
            Merge keeps records that are not in this backup. When an ID matches,
            the imported record wins.
          </p>
          <div className="card-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => applyImport("merge")}
            >
              Merge backup
            </button>
            <button
              ref={replaceTriggerRef}
              className="danger-button"
              type="button"
              onClick={() => setReplacePending(true)}
            >
              Replace all data
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setCandidate(null);
                setReplacePending(false);
              }}
            >
              Cancel
            </button>
          </div>

          {replacePending && (
            <section
              ref={replaceDialogRef}
              className="empty-card confirmation-dialog replacement-confirmation"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="replacement-confirmation-title"
              aria-describedby="replacement-confirmation-description"
              onKeyDown={containDialogFocus}
            >
              <h3 id="replacement-confirmation-title">
                Replace all saved data?
              </h3>
              <p id="replacement-confirmation-description">
                Replace your current {profiles.length} child profiles and{" "}
                {sessions.length} worksheets? This cannot be undone unless you
                downloaded a backup first.
              </p>
              <div className="card-actions">
                <button
                  ref={replaceConfirmRef}
                  className="danger-button"
                  type="button"
                  onClick={() => applyImport("replace")}
                >
                  Confirm replacement
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={cancelReplacement}
                >
                  Keep current data
                </button>
              </div>
            </section>
          )}
        </section>
      )}

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
