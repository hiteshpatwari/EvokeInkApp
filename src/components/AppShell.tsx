"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type {
  Book,
  ChildProfile,
  Difficulty,
  GenerationInput,
  PromptBatch,
  ReadingSession,
  ResponseLength,
  WorksheetPrompt,
} from "@/domain/schemas";
import {
  getInstallationToken,
  toNetworkGenerationInput,
} from "@/client/promptRequest";
import {
  getPreviousScreen,
  NATIVE_BACK_EVENT,
  type AppScreen,
} from "@/client/nativeBack";
import {
  childProfileSchema,
  generationInputSchema,
  readingSessionSchema,
} from "@/domain/schemas";
import {
  createLocalRepository,
  type FlushableStorage,
  type StorageDiagnostic,
} from "@/storage/repository";
import {
  exportWorksheet,
  getWorksheetExportExperience,
} from "@/pdf/worksheetExport";
import { DataBackupPanel } from "./DataBackupPanel";
import { PromptEditor } from "./PromptEditor";
import { ResponseReview } from "./ResponseReview";
import { WorksheetPreview } from "./WorksheetPreview";

const DIFFICULTIES: Array<{ value: Difficulty; label: string }> = [
  { value: "accessible", label: "Accessible" },
  { value: "grade_level", label: "Grade-level" },
  { value: "challenging", label: "Challenging" },
  { value: "advanced", label: "Advanced" },
];

const SKILLS = [
  ["evidence_and_explanation", "Evidence & explanation"],
  ["inference", "Inference"],
  ["cause_and_effect", "Cause & effect"],
  ["character_motivation", "Character motivation"],
  ["conflict_and_problem_solving", "Conflict & problem solving"],
  ["theme", "Theme or message"],
  ["authors_purpose", "Author’s purpose"],
  ["comparison", "Comparison"],
  ["prediction", "Prediction"],
] as const;

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const optional = (value: string) => (value.trim() ? value.trim() : undefined);

interface CreationState {
  title: string;
  author: string;
  genre: Book["genre"];
  progress: string;
  parentNotes: string;
  parentSummary: string;
  detailNotes: string;
  specificity: "general" | "notes";
  skills: string[];
}

const emptyCreation: CreationState = {
  title: "",
  author: "",
  genre: "fiction",
  progress: "",
  parentNotes: "",
  parentSummary: "",
  detailNotes: "",
  specificity: "general",
  skills: ["evidence_and_explanation", "inference"],
};

type AppShellProps = { storage?: FlushableStorage };

