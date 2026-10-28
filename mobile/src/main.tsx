import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@capacitor/app";
import { AppShell } from "../../src/components/AppShell";
import { createMobilePromptFetch } from "./promptTransport";
import { installNativeBackHandler } from "./nativeBack";
import { installWorksheetExporter } from "@/pdf/worksheetExport";
import { nativeWorksheetExporter } from "./nativeWorksheetExport";
import { createMobilePersistence } from "./nativePersistence";
import { bootstrapMobileApplication } from "./bootstrap";
import { nativeResponsePhotoCapture } from "./nativeResponsePhotoCapture";
import { playIntegrityAttestation } from "./playIntegrityAttestation";
import "../../src/app/globals.css";

declare const __PROMPT_API_URL__: string;

window.fetch = createMobilePromptFetch(
  window.fetch.bind(window),
  __PROMPT_API_URL__,
  8_000,
  playIntegrityAttestation,
);

document.documentElement.dataset["nativeApp"] = "true";
installWorksheetExporter(nativeWorksheetExporter);
void installNativeBackHandler(App, window);

export async function startMobileApplication() {
  const root = document.getElementById("root");
  if (!root) throw new Error("Mobile application root is missing");
  await App.addListener("appRestoredResult", (event) => {
    void nativeResponsePhotoCapture.handleRestoredResult(event);
  });
  void playIntegrityAttestation.prepare().catch(() => undefined);
  await nativeResponsePhotoCapture.retryPendingCleanup();
  await bootstrapMobileApplication(
    () => createMobilePersistence(window.localStorage),
    (storage) =>
      createRoot(root).render(
        <StrictMode>
          <AppShell
            storage={storage}
            captureResponsePhoto={nativeResponsePhotoCapture.capture}
            subscribeToRestoredResponsePhoto={
              nativeResponsePhotoCapture.subscribe
            }
          />
        </StrictMode>,
      ),
  );
}

void startMobileApplication().catch(() => {
  const root = document.getElementById("root");
  if (root) {
    root.textContent =
      "Saved data could not be opened safely. Close and reopen the app. Your existing data has not been overwritten.";
  }
});