export function AppShell({ storage }: AppShellProps = {}) {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [editingProfile, setEditingProfile] = useState<ChildProfile | null>(
    null,
  );
  const [creation, setCreation] = useState<CreationState>({
    ...emptyCreation,
    skills: [...emptyCreation.skills],
  });
  const [workingSession, setWorkingSession] = useState<ReadingSession | null>(
    null,
  );
  const [responseReviewPrompt, setResponseReviewPrompt] =
    useState<WorksheetPrompt | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [storageDiagnostics, setStorageDiagnostics] = useState<
    StorageDiagnostic[]
  >([]);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const exportExperience = getWorksheetExportExperience();
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null,
  );
  const [bookFilter, setBookFilter] = useState("");
  const [childFilter, setChildFilter] = useState("all");
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<
    string | null
  >(null);
  const [pendingDeleteProfileId, setPendingDeleteProfileId] = useState<
    string | null
  >(null);
  const deleteConfirmRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const profileDeleteConfirmRef = useRef<HTMLButtonElement>(null);
  const profileDeleteDialogRef = useRef<HTMLElement>(null);
  const profileDeleteTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const repository = createLocalRepository(storage ?? localStorage);
      const loadedProfiles = repository.loadProfiles();
      setProfiles(loadedProfiles);
      setSessions(repository.loadSessions());
      setStorageDiagnostics(repository.getStorageDiagnostics());
      setSelectedChildId(loadedProfiles[0]?.id ?? "");
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [storage]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("main")?.focus({
        preventScroll: true,
      });
      (document.scrollingElement ?? document.documentElement).scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [screen]);

  useEffect(() => {
    if (pendingDeleteSessionId) deleteConfirmRef.current?.focus();
  }, [pendingDeleteSessionId]);

  useEffect(() => {
    if (pendingDeleteProfileId) profileDeleteConfirmRef.current?.focus();
  }, [pendingDeleteProfileId]);

  useEffect(() => {
    const dialog = pendingDeleteSessionId
      ? deleteDialogRef.current
      : pendingDeleteProfileId
        ? profileDeleteDialogRef.current
        : null;
    if (!dialog) return;

    const keepInteractionInsideDialog = (event: Event) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        const initialFocus = pendingDeleteSessionId
          ? deleteConfirmRef.current
          : profileDeleteConfirmRef.current;
        initialFocus?.focus();
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
  }, [pendingDeleteProfileId, pendingDeleteSessionId]);

  const containDialogFocus = (
    event: KeyboardEvent<HTMLElement>,
    onEscape: () => void,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
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

  const selectedChild =
    profiles.find((profile) => profile.id === selectedChildId) ?? profiles[0];
  const repository = useMemo(
    () =>
      typeof window === "undefined"
        ? null
        : createLocalRepository(storage ?? localStorage),
    [storage],
  );

  const flushPersistence = async () => storage?.flush?.();
  const persistenceFailure = () => {
    setNotice("");
    setError(
      "Your change could not be saved safely. Reload the app to confirm what is stored before trying again.",
    );
  };

  const goHome = () => {
    setScreen("home");
    setResponseReviewPrompt(null);
    setPendingDeleteSessionId(null);
    setPendingDeleteProfileId(null);
    setError("");
    setNotice("");
  };

  const beginCreate = () => {
    if (!selectedChild) {
      setEditingProfile(null);
      setScreen("profile");
      return;
    }
    setCreation({ ...emptyCreation, skills: [...emptyCreation.skills] });
    setWorkingSession(null);
    setScreen("create");
  };

  const cleanUpSavedData = async () => {
    if (!repository) return;
    try {
      const removed = repository.clearInvalidPersistedRecords();
      await flushPersistence();
      setStorageDiagnostics([]);
      setNotice(
        `Saved data cleaned up. ${removed.profiles} invalid ${removed.profiles === 1 ? "child profile" : "child profiles"} and ${removed.sessions} invalid ${removed.sessions === 1 ? "worksheet" : "worksheets"} were removed.`,
      );
    } catch {
      persistenceFailure();
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const timestamp = now();
    const raw = {
      id: editingProfile?.id ?? id("child"),
      name: String(data.get("name") ?? ""),
      gradeOrAge: String(data.get("gradeOrAge") ?? ""),
      ...(optional(String(data.get("readingLevel") ?? ""))
        ? { readingLevel: optional(String(data.get("readingLevel") ?? "")) }
        : {}),
      ...(optional(String(data.get("lexile") ?? ""))
        ? { lexile: optional(String(data.get("lexile") ?? "")) }
        : {}),
      difficulty: String(data.get("difficulty") ?? "grade_level"),
      responseLength: String(data.get("responseLength") ?? "medium"),
      createdAt: editingProfile?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const result = childProfileSchema.safeParse(raw);
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ?? "Please check the profile details.",
      );
      return;
    }
    try {
      repository?.saveProfile(result.data);
      await flushPersistence();
    } catch {
      persistenceFailure();
      return;
    }
    setProfiles((current) => [
      ...current.filter((profile) => profile.id !== result.data.id),
      result.data,
    ]);
    setSelectedChildId(result.data.id);
    setEditingProfile(null);
    setNotice(`${result.data.name}’s profile is ready.`);
    setError("");
    setScreen("home");
  };

  const useDemoProfile = () => {
    setEditingProfile({
      id: id("child"),
      name: "Aavya",
      gradeOrAge: "Grade 3",
      readingLevel: "Advanced independent reader",
      lexile: "1100L",
      difficulty: "advanced",
      responseLength: "medium",
      createdAt: now(),
      updatedAt: now(),
    });
  };

  const generationPayload = (
    variant = 0,
    profile: ChildProfile | undefined = selectedChild,
  ): GenerationInput | null => {
    if (!profile) return null;
    const raw = {
      child: {
        name: profile.name,
        gradeOrAge: profile.gradeOrAge,
        ...(profile.readingLevel ? { readingLevel: profile.readingLevel } : {}),
        ...(profile.lexile ? { lexile: profile.lexile } : {}),
        difficulty: profile.difficulty,
        responseLength: profile.responseLength,
      },
      book: {
        title: creation.title,
        author: creation.author,
        genre: creation.genre,
        progress: creation.progress,
      },
      specificity: creation.specificity,
      skills: creation.skills,
      parentNotes: creation.parentNotes,
      parentSummary: creation.parentSummary,
      detailNotes: creation.detailNotes,
      variant,
    };
    const result = generationInputSchema.safeParse(raw);
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ?? "Please check the reading details.",
      );
      return null;
    }
    if (
      raw.specificity === "notes" &&
      !raw.parentNotes &&
      !raw.parentSummary &&
      !raw.detailNotes
    ) {
      setError("Add a summary or note, or choose general prompts.");
      return null;
    }
    return result.data;
  };

  const requestPrompts = async (payload: GenerationInput) => {
    const response = await fetch("/api/prompts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Installation-Token": getInstallationToken(),
      },
      body: JSON.stringify(toNetworkGenerationInput(payload)),
    });
    const body: unknown = await response.json();
    if (!response.ok)
      throw new Error(
        "We couldn’t generate prompts. Check the form and try again.",
      );
    return body as PromptBatch & { notice?: string };
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    const payload = generationPayload();
    if (!payload || !selectedChild) return;
    setGenerating(true);
    setError("");
    try {
      const result = await requestPrompts(payload);
      const timestamp = now();
      const generatedPrompts = result.prompts.map((prompt) => ({
        ...prompt,
        id: id("prompt"),
      }));
      setWorkingSession({
        id: id("session"),
        childId: selectedChild.id,
        childSnapshot: { ...selectedChild },
        book: payload.book,
        specificity: payload.specificity,
        skills: [...payload.skills],
        parentNotes: payload.parentNotes,
        parentSummary: payload.parentSummary,
        detailNotes: payload.detailNotes,
        generatedPrompts: generatedPrompts.map((prompt) => ({ ...prompt })),
        prompts: generatedPrompts.map((prompt) => ({ ...prompt })),
        createdAt: timestamp,
        updatedAt: timestamp,
        status: "draft",
      });
      setNotice(result.notice ?? "Four prompts are ready for your review.");
      setScreen("review");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn’t generate prompts. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const regenerateOne = async (index: number) => {
    const payload = generationPayload(index + 1, workingSession?.childSnapshot);
    if (!payload || !workingSession) return;
    setRegeneratingIndex(index);
    setError("");
    try {
      const result = await requestPrompts(payload);
      const replacement = result.prompts[index] ?? result.prompts[0];
      if (!replacement) throw new Error("No replacement prompt was returned.");
      const replacementWithId = {
        ...replacement,
        id: workingSession.prompts[index]?.id ?? id("prompt"),
        required:
          workingSession.prompts[index]?.required ?? replacement.required,
      };
      setWorkingSession({
        ...workingSession,
        prompts: workingSession.prompts.map((prompt, promptIndex) =>
          promptIndex === index ? replacementWithId : prompt,
        ),
        generatedPrompts: (workingSession.generatedPrompts.length
          ? workingSession.generatedPrompts
          : workingSession.prompts
        ).map((prompt, promptIndex) =>
          promptIndex === index ? { ...replacementWithId } : prompt,
        ),
        updatedAt: now(),
      });
      setNotice("That prompt has been refreshed. Review it before printing.");
    } catch {
      setError(
        "That prompt could not be regenerated. Your current prompt is unchanged.",
      );
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const saveWorkingSession = async (nextScreen: AppScreen = "preview") => {
    if (!workingSession) return;
    const candidate = {
      ...workingSession,
      updatedAt: now(),
      status: "ready" as const,
    };
    const result = readingSessionSchema.safeParse(candidate);
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ??
          "Please check each prompt before saving.",
      );
      setScreen("review");
      return;
    }
    const saved = result.data;
    try {
      repository?.saveSession(saved);
      await flushPersistence();
    } catch {
      persistenceFailure();
      return;
    }
    setWorkingSession(saved);
    setSessions((current) => [
      saved,
      ...current.filter((session) => session.id !== saved.id),
    ]);
    setNotice("Worksheet saved on this device.");
    setScreen(nextScreen);
  };

  const handleWorksheetExport = async () => {
    if (!workingSession || exportingPdf) return;
    setExportingPdf(true);
    setError("");
    try {
      const result = await exportWorksheet(workingSession);
      if (result.status === "downloaded") {
        setNotice("The worksheet PDF download has started.");
      } else if (result.status === "shared") {
        setNotice(
          result.cleanupFailed
            ? "The PDF was shared, but its temporary cache copy could not be removed. Android will clear app cache automatically."
            : "Share sheet closed. The temporary PDF was removed.",
        );
      } else if (result.status === "cancelled") {
        setNotice(
          result.cleanupFailed
            ? "Sharing was cancelled, but the temporary cache copy could not be removed. Android will clear app cache automatically."
            : "Sharing cancelled. No PDF was saved.",
        );
      } else {
        setError("PDF sharing is unavailable on this device.");
      }
    } catch (caught) {
      const cleanupFailed =
        typeof caught === "object" &&
        caught !== null &&
        "cleanupFailed" in caught &&
        caught.cleanupFailed === true;
      setError(
        cleanupFailed
          ? "The PDF could not be shared, and its temporary cache copy could not be removed. Android will clear app cache automatically."
          : "The PDF could not be shared. Please try again.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const loadDemoBook = () =>
    setCreation((current) => ({
      ...current,
      title: "The Chronicles of Narnia: Prince Caspian",
      author: "C. S. Lewis",
      genre: "fiction",
      progress: "Pages 1-60",
      specificity: "general",
    }));

  const loadSession = (session: ReadingSession, target: AppScreen) => {
    setSelectedChildId(session.childId);
    setWorkingSession(session);
    setCreation({
      title: session.book.title,
      author: session.book.author,
      genre: session.book.genre,
      progress: session.book.progress,
      parentNotes: session.parentNotes,
      parentSummary: session.parentSummary,
      detailNotes: session.detailNotes,
      specificity: session.specificity,
      skills: [...session.skills],
    });
    setScreen(target);
  };

  const duplicateSession = async (session: ReadingSession) => {
    const duplicate = {
      ...session,
      id: id("session"),
      prompts: session.prompts.map((prompt) => ({
        ...prompt,
        id: id("prompt"),
      })),
      generatedPrompts: session.generatedPrompts.map((prompt) => ({
        ...prompt,
        id: id("prompt"),
      })),
      createdAt: now(),
      updatedAt: now(),
      status: "draft" as const,
    };
    try {
      repository?.saveSession(duplicate);
      await flushPersistence();
    } catch {
      persistenceFailure();
      return;
    }
    setSessions((current) => [duplicate, ...current]);
    setNotice("A copy was added to saved reflections.");
  };

  const requestDeleteSession = (
    sessionId: string,
    trigger: HTMLButtonElement,
  ) => {
    deleteTriggerRef.current = trigger;
    setPendingDeleteSessionId(sessionId);
  };

  const cancelDeleteSession = () => {
    const trigger = deleteTriggerRef.current;
    setPendingDeleteSessionId(null);
    queueMicrotask(() => trigger?.focus());
  };

  const deleteSession = async () => {
    if (!pendingDeleteSessionId) return;
    try {
      repository?.deleteSession(pendingDeleteSessionId);
      await flushPersistence();
    } catch {
      persistenceFailure();
      return;
    }
    document.querySelector<HTMLElement>("main")?.focus();
    setSessions((current) =>
      current.filter((session) => session.id !== pendingDeleteSessionId),
    );
    setPendingDeleteSessionId(null);
    setNotice("Worksheet deleted from this device.");
  };

  const requestDeleteProfile = (
    profileId: string,
    trigger: HTMLButtonElement,
  ) => {
    profileDeleteTriggerRef.current = trigger;
    setPendingDeleteProfileId(profileId);
  };

  const cancelDeleteProfile = () => {
    const trigger = profileDeleteTriggerRef.current;
    setPendingDeleteProfileId(null);
    queueMicrotask(() => trigger?.focus());
  };

  const deleteProfile = async () => {
    const profile = profiles.find(
      (candidate) => candidate.id === pendingDeleteProfileId,
    );
    if (!profile) return;

    const remainingProfiles = profiles.filter(
      (candidate) => candidate.id !== profile.id,
    );
    const retainedWorksheetCount = sessions.filter(
      (session) => session.childId === profile.id,
    ).length;

    try {
      repository?.deleteProfile(profile.id);
      await flushPersistence();
    } catch {
      persistenceFailure();
      return;
    }
    setProfiles(remainingProfiles);
    if (selectedChildId === profile.id) {
      setSelectedChildId(remainingProfiles[0]?.id ?? "");
    }
    if (childFilter === profile.id && retainedWorksheetCount === 0) {
      setChildFilter("all");
    }
    setPendingDeleteProfileId(null);
    setNotice(
      `${profile.name}’s profile was deleted. ${retainedWorksheetCount} saved ${retainedWorksheetCount === 1 ? "worksheet was" : "worksheets were"} kept.`,
    );
    document.querySelector<HTMLElement>("main")?.focus();
  };

  const updateSessionStatus = async (
    session: ReadingSession,
    status: ReadingSession["status"],
  ) => {
    const updated = { ...session, status, updatedAt: now() };
    try {
      repository?.saveSession(updated);
      await flushPersistence();
    } catch {
      persistenceFailure();
      return;
    }
    setSessions((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    if (workingSession?.id === updated.id) setWorkingSession(updated);
    setNotice(
      status === "completed"
        ? "Reflection marked completed."
        : "Reflection moved back to ready.",
    );
  };

  const importBackupData = async (data: {
    profiles: ChildProfile[];
    sessions: ReadingSession[];
  }) => {
    if (!repository) {
      throw new Error("Local storage is not ready.");
    }

    repository.replaceAllData(data);
    await flushPersistence();
    setProfiles(data.profiles);
    setSessions(data.sessions);
    setSelectedChildId((current) =>
      data.profiles.some((profile) => profile.id === current)
        ? current
        : (data.profiles[0]?.id ?? ""),
    );
    setWorkingSession((current) =>
      current
        ? (data.sessions.find((session) => session.id === current.id) ?? null)
        : null,
    );
    setBookFilter("");
    setChildFilter("all");
    setPendingDeleteSessionId(null);
    setPendingDeleteProfileId(null);
    setError("");
    setNotice("");
  };

  useEffect(() => {
    const handleNativeBack = (event: Event) => {
      if (pendingDeleteSessionId) {
        event.preventDefault();
        cancelDeleteSession();
        return;
      }
      if (pendingDeleteProfileId) {
        event.preventDefault();
        cancelDeleteProfile();
        return;
      }

      const previousScreen = getPreviousScreen(screen);
      if (!previousScreen) return;
      event.preventDefault();
      setError("");
      setNotice("");
      if (screen === "response") setResponseReviewPrompt(null);
      setScreen(previousScreen);
    };

    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
    return () =>
      window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
  }, [pendingDeleteProfileId, pendingDeleteSessionId, screen]);

  if (!ready)
    return (
      <main className="loading-state" tabIndex={-1}>
        Opening your reading desk…
      </main>
    );

  const skillCounts = sessions
    .flatMap((session) => session.prompts.map((prompt) => prompt.skill))
    .reduce<
      Record<string, number>
    >((counts, skill) => ({ ...counts, [skill]: (counts[skill] ?? 0) + 1 }), {});
  const completedCount = sessions.filter(
    (session) => session.status === "completed",
  ).length;
  const filteredSessions = sessions.filter(
    (session) =>
      (childFilter === "all" || session.childId === childFilter) &&
      session.book.title.toLowerCase().includes(bookFilter.toLowerCase()),
  );
  const pendingDeleteSession = sessions.find(
    (session) => session.id === pendingDeleteSessionId,
  );
  const pendingDeleteProfile = profiles.find(
    (profile) => profile.id === pendingDeleteProfileId,
  );
  const pendingProfileWorksheetCount = pendingDeleteProfile
    ? sessions.filter((session) => session.childId === pendingDeleteProfile.id)
        .length
    : 0;
  const deletedProfileFilters = Array.from(
    sessions.reduce<Map<string, string>>((deletedProfiles, session) => {
      if (
        !profiles.some((profile) => profile.id === session.childId) &&
        !deletedProfiles.has(session.childId)
      ) {
        deletedProfiles.set(session.childId, session.childSnapshot.name);
      }
      return deletedProfiles;
    }, new Map()),
    ([id, name]) => ({ id, name }),
  );

  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <button type="button" className="brand-button" onClick={goHome}>
          <span>R&amp;R</span>
          <strong>Read &amp; Reflect</strong>
        </button>
        <nav aria-label="Main navigation">
          <button
            type="button"
            aria-current={screen === "home" ? "page" : undefined}
            onClick={goHome}
          >
            Home
          </button>
          <button
            type="button"
            aria-current={screen === "saved" ? "page" : undefined}
            onClick={() => setScreen("saved")}
          >
            Saved reflections
          </button>
        </nav>
      </header>

      {storageDiagnostics.length > 0 && (
        <section
          className="storage-warning no-print"
          role="alert"
          aria-labelledby="storage-warning-title"
        >
          <div>
            <h2 id="storage-warning-title">
              Some saved data could not be loaded
            </h2>
            <p>
              {storageDiagnostics
                .map((diagnostic) => {
                  const item =
                    diagnostic.collection === "profiles"
                      ? diagnostic.skippedRecords === 1
                        ? "child profile"
                        : "child profiles"
                      : diagnostic.skippedRecords === 1
                        ? "worksheet"
                        : "worksheets";
                  return `${diagnostic.skippedRecords} ${item}`;
                })
                .join(" and ")}{" "}
              could not be read. Your other saved data is still available.
            </p>
            <p className="muted">
              Clean up removes only the unreadable records from this device.
            </p>
          </div>
          <div className="storage-warning__actions">
            <button
              type="button"
              className="secondary-button"
              onClick={cleanUpSavedData}
            >
              Clean up saved data
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setStorageDiagnostics([])}
              aria-label="Dismiss saved-data warning"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {notice && (
        <div className="notice no-print" role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="error-message no-print" role="alert">
          {error}
        </div>
      )}

      {screen === "home" && (
        <main className="page page--home" tabIndex={-1}>
          <section className="hero-card">
            <div>
              <p className="eyebrow">READ · THINK · WRITE BY HAND</p>
              <h1>Turn one good reading moment into thoughtful writing.</h1>
              <p>
                Create a calm, printable reflection in a few minutes. No scores,
                streaks, or screens for the child.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={beginCreate}
              >
                {profiles.length
                  ? "Create a worksheet"
                  : "Create your first child profile"}
              </button>
            </div>
            <div className="routine-card">
              <span>1</span>
              <p>Choose a reader and add what they read.</p>
              <span>2</span>
              <p>Review four tailored prompts.</p>
              <span>3</span>
              <p>Print, then put the screen away.</p>
            </div>
          </section>

          {profiles.length === 0 ? (
            <section className="empty-card">
              <h2>Start with the reader</h2>
              <p>
                Grade and reading level stay separate, so the writing challenge
                can fit the person—not a stereotype.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditingProfile(null);
                  setScreen("profile");
                }}
              >
                Create child profile
              </button>
            </section>
          ) : (
            <div className="dashboard-grid">
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">READERS</p>
                    <h2>Child profiles</h2>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setEditingProfile(null);
                      setScreen("profile");
                    }}
                  >
                    + Add reader
                  </button>
                </div>
                <div className="profile-list">
                  {pendingDeleteProfile && (
                    <section
                      ref={profileDeleteDialogRef}
                      className="empty-card confirmation-dialog"
                      role="alertdialog"
                      aria-modal="true"
                      aria-labelledby="delete-profile-title"
                      aria-describedby="delete-profile-description"
                      onKeyDown={(event) =>
                        containDialogFocus(event, cancelDeleteProfile)
                      }
                    >
                      <h3 id="delete-profile-title">
                        Delete {pendingDeleteProfile.name}’s profile?
                      </h3>
                      <p id="delete-profile-description">
                        The reader profile will be removed.{" "}
                        {pendingProfileWorksheetCount}{" "}
                        {pendingProfileWorksheetCount === 1
                          ? "saved worksheet"
                          : "saved worksheets"}{" "}
                        will stay available with {pendingDeleteProfile.name}’s
                        original reading-profile details, so you can still view,
                        filter, and reprint{" "}
                        {pendingProfileWorksheetCount === 1 ? "it" : "them"}.
                      </p>
                      <div className="card-actions">
                        <button
                          ref={profileDeleteConfirmRef}
                          type="button"
                          className="danger-button"
                          onClick={deleteProfile}
                        >
                          Delete profile
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={cancelDeleteProfile}
                        >
                          Keep profile
                        </button>
                      </div>
                    </section>
                  )}
                  {profiles.map((profile) => (
                    <article
                      className={`profile-row ${selectedChild?.id === profile.id ? "profile-row--selected" : ""}`}
                      key={profile.id}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedChildId(profile.id)}
                      >
                        <span className="avatar">
                          {profile.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span>
                          <strong>{profile.name}</strong>
                          <small>
                            {profile.gradeOrAge} ·{" "}
                            {
                              DIFFICULTIES.find(
                                (item) => item.value === profile.difficulty,
                              )?.label
                            }
                          </small>
                          {profile.readingLevel && (
                            <small>{profile.readingLevel}</small>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setEditingProfile(profile);
                          setScreen("profile");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Delete ${profile.name} profile`}
                        onClick={(event) =>
                          requestDeleteProfile(profile.id, event.currentTarget)
                        }
                      >
                        Delete
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">RECENT</p>
                    <h2>Saved worksheets</h2>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setScreen("saved")}
                  >
                    View all
                  </button>
                </div>
                {sessions.length ? (
                  sessions.slice(0, 3).map((session) => (
                    <button
                      type="button"
                      className="session-row"
                      key={session.id}
                      onClick={() => loadSession(session, "preview")}
                    >
                      <span>
                        <strong>{session.book.title}</strong>
                        <small>
                          {session.childSnapshot.name} · {session.book.progress}
                        </small>
                      </span>
                      <span>Open →</span>
                    </button>
                  ))
                ) : (
                  <p className="muted">
                    Your saved reflections will appear here.
                  </p>
                )}
              </section>
              <section className="panel panel--wide">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">A GENTLE OVERVIEW</p>
                    <h2>
                      {completedCount}{" "}
                      {completedCount === 1 ? "reflection" : "reflections"}{" "}
                      completed
                    </h2>
                    <p className="muted">
                      {sessions.length} saved{" "}
                      {sessions.length === 1 ? "worksheet" : "worksheets"}
                    </p>
                  </div>
                </div>
                <div className="skill-chips">
                  {Object.keys(skillCounts).length ? (
                    Object.entries(skillCounts)
                      .slice(0, 6)
                      .map(([skill, count]) => (
                        <span key={skill}>
                          {skill.replaceAll("_", " ")} · {count}
                        </span>
                      ))
                  ) : (
                    <p className="muted">
                      Skill history will stay simple and non-graded.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      )}

      {screen === "profile" && (
        <main className="page page--narrow" tabIndex={-1}>
          <button
            type="button"
            className="back-button no-print"
            onClick={goHome}
          >
            ← Back home
          </button>
          <div className="page-intro">
            <p className="eyebrow">CHILD PROFILE</p>
            <h1>
              {editingProfile
                ? `Update ${editingProfile.name}’s reading profile`
                : "Tell us about the reader"}
            </h1>
            <p>
              School grade and independent reading level are intentionally
              separate. Update either one as the reader grows.
            </p>
          </div>
          <form
            className="form-card"
            key={editingProfile?.id ?? "new-profile"}
            onSubmit={saveProfile}
          >
            <div className="form-grid">
              <label>
                Child name{" "}
                <input
                  name="name"
                  required
                  defaultValue={editingProfile?.name ?? ""}
                />
              </label>
              <label>
                School grade or age range{" "}
                <input
                  name="gradeOrAge"
                  required
                  placeholder="Grade 3, ages 8-10, or adult"
                  defaultValue={editingProfile?.gradeOrAge ?? ""}
                />
              </label>
              <label>
                Independent reading level{" "}
                <input
                  name="readingLevel"
                  placeholder="Optional description"
                  defaultValue={editingProfile?.readingLevel ?? ""}
                />
              </label>
              <label>
                Lexile or equivalent measure{" "}
                <input
                  name="lexile"
                  placeholder="Optional, e.g. 850L"
                  defaultValue={editingProfile?.lexile ?? ""}
                />
              </label>
              <label>
                Preferred difficulty{" "}
                <select
                  name="difficulty"
                  defaultValue={editingProfile?.difficulty ?? "grade_level"}
                >
                  {DIFFICULTIES.map((difficulty) => (
                    <option key={difficulty.value} value={difficulty.value}>
                      {difficulty.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Preferred response length{" "}
                <select
                  name="responseLength"
                  defaultValue={
                    editingProfile?.responseLength ??
                    ("medium" satisfies ResponseLength)
                  }
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={useDemoProfile}
              >
                Use Aavya demo values
              </button>
              <button type="submit" className="primary-button">
                Save profile
              </button>
            </div>
          </form>
        </main>
      )}

      {screen === "create" && selectedChild && (
        <main className="page page--narrow" tabIndex={-1}>
          <button
            type="button"
            className="back-button no-print"
            onClick={goHome}
          >
            ← Back home
          </button>
          <div className="page-intro">
            <p className="eyebrow">
              NEW REFLECTION · {selectedChild.name.toUpperCase()}
            </p>
            <h1>What did {selectedChild.name} read?</h1>
            <p>
              Prompts will use {selectedChild.gradeOrAge},{" "}
              {selectedChild.readingLevel || "the selected reading preferences"}
              , and{" "}
              {DIFFICULTIES.find(
                (item) => item.value === selectedChild.difficulty,
              )?.label.toLowerCase()}{" "}
              difficulty.
            </p>
          </div>
          <form className="form-card" onSubmit={generate}>
            <div className="demo-strip">
              <span>Want a quick tour?</span>
              <button
                type="button"
                className="text-button"
                onClick={loadDemoBook}
              >
                Load the Prince Caspian example
              </button>
            </div>
            <div className="form-grid">
              <label>
                Book title{" "}
                <input
                  required
                  value={creation.title}
                  onChange={(event) =>
                    setCreation({ ...creation, title: event.target.value })
                  }
                />
              </label>
              <label>
                Author{" "}
                <input
                  required
                  value={creation.author}
                  onChange={(event) =>
                    setCreation({ ...creation, author: event.target.value })
                  }
                />
              </label>
              <label>
                Genre{" "}
                <select
                  value={creation.genre}
                  onChange={(event) =>
                    setCreation({
                      ...creation,
                      genre: event.target.value as Book["genre"],
                    })
                  }
                >
                  <option value="fiction">Fiction</option>
                  <option value="nonfiction">Nonfiction</option>
                  <option value="biography">Biography</option>
                  <option value="poetry">Poetry</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Pages or chapters completed{" "}
                <input
                  required
                  placeholder="1-60, Chapters 1-3, or Complete"
                  value={creation.progress}
                  onChange={(event) =>
                    setCreation({ ...creation, progress: event.target.value })
                  }
                />
              </label>
            </div>
            <fieldset className="choice-fieldset">
              <legend>How specific should the prompts be?</legend>
              <label className="radio-card">
                <input
                  type="radio"
                  name="specificity"
                  checked={creation.specificity === "general"}
                  onChange={() =>
                    setCreation({ ...creation, specificity: "general" })
                  }
                />
                <span>
                  <strong>I only want general prompts</strong>
                  <small>Safest when you have not added notes.</small>
                </span>
              </label>
              <label className="radio-card">
                <input
                  type="radio"
                  name="specificity"
                  checked={creation.specificity === "notes"}
                  onChange={() =>
                    setCreation({ ...creation, specificity: "notes" })
                  }
                />
                <span>
                  <strong>Use my notes for more specific prompts</strong>
                  <small>Only parent-supplied facts may be referenced.</small>
                </span>
              </label>
            </fieldset>
            <div className="form-grid">
              <label className="full-width">
                Short summary of what was read{" "}
                <textarea
                  rows={3}
                  value={creation.parentSummary}
                  onChange={(event) =>
                    setCreation({
                      ...creation,
                      parentSummary: event.target.value,
                    })
                  }
                  placeholder="Optional. Only include details you want reflected in prompts."
                />
              </label>
              <label>
                Parent notes{" "}
                <textarea
                  rows={3}
                  value={creation.parentNotes}
                  onChange={(event) =>
                    setCreation({
                      ...creation,
                      parentNotes: event.target.value,
                    })
                  }
                  placeholder="Optional observations or context"
                />
              </label>
              <label>
                Vocabulary, character, event, or theme notes{" "}
                <textarea
                  rows={3}
                  value={creation.detailNotes}
                  onChange={(event) =>
                    setCreation({
                      ...creation,
                      detailNotes: event.target.value,
                    })
                  }
                  placeholder="Optional details from this reading"
                />
              </label>
            </div>
            <fieldset className="skills-fieldset">
              <legend>Focus skills</legend>
              <p className="muted">
                Choose up to two core skills. A concise summary is always
                included; prediction can replace the optional personal prompt.
                Uncheck a selected skill to choose a different one.
              </p>
              <div className="checkbox-grid">
                {SKILLS.map(([value, skillLabel]) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={creation.skills.includes(value)}
                      disabled={
                        !creation.skills.includes(value) &&
                        value !== "prediction" &&
                        creation.skills.filter(
                          (skill) => skill !== "prediction",
                        ).length >= 2
                      }
                      onChange={(event) =>
                        setCreation({
                          ...creation,
                          skills: event.target.checked
                            ? [...creation.skills, value]
                            : creation.skills.filter(
                                (skill) => skill !== value,
                              ),
                        })
                      }
                    />
                    {skillLabel}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="privacy-note">
              When OpenAI generation is enabled, reading profile settings, book
              details, progress, selected skills, and any notes you add are sent
              to our AI service and OpenAI to create prompts. The child’s name
              is not sent to OpenAI.
            </p>
            <div className="form-actions">
              <span className="privacy-note">
                Book text is never downloaded or scraped.
              </span>
              <button
                type="submit"
                className="primary-button"
                disabled={generating}
              >
                {generating
                  ? "Creating thoughtful prompts…"
                  : "Generate 4 prompts"}
              </button>
            </div>
          </form>
        </main>
      )}

      {screen === "review" && workingSession && (
        <main className="page page--review" tabIndex={-1}>
          <div className="review-header">
            <div>
              <p className="eyebrow">PROMPT REVIEW</p>
              <h1>Shape the worksheet before it reaches the printer.</h1>
              <p>
                Edit, reorder, regenerate, or remove anything that does not fit.
              </p>
            </div>
            <div className="review-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setScreen("create")}
              >
                Edit book details
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => saveWorkingSession("preview")}
                disabled={!workingSession.prompts.length}
              >
                Save & preview
              </button>
            </div>
          </div>
          <PromptEditor
            prompts={workingSession.prompts}
            onChange={(prompts) =>
              setWorkingSession({
                ...workingSession,
                prompts,
                updatedAt: now(),
              })
            }
            onRegenerate={regenerateOne}
            regeneratingIndex={regeneratingIndex}
          />
        </main>
      )}

      {screen === "preview" && workingSession && (
        <main className="preview-page" tabIndex={-1}>
          <div className="preview-toolbar no-print">
            <div>
              <p className="eyebrow">WORKSHEET PREVIEW</p>
              <h1>Ready for pen and paper</h1>
            </div>
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setScreen("review")}
              >
                Edit prompts
              </button>
              {exportExperience.printAvailable && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => window.print()}
                >
                  Print
                </button>
              )}
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleWorksheetExport()}
                disabled={exportingPdf}
              >
                {exportingPdf
                  ? "Preparing PDF…"
                  : exportExperience.primaryLabel}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={beginCreate}
              >
                Start over
              </button>
            </div>
          </div>
          <WorksheetPreview
            session={workingSession}
            onReviewResponse={(prompt) => {
              setResponseReviewPrompt(prompt);
              setError("");
              setNotice("");
              setScreen("response");
            }}
          />
        </main>
      )}

      {screen === "response" && workingSession && responseReviewPrompt && (
        <ResponseReview
          childSnapshot={workingSession.childSnapshot}
          prompt={responseReviewPrompt}
          onDone={() => {
            setResponseReviewPrompt(null);
            setScreen("preview");
          }}
        />
      )}

      {screen === "saved" && (
        <main className="page" tabIndex={-1}>
          <div className="page-intro">
            <p className="eyebrow">YOUR LIBRARY</p>
            <h1>Saved reflections</h1>
            <p>
              Reopen, reprint, or duplicate a worksheet without changing its
              original reading-profile snapshot.
            </p>
          </div>
          {pendingDeleteSession && (
            <section
              ref={deleteDialogRef}
              className="empty-card confirmation-dialog no-print"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-worksheet-title"
              aria-describedby="delete-worksheet-description"
              onKeyDown={(event) =>
                containDialogFocus(event, cancelDeleteSession)
              }
            >
              <h2 id="delete-worksheet-title">Delete this worksheet?</h2>
              <p id="delete-worksheet-description">
                “{pendingDeleteSession.book.title}” will be removed from this
                device. This cannot be undone.
              </p>
              <div className="card-actions">
                <button
                  ref={deleteConfirmRef}
                  type="button"
                  className="danger-button"
                  onClick={deleteSession}
                >
                  Delete worksheet
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelDeleteSession}
                >
                  Keep worksheet
                </button>
              </div>
            </section>
          )}
          <div className="filter-row">
            <label>
              Filter by child or book{" "}
              <input
                value={bookFilter}
                onChange={(event) => setBookFilter(event.target.value)}
                placeholder="Start typing a book title"
              />
            </label>
            <select
              aria-label="Filter by child"
              value={childFilter}
              onChange={(event) => setChildFilter(event.target.value)}
            >
              <option value="all">All children</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
              {deletedProfileFilters.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} (profile deleted)
                </option>
              ))}
            </select>
          </div>
          <div className="saved-grid">
            {filteredSessions.length ? (
              filteredSessions.map((session) => (
                <article className="saved-card" key={session.id}>
                  <p className="eyebrow">
                    {session.childSnapshot.name} ·{" "}
                    {session.childSnapshot.gradeOrAge}
                  </p>
                  <h2>{session.book.title}</h2>
                  <p>{session.book.author}</p>
                  <p className="muted">
                    {session.book.progress} ·{" "}
                    {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                  <span
                    className={[
                      "status-pill",
                      session.status === "completed"
                        ? "status-pill--required"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {
                      {
                        draft: "Draft",
                        ready: "Ready",
                        completed: "Completed",
                      }[session.status]
                    }
                  </span>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => loadSession(session, "preview")}
                    >
                      View & reprint
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => duplicateSession(session)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        updateSessionStatus(
                          session,
                          session.status === "completed"
                            ? "ready"
                            : "completed",
                        )
                      }
                    >
                      {session.status === "completed"
                        ? "Mark ready"
                        : "Mark completed"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={(event) =>
                        requestDeleteSession(session.id, event.currentTarget)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-card">
                <h2>No saved reflections yet</h2>
                <p>Create and save a worksheet to find it here.</p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={beginCreate}
                >
                  Create worksheet
                </button>
              </div>
            )}
          </div>
          <DataBackupPanel
            profiles={profiles}
            sessions={sessions}
            onImport={importBackupData}
          />
        </main>
      )}
    </div>
  );
}
